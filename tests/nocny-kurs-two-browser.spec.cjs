const { test, expect } = require('@playwright/test');
const { once } = require('node:events');
const { WebSocketServer } = require('ws');

// A small real WebSocket relay: the host connects from a dedicated Worker,
// while the guest connects from the page. Playwright's routeWebSocket cannot
// intercept worker sockets, so we use an actual loopback WebSocket server.
class LocalRoomRelay {
  constructor() {
    this.rooms = new Map();
    this.nextPeerId = 1;
    this.guestSnapshots = [];
    this.guestTraces = [];
    this.guestInputs = [];
    this.dropGuestSnapshots = false;
  }

  attach(socket) {
    const peer = { id: 'peer-' + this.nextPeerId++, socket, kind: null, roomId: null };
    const send = (recipient, message) => {
      if (recipient.kind === 'guest' && message.type === 'data' &&
          message.payload?.kind === 'snapshot') {
        if (this.dropGuestSnapshots) return;
        this.guestSnapshots.push(message.payload.state);
      }
      if (recipient.kind === 'guest' && message.type === 'data' &&
          message.payload?.kind === 'traces') {
        this.guestTraces.push(message.payload.traces);
      }
      if (recipient.socket.readyState === 1) {
        recipient.socket.send(JSON.stringify(message));
      }
    };

    socket.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString('utf8')); } catch { return; }
      if (message.type === 'join' && !peer.roomId) {
        const roomId = message.game + ':' + message.key;
        let room = this.rooms.get(roomId);
        if (!room) {
          room = [];
          this.rooms.set(roomId, room);
        }
        peer.kind = room.length === 0 ? 'host' : 'guest';
        const priorPeers = room.map(member => member.id);
        peer.roomId = roomId;
        room.push(peer);
        send(peer, { type: 'joined', peerId: peer.id, peers: priorPeers });
        for (const member of room) {
          if (member !== peer) send(member, { type: 'peer_joined', peerId: peer.id });
        }
      } else if (message.type === 'data' && peer.roomId) {
        if (peer.kind === 'guest' && message.payload?.kind === 'input') {
          this.guestInputs.push(message.payload);
        }
        for (const member of this.rooms.get(peer.roomId) || []) {
          if (member !== peer) send(member, { type: 'data', from: peer.id, payload: message.payload });
        }
      }
    });

    socket.on('close', () => {
      if (!peer.roomId) return;
      const room = this.rooms.get(peer.roomId) || [];
      this.rooms.set(peer.roomId, room.filter(member => member !== peer));
      for (const member of room) {
        if (member !== peer) send(member, { type: 'peer_left', peerId: peer.id });
      }
    });
  }
}

