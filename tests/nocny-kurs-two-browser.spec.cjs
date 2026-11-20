const { test, expect } = require('@playwright/test');

// A tiny relay implementing the messages the production sockets service sends.
// It exercises real WebSocket traffic in two browser contexts without needing
// public-server availability or its GitHub Pages Origin allowlist in CI.
class LocalRoomRelay {
  constructor() {
    this.rooms = new Map();
    this.nextPeerId = 1;
    this.guestSnapshots = [];
    this.guestInputs = [];
  }

  attach(socket, browserName) {
    const peer = { id: 'peer-' + this.nextPeerId++, socket, browserName, roomId: null };
    const send = (recipient, message) => {
      if (recipient.browserName === 'guest' && message.type === 'data' &&
          message.payload?.kind === 'snapshot') {
        this.guestSnapshots.push(message.payload.state);
      }
      recipient.socket.send(JSON.stringify(message));
    };

    socket.onMessage(raw => {
      let message;
      try { message = JSON.parse(raw); } catch { return; }
      if (message.type === 'join') {
        const roomId = message.game + ':' + message.key;
        let room = this.rooms.get(roomId);
        if (!room) {
          room = [];
          this.rooms.set(roomId, room);
        }
        const priorPeers = room.map(member => member.id);
        peer.roomId = roomId;
        room.push(peer);
        send(peer, { type: 'joined', peerId: peer.id, peers: priorPeers });
        for (const member of room) {
          if (member !== peer) send(member, { type: 'peer_joined', peerId: peer.id });
        }
      } else if (message.type === 'data' && peer.roomId) {
        if (peer.browserName === 'guest' && message.payload?.kind === 'input') {
          this.guestInputs.push(message.payload);
        }
        for (const member of this.rooms.get(peer.roomId) || []) {
          if (member !== peer) send(member, { type: 'data', from: peer.id, payload: message.payload });
        }
      }
    });

    socket.onClose(() => {
      if (!peer.roomId) return;
      const room = this.rooms.get(peer.roomId) || [];
      this.rooms.set(peer.roomId, room.filter(member => member !== peer));
      for (const member of room) {
        if (member !== peer) send(member, { type: 'peer_left', peerId: peer.id });
      }
    });
  }
}

test('two browser sessions stay synchronized when the host tab is in the background', async ({ browser }) => {
  const relay = new LocalRoomRelay();
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    await hostContext.routeWebSocket('wss://gra.w.korzec-it.pl/ws', socket => relay.attach(socket, 'host'));
    await guestContext.routeWebSocket('wss://gra.w.korzec-it.pl/ws', socket => relay.attach(socket, 'guest'));

    const host = await hostContext.newPage();
    await host.goto('/nocny-kurs/');
    await host.locator('#multiplayer-host').click();
    const codeField = host.locator('#multiplayer-room-key');
    await expect(codeField).toHaveValue(/^[A-Z]{6}$/);
    const code = await codeField.inputValue();

    const guest = await guestContext.newPage();
    await guest.goto('/nocny-kurs/#room=' + code);
    await expect(guest.locator('#multiplayer-status')).toContainText('grasz jako P2');
    await expect(host.locator('#multiplayer-status')).toContainText('gracz dołączył');

    await host.locator('#start').click();
    await expect(host.locator('#overlay')).toHaveClass(/hidden/);
    await expect(guest.locator('#overlay')).toHaveClass(/hidden/);
    await expect.poll(() => relay.guestSnapshots.filter(s => s.running).length).toBeGreaterThan(1);

    const baseline = relay.guestSnapshots.at(-1);
    expect(baseline.players).toHaveLength(2);
    expect(baseline.cars.length).toBeGreaterThan(0);
    const carsAtStart = new Map(baseline.cars.map(car => [car.id, { x: car.x, y: car.y }]));
    const receivedBeforeBackground = relay.guestSnapshots.length;

    // An actual second tab makes the host document hidden (no fake visibility
    // flags), so requestAnimationFrame is no longer a reliable simulation clock.
    const activeHostTab = await hostContext.newPage();
    await activeHostTab.goto('about:blank');
    await activeHostTab.bringToFront();
    await guest.bringToFront();
    await expect.poll(() => host.evaluate(() => document.visibilityState)).toBe('hidden');

    await guest.keyboard.down('d');
    await expect.poll(() => relay.guestInputs.length).toBeGreaterThan(0);

    // Observe authoritative car positions delivered to the guest after the host
    // was backgrounded. Static snapshots alone are not sufficient for this test.
    await expect.poll(() => relay.guestSnapshots.slice(receivedBeforeBackground).some(state =>
      state.running && state.cars.some(car => {
        const initial = carsAtStart.get(car.id);
        return initial && Math.hypot(car.x - initial.x, car.y - initial.y) > 12;
      })
    ), { timeout: 20000 }).toBe(true);

    expect(await host.evaluate(() => document.visibilityState)).toBe('hidden');
    await guest.keyboard.up('d');
    expect(relay.guestInputs.some(input => input.dx > 0)).toBe(true);
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});
