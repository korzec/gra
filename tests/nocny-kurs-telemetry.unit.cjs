const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

test('browser telemetry records bounded aggregates and omits identifying data', () => {
  let now = 0;
  const window = {};
  const document = {
    querySelector() { return { content: 'v86' }; }
  };
  const sandbox = {
    window, document, TextEncoder, navigator: { maxTouchPoints: 0 },
    performance: { now: () => now },
    matchMedia: () => ({ matches: false })
  };
  runInNewContext(readFileSync('nocny-kurs/telemetry.js', 'utf8'), sandbox);
  const telemetry = window.NocnyKursTelemetry;
  for (let i = 1; i <= 1800; i++) {
    now = i * (1000 / 60);
    telemetry.frame(now, 3);
    telemetry.snapshot(now);
  }
  telemetry.transfer('outbound', 'x'.repeat(4500));
  telemetry.transfer('inbound', 'y'.repeat(10500));
  telemetry.rtt(45);
  telemetry.rtt(60);
  telemetry.correction(5);
  const report = telemetry.flush('dedicated');
  assert.equal(report.version, 'v86');
  assert.equal(report.mode, 'dedicated');
  assert.equal(report.device, 'desktop');
  assert.ok(report.values.fps > 59 && report.values.fps < 61);
  assert.ok(report.values.frameP95Ms > 16);
  assert.equal(report.values.rttP95Ms, 45);
  assert.equal(report.values.correctionP95, 5);
  assert.ok(report.values.uploadBytesPerSecond >= 149);
  assert.ok(report.values.downloadBytesPerSecond >= 349);
  const json = JSON.stringify(report);
  assert.doesNotMatch(json, /room|session|peer|name|ipAddress|username/i);
  assert.equal(telemetry.flush('dedicated'), null);
});
