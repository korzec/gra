(() => {
  'use strict';
  const SERVER = 'wss://gra.w.korzec-it.pl/ws';
  const GAME = 'nocny-kurs';
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
    let key = '', connected = false, ticker = null, joinTimeout = null, failed = false, gameRunning = false, hostWorker = null, inputTicks = 0, traceTicks = 0;
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
      ticker = joinTimeout = null;
    }

    function setStatus(key, vars = {}) {
      statusMessage = { key, vars };
      status.textContent = t(key, vars);
    }

    function setWaiting(title, copy, error = null) {
      waitingMessage = { title, copy, error };
      refreshLanguage();
      overlay.classList.remove('hidden');
    }

    function showError(key, vars = {}) {
      if (failed) return;
      failed = true;
      connected = false;
      stopTimers();
      setStatus(key, vars);
      if (role === 'guest') setWaiting('connectionLost', 'connectionLostCopy', { key, vars });
      socket?.close();
    }

    function sendData(payload) {
      if (!connected) return;
      if (!hostWorker && (!socket || socket.readyState !== WebSocket.OPEN)) return;
      const message = JSON.stringify({ type: 'data', payload });
      if (message.length > 16000) {
        console.warn('Nocny Kurs: multiplayer payload exceeds relay limit');
        return;
      }
      if (hostWorker) hostWorker.postMessage({ type: 'send', data: message });
      else socket.send(message);
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

    function onMessage(event) {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'error') {
        showError('rejectedByServer', { code: String(message.code || t('genericError')) });
        return;
      }
      if (message.type === 'joined') {
        peerId = message.peerId;
        if (role === 'host') {
          connected = true;
          setStatus('roomActive');
          // The dedicated host worker schedules 60 snapshots/s. Only use a
          // page timer in browsers without Web Worker support.
          if (!hostWorker) {
            ticker = setInterval(sendSnapshot, 1000 / 60);
            sendSnapshot();
          }
        } else {
          expectedHostId = Array.isArray(message.peers) ? message.peers[0] || null : null;
          setStatus('waitingForHost');
          joinTimeout = setTimeout(() => {
            showError('noHost');
          }, 7000);
        }
        return;
      }
      if (message.type === 'peer_joined' && role === 'host' && connected) {
        const id = callbacks.onPeerJoin(message.peerId);
        if (id === null || id === undefined) {
          sendData({ kind: 'rejected', to: message.peerId, reason: t('roomFull'), reasonCode: 'roomFull' });
        } else {
          sendData({ kind: 'welcome', to: message.peerId, hostId: peerId, playerId: id });
          sendTraces(); // New guests need old marks and remains too.
          setStatus('peerJoined');
        }
        return;
      }
      if (message.type === 'peer_left') {
        if (role === 'host') {
          callbacks.onPeerLeft(message.peerId);
          setStatus('peerLeft');
        } else if (role === 'guest' && message.peerId === hostId) {
          showError('hostLeft');
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
        setStatus('playingAs', { id: playerId });
        callbacks.onWelcome(playerId);
        ticker = setInterval(() => {
          sendData({ kind: 'input', ...callbacks.getInput() });
          if (++inputTicks % 120 === 0) {
            sendData({ kind: 'ping', sentAt: performance.now() });
          }
        }, 1000 / 60);
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
        callbacks.onSnapshot(payload.state);
      }
    }

    function openHostWorker() {
      if (typeof Worker === 'undefined') return false;
      try {
        const script = document.querySelector('script[src*="multiplayer.js"]');
        const workerURL = new URL('host-worker.js', script?.src || location.href);
        if (script?.src) workerURL.search = new URL(script.src).search;
        hostWorker = new Worker(workerURL.toString());
        hostWorker.onmessage = event => {
          const msg = event.data;
          if (msg?.type === 'snapshot_request') sendSnapshot();
          else if (msg?.type === 'message') onMessage({ data: msg.data });
          else if (msg?.type === 'error') showError('socketError');
          else if (msg?.type === 'close' && !failed) showError('socketClosed');
        };
        hostWorker.onerror = () => showError('workerError');
        hostWorker.postMessage({ type: 'connect', url: SERVER, game: GAME, key: serverKey(key) });
        return true;
      } catch {
        hostWorker?.terminate();
        hostWorker = null;
        return false;
      }
    }

    function connect(nextRole, nextKey) {
      if (role !== 'solo') return;
      role = nextRole;
      key = nextKey;
      panel.hidden = false;
      link.value = location.href.split('#')[0] + '#room=' + encodeURIComponent(key);
      roomKey.value = key;
      el('multiplayer-host').hidden = true;
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
      // The host owns the listen-server connection in a dedicated worker.
      // Guests keep a direct socket; if workers are unavailable, use the
      // original page-based transport for host compatibility.
      if (nextRole === 'host' && openHostWorker()) return;
      try {
        socket = new WebSocket(SERVER);
        socket.addEventListener('open', () => {
          socket.send(JSON.stringify({ type: 'join', game: GAME, key: serverKey(key) }));
        });
        socket.addEventListener('message', onMessage);
        socket.addEventListener('error', () => showError('socketError'));
        socket.addEventListener('close', () => {
          if (!failed) showError('socketClosed');
        });
      } catch {
        showError('socketStartError');
      }
    }

    el('multiplayer-host').addEventListener('click', () => {
      try { connect('host', randomKey()); }
      catch { setWaiting('errorTitle','keyGenerationError'); }
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
      stopTimers();
      socket?.close(1000);
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
