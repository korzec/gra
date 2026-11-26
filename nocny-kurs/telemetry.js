(() => {
  'use strict';

  // Aggregate measurements only. No names, IPs, room codes or session IDs.
  const version = document.querySelector('meta[name="game-version"]')?.content || 'unknown';
  const encoder = new TextEncoder();
  const MAX_SAMPLES = 2400;
  const samples = { frame: [], render: [], rtt: [], jitter: [], gap: [], correction: [] };
  let previousFrame = null, previousRtt = null, previousSnapshot = null;
  let startedAt = performance.now(), uploaded = 0, downloaded = 0, correctionCount = 0;

  function record(kind, amount) {
    if (!Number.isFinite(amount) || amount < 0) return;
    const values = samples[kind];
    values.push(amount);
    if (values.length > MAX_SAMPLES) values.shift();
  }
  function percentile(values, p) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) * p)];
  }
  function frame(timestamp, renderTimeMs) {
    if (previousFrame !== null) {
      const elapsed = timestamp - previousFrame;
      if (elapsed > 0 && elapsed < 1000) {
        record('frame', elapsed);
        record('render', renderTimeMs);
      }
    }
    previousFrame = timestamp;
  }
  function rtt(ms) {
    record('rtt', ms);
    if (previousRtt !== null) record('jitter', Math.abs(ms - previousRtt));
    previousRtt = ms;
  }
  function snapshot(timestamp) {
    if (previousSnapshot !== null) {
      const elapsed = timestamp - previousSnapshot;
      if (elapsed > 0 && elapsed < 1000) record('gap', elapsed);
    }
    previousSnapshot = timestamp;
  }
  function correction(distance) {
    record('correction', distance);
    if (distance > 2) correctionCount++;
  }
  function transfer(direction, data) {
    const bytes = typeof data === 'string' ? encoder.encode(data).byteLength : data?.byteLength;
    if (!Number.isFinite(bytes)) return;
    if (direction === 'outbound') uploaded += bytes;
    else downloaded += bytes;
  }
  function flush(mode) {
    const now = performance.now();
    const intervalMs = now - startedAt;
    if (intervalMs < 25000 || samples.frame.length < 10) return null;
    const values = {};
    const averageFrame = samples.frame.reduce((sum, value) => sum + value, 0) / samples.frame.length;
    values.fps = Math.max(0, Math.min(240, 1000 / averageFrame));
    for (const [source, name, percentileValue] of [
      ['frame', 'frameP95Ms', .95], ['render', 'renderP95Ms', .95],
      ['rtt', 'rttP95Ms', .95], ['jitter', 'jitterMs', .95],
      ['gap', 'snapshotGapP95Ms', .95], ['correction', 'correctionP95', .95]
    ]) {
      const result = percentile(samples[source], percentileValue);
      if (result !== null) values[name] = result;
    }
    values.correctionsPerMinute = correctionCount * 60000 / intervalMs;
    values.uploadBytesPerSecond = uploaded * 1000 / intervalMs;
    values.downloadBytesPerSecond = downloaded * 1000 / intervalMs;
    for (const values of Object.values(samples)) values.length = 0;
    uploaded = downloaded = correctionCount = 0;
    startedAt = now;
    const touch = navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches;
    return {
      type: 'telemetry',
      version: /^v[1-9][0-9]{0,3}$/.test(version) ? version : 'unknown',
      mode: mode === 'dedicated' ? 'dedicated' : 'browser-hosted',
      device: touch ? 'touch' : 'desktop',
      values
    };
  }

  window.NocnyKursTelemetry = { frame, rtt, snapshot, correction, transfer, flush };
})();