test('two browser sessions stay synchronized while the host rendering loop is suspended', async ({ browser }) => {
  const relay = new LocalRoomRelay();
  const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(wsServer, 'listening');
  wsServer.on('connection', socket => relay.attach(socket));
  const localSocketUrl = 'ws://127.0.0.1:' + wsServer.address().port;
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    // Rewrite only the server URL in the local game script. Both the host
    // Worker and the guest page then use the same real loopback relay.
    const useLocalRelay = async context => {
      await context.route('**/nocny-kurs/multiplayer.js*', async route => {
        const response = await route.fetch();
        const source = await response.text();
        const original = "const SERVER = 'wss://gra.w.korzec-it.pl/ws';";
        expect(source).toContain(original);
        await route.fulfill({ response, body: source.replace(original, "const SERVER = '" + localSocketUrl + "';") });
      });
    };
    await useLocalRelay(hostContext);
    await useLocalRelay(guestContext);
    // Test-only hooks inside the game closure: prove that graphics on both
    // browsers come from the same authoritative trace data, not an overlay.
    const instrumentTraces = async context => {
      await context.route('**/nocny-kurs/game.js*', async route => {
        const response = await route.fetch();
        const source = await response.text();
        const anchor = '  function gameSnapshot(){';
        expect(source).toContain(anchor);
        const hooks = `
          window.__testAddTraces = () => {
            skidMarks.push({x:1260,y:1260,angle:0.5,age:0,lifetime:SKID_MARK_LIFETIME});
            deathRemains.push({x:1330,y:1330,bodyFacing:1,color:'#d6f36a',age:12});
          };
          window.__testTraceState = () => ({
            marks:skidMarks.map(m=>({x:m.x,y:m.y,age:m.age})),
            remains:deathRemains.map(r=>({x:r.x,y:r.y,age:r.age}))
          });
        `;
        await route.fulfill({ response, body: source.replace(anchor, hooks + anchor) });
      });
    };
    await instrumentTraces(hostContext);
    await instrumentTraces(guestContext);
    // Instrument only the test-served script so the test can inspect the
    // guest's live predicted poses without adding debug globals to the game.
    await guestContext.route('**/nocny-kurs/client-prediction.js*', async route => {
      const response = await route.fetch();
      const source = await response.text();
      const instrumentation = `
        (() => {
          const original = window.NocnyKursGuestPrediction.create;
          window.NocnyKursGuestPrediction.create = (...args) => {
            const engine = original(...args);
            const reconcile = engine.reconcile;
            engine.reconcile = (...items) => {
              const result = reconcile(...items);
              if (items[0] === 'car') window.__testPredictedCars = result;
              if (items[0] === 'player') window.__testPredictedPlayers = result;
              return result;
            };
            return engine;
          };
        })();`;
      await route.fulfill({ response, body: source + '\n' + instrumentation });
    });

    const host = await hostContext.newPage();
    await host.goto('/nocny-kurs/');
    await expect(host.locator('#player-name-start')).toBeVisible();
    await expect(host.locator('#player-name-live')).toBeHidden();
    await host.locator('#player-name-start').fill('Gospodarz');
    const hostWorkerCreated = host.waitForEvent('worker');
    await host.locator('#multiplayer-host').click();
    await expect(host.locator('#overlay')).toHaveClass(/hidden/);
    await expect(host.locator('#player-name-live')).toBeVisible();
    await expect(host.locator('#player-name-live')).toHaveValue('Gospodarz');
    await expect(host.locator('#player-list')).toContainText('Gospodarz');
    const hostWorker = await hostWorkerCreated;
    expect(hostWorker.url()).toContain('/nocny-kurs/host-worker.js');
    await expect(host.locator('#multiplayer-status')).toContainText('Pokój aktywny');
    const codeField = host.locator('#multiplayer-room-key');
    await expect(codeField).toHaveValue(/^[A-Z]{6}$/);
    const code = await codeField.inputValue();

    const guest = await guestContext.newPage();
    await guest.goto('/nocny-kurs/#room=' + code);
    await expect(guest.locator('#multiplayer-status')).toContainText('grasz jako P2');
    await expect(host.locator('#multiplayer-status')).toContainText('gracz dołączył');

    // Selecting online mode already started the host; guests receive its live state.
    await expect(guest.locator('#overlay')).toHaveClass(/hidden/);
    await expect.poll(() => relay.guestSnapshots.filter(state => state.running).length).toBeGreaterThan(1);
    await expect(guest.locator('#player-name-live')).toBeVisible();
    await expect(guest.locator('#player-list')).toContainText('Gospodarz');
    await expect(guest.locator('#player-list')).toContainText('P2');
    await guest.locator('#player-name-live').fill('Żółw 🐢');
    await expect(guest.locator('#player-list')).toContainText('Żółw 🐢');
    await expect(host.locator('#player-list')).toContainText('Żółw 🐢');
    await guest.locator('#player-name-live').fill('Ala');
    await expect(host.locator('#player-list')).toContainText('Ala');
    await host.locator('#player-name-live').fill('Nowy host');
    await expect(guest.locator('#player-list')).toContainText('Nowy host');
    await guest.locator('#player-name-live').fill('');
    await expect(host.locator('#player-list')).toContainText('P2');
    await guest.locator('#player-name-live').evaluate(input => input.blur());

    // Inject a wheel mark and an old body (already rendered as chalk) on the
    // authoritative host. Both should appear on the guest between snapshots.
    await host.evaluate(() => window.__testAddTraces());
    await expect.poll(() => relay.guestTraces.some(traces =>
      traces.skidMarks.some(mark => mark[0] === 1260 && mark[1] === 1260) &&
      traces.deathRemains.some(remain => remain[0] === 1330 && remain[1] === 1330)
    )).toBe(true);
    await expect.poll(() => guest.evaluate(() => {
      const traces = window.__testTraceState();
      return traces.marks.some(mark => mark.x === 1260 && mark.y === 1260) &&
        traces.remains.some(remain => remain.x === 1330 && remain.y === 1330 && remain.age >= 10);
    })).toBe(true);
    const baseline = relay.guestSnapshots.at(-1);
    expect(baseline.players).toHaveLength(2);
    expect(baseline.cars.length).toBeGreaterThan(0);
    const carsAtStart = new Map(baseline.cars.map(car => [car.id, { x: car.x, y: car.y }]));
    const receivedBeforeBackground = relay.guestSnapshots.length;

    // Simulate browser background rendering suspension. The authoritative
    // physics and network snapshots must keep advancing independently.
    await host.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await guest.bringToFront();

    // Hide incoming world updates for 180 ms. A snapshot-only guest freezes
    // immediately; the predictor should keep traffic moving locally.
    await expect.poll(() => guest.evaluate(() =>
      window.__testPredictedCars?.some(car => Math.hypot(
        car._velocityX || 0, car._velocityY || 0) > 50))).toBe(true);
    const movingCar = await guest.evaluate(() => {
      const car = window.__testPredictedCars.find(item =>
        Math.hypot(item._velocityX || 0, item._velocityY || 0) > 50);
      return { id: car.id, x: car.x, y: car.y };
    });
    const playerBeforeLoss = await guest.evaluate(() => {
      const player = window.__testPredictedPlayers.find(p => p.id === 2);
      return { x: player.x, y: player.y };
    });
    relay.dropGuestSnapshots = true;
    await guest.keyboard.down('d');
    await expect.poll(async () => guest.evaluate(({ id, x, y }) => {
      const car = window.__testPredictedCars?.find(item => item.id === id);
      return car ? Math.hypot(car.x - x, car.y - y) : 0;
    }, movingCar), { timeout: 4000 }).toBeGreaterThan(5);
    await guest.keyboard.up('d');
    const distanceMoved = async () => guest.evaluate(({ x, y }) => {
      const player = window.__testPredictedPlayers?.find(p => p.id === 2);
      return player ? Math.hypot(player.x - x, player.y - y) : 0;
    }, playerBeforeLoss);
    let moved = await distanceMoved();
    // The spawn position can be blocked on one side. Try the remaining axes
    // before concluding that local prediction failed to advance.
    for (const direction of ['a', 'w', 's']) {
      if (moved > 5) break;
      await guest.keyboard.down(direction);
      await guest.waitForTimeout(180);
      await guest.keyboard.up(direction);
      moved = await distanceMoved();
    }
    relay.dropGuestSnapshots = false;
    expect(moved).toBeGreaterThan(5);
    await expect.poll(() => relay.guestInputs.length).toBeGreaterThan(2);
    // Once packets resume, predicted and authoritative positions converge.
    await expect.poll(async () => {
      const hostPlayer = relay.guestSnapshots.at(-1)?.players.find(p => p.id === 2);
      const localPlayer = await guest.evaluate(() => {
        const p = window.__testPredictedPlayers?.find(p => p.id === 2);
        return p && { x: p.x, y: p.y };
      });
      return hostPlayer && localPlayer
        ? Math.hypot(hostPlayer.x - localPlayer.x, hostPlayer.y - localPlayer.y) : Infinity;
    }, { timeout: 6000 }).toBeLessThan(45);
    await expect.poll(() => relay.guestSnapshots.slice(receivedBeforeBackground).some(state =>
      state.running && state.cars.some(car => {
        const initial = carsAtStart.get(car.id);
        return initial && Math.hypot(car.x - initial.x, car.y - initial.y) > 12;
      })
    ), { timeout: 20000 }).toBe(true);

    await guest.keyboard.up('d');
    expect(relay.guestInputs.some(input => input.dx > 0)).toBe(true);
  } finally {
    await guestContext.close();
    await hostContext.close();
    await new Promise((resolve, reject) => wsServer.close(error => error ? reject(error) : resolve()));
  }
});


