(() => {
  "use strict";
  // Only a preloaded in-page test harness can override this endpoint.
  const SERVER = typeof window.__MIKRO_SPRINT_WS_URL__ === "string"
    ? window.__MIKRO_SPRINT_WS_URL__ : "wss://sockets-korzecs-projects.vercel.app/ws";
  const GAME = "mikro-sprint";
  const HOST = "mikro-sprint-server";
  const PROBE_MS = 4000, ACK_TIMEOUT_MS = 14000, SNAPSHOT_TIMEOUT_MS = 9000;
  const $ = id => document.getElementById(id);

  function parseRoom(value) {
    let token = value.trim();
    try {
      if (/^https?:\/\//i.test(token)) token = new URL(token).hash;
      if (token.startsWith("#")) token = new URLSearchParams(token.slice(1)).get("room") || "";
    } catch { return ""; }
    if (/^[a-z]{6}$/i.test(token)) return token.toUpperCase();
    return /^[A-Za-z0-9_-]{16,256}$/.test(token) ? token : "";
  }
  function generateRoom() {
    // Six letters, matching the invite UX of Nocny Kurs. Rejection sampling
    // prevents bias when mapping cryptographic random bytes onto A-Z.
    let token = "";
    while (token.length < 6) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      for (const byte of bytes) {
        if (byte < 234) token += String.fromCharCode(65 + byte % 26);
        if (token.length === 6) break;
      }
    }
    return token;
  }
  const serverKey = token => /^[A-Z]{6}$/.test(token) ? "mikro-sprint-room-v1-" + token : token;
  const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(18)),
    byte => byte.toString(16).padStart(2, "0")).join("");

  function create(callbacks) {
    let active = false, ready = false, socket = null, peerId = null, playerId = null;
    let key = "", track = "pool", botCount = 3, epoch = 0, attempt = 0, seqProbe = 0, confirmedProbe = 0;
    let closed = false, reconnectTimer = null, connectTimer = null, healthTimer = null;
    let lastAck = 0, lastSnapshot = 0, statusText = "";
    const roomPanel = $("online-room");
    const roomCode = $("online-room-code");
    const status = $("online-status");
    const overlay = $("overlay");
    const createButton = $("online-create");
    const joinButton = $("online-join");
    const joinInput = $("online-key");
    const joinControls = $("online-start-controls");

    const t = message => window.MikroSprintLocale?.t(message) ?? message;
    const write = (node, message, property = "textContent") => {
      if (window.MikroSprintLocale) window.MikroSprintLocale.write(node, message, {}, property);
      else node[property] = message;
    };
    function statusMessage(message) {
      statusText = message;
      write(status, message);
      status.hidden = !message;
      callbacks.onStatus?.(message);
    }
    const send = packet => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(packet));
    };
    function stopTimers() {
      if (connectTimer !== null) clearTimeout(connectTimer);
      if (healthTimer !== null) clearInterval(healthTimer);
      connectTimer = healthTimer = null;
    }
    function closeSocket() {
      epoch++;
      stopTimers();
      const old = socket;
      socket = null;
      if (old) try { old.close(1000); } catch {}
    }
    function disconnect(reason, retry = true) {
      if (!active || closed) return;
      if (!retry) {
        closeSocket();
        ready = false;
        statusMessage(reason);
        callbacks.onLost?.(reason);
        return;
      }
      if (reconnectTimer !== null) return;
      ready = false;
      peerId = playerId = null;
      callbacks.onLost?.(reason);
      closeSocket();
      statusMessage(reason + " — ponawianie połączenia");
      const delay = Math.min(10000, 500 * 2 ** Math.min(attempt++, 5));
      reconnectTimer = setTimeout(() => { reconnectTimer = null; open(); }, delay);
    }
    function startHealth() {
      lastAck = lastSnapshot = performance.now();
      if (healthTimer !== null) clearInterval(healthTimer);
      const currentEpoch = epoch;
      const probe = () => {
        if (currentEpoch !== epoch || !active || closed || !peerId) return;
        const now = performance.now();
        if (now - lastAck > ACK_TIMEOUT_MS ||
            (ready && now - lastSnapshot > SNAPSHOT_TIMEOUT_MS)) {
          disconnect("Utracono kontakt z serwerem");
          return;
        }
        send({ type: "probe", nonce: ++seqProbe });
      };
      healthTimer = setInterval(probe, PROBE_MS);
      probe();
    }
    function receive(event) {
      let packet;
      try { packet = JSON.parse(event.data); } catch { return; }
      if (!packet || typeof packet !== "object") return;
      if (packet.type === "probe_ack") {
        if (Number.isSafeInteger(packet.nonce) && packet.nonce > confirmedProbe &&
            packet.nonce <= seqProbe) {
          confirmedProbe = packet.nonce;
          lastAck = performance.now();
        }
        return;
      }
      if (packet.type === "error") {
        if (["invalid_game", "invalid_join", "host_already_connected"].includes(packet.code)) {
          disconnect("Serwer nie obsługuje jeszcze tego pokoju (" + packet.code + ")", false);
        } else disconnect("Serwer: " + String(packet.code || "błąd"));
        return;
      }
      if (packet.type === "joined") {
        if (typeof packet.peerId !== "string") return;
        if (packet.hostPeerId && packet.hostPeerId !== HOST) {
          disconnect("Pokój nie działa na serwerze dedykowanym", false);
          return;
        }
        peerId = packet.peerId;
        if (connectTimer !== null) clearTimeout(connectTimer);
        connectTimer = null;
        statusMessage("Oczekiwanie na autorytatywny stan wyścigu");
        startHealth();
        return;
      }
      if (packet.type === "peer_joined") {
        if (typeof packet.peerId === "string" && packet.peerId !== peerId)
          callbacks.onPeerJoined?.(packet.peerId);
        return;
      }
      if (packet.type !== "data" || packet.from !== HOST || !packet.payload) return;
      const payload = packet.payload;
      if (payload.kind === "welcome" && payload.to === peerId &&
          Number.isInteger(payload.playerId) && payload.playerId >= 1 && payload.playerId <= 8) {
        playerId = payload.playerId;
        ready = true;
        attempt = 0;
        lastSnapshot = performance.now();
        statusMessage("");
        callbacks.onWelcome?.(playerId);
      } else if (payload.kind === "snapshot" && ready && payload.state) {
        lastSnapshot = performance.now();
        callbacks.onSnapshot?.(payload.state);
      } else if (payload.kind === "pong" && ready && payload.to === peerId &&
                 Number.isFinite(payload.sentAt)) {
        callbacks.onLatency?.(performance.now() - payload.sentAt);
      }
    }
    function open() {
      if (!active || closed) return;
      const current = ++epoch;
      statusMessage(attempt ? "Ponowne łączenie…" : "Łączenie z serwerem…");
      connectTimer = setTimeout(() => {
        if (current === epoch && !peerId) disconnect("Przekroczono czas połączenia");
      }, 12000);
      try {
        const ws = new WebSocket(SERVER);
        socket = ws;
        ws.addEventListener("open", () => {
          if (current !== epoch) return;
          send({ type: "join", game: GAME, key: serverKey(key), role: "dedicated",
            track, botCount, sessionId });
        });
        ws.addEventListener("message", event => {
          if (current === epoch) receive(event);
        });
        ws.addEventListener("error", () => {
          if (current === epoch) disconnect("Połączenie WebSocket przerwane");
        });
        ws.addEventListener("close", event => {
          if (current !== epoch) return;
          if (event.code === 4002) disconnect("Pokój zamknięty — brak aktywnych klientów", false);
          else disconnect("Serwer rozłączył połączenie");
        });
      } catch {
        if (current === epoch) disconnect("Nie można otworzyć WebSocket");
      }
    }
    function join(token) {
      if (active) return;
      active = true;
      key = token;
      track = document.querySelector('input[name="track"]:checked')?.value === "bath" ? "bath" : "pool";
      botCount = Math.max(0, Math.min(7, Number($("bots")?.value) || 0));
      const url = location.href.split("#")[0] + "#room=" + encodeURIComponent(key);
      history.replaceState(null, "", url);
      roomPanel.hidden = false;
      roomCode.textContent = key;
      joinControls.hidden = true;
      createButton.hidden = true;
      $("start").hidden = true;
      overlay.classList.remove("hidden");
      statusMessage("Łączenie…");
      callbacks.onConnecting?.();
      open();
    }
    function leave() {
      closed = true;
      active = ready = false;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      closeSocket();
      // Changing only the hash does not reload the game; reset the local race UI too.
      history.replaceState(null, "", location.href.split("#")[0]);
      location.reload();
    }
    createButton.addEventListener("click", () => {
      try { join(generateRoom()); }
      catch { statusMessage("Nie można utworzyć bezpiecznego kodu pokoju"); }
    });
    joinButton.addEventListener("click", () => {
      const token = parseRoom(joinInput.value);
      if (!token) {
        joinInput.setCustomValidity(t("Wpisz sześć liter lub pełny link do pokoju."));
        joinInput.reportValidity();
        return;
      }
      joinInput.setCustomValidity("");
      join(token);
    });
    joinInput.addEventListener("input", () => joinInput.setCustomValidity(""));
    joinInput.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); joinButton.click(); }
    });
    const copyButton = $("online-copy");
    copyButton.addEventListener("click", async () => {
      const url = location.href.split("#")[0] + "#room=" + encodeURIComponent(key);
      try {
        await navigator.clipboard.writeText(url);
        statusMessage("Skopiowano link zaproszenia");
        copyButton.classList.add("is-copied");
        write(copyButton, "Skopiowano link zaproszenia", "title");
        setTimeout(() => {
          copyButton.classList.remove("is-copied");
          write(copyButton, "Skopiuj link zaproszenia", "title");
        }, 1800);
      } catch {
        statusMessage("Link do skopiowania: " + url);
      }
    });
    $("online-leave").addEventListener("click", leave);
    const supplied = new URLSearchParams(location.hash.replace(/^#/, "")).get("room");
    if (supplied) {
      const token = parseRoom(supplied);
      if (token) join(token);
      else statusMessage("Nieprawidłowy link zaproszenia");
    }
    return {
      get active() { return active; },
      get ready() { return ready; },
      get playerId() { return playerId; },
      get status() { return statusText; },
      sendInput(input) { if (ready) send({ type: "data", payload: { kind: "input", ...input } }); },
      sendPing(time) { if (ready) send({ type: "data", payload: { kind: "ping", sentAt: time } }); }
    };
  }
  window.MikroSprintMultiplayer = { create, parseRoom };
})();
