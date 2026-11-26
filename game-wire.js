/* Compact game wire v2. Keep identical in gra/game-wire.js and sockets/server/game-wire.cjs. */
(() => {
  'use strict';
  const VERSION = 2, LIMIT = 2 ** 20;
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
  const forbidden = key => key === '__proto__' || key === 'constructor' || key === 'prototype';
  const position = new Set(['x','y','vx','vy','speed','jumpSafeX','jumpSafeY','aimX','aimY']);
  const angular = new Set(['angle','facing','bodyFacing']);
  function normalize(value) {
    // Copy mutable engine arrays before storing a baseline. Do not quantize IDs,
    // scores, ticks, game timers or discrete collision/elimination decisions.
    return JSON.parse(JSON.stringify(value, (key, number) => {
      if (typeof number !== 'number' || !Number.isFinite(number)) return number;
      const scale = position.has(key) ? 16 : angular.has(key) ? 4096 : 0;
      return scale && Math.abs(number) < 1000000 ? Math.round(number * scale) / scale : number;
    }));
  }
  function diff(before, after) {
    if (before === after) return undefined;
    if (Array.isArray(before) && Array.isArray(after)) {
      const edits = [];
      for (let i = 0; i < after.length; i++) {
        const change = diff(before[i], after[i]);
        if (change !== undefined) edits.push([i, change]);
      }
      return edits.length || before.length !== after.length ? [2, after.length, edits] : undefined;
    }
    if (before && after && typeof before === 'object' && typeof after === 'object' &&
        !Array.isArray(before) && !Array.isArray(after)) {
      const edits = [], removed = [];
      for (const key of Object.keys(after)) {
        const change = diff(Object.hasOwn(before, key) ? before[key] : undefined, after[key]);
        if (change !== undefined) edits.push([key, change]);
      }
      for (const key of Object.keys(before)) if (!Object.hasOwn(after, key)) removed.push(key);
      return edits.length || removed.length ? [1, edits, removed] : undefined;
    }
    return [0, after];
  }
  function apply(before, patch) {
    if (patch === null) return before;
    if (!Array.isArray(patch)) throw Error('Invalid patch');
    if (patch[0] === 0) return patch[1];
    if (patch[0] === 1 && before && typeof before === 'object' && !Array.isArray(before)) {
      const result = { ...before };
      for (const key of patch[2]) {
        if (forbidden(key)) throw Error('Invalid key');
        delete result[key];
      }
      for (const [key, change] of patch[1]) {
        if (typeof key !== 'string' || forbidden(key)) throw Error('Invalid key');
        result[key] = apply(result[key], change);
      }
      return result;
    }
    if (patch[0] === 2 && Array.isArray(before) && Number.isInteger(patch[1]) && patch[1] >= 0 && patch[1] <= LIMIT) {
      const result = before.slice(0, patch[1]);
      result.length = patch[1];
      for (const [index, change] of patch[2]) {
        if (!Number.isInteger(index) || index < 0 || index >= result.length) throw Error('Invalid index');
        result[index] = apply(result[index], change);
      }
      return result;
    }
    throw Error('Invalid patch baseline');
  }
  // Type tags: null, false, true, signed int, float64, UTF-8 string,
  // dictionary string, array, object, signed fixed point (1/4096).
  function encode(value) {
    const out = [], strings = new Map(), scratch = new DataView(new ArrayBuffer(8));
    function uint(n) {
      while (n >= 128) { out.push(n % 128 + 128); n = Math.floor(n / 128); }
      out.push(n);
    }
    function sint(n) { uint(n < 0 ? -2 * n - 1 : 2 * n); }
    function write(v) {
      if (v === null) { out.push(0); return; }
      if (v === false || v === true) { out.push(v ? 2 : 1); return; }
      if (typeof v === 'number') {
        if (Number.isInteger(v) && Math.abs(v) < 2 ** 31) { out.push(3); sint(v); }
        else if (Number.isInteger(v * 4096) && Math.abs(v * 4096) < 2 ** 31) {
          out.push(9); sint(v * 4096);
        } else {
          out.push(4); scratch.setFloat64(0, v, true);
          for (let i = 0; i < 8; i++) out.push(scratch.getUint8(i));
        }
        return;
      }
      if (typeof v === 'string') {
        if (strings.has(v)) { out.push(6); uint(strings.get(v)); return; }
        strings.set(v, strings.size);
        const bytes = encoder.encode(v);
        out.push(5); uint(bytes.length);
        for (const byte of bytes) out.push(byte);
        return;
      }
      if (Array.isArray(v)) {
        out.push(7); uint(v.length);
        for (const item of v) write(item);
        return;
      }
      const keys = Object.keys(v);
      out.push(8); uint(keys.length);
      for (const key of keys) { write(key); write(v[key]); }
    }
    write(value);
    return Uint8Array.from(out);
  }
  function decode(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length > LIMIT) throw Error('Frame too large');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), strings = [];
    let offset = 0, budget = LIMIT;
    function byte() {
      if (offset >= bytes.length) throw Error('Truncated frame');
      return bytes[offset++];
    }
    function uint() {
      let n = 0, factor = 1;
      for (let i = 0; i < 5; i++) {
        const b = byte(); n += (b & 127) * factor;
        if (b < 128) return n;
        factor *= 128;
      }
      throw Error('Invalid integer');
    }
    function sint() { const n = uint(); return n % 2 ? -(n + 1) / 2 : n / 2; }
    function read(depth = 0) {
      if (depth > 64 || --budget < 0) throw Error('Frame complexity');
      const tag = byte();
      if (tag === 0) return null;
      if (tag === 1 || tag === 2) return tag === 2;
      if (tag === 3) return sint();
      if (tag === 9) return sint() / 4096;
      if (tag === 4) { const n = view.getFloat64(offset, true); offset += 8; return n; }
      if (tag === 5) {
        const length = uint();
        if (length > bytes.length - offset) throw Error('Truncated string');
        const s = decoder.decode(bytes.subarray(offset, offset + length)); offset += length;
        strings.push(s); return s;
      }
      if (tag === 6) {
        const index = uint();
        if (index >= strings.length) throw Error('Invalid string index');
        return strings[index];
      }
      if (tag !== 7 && tag !== 8) throw Error('Invalid tag');
      const length = uint();
      if (length > budget || length > bytes.length - offset) throw Error('Invalid length');
      if (tag === 7) {
        const a = [];
        for (let i = 0; i < length; i++) a.push(read(depth + 1));
        return a;
      }
      const obj = {};
      for (let i = 0; i < length; i++) {
        const key = read(depth + 1);
        if (typeof key !== 'string' || forbidden(key)) throw Error('Invalid key');
        obj[key] = read(depth + 1);
      }
      return obj;
    }
    const result = read();
    if (offset !== bytes.length) throw Error('Trailing bytes');
    return result;
  }
  function frame(stream, seq, state, previous) {
    const full = encode([VERSION, stream, seq, 0, state]);
    if (!previous || seq - previous.keyframe >= 60) return { bytes: full, keyframe: seq };
    const patch = diff(previous.state, state);
    const delta = encode([VERSION, stream, seq, previous.seq, patch === undefined ? null : patch]);
    return delta.length < full.length ? { bytes: delta, keyframe: previous.keyframe } : { bytes: full, keyframe: seq };
  }
  function receiver() {
    const baselines = new Map();
    return {
      reset() { baselines.clear(); },
      receive(bytes) {
        const packet = decode(bytes);
        if (!Array.isArray(packet) || packet.length !== 5 || packet[0] !== VERSION ||
            ![0, 1].includes(packet[1]) || !Number.isSafeInteger(packet[2]) ||
            packet[2] < 1 || !Number.isSafeInteger(packet[3]) || packet[3] < 0) throw Error('Invalid frame');
        const [, stream, seq, base, payload] = packet;
        const old = baselines.get(stream);
        if (old && seq <= old.seq) return null;
        if (base && (!old || old.seq !== base)) return null;
        const state = base ? apply(old.state, payload) : payload;
        if (!state || typeof state !== 'object' || Array.isArray(state)) throw Error('Invalid state');
        baselines.set(stream, { seq, state });
        // The gameplay engine may mutate received state; keep the baseline isolated.
        return { stream, state: JSON.parse(JSON.stringify(state)) };
      }
    };
  }
  const INPUT_FIELDS = ['seq','dx','dy','gas','brake','fire','jump','weaponSwitch','gear','round','name','readyRound','ready'];
  function encodeInput(input) {
    return encode([VERSION, 2, INPUT_FIELDS.map(key => input[key] ?? null)]);
  }
  function decodeInput(bytes) {
    const message = decode(bytes);
    if (!Array.isArray(message) || message.length !== 3 || message[0] !== VERSION || message[1] !== 2 ||
        !Array.isArray(message[2]) || message[2].length !== INPUT_FIELDS.length) throw Error('Invalid input frame');
    const input = { kind: 'input' };
    for (let i = 0; i < INPUT_FIELDS.length; i++) {
      const value = message[2][i];
      if (value === null) continue;
      if (!['number','boolean','string'].includes(typeof value) ||
          (typeof value === 'number' && !Number.isFinite(value))) throw Error('Invalid input value');
      input[INPUT_FIELDS[i]] = value;
    }
    return { type: 'data', payload: input };
  }
  function inputSender(send) {
    let signature = null, sentAt = -Infinity, lastName;
    return {
      reset() { signature = null; sentAt = -Infinity; lastName = undefined; },
      send(input, now, compact, force = false) {
        // Ready/name-only packets and legacy servers keep their original semantics.
        if (!compact || !Number.isFinite(input.dx) || !Number.isFinite(input.dy) || input.readyRound !== undefined) {
          signature = null;
          send(input, false);
          return true;
        }
        const next = JSON.stringify(INPUT_FIELDS.slice(1, 11).map(key => input[key] ?? null));
        if (!force && next === signature && now - sentAt < 100) return false;
        const payload = { ...input };
        if (payload.name === lastName) delete payload.name;
        else lastName = payload.name;
        signature = next;
        sentAt = now;
        send(encodeInput(payload), true);
        return true;
      }
    };
  }
  const api = { VERSION, normalize, diff, apply, encode, decode, frame, receiver, encodeInput, decodeInput, inputSender };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.GameWire = api;
})();
