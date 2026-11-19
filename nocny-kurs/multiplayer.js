(() => {
  'use strict';
  const SERVER = 'wss://gra.w.korzec-it.pl/ws';
  const GAME = 'nocny-kurs';
  const el = id => document.getElementById(id);

  function parseKey(value) {
    let key = value.trim();
    try {
      if (/^https?:\/\//i.test(key)) key = new URL(key).hash;
      if (key.startsWith('#')) key = new URLSearchParams(key.slice(1)).get('room') || '';
    } catch { return ''; }
    return /^[A-Za-z0-9_-]{16,256}$/.test(key) ? key : '';
  }

  function randomKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function create(callbacks) {
    let role = 'solo', socket = null, peerId = null, hostId = null, playerId = null;
    let key = '', connected = false, ticker = null, joinTimeout = null, failed = false;
    const panel = el('multiplayer-room');
    const link = el('multiplayer-link');
    const roomKey = el('multiplayer-room-key');
    const status = el('multiplayer-status');
    const overlay = el('overlay');

    const api = {
      get role() { return role; },
      get playerId() { return playerId; },
      get ready() { return connected; },
      sendAction() {
        if (role === 'guest' && connected) sendData({ kind: 'interact' });
      }
    };

    function stopTimers() {
      if (ticker !== null) clearInterval(ticker);
      if (joinTimeout !== null) clearTimeout(joinTimeout);
      ticker = joinTimeout = null;
    }

    function setStatus(message) {
      status.textContent = message;
    }

    function setWaiting(title, copy) {
      el('overlay-title').textContent = title;
      el('overlay-copy').textContent = copy;
      overlay.classList.remove('hidden');
    }

    function showError(message) {
      if (failed) return;
      failed = true;
      connected = false;
      stopTimers();
      setStatus(message);
      if (role === 'guest') setWaiting('Połączenie przerwane', message + ' Odśwież stronę lub rozłącz się.');
      socket?.close();
    }

    function sendData(payload) {
      if (!connected || !socket || socket.readyState !== WebSocket.OPEN) return;
      const message = JSON.stringify({ type: 'data', payload });
      if (message.length > 16000) {
        console.warn('Nocny Kurs: multiplayer payload exceeds relay limit');
        return;
      }
      socket.send(message);
    }

    function sendSnapshot() {
      if (role !== 'host' || !connected) return;
      sendData({ kind: 'snapshot', state: callbacks.makeSnapshot() });
    }

    function onMessage(event) {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'error') {
        showError('Serwer odrzucił połączenie: ' + String(message.code || 'błąd'));
        return;
      }
      if (message.type === 'joined') {
        peerId = message.peerId;
        if (role === 'host') {
          connected = true;
          setStatus('Pokój aktywny · czekam na graczy');
          ticker = setInterval(sendSnapshot, 125);
          sendSnapshot();
        } else {
          setStatus('Połączono · czekam na gospodarza');
          joinTimeout = setTimeout(() => {
            showError('W tym pokoju nie ma aktywnego gospodarza.');
          }, 7000);
        }
        return;
      }
      if (message.type === 'peer_joined' && role === 'host' && connected) {
        const id = callbacks.onPeerJoin(message.peerId);
        if (id === null || id === undefined) {
          sendData({ kind: 'rejected', to: message.peerId, reason: 'Pokój jest pełny (8 graczy).' });
        } else {
          sendData({ kind: 'welcome', to: message.peerId, hostId: peerId, playerId: id });
          sendSnapshot();
          setStatus('Pokój aktywny · gracz dołączył');
        }
        return;
      }
      if (message.type === 'peer_left') {
        if (role === 'host') {
          callbacks.onPeerLeft(message.peerId);
          setStatus('Pokój aktywny · gracz wyszedł');
        } else if (role === 'guest' && message.peerId === hostId) {
          showError('Gospodarz opuścił pokój.');
        }
        return;
      }
      if (message.type !== 'data' || !message.payload || typeof message.payload !== 'object') return;
      const payload = message.payload;
      if (role === 'host') {
        if (payload.kind === 'input') callbacks.onInput(message.from, payload);
        if (payload.kind === 'interact') callbacks.onInteract(message.from);
        return;
      }
      if (role !== 'guest') return;
      if (payload.kind === 'welcome' && payload.to === peerId && !hostId) {
        hostId = message.from;
        playerId = payload.playerId;
        connected = true;
        if (joinTimeout !== null) clearTimeout(joinTimeout);
        joinTimeout = null;
        setStatus('Połączono · grasz jako P' + playerId);
        callbacks.onWelcome(playerId);
        ticker = setInterval(() => {
          sendData({ kind: 'input', ...callbacks.getInput() });
        }, 85);
        return;
      }
      if (payload.kind === 'rejected' && payload.to === peerId) {
        showError(String(payload.reason || 'Odmowa dołączenia.'));
        return;
      }
      if (payload.kind === 'snapshot' && message.from === hostId && connected) {
        callbacks.onSnapshot(payload.state);
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
        setStatus('Łączenie z serwerem...');
        el('start').textContent = 'Zacznij grę ↗';
      } else {
        callbacks.onGuest();
        el('start').hidden = true;
        setWaiting('Dołączanie do pokoju', 'Czekam na gospodarza i synchronizację gry.');
        setStatus('Łączenie z serwerem...');
      }
      try {
        socket = new WebSocket(SERVER);
        socket.addEventListener('open', () => {
          socket.send(JSON.stringify({ type: 'join', game: GAME, key }));
        });
        socket.addEventListener('message', onMessage);
        socket.addEventListener('error', () => showError('Nie można połączyć się z serwerem WebSocket.'));
        socket.addEventListener('close', () => {
          if (!failed) showError('Utracono połączenie z serwerem WebSocket.');
        });
      } catch {
        showError('Nie można uruchomić połączenia WebSocket.');
      }
    }

    el('multiplayer-host').addEventListener('click', () => {
      try { connect('host', randomKey()); }
      catch { setWaiting('Błąd', 'Przeglądarka nie obsługuje bezpiecznego generatora kluczy.'); }
    });
    const join = () => {
      const parsed = parseKey(el('multiplayer-key').value);
      if (!parsed) {
        el('multiplayer-key').setCustomValidity('Wklej klucz pokoju (minimum 16 znaków) lub link.');
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
        link.focus();
        link.select();
        document.execCommand('copy');
      }
      setStatus('Link skopiowany · przekaż go znajomym');
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
      else setWaiting('Nieprawidłowy link', 'Klucz pokoju w linku jest nieprawidłowy.');
    }
    return api;
  }

  window.NocnyKursMultiplayer = { create, parseKey };
})();
