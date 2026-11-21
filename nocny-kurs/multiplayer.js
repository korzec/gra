(() => {
  'use strict';
  const SERVER = 'wss://gra.w.korzec-it.pl/ws';
  const GAME = 'nocny-kurs';
  const PROBE_INTERVAL_MS = 4000;
  const PROBE_TIMEOUT_MS = 14000;
  const SNAPSHOT_TIMEOUT_MS = 9000;
  const CONNECT_TIMEOUT_MS = 12000;
  const el = id => document.getElementById(id);
  const t = (key, vars) => window.NocnyKursLocale.t(key, vars);

  function parseKey(value) {
    let key = value.trim();
    try {
      if (/^https?:\/\//i.test(key)) key = new URL(key).hash;
      if (key.startsWith('#')) key = new URLSearchParams(key.slice(1)).get('room') || '';
    } catch { return ''; }
    if (/^[a-z]{6}$/i.test(key)) return key.toUpperCase();
    // Preserve links issued before six-letter room codes.
    return /^[A-Za-z0-9_-]{16,256}$/.test(key) ? key : '';
  }

  function randomKey() {
    // 234 is the largest multiple of 26 below 256; avoid modulo bias.
    let key = '';
    while (key.length < 6) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      for (const byte of bytes) {
        if (byte < 234) key += String.fromCharCode(65 + byte % 26);
        if (key.length === 6) break;
      }
    }
    return key;
  }

  function serverKey(key) {
    // The relay requires >=16 characters. Use a stable, namespaced expansion
    // of the display code; it does not increase the entropy of six letters.
    return /^[A-Z]{6}$/.test(key) ? 'nocny-kurs-room-v1-' + key : key;
  }

  function create(callbacks) {
    let role = 'solo', socket = null, peerId = null, hostId = null, expectedHostId = null, playerId = null;
    let key = '', dedicatedRoom = false, connected = false, ticker = null, joinTimeout = null, failed = false, gameRunning = false, hostWorker = null, inputTicks = 0, traceTicks = 0;
    let retryTimer = null, healthTimer = null, connectTimer = null, attempt = 0, epoch = 0;
    let shuttingDown = false, reconnecting = false, lastAckAt = 0, lastSnapshotAt = 0;
    let probeId = 0, lastConfirmedProbe = 0;
    const activePeers = new Set();
    // Private to this page, preserved across reconnects but never broadcast.
    const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(18)),
      byte => byte.toString(16).padStart(2, '0')).join('');
    const panel = el('multiplayer-room');
    const link = el('multiplayer-link');
    const roomKey = el('multiplayer-room-key');
    const status = el('multiplayer-status');
    const overlay = el('overlay');
    let statusMessage = { key: 'connecting', vars: {} };
    let waitingMessage = null;

    function refreshLanguage() {
      status.textContent = t(statusMessage.key, statusMessage.vars);
      if (waitingMessage) {
        el('overlay-title').textContent = t(waitingMessage.title);
        el('overlay-copy').textContent = waitingMessage.error
          ? t('connectionLostCopy', { error: t(waitingMessage.error.key, waitingMessage.error.vars) })
          : t(waitingMessage.copy);
      }
      if (role === 'host') el('start').textContent = t('replay');
    }
    window.NocnyKursLocale.onChange(refreshLanguage);

    const api = {
      get role() { return role; },
      get playerId() { return playerId; },
      get ready() { return connected; },
      setGameRunning(next) {
        gameRunning = Boolean(next);
      },
      sendAction() {
        if (role === 'guest' && connected) sendData({ kind: 'interact' });
      }
    };

    function stopTimers() {
      if (hostWorker) {
        hostWorker.terminate();
        hostWorker = null;
      }
      if (ticker !== null) clearInterval(ticker);
      if (joinTimeout !== null) clearTimeout(joinTimeout);
      if (healthTimer !== null) clearInterval(healthTimer);
      if (connectTimer !== null) clearTimeout(connectTimer);
      ticker = joinTimeout = healthTimer = connectTimer = null;
    }

    function setStatus(key, vars = {}) {
      statusMessage = { key, vars };
      status.textContent = t(key, vars);
      if (reconnecting) status.classList.add('is-disconnected');
      else status.classList.remove('is-disconnected');
    }

    function setWaiting(title, copy, error = null) {
      waitingMessage = { title, copy, error };
      refreshLanguage();
      overlay.classList.remove('hidden');
    }

    function closeTransport() {
      epoch++;
      stopTimers();
      const old = socket;
      socket = null;
      try { old?.close(1000); } catch {}
    }

    function showError(key, vars = {}) {
      if (failed) return;
      failed = true;
      shuttingDown = true;
      connected = false;
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = null;
      closeTransport();
      setStatus(key, vars);
      status.classList.add('is-disconnected');
      if (role === 'guest') setWaiting('connectionLost', 'connectionLostCopy', { key, vars });
    }

    function sendRaw(message) {
      const data = JSON.stringify(message);
      if (hostWorker) hostWorker.postMessage({ type: 'send', data });
      else if (socket?.readyState === WebSocket.OPEN) socket.send(data);
    }

    function sendData(payload) {
      if (!connected) return;
      if (!hostWorker && (!socket || socket.readyState !== WebSocket.OPEN)) return;
      const message = { type: 'data', payload };
      if (JSON.stringify(message).length > 16000) {
        console.warn('Nocny Kurs: multiplayer payload exceeds relay limit');
        return;
      }
      sendRaw(message);
    }

    function connectionLost() {
      if (shuttingDown || role === 'solo' || retryTimer !== null) return;
      connected = false;
      reconnecting = true;
      peerId = null;
      if (role === 'host') {
        for (const id of activePeers) callbacks.onPeerLeft(id);
        activePeers.clear();
      } else {
        hostId = expectedHostId = playerId = null;
      }
      callbacks.onConnectionLost?.();
      closeTransport();
      setStatus('reconnecting');
      if (role === 'guest') setWaiting('reconnectingTitle', 'reconnectingCopy');
      const delay = Math.min(10000, 500 * 2 ** Math.min(attempt++, 5));
      retryTimer = setTimeout(() => {
        retryTimer = null;
        openTransport();
      }, delay * (.8 + Math.random() * .4));
    }

    function startHealth() {
      lastAckAt = performance.now();
      lastSnapshotAt = performance.now();
      if (healthTimer !== null) clearInterval(healthTimer);
      const currentEpoch = epoch;
      const probe = () => {
        if (currentEpoch !== epoch || shuttingDown || !peerId) return;
        const now = performance.now();
        if (now - lastAckAt > PROBE_TIMEOUT_MS ||
            (role === 'guest' && connected && now - lastSnapshotAt > SNAPSHOT_TIMEOUT_MS)) {
          connectionLost();
          return;
        }
        sendRaw({ type: 'probe', nonce: ++probeId });
      };
      healthTimer = setInterval(probe, PROBE_INTERVAL_MS);
      probe();
    }

    function sendTraces() {
      if (role !== 'host' || !connected || !callbacks.makeTraces) return;
      sendData({ kind: 'traces', traces: callbacks.makeTraces() });
    }

    function sendSnapshot() {
      if (role !== 'host' || !connected) return;
      const state = callbacks.makeSnapshot();
      // The relay enforces a 16 KiB payload. Drop visual-only effects first.
      const packet = { kind: 'snapshot', state };
      for (const field of ['muzzleFlashes', 'explosions', 'bullets']) {
        if (JSON.stringify({ type: 'data', payload: packet }).length <= 14500) break;
        state[field] = [];
      }
      sendData(packet);
      // 10 trace syncs/s + 60 snapshots/s stay below the relay's 100 msg/s cap.
      if (++traceTicks % 6 === 0) sendTraces();
    }

    function admitPeer(id) {
      if (typeof id !== 'string' || !id || activePeers.has(id)) return;
      const playerId = callbacks.onPeerJoin(id);
      if (playerId === null || playerId === undefined) {
        sendData({ kind: 'rejected', to: id, reason: t('roomFull'), reasonCode: 'roomFull' });
        return;
      }
      activePeers.add(id);
      sendData({ kind: 'welcome', to: id, hostId: peerId, playerId });
      sendTraces();
      setStatus('peerJoined');
    }

    function onMessage(event) {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'probe_ack') {
        if (Number.isSafeInteger(message.nonce) && message.nonce > lastConfirmedProbe &&
            message.nonce <= probeId) {
          lastConfirmedProbe = message.nonce;
          lastAckAt = performance.now();
        }
        return;
      }
      if (message.type === 'error') {
        if (['rate_limited', 'join_timeout', 'server_busy'].includes(message.code)) connectionLost();
        else showError('rejectedByServer', { code: String(message.code || t('genericError')) });
        return;
      }
      if (message.type === 'joined') {
        if (typeof message.peerId !== 'string' || !message.peerId) return;
        peerId = message.peerId;
        if (connectTimer !== null) clearTimeout(connectTimer);
        connectTimer = null;
        reconnecting = false;
        attempt = 0;
        if (role === 'host') {
          if (message.hostPeerId && message.hostPeerId !== peerId) {
            showError('rejectedByServer', { code: 'host_already_connected' });
            return;
          }
          connected = true;
          setStatus('roomActive');
          // A guest might reconnect before the host. Admit guests already in
          // the room, not only those arriving after this joined packet.
          for (const existing of Array.isArray(message.peers) ? message.peers : []) {
            if (typeof existing === 'string' && existing !== peerId) admitPeer(existing);
          }
          // The dedicated host worker schedules 60 snapshots/s. Only use a
          // page timer in browsers without Web Worker support.
          if (!hostWorker) {
            ticker = setInterval(sendSnapshot, 1000 / 60);
            sendSnapshot();
          }
          startHealth();
        } else {
          expectedHostId = typeof message.hostPeerId === 'string' && message.hostPeerId
            ? message.hostPeerId
            : (Array.isArray(message.peers) ? message.peers[0] || null : null);
          setStatus('waitingForHost');
          joinTimeout = setTimeout(() => connectionLost(), 10000);
        }
        return;
      }
      if (message.type === 'peer_joined') {
        if (role === 'host' && connected) admitPeer(message.peerId);
        else if (role === 'guest' && !hostId && message.isHost === true) {
          expectedHostId = message.peerId;
        }
        return;
      }
      if (message.type === 'peer_left') {
        if (role === 'host' && activePeers.delete(message.peerId)) {
          callbacks.onPeerLeft(message.peerId);
          setStatus('peerLeft');
        } else if (role === 'guest' && (message.peerId === hostId ||
            message.peerId === expectedHostId)) {
          connectionLost();
        }
        return;
      }
      if (message.type !== 'data' || !message.payload || typeof message.payload !== 'object') return;
      const payload = message.payload;
      if (role === 'host') {
        if (payload.kind === 'input') callbacks.onInput(message.from, payload);
        if (payload.kind === 'interact') callbacks.onInteract(message.from);
        if (payload.kind === 'ping' && Number.isFinite(payload.sentAt)) {
          sendData({ kind: 'pong', to: message.from, sentAt: payload.sentAt });
        }
        return;
      }
      if (role !== 'guest') return;
      if (payload.kind === 'welcome' && payload.to === peerId && !hostId && message.from === expectedHostId && Number.isInteger(payload.playerId) && payload.playerId>=1 && payload.playerId<=8) {
        hostId = message.from;
        playerId = payload.playerId;
        connected = true;
        if (joinTimeout !== null) clearTimeout(joinTimeout);
        joinTimeout = null;
        lastSnapshotAt = performance.now();
        reconnecting = false;
        setStatus('playingAs', { id: playerId });
        callbacks.onWelcome(playerId);
        ticker = setInterval(() => {
          sendData({ kind: 'input', ...callbacks.getInput() });
          if (++inputTicks % 120 === 0) {
            sendData({ kind: 'ping', sentAt: performance.now() });
          }
        }, 1000 / 60);
        startHealth();
        return;
      }
      if (payload.kind === 'rejected' && payload.to === peerId && message.from === expectedHostId) {
        showError(payload.reasonCode === 'roomFull' ? 'roomFull' : 'joinRejected');
        return;
      }
      if (payload.kind === 'pong' && message.from === hostId && payload.to === peerId &&
          Number.isFinite(payload.sentAt)) {
        callbacks.onLatency?.(performance.now() - payload.sentAt);
      }
      if (payload.kind === 'traces' && message.from === hostId && connected) {
        callbacks.onTraces?.(payload.traces);
        return;
      }
      if (payload.kind === 'snapshot' && message.from === hostId && connected) {
        lastSnapshotAt = performance.now();
        callbacks.onSnapshot(payload.state);
      }
    }

    function openHostWorker(connectionEpoch) {
      if (typeof Worker === 'undefined') return false;
      try {
        const script = document.querySelector('script[src*="multiplayer.js"]');
        const workerURL = new URL('host-worker.js', script?.src || location.href);
        if (script?.src) workerURL.search = new URL(script.src).search;
        hostWorker = new Worker(workerURL.toString());
        hostWorker.onmessage = event => {
          if (connectionEpoch !== epoch || shuttingDown) return;
          const msg = event.data;
          if (msg?.type === 'snapshot_request') sendSnapshot();
          else if (msg?.type === 'message') onMessage({ data: msg.data });
          else if (msg?.type === 'error' || msg?.type === 'close') connectionLost();
        };
        hostWorker.onerror = () => {
          if (connectionEpoch === epoch) connectionLost();
        };
        hostWorker.postMessage({
          type: 'connect', url: SERVER, game: GAME, key: serverKey(key),
          role: 'host', sessionId
        });
        return true;
      } catch {
        hostWorker?.terminate();
        hostWorker = null;
        return false;
      }
    }

    function openTransport() {
      if (shuttingDown || role === 'solo') return;
      const connectionEpoch = ++epoch;
      peerId = null;
      connected = false;
      // A TCP/WebSocket handshake can hang without ever emitting close.
      connectTimer = setTimeout(() => {
        if (connectionEpoch === epoch && !peerId) connectionLost();
      }, CONNECT_TIMEOUT_MS);
      setStatus(reconnecting ? 'reconnecting' : 'connectingServer');
      // Host WebSocket stays in a Worker, falling back to the page socket.
      if (role === 'host' && openHostWorker(connectionEpoch)) return;
      try {
        const next = new WebSocket(SERVER);
        socket = next;
        next.addEventListener('open', () => {
          if (connectionEpoch !== epoch) return;
          next.send(JSON.stringify({
            type: 'join', game: GAME, key: serverKey(key),
            role: dedicatedRoom ? 'dedicated' : role, sessionId
          }));
        });
        next.addEventListener('message', event => {
          if (connectionEpoch === epoch) onMessage(event);
        });
        next.addEventListener('error', () => {
          if (connectionEpoch === epoch) connectionLost();
        });
        next.addEventListener('close', () => {
          if (connectionEpoch === epoch) connectionLost();
        });
      } catch {
        if (connectionEpoch === epoch) connectionLost();
      }
    }

    function connect(nextRole, nextKey, serverHosted = false) {
      if (role !== 'solo') return;
      dedicatedRoom = serverHosted;
      role = nextRole;
      key = nextKey;
      panel.hidden = false;
      link.value = location.href.split('#')[0] + '#room=' + encodeURIComponent(key);
      roomKey.value = key;
      el('multiplayer-host').hidden = true;
      el('multiplayer-dedicated').hidden = true;
      el('multiplayer-join-area').hidden = true;
      if (nextRole === 'host') {
        callbacks.onHost();
        setStatus('connectingServer');
        el('start').textContent = t('replay');
      } else {
        callbacks.onGuest();
        el('start').hidden = true;
        setWaiting('joiningRoom', 'joiningCopy');
        setStatus('connectingServer');
      }
      openTransport();
    }

    el('multiplayer-host').addEventListener('click', () => {
      try { connect('host', randomKey()); }
      catch { setWaiting('errorTitle','keyGenerationError'); }
    });
    el('multiplayer-dedicated').addEventListener('click', () => {
      try { connect('guest', randomKey(), true); }
      catch { setWaiting('errorTitle', 'keyGenerationError'); }
    });
    const join = () => {
      const parsed = parseKey(el('multiplayer-key').value);
      if (!parsed) {
        el('multiplayer-key').setCustomValidity(t('invalidKey'));
        el('multiplayer-key').reportValidity();
        return;
      }
      el('multiplayer-key').setCustomValidity('');
      connect('guest', parsed);
    };
    el('multiplayer-join').addEventListener('click', join);
    el('multiplayer-key').addEventListener('input', () => el('multiplayer-key').setCustomValidity(''));
    el('multiplayer-key').addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); join(); }
    });
    el('multiplayer-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(link.value);
      } catch {
        // Clipboard API may be unavailable in insecure contexts or denied.
        const field = document.createElement('textarea');
        field.value = link.value;
        field.setAttribute('readonly', '');
        field.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) return;
      }
      setStatus('linkCopied');
    });
    el('multiplayer-leave').addEventListener('click', () => {
      shuttingDown = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = null;
      closeTransport();
      location.href = location.href.split(/[?#]/)[0];
    });

    const supplied = new URLSearchParams(location.hash.replace(/^#/, '')).get('room');
    if (supplied) {
      const parsed = parseKey(supplied);
      if (parsed) connect('guest', parsed);
      else setWaiting('invalidLink', 'invalidLinkCopy');
    }
    return api;
  }

  window.NocnyKursMultiplayer = { create, parseKey };
})();
