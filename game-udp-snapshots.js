(() => {
  "use strict";

  function create({ send, receiver, onFrame, onFallback, onActive }) {
    let peer = null, channel = null, active = false, started = false;
    let negotiationTimer = null, pendingCandidates = [], failureNotified = false;

    function clearNegotiationTimer() {
      if (negotiationTimer !== null) clearTimeout(negotiationTimer);
      negotiationTimer = null;
    }

    function dispose() {
      clearNegotiationTimer();
      const oldPeer = peer, oldChannel = channel;
      peer = channel = null;
      active = false;
      started = false;
      pendingCandidates = [];
      try { oldChannel?.close(); } catch {}
      try { oldPeer?.close(); } catch {}
    }

    function fallback(code = "unavailable", notifyServer = true) {
      const hadTransport = Boolean(peer || channel || started || active);
      if (notifyServer && hadTransport) {
        try { send({ type: "rtc_fallback_request" }); } catch {}
      }
      dispose();
      if (!failureNotified && hadTransport) {
        failureNotified = true;
        onFallback?.(code);
      }
    }

    function waitForIceGathering(target, timeoutMs = 8000) {
      if (target.iceGatheringState === "complete") return Promise.resolve(true);
      return new Promise(resolve => {
        let finished = false;
        const finish = value => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          target.removeEventListener("icegatheringstatechange", changed);
          resolve(value);
        };
        const changed = () => {
          if (target.iceGatheringState === "complete") finish(true);
        };
        const timer = setTimeout(() => finish(false), timeoutMs);
        target.addEventListener("icegatheringstatechange", changed);
      });
    }

    async function start(isCurrent = () => true) {
      if (started) return;
      failureNotified = false;
      if (!receiver || typeof window.RTCPeerConnection !== "function") {
        failureNotified = true;
        onFallback?.("unsupported");
        return;
      }
      started = true;
      try {
        const connection = new window.RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });
        peer = connection;
        const dataChannel = connection.createDataChannel("game-snapshots", {
          ordered: false,
          maxRetransmits: 0
        });
        channel = dataChannel;
        dataChannel.binaryType = "arraybuffer";
        dataChannel.onopen = () => {
          if (peer !== connection || !isCurrent()) return;
          active = true;
          clearNegotiationTimer();
          onActive?.();
        };
        dataChannel.onclose = () => {
          if (peer === connection) fallback("channel_closed");
        };
        dataChannel.onerror = () => {
          if (peer === connection) fallback("channel_error");
        };
        dataChannel.onmessage = event => {
          if (peer !== connection || !active || !isCurrent()) return;
          try {
            const frame = receiver.receive(event.data);
            if (frame) onFrame?.(frame, event.data);
          } catch {}
        };
        connection.onconnectionstatechange = () => {
          if (peer === connection && ["failed", "closed"].includes(connection.connectionState)) {
            fallback("connection_failed");
          }
        };

        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        const gathered = await waitForIceGathering(connection);
        if (peer !== connection || !isCurrent()) {
          if (peer === connection) dispose();
          return;
        }
        if (!gathered || !connection.localDescription?.sdp) {
          fallback("ice_timeout");
          return;
        }
        send({ type: "rtc_offer", sdp: connection.localDescription.sdp });
        negotiationTimer = setTimeout(() => {
          if (peer === connection && !active) fallback("negotiation_timeout");
        }, 15000);
      } catch {
        fallback("negotiation_failed");
      }
    }

    function addCandidate(message, target) {
      if (typeof message.candidate !== "string" || message.candidate.length > 2048) return;
      const init = {
        candidate: message.candidate,
        sdpMid: typeof message.mid === "string" && message.mid ? message.mid : null,
        sdpMLineIndex: 0
      };
      if (!target.remoteDescription) {
        pendingCandidates.push(init);
        return;
      }
      target.addIceCandidate(init).catch(() => fallback("candidate_failed"));
    }

    function handle(message) {
      if (!message || typeof message !== "object") return;
      if (message.type === "rtc_answer") {
        const target = peer;
        if (!target || typeof message.sdp !== "string" || message.sdp.length > 12_000) return;
        const descriptionType = message.descriptionType === "answer" ? "answer" : null;
        if (!descriptionType) { fallback("invalid_answer"); return; }
        target.setRemoteDescription({ type: descriptionType, sdp: message.sdp }).then(async () => {
          if (peer !== target) return;
          for (const candidate of pendingCandidates.splice(0)) {
            try { await target.addIceCandidate(candidate); } catch {}
          }
        }).catch(() => fallback("invalid_answer"));
      } else if (message.type === "rtc_candidate") {
        if (peer) addCandidate(message, peer);
      } else if (message.type === "rtc_fallback") {
        fallback(message.code || "unavailable", false);
      }
    }

    return {
      start,
      handle,
      fallback,
      close: dispose,
      get active() { return active; }
    };
  }

  window.GameUdpSnapshots = { create };
})();
