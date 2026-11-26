(() => {
  const SAMPLE_MAX_AGE_MS = 12_000;
  let online = false;
  let version = '';
  let pending = null;
  let ping = null;
  let jitter = null;
  let lastSampleAt = null;
  let transferStart = null, rx = 0, tx = 0, rxRate = null, txRate = null;
  function resetTransfer() { transferStart = null; rx = tx = 0; rxRate = txRate = null; }

  function clearSamples() {
    pending = ping = jitter = lastSampleAt = null;
  }

  function setVersion(value) {
    if (typeof value === 'string' && /^[A-Za-z0-9._+-]{1,128}$/.test(value)) version = value;
  }

  // Reuse the existing transport health probes; no extra WebSocket traffic.
  window.GamePerformanceNetwork = {
    reset(isOnline = false) {
      online = isOnline;
      version = '';
      clearSamples();
      resetTransfer();
    },
    joined(serverVersion) {
      this.reset(true);
      setVersion(serverVersion);
    },
    sent(nonce) {
      if (online && !document.hidden) pending = { nonce, at: performance.now() };
    },
    ack(nonce, serverVersion) {
      if (!online) return;
      setVersion(serverVersion);
      if (!pending || nonce !== pending.nonce) return;
      const now = performance.now();
      const rtt = now - pending.at;
      pending = null;
      if (document.hidden || rtt < 0 || rtt > SAMPLE_MAX_AGE_MS) return;
      if (lastSampleAt !== null && now - lastSampleAt > SAMPLE_MAX_AGE_MS) clearSamples();
      if (ping !== null) {
        const variation = Math.abs(rtt - ping);
        jitter = jitter === null ? variation : jitter + (variation - jitter) / 8;
      }
      ping = rtt;
      lastSampleAt = now;
    },
    transfer(direction, data) {
      if (!online) return;
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data).byteLength : data?.byteLength;
      if (!Number.isFinite(bytes)) return;
      if (transferStart === null) transferStart = performance.now();
      if (direction === 'inbound') rx += bytes;
      else if (direction === 'outbound') tx += bytes;
    },
    rates() {
      const now = performance.now();
      if (transferStart !== null && now - transferStart >= 1000) {
        const seconds = (now - transferStart) / 1000;
        rxRate = rx / seconds; txRate = tx / seconds;
        rx = tx = 0; transferStart = now;
      }
      return { rx: rxRate, tx: txRate };
    },
    snapshot() {
      if (lastSampleAt !== null && performance.now() - lastSampleAt > SAMPLE_MAX_AGE_MS) clearSamples();
      return { online, version, ping, jitter };
    }
  };

  document.addEventListener('visibilitychange', () => { clearSamples(); resetTransfer(); });

  window.createGamePerformanceHud = container => {
    const hud = document.createElement('div');
    hud.className = 'performance-hud';
    hud.setAttribute('aria-label', 'Game performance / Wydajność gry');
    const rendering = document.createElement('div');
    rendering.textContent = 'FPS — · FRAME — ms · RENDER — ms';
    const network = document.createElement('div');
    const transfer = document.createElement('div');
    hud.append(rendering, network, transfer);
    container.appendChild(hud);

    const formatMs = value => value === null ? '—' : String(Math.round(value));
    function updateNetwork() {
      const sample = window.GamePerformanceNetwork.snapshot();
      const compactVersion = /^(sha-)?[a-f0-9]{40}$/i.test(sample.version)
        ? sample.version.slice(0, sample.version.startsWith('sha-') ? 12 : 8) : sample.version;
      const server = sample.online ? compactVersion || '—' : 'LOCAL';
      network.textContent = `PING ${formatMs(sample.ping)} ms · JITTER ${formatMs(sample.jitter)} ms · SERVER ${server}`;
      network.title = sample.online ? sample.version : '';
      const rates = window.GamePerformanceNetwork.rates();
      const format = value => value === null ? '—' : (value / 1000).toFixed(1);
      transfer.hidden = !sample.online;
      transfer.textContent = `RX ${format(rates.rx)} KB/s · TX ${format(rates.tx)} KB/s · ${rates.rx === null || rates.tx === null ? '—' : ((rates.rx + rates.tx) * 3600 / 1000000).toFixed(1)} MB/h`;
      transfer.title = 'Application payload bytes; excludes WebSocket/TLS overhead and transport compression';
    }
    updateNetwork();

    let previousFrame = null;
    let frames = 0;
    let frameTotal = 0;
    let renderTotal = 0;
    let lastNetworkUpdate = null;

    function resetFrames() {
      previousFrame = null;
      frames = frameTotal = renderTotal = 0;
    }
    document.addEventListener('visibilitychange', () => {
      resetFrames();
      rendering.textContent = 'FPS — · FRAME — ms · RENDER — ms';
      updateNetwork();
    });

    return (timestamp, renderTime) => {
      if (document.hidden) return;
      if (lastNetworkUpdate === null || timestamp - lastNetworkUpdate >= 600) {
        updateNetwork();
        lastNetworkUpdate = timestamp;
      }
      if (previousFrame !== null) {
        const frameTime = timestamp - previousFrame;
        if (frameTime <= 0 || frameTime >= 1000) resetFrames();
        else {
          frames++;
          frameTotal += frameTime;
          renderTotal += renderTime;
        }
      }
      previousFrame = timestamp;
      if (frameTotal < 600 || frames < 2) return;

      const fps = Math.round(frames * 1000 / frameTotal);
      const averageFrame = frameTotal / frames;
      const averageRender = renderTotal / frames;
      rendering.textContent = `FPS ${fps} · FRAME ${averageFrame.toFixed(1)} ms · RENDER ${averageRender.toFixed(1)} ms`;
      frames = frameTotal = renderTotal = 0;
    };
  };
})();
