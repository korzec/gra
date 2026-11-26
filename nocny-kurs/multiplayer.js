(() => {
  'use strict';
  const SERVER_URLS = { vercel: 'wss://sockets-korzecs-projects.vercel.app/ws', dwa: 'wss://gra.w.korzec-it.pl/ws' };
  const GAME = 'nocny-kurs';
  const PROBE_INTERVAL_MS = 4000;
  const PROBE_TIMEOUT_MS = 14000;
  const SNAPSHOT_TIMEOUT_MS = 9000;
  const CONNECT_TIMEOUT_MS = 12000;
  const el = id => document.getElementById(id);
  const t = (key, vars) => window.NocnyKursLocale.t(key, vars);
  const serverSetting = el('sockets-server');
  serverSetting?.addEventListener('change', () => {
    try { localStorage.setItem('sockets-server', serverSetting.value === 'dwa' ? 'dwa' : 'vercel'); } catch {}
  });
  function serverUrl() {
    let selected = 'vercel';
    try { selected = localStorage.getItem('sockets-server') === 'dwa' ? 'dwa' : 'vercel'; } catch {}
    return SERVER_URLS[selected];
  }

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
    let role = 'solo', socket = null, peerId = null, hostId = null, playerId = null;
    const DEDICATED_HOST_ID = 'nocny-kurs-server';
    let key = '', connected = false, ticker = null, joinTimeout = null, failed = false, inputTicks = 0;
    let retryTimer = null, healthTimer = null, connectTimer = null, attempt = 0, epoch = 0;
    let shuttingDown = false, reconnecting = false, lastAckAt = 0, lastSnapshotAt = 0;
    let probeId = 0, lastConfirmedProbe = 0;
    let compact = false;
    const wireReceiver = window.GameWire?.receiver();
    const wireInput = window.GameWire?.inputSender((data, binary) => binary ? sendRaw(data) : sendData(data));
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
    }
    window.NocnyKursLocale.onChange(refreshLanguage);

    const api = {
      get role() { return role; },
      get playerId() { return playerId; },
      get ready() { return connected; },
      setGameRunning() {},
      sendAction() {
        if (role === 'guest' && connected) sendData({ kind: 'interact' });
      }
    };

    function stopTimers() {
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

    function closeTransport(reason = '') {
      window.GamePerformanceNetwork?.reset(role !== 'solo');
      compact = false;
      wireReceiver?.reset();
      wireInput?.reset();
      epoch++;
      stopTimers();
      const old = socket;
      socket = null;
      try { old?.close(1000, reason); } catch {}
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
      const data = message instanceof Uint8Array ? message : JSON.stringify(message);
      if (socket?.readyState === WebSocket.OPEN) {
        window.NocnyKursTelemetry?.transfer('outbound', data);
        window.GamePerformanceNetwork?.transfer?.('outbound', data);
        socket.send(data);
      }
    }

    function sendData(payload) {
      if (!connected) return;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const message = { type: 'data', payload };
      if (JSON.stringify(message).length > 16000) {
        console.warn('Nocny Kurs: multiplayer payload exceeds relay limit');
        return;
      }
      sendRaw(message);
    }

    function sendInput(force = false) {
      const { aimAngle, ...controls } = callbacks.getInput();
      const input = { kind: 'input', ...controls };
      const hasAim = playerId === 1 && Number.isFinite(aimAngle);
      // Aim precedes the held input so the server can use it for the same shot.
      if (hasAim) sendData({ kind: 'aim', angle: aimAngle });
      const sent = wireInput ? wireInput.send(input, performance.now(), compact, force || hasAim) : (sendData(input), true);
      if (!sent) callbacks.onInputSuppressed?.(input.seq);
    }

    function connectionLost(statusKey = 'reconnecting') {
      if (shuttingDown || role === 'solo' || retryTimer !== null) return;
      connected = false;
      reconnecting = true;
      peerId = null;
      hostId = playerId = null;
      callbacks.onConnectionLost?.();
      closeTransport();
      setStatus(statusKey);
      setWaiting('reconnectingTitle', 'reconnectingCopy');
      const delay = Math.min(10000, 500 * 2 ** Math.min(attempt++, 5));
      retryTimer = setTimeout(() => {
        retryTimer = null;
        openTransport();
      }, delay * (.8 + Math.random() * .4));
    }

    function sendProbe() {
      const nonce = ++probeId;
      window.GamePerformanceNetwork?.sent(nonce);
      sendRaw({ type: 'probe', nonce });
    }

    function startHealth() {
      lastAckAt = performance.now();
      lastSnapshotAt = performance.now();
      if (healthTimer !== null) clearInterval(healthTimer);
      const currentEpoch = epoch;
      const probe = () => {
        if (currentEpoch !== epoch || shuttingDown || !peerId) return;
        if (document.hidden) return;
        const now = performance.now();
        if (now - lastAckAt > PROBE_TIMEOUT_MS ||
            (connected && now - lastSnapshotAt > SNAPSHOT_TIMEOUT_MS)) {
          connectionLost();
          return;
        }
        sendProbe();
      };
      healthTimer = setInterval(probe, PROBE_INTERVAL_MS);
      probe();
    }

    function sendTelemetry() {
      if (!connected) return;
      const sample = window.NocnyKursTelemetry?.flush('dedicated');
      if (sample) sendRaw(sample);
    }

    function onMessage(event) {
      window.NocnyKursTelemetry?.transfer('inbound', event.data);
      window.GamePerformanceNetwork?.transfer?.('inbound', event.data);
      let message;
      try {
        if (typeof event.data === 'string') message = JSON.parse(event.data);
        else if (compact && connected && wireReceiver) {
          const frame = wireReceiver.receive(event.data);
          if (!frame) return;
          message = { type: 'data', from: DEDICATED_HOST_ID, payload: frame.stream === 0
            ? { kind: 'snapshot', state: frame.state } : { kind: 'traces', traces: frame.state } };
        } else return;
      } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'probe_ack') {
        if (Number.isSafeInteger(message.nonce) && message.nonce > lastConfirmedProbe &&
            message.nonce <= probeId) {
          lastConfirmedProbe = message.nonce;
          lastAckAt = performance.now();
          window.GamePerformanceNetwork?.ack(message.nonce, message.serverVersion, message.transfer, message.connectedClients);
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
        compact = Boolean(wireReceiver && message.wire === window.GameWire.VERSION);
        window.GamePerformanceNetwork?.joined(message.serverVersion, message.connectedClients);
        if (connectTimer !== null) clearTimeout(connectTimer);
        connectTimer = null;
        reconnecting = false;
        attempt = 0;
        if (message.hostPeerId && message.hostPeerId !== DEDICATED_HOST_ID) {
          showError('rejectedByServer', { code: 'dedicated_server_required' });
          return;
        }
        // Only the server-owned simulation can authoritatively start the game.
        setStatus('waitingForHost');
        joinTimeout = setTimeout(() => connectionLost(), 10000);
        return;
      }
      if (message.type === 'peer_joined') {
        // Player-to-player host election is intentionally unsupported.
        return;
      }
      if (message.type === 'peer_left') {
        // The authoritative server is not a peer WebSocket in this room.
        return;
      }
      if (message.type !== 'data' || !message.payload || typeof message.payload !== 'object') return;
      const payload = message.payload;
      if (payload.kind === 'welcome' && payload.to === peerId && !hostId && message.from === DEDICATED_HOST_ID && Number.isInteger(payload.playerId) && payload.playerId>=1 && payload.playerId<=8) {
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
          if (document.hidden) return;
          sendInput();
          if (++inputTicks % 120 === 0) {
            sendData({ kind: 'ping', sentAt: performance.now() });
          }
          if (inputTicks % 1800 === 0) sendTelemetry();
        }, 1000 / 60);
        startHealth();
        return;
      }
      if (payload.kind === 'rejected' && payload.to === peerId && message.from === DEDICATED_HOST_ID) {
        showError(payload.reasonCode === 'roomFull' ? 'roomFull' : 'joinRejected');
        return;
      }
      if (payload.kind === 'pong' && message.from === hostId && payload.to === peerId &&
          Number.isFinite(payload.sentAt)) {
        const rttMs = performance.now() - payload.sentAt;
        callbacks.onLatency?.(rttMs);
        window.NocnyKursTelemetry?.rtt(rttMs);
      }
      if (payload.kind === 'traces' && message.from === hostId && connected) {
        callbacks.onTraces?.(payload.traces);
        return;
      }
      if (payload.kind === 'snapshot' && message.from === hostId && connected) {
        lastSnapshotAt = performance.now();
        window.NocnyKursTelemetry?.snapshot(lastSnapshotAt);
        callbacks.onSnapshot(payload.state);
      }
    }

    function openTransport() {
      if (shuttingDown || role === 'solo') return;
      window.GamePerformanceNetwork?.reset(true);
      const connectionEpoch = ++epoch;
      peerId = null;
      connected = false;
      // A TCP/WebSocket handshake can hang without ever emitting close.
      connectTimer = setTimeout(() => {
        if (connectionEpoch === epoch && !peerId) connectionLost();
      }, CONNECT_TIMEOUT_MS);
      setStatus(reconnecting ? 'reconnecting' : 'connectingServer');
      try {
        const next = new WebSocket(serverUrl());
        socket = next;
        next.binaryType = 'arraybuffer';
        next.addEventListener('open', () => {
          if (connectionEpoch !== epoch) return;
          sendRaw({ type: 'join', game: GAME, key: serverKey(key),
            role: 'dedicated', sessionId, ...(wireReceiver ? { wire: window.GameWire.VERSION } : {}) });
        });
        next.addEventListener('message', event => {
          if (connectionEpoch === epoch) onMessage(event);
        });
        next.addEventListener('error', () => {
          if (connectionEpoch === epoch) connectionLost();
        });
        next.addEventListener('close', event => {
          if (connectionEpoch !== epoch) return;
          if (event.code === 4002) connectionLost('roomIdle');
          else if (event.code === 4001) showError('connectionLost');
          else connectionLost();
        });
      } catch {
        if (connectionEpoch === epoch) connectionLost();
      }
    }

    function connect(nextKey) {
      if (role !== 'solo') return;
      role = 'guest';
      key = nextKey;
      panel.hidden = false;
      link.value = location.href.split('#')[0] + '#room=' + encodeURIComponent(key);
      roomKey.value = key;
      const code = el('gt-room-code');
      if (code) code.textContent = key;
      el('multiplayer-online').hidden = true;
      el('multiplayer-join-area').hidden = true;
      callbacks.onGuest();
      el('start').hidden = true;
      setWaiting('joiningRoom', 'joiningCopy');
      setStatus('connectingServer');
      openTransport();
    }

    el('multiplayer-online').addEventListener('click', () => {
      try { connect(randomKey()); }
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
      connect(parsed);
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
      const copyButton = el('multiplayer-copy');
      copyButton.classList.add('is-copied');
      setTimeout(() => copyButton.classList.remove('is-copied'), 1500);
    });
    el('multiplayer-leave').addEventListener('click', () => {
      shuttingDown = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = null;
      closeTransport('leave_room');
      location.href = location.href.split(/[?#]/)[0];
    });

    document.addEventListener?.('visibilitychange', () => {
      if (document.hidden || shuttingDown || role === 'solo') return;
      // Give queued messages time to arrive before applying foreground timeouts.
      lastAckAt = lastSnapshotAt = performance.now();
      if (connected && socket?.readyState === WebSocket.OPEN) {
        sendInput(true);
        sendProbe();
      }
    });

    const supplied = new URLSearchParams(location.hash.replace(/^#/, '')).get('room');
    if (supplied) {
      const parsed = parseKey(supplied);
      if (parsed) connect(parsed);
      else setWaiting('invalidLink', 'invalidLinkCopy');
    }
    return api;
  }

  window.NocnyKursMultiplayer = { create, parseKey };
})();
