(() => {
  'use strict';

  // Replicate short-lived tire tracks and long-lived body/chalk decals without
  // sending the complete history in every 60 Hz world snapshot.
  const REPLAY_EVERY = 6; // 10 Hz history pages for late joiners
  const NEW_MARKS_PER_SNAPSHOT = 32;
  const NEW_REMAINS_PER_SNAPSHOT = 12;
  const REPLAY_MARKS_PER_PAGE = 16;
  const REPLAY_REMAINS_PER_PAGE = 8;

  function create({ maxMarks = 220, maxRemains = 64, markLifetime = 2.25, remainLifetime = 610 } = {}) {
    let nextMark = 0, nextRemain = 0, sentMark = 0, sentRemain = 0;
    let round = 0, receivedRound = null, frame = 0;
    let markCursor = 0, remainCursor = 0;

    function page(history, cursor, size) {
      if (!history.length) return { items: [], next: 0 };
      const offset = cursor % history.length;
      const items = history.slice(offset, offset + size);
      return { items, next: offset + items.length >= history.length ? 0 : offset + items.length };
    }

    function pack(items, fields) {
      return items.map(item => {
        const out = {};
        for (const key of fields) out[key] = item[key];
        return out;
      });
    }

    const markFields = ['id', 'x', 'y', 'angle', 'age', 'lifetime'];
    const remainFields = ['id', 'x', 'y', 'facing', 'bodyFacing', 'color', 'playerId', 'age'];

    function snapshot(marks, remains) {
      frame++;
      const newMarks = marks.filter(mark => mark.id > sentMark).slice(0, NEW_MARKS_PER_SNAPSHOT);
      const newRemains = remains.filter(remain => remain.id > sentRemain).slice(0, NEW_REMAINS_PER_SNAPSHOT);
      if (newMarks.length) sentMark = newMarks[newMarks.length - 1].id;
      if (newRemains.length) sentRemain = newRemains[newRemains.length - 1].id;

      let replayMarks = [], replayRemains = [];
      if (frame % REPLAY_EVERY === 0) {
        const markPage = page(marks, markCursor, REPLAY_MARKS_PER_PAGE);
        const remainPage = page(remains, remainCursor, REPLAY_REMAINS_PER_PAGE);
        replayMarks = markPage.items;
        replayRemains = remainPage.items;
        markCursor = markPage.next;
        remainCursor = remainPage.next;
      }

      const unique = items => [...new Map(items.map(item => [item.id, item])).values()];
      return {
        round,
        marks: pack(unique([...newMarks, ...replayMarks]), markFields),
        remains: pack(unique([...newRemains, ...replayRemains]), remainFields)
      };
    }

    function merge(current, updates, limit, lifetime, isMark) {
      if (!Array.isArray(updates)) return current;
      const ids = new Map(current.map(item => [item.id, item]));
      // A malformed or oversized network update cannot create unbounded decals.
      for (const item of updates.slice(0, 64)) {
        if (!item || !Number.isSafeInteger(item.id) || item.id < 1 ||
            !Number.isFinite(item.x) || !Number.isFinite(item.y) ||
            !Number.isFinite(item.age) || item.age < 0 || item.age >= lifetime ||
            !Number.isFinite(isMark ? item.angle : item.bodyFacing)) continue;
        const prior = ids.get(item.id);
        if (prior) {
          // The client also ages decals between packets. Never rewind a fade
          // or turn a chalk outline back into a body on a replayed snapshot.
          prior.age = Math.max(prior.age, item.age);
          continue;
        }
        const decal = isMark
          ? { id: item.id, x: item.x, y: item.y, angle: item.angle,
              age: item.age, lifetime: Math.min(lifetime, Number.isFinite(item.lifetime) ? item.lifetime : lifetime) }
          : { id: item.id, x: item.x, y: item.y,
              facing: Number.isFinite(item.facing) ? item.facing : item.bodyFacing,
              bodyFacing: item.bodyFacing, age: item.age,
              color: typeof item.color === 'string' && /^#[0-9a-f]{6}$/i.test(item.color)
                ? item.color : '#8d9690',
              playerId: item.playerId };
        ids.set(item.id, decal);
        current.push(decal);
      }
      while (current.length > limit) current.shift();
      return current;
    }

    function receive(packet, marks, remains) {
      if (!packet || !Number.isSafeInteger(packet.round) || packet.round < 0) {
        return { marks, remains };
      }
      if (receivedRound !== null && packet.round < receivedRound) {
        return { marks, remains };
      }
      if (receivedRound !== null && packet.round > receivedRound) marks = [];
      receivedRound = packet.round;
      return {
        marks: merge(marks, packet.marks, maxMarks, markLifetime, true),
        remains: merge(remains, packet.remains, maxRemains, remainLifetime, false)
      };
    }

    return {
      nextMarkId() { return ++nextMark; },
      nextRemainId() { return ++nextRemain; },
      nextRound() { round++; markCursor = 0; },
      resetClient() { receivedRound = null; },
      snapshot,
      receive
    };
  }

  window.NocnyKursVisualSync = { create };
})();