test('the start screen requires an explicit mode choice, and keeps room join as the third option', async ({ page }) => {
  await page.goto('/nocny-kurs/');
  await expect(page.locator('#start')).toHaveText('Gra lokalna');
  await expect(page.locator('#multiplayer-host')).toHaveText('Gra online');
  await expect(page.locator('#multiplayer-join-area')).toBeVisible();
  await expect(page.locator('#player-name-start')).toBeVisible();
  await expect(page.locator('#player-name-live')).toBeHidden();
  await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);

  // Neither the overlay backdrop nor keyboard/gamepad controls select a mode.
  await page.locator('#overlay').click({ position: { x: 8, y: 180 } });
  await page.locator('body').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [{ connected: true, buttons: [{ pressed: true }], axes: [0, 0] }]
    });
  });
  await page.waitForTimeout(100);
  await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);
  await expect(page.locator('#multiplayer-room')).toBeHidden();

  await page.locator('#start').click();
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
  await expect(page.locator('#multiplayer-room')).toBeHidden();
  await expect(page.locator('#player-name-live')).toBeVisible();
  await expect(page.locator('#player-list')).toContainText('P1');
  await page.locator('#player-name-live').fill('Kot');
  await expect(page.locator('#player-list')).toContainText('Kot');
  await expect(page.locator('#player-name-start')).toHaveValue('Kot');
  await page.locator('#player-name-live').fill(' ');
  await expect(page.locator('#player-list')).toContainText('P1');
});

