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
    // Expose game-owned decal arrays through test-served scripts only. Real
    // gameplay uses the same addDeathRemain and skidMarks collection paths.
    const exposeDecals = async context => {
      await context.route('**/nocny-kurs/game.js*', async route => {
        const response = await route.fetch();
        const source = await response.text();
        const anchor = '  function loop(now){';
        expect(source).toContain(anchor);
        const instrumentation = `
          window.__testDecals = () => ({
            marks: skidMarks.map(({id, age}) => ({id, age})),
            remains: deathRemains.map(({id, age}) => ({id, age}))
          });
          window.__testSpawnDecals = () => {
            const p = players[0];
            const origin = pos(p);
            const marks = [-9.5, 9.5].map(side => {
              const mark = {id:visualSync.nextMarkId(),x:origin.x+side,y:origin.y+10,
                angle:0,age:0,lifetime:SKID_MARK_LIFETIME};
              skidMarks.push(mark);
              return mark.id;
            });
            addDeathRemain(p,origin.x+28,origin.y+20);
            const bodyId = deathRemains.at(-1).id;
            addDeathRemain(p,origin.x+48,origin.y+20);
            const outline = deathRemains.at(-1);
            const outlineId = outline.id;
            outline.age = DEATH_BODY_LIFETIME - .2;
            return {markIds:marks,bodyId,outlineId};
          };
        `;
        await route.fulfill({response,body:source.replace(anchor,instrumentation+'\\n'+anchor)});
      });
    };
    await exposeDecals(hostContext);
    await exposeDecals(guestContext);
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
    const hostWorkerCreated = host.waitForEvent('worker');
    await host.locator('#multiplayer-host').click();
    await expect(host.locator('#overlay')).toHaveClass(/hidden/);
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

    // The host creates two actual track decals and two body remains. The
    // second remain is nearly chalk to cover the transition quickly.
    const decals = await host.evaluate(() => window.__testSpawnDecals());
    const guestHasDecals = async page => page.evaluate(ids => {
      const visual = window.__testDecals?.();
      return Boolean(visual &&
        ids.markIds.every(id => visual.marks.some(mark => mark.id === id)) &&
        visual.remains.some(body => body.id === ids.bodyId) &&
        visual.remains.some(body => body.id === ids.outlineId));
    }, decals);
    await expect.poll(() => guestHasDecals(guest)).toBe(true);

    // A player joining after those events receives the short history replay
    // without requiring a larger full-history packet at 60 Hz.
    const lateGuest = await guestContext.newPage();
    await lateGuest.goto('/nocny-kurs/#room=' + code);
    await expect(lateGuest.locator('#multiplayer-status')).toContainText('grasz jako P3');
    await expect.poll(() => guestHasDecals(lateGuest), {timeout:6000}).toBe(true);

    await expect.poll(() => lateGuest.evaluate(id =>
      window.__testDecals?.().remains.some(body => body.id === id && body.age >= 10),
      decals.outlineId), {timeout:5000}).toBe(true);
    await expect.poll(() => guest.evaluate(ids =>
      !window.__testDecals?.().marks.some(mark => ids.includes(mark.id)),
      decals.markIds), {timeout:6500}).toBe(true);
    expect(await guest.evaluate(id =>
      window.__testDecals?.().remains.some(body => body.id === id),
      decals.bodyId)).toBe(true);
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
