(() => {
  'use strict';

  // The listen-server transport runs in a dedicated Web Worker, rather than a
  // service worker (which the browser is free to terminate between events).
  const SNAPSHOT_HZ = 60; // Production relay allows 100 outgoing messages/second.
  const MAX_MESSAGE_LENGTH = 16000;
  const MAX_BUFFERED_BYTES = 256 * 1024;
  let socket = null;
  let snapshotTimer = null;

  function stopTicker() {
    if (snapshotTimer !== null) clearInterval(snapshotTimer);
    snapshotTimer = null;
  }

  function requestSnapshot() {
    if (socket?.readyState === WebSocket.OPEN &&
        socket.bufferedAmount < MAX_BUFFERED_BYTES) {
      self.postMessage({ type: 'snapshot_request' });
    }
  }

  function startTicker() {
    if (snapshotTimer !== null) return;
    snapshotTimer = setInterval(requestSnapshot, 1000 / SNAPSHOT_HZ);
    requestSnapshot();
  }

  self.onmessage = event => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;

    if (message.type === 'connect') {
      if (socket) return;
      try {
        socket = new WebSocket(message.url);
        socket.addEventListener('open', () => {
          socket.send(JSON.stringify({ type: 'join', game: message.game, key: message.key, role: message.role, sessionId: message.sessionId }));
        });
        socket.addEventListener('message', incoming => {
          // Keep room protocol/host authorization in multiplayer.js.
          try {
            if (JSON.parse(incoming.data)?.type === 'joined') startTicker();
          } catch { /* main-thread protocol handler will ignore malformed JSON */ }
          self.postMessage({ type: 'message', data: incoming.data });
        });
        socket.addEventListener('error', () => {
          stopTicker();
          self.postMessage({ type: 'error' });
        });
        socket.addEventListener('close', () => {
          stopTicker();
          self.postMessage({ type: 'close' });
          socket = null;
        });
      } catch {
        stopTicker();
        self.postMessage({ type: 'error' });
      }
      return;
    }

    if (message.type === 'send' && socket?.readyState === WebSocket.OPEN &&
        typeof message.data === 'string' &&
        message.data.length <= MAX_MESSAGE_LENGTH &&
        socket.bufferedAmount < MAX_BUFFERED_BYTES) {
      socket.send(message.data);
    }

    if (message.type === 'close') {
      stopTicker();
      socket?.close(1000);
      socket = null;
    }
  };
})();