test('the catalog button opens a fresh game start screen instead of leaving the game', async ({ page }) => {
  await page.goto('/nocny-kurs/');
  await page.locator('#start').click();
  await expect(page.locator('#overlay')).toHaveClass(/hidden/);
  await page.getByRole('link', { name: /EKRAN STARTOWY/ }).first().click();
  await expect(page).toHaveURL(/\/nocny-kurs\/$/);
  await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);
  await expect(page.locator('#start')).toBeVisible();
});

test('Swedish browser locale translates start and gameplay, and language selection persists', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'sv-SE' });
  try {
    const page = await context.newPage();
    await page.goto('/nocny-kurs/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
    await expect(page.locator('#language-select')).toHaveValue('sv');
    await expect(page.locator('#start')).toHaveText('Lokalt spel');
    await expect(page.locator('#multiplayer-host')).toHaveText('Onlinespel');
    await expect(page.locator('#multiplayer-join-area label')).toHaveText('Gå med i ett rum');
    await expect(page.locator('#round-label')).toHaveText('12 PAKET');
    await expect(page.locator('#status')).toHaveText('STADEN VÄNTAR');
    await expect(page.getByRole('link', { name: /STARTSKÄRM/ }).first()).toBeVisible();

    await page.locator('#start').click();
    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#status')).toHaveText('LAGET ÄR PÅ VÄG');
    await page.locator('#language-select').selectOption('pl');
    await expect(page.locator('#status')).toHaveText('EKIPA W DRODZE');
    await expect(page.locator('#round-label')).toHaveText('12 PRZESYŁEK');
    await page.locator('#language-select').selectOption('sv');
    await expect(page.locator('#status')).toHaveText('LAGET ÄR PÅ VÄG');
    await page.reload();
    await expect(page.locator('#language-select')).toHaveValue('sv');
    await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);
    await expect(page.locator('#start')).toHaveText('Lokalt spel');
  } finally {
    await context.close();
  }
});

test('a Swedish guest sees local game status from a Polish host', async ({ browser }) => {
  const relay = new LocalRoomRelay();
  const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(wsServer, 'listening');
  wsServer.on('connection', socket => relay.attach(socket));
  const socketUrl = 'ws://127.0.0.1:' + wsServer.address().port;
  const hostContext = await browser.newContext({ locale: 'pl-PL' });
  const guestContext = await browser.newContext({ locale: 'sv-SE' });
  try {
    for (const context of [hostContext, guestContext]) {
      await context.route('**/nocny-kurs/multiplayer.js*', async route => {
        const response = await route.fetch();
        const source = await response.text();
        const original = "const SERVER = 'wss://gra.w.korzec-it.pl/ws';";
        expect(source).toContain(original);
        await route.fulfill({ response, body: source.replace(original, "const SERVER = '" + socketUrl + "';") });
      });
    }

    const host = await hostContext.newPage();
    await host.goto('/nocny-kurs/');
    await host.locator('#multiplayer-host').click();
    await expect(host.locator('#multiplayer-status')).toContainText('Pokój aktywny');
    const code = await host.locator('#multiplayer-room-key').inputValue();

    const guest = await guestContext.newPage();
    await guest.goto('/nocny-kurs/#room=' + code);
    await expect(guest.locator('#multiplayer-status')).toContainText('du spelar som P2');
    await expect(guest.locator('#overlay')).toHaveClass(/hidden/);
    await expect.poll(() => relay.guestSnapshots.some(state => state.running && state.statusKey === 'enRoute')).toBe(true);
    await expect(guest.locator('#status')).toHaveText('LAGET ÄR PÅ VÄG');
    await expect(host.locator('#status')).toHaveText('EKIPA W DRODZE');
    await guest.locator('#language-select').selectOption('pl');
    await expect(guest.locator('#status')).toHaveText('EKIPA W DRODZE');
  } finally {
    await guestContext.close();
    await hostContext.close();
    await new Promise((resolve, reject) => wsServer.close(error => error ? reject(error) : resolve()));
  }
});


test('guards fire on sight, ignore friendly fire, and investigate gunshots for three seconds', async ({ page }) => {
  // Instrument only the served test copy, without production debug globals.
  await page.route('**/nocny-kurs/game.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const anchor = '  function gameSnapshot(){';
    expect(source).toContain(anchor);
    const hooks = `
      window.__testGuardCombat = {
        spawned: () => guards.length,
        setup: ({ covered = false, ally = false } = {}) => {
          buildings = []; cars = []; carRespawns = []; bullets = [];
          const p = players[0];
          p.car = null; p.x = 1200; p.y = 1000;
          p.alive = true; p.health = 3; p.invuln = 100;
          p.facing = 0; p.bodyFacing = 0; p.recentGunfire = 0;
          p.fireHeld = false; p.fireCooldown = 0; p.stun = 0;
          guards = [{ id: 900, x: 1000, y: 1000, color: '#f18161', facing: 0,
            walk: 0, stun: 0, hp: 2, fireCooldown: 0 }];
          if (ally) guards.push({ id: 901, x: 1100, y: 1000, color: '#e8a14e',
            facing: 0, walk: 0, stun: 0, hp: 2, fireCooldown: 999 });
          if (covered) buildings.push({ x: 1098, y: 970, w: 36, h: 60 });
        },
        firePlayer: () => {
          const p = players[0]; p.fireHeld = true; p.fireCooldown = 0;
          shoot(p); p.fireHeld = false;
        },
        advance: frames => {
          for (let i = 0; i < frames; i++) update(1 / 60);
          return {
            guardShots: bullets.filter(b => b.team === 'guard').length,
            x: guards[0].x, walk: guards[0].walk,
            allyHp: guards[1]?.hp,
            recent: players[0].recentGunfire
          };
        }
      };
    `;
    await route.fulfill({ response, body: source.replace(anchor, hooks + anchor) });
  });

  await page.goto('/nocny-kurs/');
  await page.locator('#start').click();
  const result = await page.evaluate(() => {
    const combat = window.__testGuardCombat;
    const spawned = combat.spawned();
    combat.setup({ ally: true });
    const visible = combat.advance(17);
    combat.setup({ covered: true });
    const idle = combat.advance(12);
    combat.firePlayer();
    const following = combat.advance(18);
    const expired = combat.advance(180);
    return { spawned, visible, idle, following, expired };
  });

  expect(result.spawned).toBe(12);
  expect(result.visible.guardShots).toBeGreaterThan(0);
  expect(result.visible.allyHp).toBe(2);
  expect(result.idle.x).toBe(1000);
  expect(result.idle.guardShots).toBe(0);
  expect(result.following.x).toBeGreaterThan(result.idle.x);
  expect(result.following.guardShots).toBe(0);
  expect(result.following.recent).toBeGreaterThan(0);
  expect(result.expired.recent).toBe(0);
  expect(result.expired.walk).toBe(0);
});


test('local play paints the map and a player in both supported languages without renderer errors', async ({ browser }) => {
  for (const locale of ['pl-PL', 'sv-SE']) {
    const context = await browser.newContext({ locale });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        const originalFillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
          if (value === 'P1') window.__paintedPlayerLabels = (window.__paintedPlayerLabels || 0) + 1;
          return originalFillText.call(this, value, ...args);
        };
      });
      await page.goto('/nocny-kurs/');
      await page.locator('#start').click();
      await expect(page.locator('#overlay')).toHaveClass(/hidden/);
      await expect(page.locator('#player-count')).toHaveText('1');
      await expect.poll(() => page.evaluate(() => window.__paintedPlayerLabels || 0)).toBeGreaterThan(0);
      const uniqueColors = await page.locator('#city').evaluate(canvas => {
        const context2d = canvas.getContext('2d');
        const { width, height } = canvas;
        const pixels = context2d.getImageData(0, 0, width, height).data;
        const colors = new Set();
        for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 14))) {
          for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 20))) {
            const offset = (y * width + x) * 4;
            colors.add(pixels[offset] + ',' + pixels[offset + 1] + ',' + pixels[offset + 2]);
          }
        }
        return colors.size;
      });
      expect(uniqueColors).toBeGreaterThan(12);
      expect(errors, 'uncaught errors in ' + locale + ': ' + errors.join('; ')).toEqual([]);
    } finally {
      await context.close();
    }
  }
});
