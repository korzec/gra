const { test, expect } = require("@playwright/test");

test("Mikro Sprint is linked from the catalog and runs a pool race", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a.game-card[href="micro-m/"]')).toBeVisible();
  await expect(page.locator(".game-count")).toContainText("04 GRY");
  await page.locator('a.game-card[href="micro-m/"]').click();
  await expect(page).toHaveURL(/\/micro-m\/$/);
  await expect(page.locator('input[name="track"]')).toHaveCount(2);
  await expect(page.locator('input[name="track"][value="pool"]')).toBeChecked();
  await page.locator("#start").click();
  await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");
  const first = await page.evaluate(() => window.__mikroSprint.cars[0]);
  await page.keyboard.down("w");
  await page.waitForTimeout(650);
  await page.keyboard.up("w");
  const second = await page.evaluate(() => window.__mikroSprint.cars[0]);
  expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThan(15);
  expect(await page.evaluate(() => window.__mikroSprint.pickups)).toBe(16);
});

test("The bathtub race supports multiple people and touch controls", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto("/micro-m/");
    await page.locator('label.track-choice').nth(1).click();
    await expect(page.locator('input[name="track"][value="bath"]')).toBeChecked();
    await page.locator("#players").selectOption("2");
    // Isolate pedal mechanics from edge knockouts by removing the bots.
    await page.locator("#bots").selectOption("0");
    await page.locator("#start").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");
    expect(await page.evaluate(() => window.__mikroSprint.track)).toBe("bath");
    expect(await page.evaluate(() => window.__mikroSprint.cars.filter(c => c.human).length)).toBe(2);
    await expect(page.locator("#touch-controls")).toBeVisible();
    const first = await page.evaluate(() => window.__mikroSprint.cars[0]);
    await page.locator('[data-control="gas"]').dispatchEvent("pointerdown", { pointerId: 101, pointerType: "touch" });
    await page.waitForTimeout(700);
    await page.locator('[data-control="gas"]').dispatchEvent("pointerup", { pointerId: 101, pointerType: "touch" });
    const second = await page.evaluate(() => window.__mikroSprint.cars[0]);
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThan(15);
  } finally {
    await context.close();
  }
});

test("Fullscreen race locks page scrolling, prevents mobile zoom and supports an analog stick", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto("/micro-m/");
    const fullScreen = await page.evaluate(() => ({
      stage: document.querySelector("#game-stage").getBoundingClientRect().height,
      viewport: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      gestureTouch: getComputedStyle(document.querySelector("#race")).touchAction,
      menuTouch: getComputedStyle(document.querySelector("#overlay")).touchAction
    }));
    expect(Math.abs(fullScreen.stage - fullScreen.viewport)).toBeLessThan(3);
    expect(fullScreen.pageHeight).toBeLessThanOrEqual(fullScreen.viewport + 2);
    expect(fullScreen.gestureTouch).toBe("none");
    expect(fullScreen.menuTouch).toContain("pan-y");

    await page.locator("#start").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");
    expect(await page.evaluate(() => "minimap" in window.__mikroSprint)).toBe(false);
    for (const id of ["position", "lap", "time"]) await expect(page.locator("#" + id)).toHaveCount(0);
    const scoreboard = await page.locator("#scoreboard").boundingBox();
    expect(scoreboard).not.toBeNull();
    expect(scoreboard.x + scoreboard.width).toBeGreaterThan(375);
    expect(scoreboard.y).toBeGreaterThan(50);
    expect(scoreboard.y).toBeLessThan(90);

    await expect(page.locator("#steering-stick")).toBeVisible();
    await expect(page.locator('[data-control="gas"]')).toBeVisible();
    await expect(page.locator('[data-control="brake"]')).toBeVisible();
    await expect(page.locator('[data-control="fire"]')).toBeVisible();
    const stick = await page.locator("#steering-stick").boundingBox();
    await page.locator("#steering-stick").dispatchEvent("pointerdown", {
      pointerId: 77, pointerType: "touch", clientX: stick.x + stick.width / 2, clientY: stick.y + stick.height / 2
    });
    await page.locator("#steering-stick").dispatchEvent("pointermove", {
      pointerId: 77, pointerType: "touch", clientX: stick.x + stick.width * 0.8, clientY: stick.y + stick.height * 0.25
    });
    await expect(page.locator("#steering-stick")).toHaveClass(/is-active/);
    const offset = await page.locator("#steering-stick").evaluate(node => node.style.getPropertyValue("--stick-x"));
    expect(parseFloat(offset)).toBeGreaterThan(0);
    await page.locator("#steering-stick").dispatchEvent("pointerup", { pointerId: 77, pointerType: "touch" });
    await expect(page.locator("#steering-stick")).not.toHaveClass(/is-active/);

    const blocking = await page.evaluate(() => {
      const gesture = new Event("gesturestart", { cancelable: true, bubbles: true });
      document.dispatchEvent(gesture);
      const move = new Event("touchmove", { cancelable: true, bubbles: true });
      document.querySelector("#race").dispatchEvent(move);
      return { gesture: gesture.defaultPrevented, move: move.defaultPrevented, scrollY: window.scrollY };
    });
    expect(blocking.gesture).toBe(true);
    expect(blocking.move).toBe(true); // Prevent native page panning during a race.
    expect(blocking.scrollY).toBe(0);

    await page.locator("#pause").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state)).toBe("paused");
    await expect(page.locator("#overlay")).toBeVisible();
    await page.locator("#start").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state)).toBe("racing");
  } finally {
    await context.close();
  }
});

test("Analog and action controls retain independent pointers and reset on interruption", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto("/micro-m/");
    await page.locator("#start").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");

    const stick = page.locator("#steering-stick");
    const stickBounds = await stick.boundingBox();
    const cx = stickBounds.x + stickBounds.width / 2;
    const cy = stickBounds.y + stickBounds.height / 2;
    await stick.dispatchEvent("pointerdown", { pointerId: 201, pointerType: "touch", clientX: cx, clientY: cy });
    await stick.dispatchEvent("pointermove", { pointerId: 201, pointerType: "touch", clientX: cx + 23, clientY: cy - 32 });
    const before = await page.evaluate(() => window.__mikroSprint.touch);
    expect(before.x).toBeGreaterThan(0);
    expect(before.y).toBeLessThan(0);
    expect(before.stickPointerId).toBe(201);
    await stick.dispatchEvent("pointerdown", { pointerId: 202, pointerType: "touch", clientX: cx - 23, clientY: cy + 32 });
    await stick.dispatchEvent("pointerup", { pointerId: 202, pointerType: "touch" });
    expect((await page.evaluate(() => window.__mikroSprint.touch)).stickPointerId).toBe(201);

    const gas = page.locator('[data-control="gas"]');
    const fire = page.locator('[data-control="fire"]');
    await gas.dispatchEvent("pointerdown", { pointerId: 203, pointerType: "touch" });
    await gas.dispatchEvent("pointerdown", { pointerId: 204, pointerType: "touch" });
    await fire.dispatchEvent("pointerdown", { pointerId: 205, pointerType: "touch" });
    const active = await page.evaluate(() => window.__mikroSprint.touch);
    expect(active.gas).toBe(true);
    expect(active.fire).toBe(true);
    expect(active.x).toBeGreaterThan(0);
    await gas.dispatchEvent("pointerup", { pointerId: 203, pointerType: "touch" });
    expect((await page.evaluate(() => window.__mikroSprint.touch)).gas).toBe(true);
    await gas.dispatchEvent("pointercancel", { pointerId: 204, pointerType: "touch" });
    expect((await page.evaluate(() => window.__mikroSprint.touch)).gas).toBe(false);
    await fire.dispatchEvent("pointercancel", { pointerId: 205, pointerType: "touch" });
    expect((await page.evaluate(() => window.__mikroSprint.touch)).fire).toBe(false);
    await stick.dispatchEvent("pointercancel", { pointerId: 201, pointerType: "touch" });
    const cleared = await page.evaluate(() => window.__mikroSprint.touch);
    expect(cleared.stickPointerId).toBe(null);
    expect(cleared.x).toBe(0);
    expect(cleared.y).toBe(0);

    // A focus loss should clear all input and pause rather than leaving the car accelerating.
    await gas.dispatchEvent("pointerdown", { pointerId: 206, pointerType: "touch" });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    expect((await page.evaluate(() => window.__mikroSprint.touch)).gas).toBe(false);
    await expect(page.locator("#overlay")).toBeVisible();
    expect(await page.evaluate(() => window.__mikroSprint.state)).toBe("paused");
    await page.locator("#start").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state)).toBe("racing");
    expect((await page.evaluate(() => window.__mikroSprint.touch)).gas).toBe(false);
  } finally {
    await context.close();
  }
});

test("Holding the gas pedal cannot scroll the page, and the menu stays scrollable", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  try {
    await page.goto("/micro-m/");
    await page.locator("#start").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");
    const gas = page.locator('[data-control="gas"]');
    await expect(gas).toBeVisible();

    // Browser-default touch behaviors are canceled, not the underlying
    // Pointer Events used by the joystick, gas, brake and fire buttons.
    const guard = await page.evaluate(() => {
      const gas = document.querySelector('[data-control="gas"]');
      const label = gas.querySelector("small");
      const start = new Event("touchstart", { cancelable: true, bubbles: true });
      label.dispatchEvent(start);
      const move = new Event("touchmove", { cancelable: true, bubbles: true });
      label.dispatchEvent(move);
      const menuMove = new Event("touchmove", { cancelable: true, bubbles: true });
      const menu = document.querySelector("#overlay");
      return {
        startPrevented: start.defaultPrevented,
        movePrevented: move.defaultPrevented,
        labelPointerEvents: getComputedStyle(label).pointerEvents,
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
        beforeY: scrollY,
        menuMoveDuringRace: (menu.dispatchEvent(menuMove), menuMove.defaultPrevented)
      };
    });
    expect(guard.startPrevented).toBe(true);
    expect(guard.movePrevented).toBe(true);
    expect(guard.labelPointerEvents).toBe("none");
    expect(guard.menuMoveDuringRace).toBe(true);
    expect(guard.pageHeight).toBeLessThanOrEqual(guard.viewportHeight + 2);

    const box = await gas.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const before = await page.evaluate(() => window.__mikroSprint.cars[0]);
    const cdp = await context.newCDPSession(page);
    try {
      // A real browser touch sequence, with deliberate finger drift.
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart", touchPoints: [{ x, y, id: 11 }]
      });
      await page.waitForTimeout(350);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x: x - 10, y: y - 70, id: 11 }]
      });
      await page.waitForTimeout(500);
      const during = await page.evaluate(() => ({
        scrollY, offsetTop: visualViewport?.offsetTop ?? 0,
        gas: window.__mikroSprint.touch.gas,
        rectTop: document.querySelector("#game-stage").getBoundingClientRect().top,
        car: window.__mikroSprint.cars[0]
      }));
      expect(during.scrollY).toBe(0);
      expect(Math.abs(during.rectTop)).toBeLessThan(2);
      expect(during.gas).toBe(true);
      expect(Math.hypot(during.car.x - before.x, during.car.y - before.y)).toBeGreaterThan(15);
    } finally {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    }
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.touch.gas)).toBe(false);

    await page.locator("#pause").click();
    await expect(page.locator("#overlay")).toBeVisible();
    const menuGesture = await page.evaluate(() => {
      const touch = new Event("touchmove", { cancelable: true, bubbles: true });
      document.querySelector("#overlay").dispatchEvent(touch);
      return { prevented: touch.defaultPrevented, state: window.__mikroSprint.state };
    });
    expect(menuGesture.state).toBe("paused");
    expect(menuGesture.prevented).toBe(false);
  } finally {
    await context.close();
  }
});

test("Mobile controls are not clipped by a fixed ancestor and remain in viewport while racing", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  try {
    await page.goto("/micro-m/");
    await page.locator("#start").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");

    const structure = await page.evaluate(() => {
      const controls = document.querySelector("#touch-controls");
      const shell = document.querySelector(".game-shell");
      const root = document.querySelector(".page");
      const stage = document.querySelector("#game-stage");
      const gas = document.querySelector('[data-control="gas"]');
      const r = gas.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      return {
        sibling: controls.parentElement === root && shell.parentElement === root,
        shellFixed: getComputedStyle(shell).position === "fixed",
        rootRelative: getComputedStyle(root).position === "relative",
        rootOverflow: getComputedStyle(root).overflow,
        bodyLocked: getComputedStyle(document.body).touchAction,
        stageTop: sr.top, stageHeight: sr.height, gasBottom: r.bottom,
        viewHeight: innerHeight, documentHeight: document.documentElement.scrollHeight
      };
    });
    expect(structure.sibling).toBe(true);
    expect(structure.shellFixed).toBe(true);
    expect(structure.rootRelative).toBe(true);
    expect(structure.rootOverflow).toBe("visible");
    expect(structure.bodyLocked).toBe("none");
    expect(Math.abs(structure.stageTop)).toBeLessThan(2);
    expect(Math.abs(structure.stageHeight - structure.viewHeight)).toBeLessThan(3);
    expect(structure.gasBottom).toBeLessThanOrEqual(structure.viewHeight);
    expect(structure.documentHeight).toBeLessThanOrEqual(structure.viewHeight + 2);

    // Simulate browser UI changes: dynamic viewport becomes shorter.
    await page.setViewportSize({ width: 390, height: 740 });
    const resized = await page.evaluate(() => {
      const stage = document.querySelector("#game-stage").getBoundingClientRect();
      const gas = document.querySelector('[data-control="gas"]').getBoundingClientRect();
      return {
        stageTop: stage.top, stageBottom: stage.bottom,
        gasBottom: gas.bottom, windowHeight: innerHeight
      };
    });
    expect(Math.abs(resized.stageTop)).toBeLessThan(2);
    expect(resized.stageBottom).toBeLessThanOrEqual(resized.windowHeight + 2);
    expect(resized.gasBottom).toBeLessThanOrEqual(resized.windowHeight);

    const gasButton = page.locator('[data-control="gas"]');
    const box = await gasButton.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const cdp = await context.newCDPSession(page);
    try {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart", touchPoints: [{ id: 31, x, y }]
      });
      await page.waitForTimeout(250);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ id: 31, x: x - 10, y: y - 38 }]
      });
      await page.waitForTimeout(650);
      const held = await page.evaluate(() => {
        const stage = document.querySelector("#game-stage").getBoundingClientRect();
        const pedal = document.querySelector('[data-control="gas"]').getBoundingClientRect();
        return {
          scrollTop: document.scrollingElement.scrollTop,
          scrollY, visualOffset: visualViewport?.offsetTop ?? 0,
          gasHeld: window.__mikroSprint.touch.gas,
          stageTop: stage.top,
          stageBottom: stage.bottom,
          gasBottom: pedal.bottom, windowHeight: innerHeight
        };
      });
      expect(held.scrollTop).toBe(0);
      expect(held.scrollY).toBe(0);
      expect(Math.abs(held.stageTop)).toBeLessThan(2);
      expect(held.stageBottom).toBeLessThanOrEqual(held.windowHeight + 2);
      expect(held.gasBottom).toBeLessThanOrEqual(held.windowHeight);
      expect(held.gasHeld).toBe(true);
    } finally {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    }

    await page.locator("#pause").click();
    expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).not.toBe("none");
    await expect(page.locator("#overlay")).toBeVisible();
    await page.locator("#start").click();
    expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).toBe("none");
  } finally {
    await context.close();
  }
});

test("Car-relative controls turn in vehicle space and preserve coasting", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto("/micro-m/");
    // Isolate driving physics from elimination by faster opponents.
    await page.locator("#players").selectOption("1");
    await page.locator("#bots").selectOption("0");
    await page.locator("#start").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");
    const wrapped = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
    const initial = await page.evaluate(() => window.__mikroSprint.cars[0]);

    // W accelerates along the car's heading without changing its compass direction.
    await page.keyboard.down("w");
    await page.waitForTimeout(450);
    await page.keyboard.up("w");
    const forward = await page.evaluate(() => window.__mikroSprint.cars[0]);
    expect(Math.abs(wrapped(forward.angle - initial.angle))).toBeLessThan(0.1);
    expect(Math.hypot(forward.x - initial.x, forward.y - initial.y)).toBeGreaterThan(10);

    // D turns clockwise and A counterclockwise, regardless of map direction.
    await page.keyboard.down("d");
    await page.waitForTimeout(300);
    await page.keyboard.up("d");
    const right = await page.evaluate(() => window.__mikroSprint.cars[0]);
    expect(wrapped(right.angle - forward.angle)).toBeGreaterThan(0.08);
    await page.keyboard.down("a");
    await page.waitForTimeout(220);
    await page.keyboard.up("a");
    const left = await page.evaluate(() => window.__mikroSprint.cars[0]);
    expect(wrapped(left.angle - right.angle)).toBeLessThan(-0.05);

    // Right on the touch stick makes another clockwise turn, not an east target.
    const stick = page.locator("#steering-stick");
    const bounds = await stick.boundingBox();
    const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
    await stick.dispatchEvent("pointerdown", { pointerId: 741, pointerType: "touch", clientX: cx, clientY: cy });
    await stick.dispatchEvent("pointermove", { pointerId: 741, pointerType: "touch", clientX: cx + bounds.width * 0.32, clientY: cy });
    const vector = await page.evaluate(() => window.__mikroSprint.touch);
    expect(vector.x).toBeGreaterThan(0);
    expect(Math.abs(vector.y)).toBeLessThan(0.001);
    await page.waitForTimeout(220);
    const touchRight = await page.evaluate(() => window.__mikroSprint.cars[0]);
    expect(wrapped(touchRight.angle - left.angle)).toBeGreaterThan(0.04);
    await stick.dispatchEvent("pointerup", { pointerId: 741, pointerType: "touch" });

    // Releasing controls does not reset the velocity.
    const beforeCoast = await page.evaluate(() => window.__mikroSprint.cars[0]);
    expect(Math.hypot(beforeCoast.vx, beforeCoast.vy)).toBeGreaterThan(1);
    await page.waitForTimeout(100);
    const afterCoast = await page.evaluate(() => window.__mikroSprint.cars[0]);
    expect(Math.hypot(afterCoast.x - beforeCoast.x, afterCoast.y - beforeCoast.y)).toBeGreaterThan(0.5);
  } finally {
    await context.close();
  }
});

test("Two browser clients join one dedicated Mikro Sprint room and receive input acknowledgments", async ({ browser }) => {
  const { WebSocketServer } = require("ws");
  const { once } = require("node:events");
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const url = "ws://127.0.0.1:" + server.address().port;
  const users = new Map(), inputs = [];
  let track = "pool", tick = 0, snapshotsPaused = false, serverShots = [];
  let serverCamera = { x: 400, y: 700, scale: 1 };
  const cars = Array.from({ length: 4 }, (_, id) => ({
    id, human: false, x: 340 + id * 32, y: 696, angle: 0, vx: 0, vy: 0,
    speed: 0, steer: 0, index: 0, safeIndex: 0, lastIndex: 0,
    raceProgress: id === 1 ? 0.08 : 0, name: id === 1 ? "Łukasz" : "",
    botDistance: 0, botSpeed: 0, gate: 1, lap: 0,
    offroad: 0, invuln: 0, turbo: 0, gun: 0, hit: 0, weapon: "", fireCooldown: 0, shotSerial: 0, eliminated: false,
    actionHeld: false, botCooldown: 1, finishAt: null, smoke: 0,
    lastAppliedInputSeq: 0
  }));
  function send(ws, data) {
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
  }
  function snapshot() {
    return { tick: ++tick, track, phase: "racing", countdown: 0,
      raceTime: tick / 30, winnerId: null, matchRound: 1,
      camera: { ...serverCamera },
      cars: cars.map(c => ({ ...c })), pickups: [], shots: serverShots.map(s => ({ ...s })) };
  }
  function broadcast() {
    if (snapshotsPaused) return;
    const data = { type: "data", from: "mikro-sprint-server",
      payload: { kind: "snapshot", state: snapshot() } };
    for (const ws of users.keys()) send(ws, data);
  }
  server.on("connection", ws => {
    ws.on("message", raw => {
      const packet = JSON.parse(raw.toString());
      if (packet.type === "join") {
        if (!users.size) track = packet.track === "bath" ? "bath" : "pool";
        const slot = users.size;
        if (slot >= 4) return;
        const peerId = "peer-" + (slot + 1);
        users.set(ws, { slot, peerId });
        cars[slot].human = true;
        send(ws, { type: "joined", peerId, hostPeerId: "mikro-sprint-server", peers: [] });
        send(ws, { type: "data", from: "mikro-sprint-server",
          payload: { kind: "welcome", to: peerId, hostId: "mikro-sprint-server",
            playerId: slot + 1 } });
        send(ws, { type: "data", from: "mikro-sprint-server",
          payload: { kind: "snapshot", state: snapshot() } });
      } else if (packet.type === "probe") {
        send(ws, { type: "probe_ack", nonce: packet.nonce });
      } else if (packet.type === "data" && packet.payload?.kind === "input") {
        const user = users.get(ws);
        if (!user) return;
        const input = packet.payload;
        inputs.push({ slot: user.slot, ...input });
        cars[user.slot].lastAppliedInputSeq = input.seq;
      } else if (packet.type === "data" && packet.payload?.kind === "ping") {
        send(ws, { type: "data", from: "mikro-sprint-server",
          payload: { kind: "pong", to: users.get(ws)?.peerId,
            sentAt: packet.payload.sentAt } });
      }
    });
    ws.on("close", () => {
      const user = users.get(ws);
      if (user) cars[user.slot].human = false;
      users.delete(ws);
    });
  });
  const timer = setInterval(broadcast, 1000 / 30);
  let context;
  try {
    context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
    });
    await context.addInitScript(wsUrl => { window.__MIKRO_SPRINT_WS_URL__ = wsUrl; }, url);
    const p1 = await context.newPage();
    await p1.goto("/micro-m/");
    await p1.locator("label.track-choice").nth(1).click();
    await p1.locator("#online-create").click();
    await expect.poll(() => p1.evaluate(() => window.__mikroSprint.multiplayer.connected)).toBe(true);
    expect(p1.url()).toMatch(/#room=[A-Z]{6}$/);
    expect(await p1.evaluate(() => window.__mikroSprint.multiplayer.playerId)).toBe(1);
    expect(await p1.evaluate(() => window.__mikroSprint.track)).toBe("bath");

    const p2 = await context.newPage();
    await p2.goto(p1.url());
    await expect.poll(() => p2.evaluate(() => window.__mikroSprint.multiplayer.connected)).toBe(true);
    expect(await p2.evaluate(() => window.__mikroSprint.multiplayer.playerId)).toBe(2);
    await expect.poll(() => p1.evaluate(() =>
      window.__mikroSprint.cars.filter(car => car.human).length)).toBe(2);
    for (const page of [p1, p2]) {
      await expect(page.locator(".score-leader:visible")).toHaveAttribute("title", /Łukasz/);
      await expect(page.locator(".score-leader:visible")).toBeVisible();
    }
    await expect(p1.locator("#online-room")).toBeVisible();
    await expect(p2.locator("#online-room")).toBeVisible();
    await expect(p2.locator("#online-room-code")).toHaveText(/^[A-Z]{6}$/);
    await expect(p2.locator(".top-actions .back")).toHaveCount(0);
    await expect(p2.locator("#online-copy svg")).toBeVisible();
    const headerLayout = await p2.evaluate(() => {
      const box = id => {
        const { left, right, top, bottom } = document.querySelector(id).getBoundingClientRect();
        return { left, right, top, bottom };
      };
      return { room: box("#online-room"), home: box("#online-leave"), width: innerWidth };
    });
    expect(headerLayout.room.top).toBeGreaterThanOrEqual(0);
    expect(headerLayout.room.bottom).toBeLessThan(60);
    expect(headerLayout.room.right).toBeLessThan(headerLayout.home.left);
    expect(headerLayout.home.right).toBeLessThanOrEqual(headerLayout.width);
    await expect(p2.locator('[data-control="gas"]')).toBeVisible();

    const gas = p2.locator('[data-control="gas"]');
    await gas.dispatchEvent("pointerdown", { pointerId: 82, pointerType: "touch" });
    await expect.poll(() => inputs.some(input => input.slot === 1 && input.gas > 0),
      { timeout: 7000 }).toBe(true);
    await gas.dispatchEvent("pointerup", { pointerId: 82, pointerType: "touch" });
    await expect.poll(() => p2.evaluate(() =>
      window.__mikroSprint.multiplayer.lastTick > 2)).toBe(true);
    const net = await p2.evaluate(() => window.__mikroSprint.multiplayer);
    expect(net.pending).toBeLessThan(40);
    expect(Number.isFinite(net.correction.x)).toBe(true);
    expect(Number.isFinite(net.correction.y)).toBe(true);
    expect(p2.url()).toContain("#room=");
    // Arm the second driver, then stop all snapshots while steering and firing.
    // Put the armed driver on the actual doubled bath track, with an unobstructed
    // line of fire. The original mock grid had a rival 32 units ahead, so
    // projectiles hit immediately and never reached a rendered frame.
    Object.assign(cars[1], {x:1256,y:1542,angle:0,vx:50,vy:0,trackDistance:640,
      offroad:0,gun:2,weapon:"machinegun",fireCooldown:0,shotSerial:0});
    for (const id of [0,2,3]) Object.assign(cars[id], {x:800+id*30,y:1200,invuln:10});
    serverCamera = {x:1256,y:1542,scale:1};
    await expect.poll(() => p2.evaluate(() => window.__mikroSprint.cars[1].gun)).toBe(2);
    await expect.poll(() => p2.evaluate(() => window.__mikroSprint.camera.x)).toBe(1256);
    snapshotsPaused = true;
    await p2.waitForTimeout(80); // Drain the last in-flight frame.
    const before = await p2.evaluate(() => ({
      tick: window.__mikroSprint.multiplayer.lastTick, car: window.__mikroSprint.displayedDriver
    }));
    await p2.keyboard.down("w");
    await p2.keyboard.down("d");
    await p2.keyboard.down("e");
    let predicted;
    try {
      await expect.poll(async () => {
        predicted = await p2.evaluate(() => ({
          tick: window.__mikroSprint.multiplayer.lastTick, car: window.__mikroSprint.displayedDriver,
          shots: window.__mikroSprint.predictedShots.filter(shot => shot.owner === 1)
        }));
        return predicted.tick === before.tick && Math.abs(predicted.car.angle - before.car.angle) > 0.03 &&
          Math.hypot(predicted.car.x - before.car.x, predicted.car.y - before.car.y) > 1 &&
          predicted.shots.length > 0;
      }, {timeout: 2000}).toBe(true);
      expect(predicted.car.eliminated).toBe(false);
    } finally {
      await p2.keyboard.up("e");
      await p2.keyboard.up("d");
      await p2.keyboard.up("w");
    }
    // Server confirmation replaces the speculative shot, rather than appending a duplicate.
    const confirmed = predicted.shots[0];
    serverShots = [confirmed];
    cars[1].gun = 1; cars[1].shotSerial = 1; cars[1].fireCooldown = 0.5;
    snapshotsPaused = false;
    await expect.poll(() => p2.evaluate(() => window.__mikroSprint.multiplayer.lastTick)).toBeGreaterThan(before.tick);
    await expect.poll(() => p2.evaluate(id => window.__mikroSprint.predictedShots.filter(shot => shot.shotId === id).length, confirmed.shotId)).toBe(1);
    // Even though local movement is predicted, an elimination comes only from the server.
    cars[1].eliminated = true;
    await expect.poll(() => p2.evaluate(() => window.__mikroSprint.displayedDriver.eliminated)).toBe(true);
    await p2.evaluate(() => {
      window.__copiedMikroInvite = null;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async text => { window.__copiedMikroInvite = text; } }
      });
    });
    await p2.locator("#online-copy").click();
    await expect.poll(() => p2.evaluate(() => window.__copiedMikroInvite)).toBe(p2.url());
    await expect(p2.locator("#online-copy")).toHaveClass(/is-copied/);
    await p2.locator("#online-leave").click();
    await expect(p2).toHaveURL(/\/micro-m\/$/);
    await expect(p2.locator("#online-room")).toBeHidden();
    await expect(p2.locator("#overlay")).toBeVisible();
  } finally {
    clearInterval(timer);
    if (context) await context.close();
    for (const ws of server.clients) ws.terminate();
    await new Promise(resolve => server.close(resolve));
  }
});



test("Menu icon returns a local Mikro Sprint race to its start screen", async ({ page }) => {
  await page.goto("/micro-m/");
  await expect(page.locator("#online-leave svg")).toBeVisible();
  await expect(page.locator("#online-room")).toBeHidden();
  await page.locator("#start").click();
  await expect(page.locator("#overlay")).toBeHidden();
  await page.locator("#online-leave").click();
  await expect(page).toHaveURL(/\/micro-m\/$/);
  await expect(page.locator("#overlay")).toBeVisible();
  await expect(page.locator("#start")).toBeVisible();
});

test("Independent player and bot selectors allow eight local cars", async ({ page }) => {
  await page.goto("/micro-m/");
  await expect(page.locator("#players option")).toHaveCount(8);
  await expect(page.locator("#bots option")).toHaveCount(8);
  await page.locator("#players").selectOption("8");
  await expect(page.locator("#bots")).toHaveValue("0");
  await page.locator("#bots").selectOption("5");
  await expect(page.locator("#players")).toHaveValue("3");
  await page.locator("#players").selectOption("3");
  await page.locator("#bots").selectOption("5");
  await page.locator("#start").click();
  expect(await page.evaluate(() => ({
    cars: window.__mikroSprint.cars.length,
    humans: window.__mikroSprint.cars.filter(car => car.human).length
  }))).toEqual({ cars: 8, humans: 3 });
  await page.reload();
  await page.locator("#bots").selectOption("0");
  await page.locator("#players").selectOption("8");
  await page.locator("#start").click();
  expect(await page.evaluate(() => ({
    cars: window.__mikroSprint.cars.length,
    humans: window.__mikroSprint.cars.filter(car => car.human).length
  }))).toEqual({ cars: 8, humans: 8 });
});

test("Mobile controls are larger, translucent and overlay the race at portrait and landscape sizes", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto("/micro-m/");
    await page.locator("#start").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");

    for (const { width, height, minStick, minPedal } of [
      { width: 390, height: 844, minStick: 155, minPedal: 75 },
      { width: 320, height: 640, minStick: 128, minPedal: 64 },
      { width: 667, height: 375, minStick: 108, minPedal: 58 }
    ]) {
      await page.setViewportSize({ width, height });
      const layout = await page.evaluate(() => {
        const box = selector => {
          const { left, right, top, bottom, width, height } = document.querySelector(selector).getBoundingClientRect();
          return { left, right, top, bottom, width, height };
        };
        const gas = document.querySelector('[data-control="gas"]');
        const brake = document.querySelector('[data-control="brake"]');
        const fire = document.querySelector('[data-control="fire"]');
        const alpha = element => {
          const value = getComputedStyle(element).backgroundColor;
          const channels = value.match(/[\d.]+/g).map(Number);
          return channels.length === 4 ? channels[3] : 1;
        };
        return {
          canvas: box("#race"), stick: box("#steering-stick"),
          controls: box("#touch-controls"), gas: box('[data-control="gas"]'),
          brake: box('[data-control="brake"]'), fire: box('[data-control="fire"]'),
          alpha: [gas, brake, fire].map(alpha),
          translucentStick: getComputedStyle(document.querySelector("#steering-stick")).backgroundImage.includes("rgba("),
          scrollHeight: document.documentElement.scrollHeight
        };
      });
      expect(layout.stick.width).toBeGreaterThanOrEqual(minStick);
      for (const button of [layout.gas, layout.brake, layout.fire]) {
        expect(button.width).toBeGreaterThanOrEqual(minPedal);
        expect(button.left).toBeGreaterThanOrEqual(layout.stick.right);
        expect(button.right).toBeLessThanOrEqual(width + 2);
        expect(button.bottom).toBeLessThanOrEqual(height + 2);
        expect(button.top).toBeGreaterThanOrEqual(0);
        // The full-screen canvas still covers the space behind each button.
        expect(layout.canvas.left).toBeLessThanOrEqual(button.left);
        expect(layout.canvas.right).toBeGreaterThanOrEqual(button.right);
        expect(layout.canvas.bottom).toBeGreaterThanOrEqual(button.bottom);
      }
      expect(layout.stick.left).toBeGreaterThanOrEqual(0);
      expect(layout.stick.bottom).toBeLessThanOrEqual(height + 2);
      expect(layout.alpha.every(value => value < 0.8)).toBe(true);
      expect(layout.translucentStick).toBe(true);
      expect(layout.scrollHeight).toBeLessThanOrEqual(height + 2);
    }
    const gas = page.locator('[data-control="gas"]');
    await gas.dispatchEvent("pointerdown", { pointerId: 401, pointerType: "touch" });
    expect((await page.evaluate(() => window.__mikroSprint.touch)).gas).toBe(true);
    await gas.dispatchEvent("pointerup", { pointerId: 401, pointerType: "touch" });
    expect((await page.evaluate(() => window.__mikroSprint.touch)).gas).toBe(false);
  } finally {
    await context.close();
  }
});

test("Mikro Sprint displays a scored roster with editable Unicode driver names", async ({ page }) => {
  await page.goto("/micro-m/");
  await page.locator("#players").selectOption("2");
  await page.locator("#settings-open").click();
  await expect(page.locator("#driver-name-2")).toBeVisible();
  await page.locator("#driver-name-1").fill("  Żaneta  ");
  await page.locator("#driver-name-2").fill("Łukasz");
  await page.locator("#settings-close").click();
  await page.locator("#bots").selectOption("0");
  await page.locator("#start").click();
  await expect(page.locator("#scoreboard")).toBeVisible();
  await expect(page.locator("#scoreboard-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#scoreboard-colors .score-color")).toHaveCount(2);
  await expect(page.locator("#scoreboard-colors .score-color").first()).toHaveCSS("background-color", "rgb(217, 252, 103)");
  await expect(page.locator("#scoreboard-details")).toBeHidden();
  await page.locator("#scoreboard-toggle").click();
  await expect(page.locator("#scoreboard-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#scoreboard-details")).toBeVisible();
  await expect(page.locator("#scoreboard-colors")).toBeHidden();
  await expect(page.locator("#scoreboard")).toContainText("RUNDA 1");
  await expect(page.locator("#score-name-0")).toHaveValue("Żaneta");
  await expect(page.locator(".score-leader:visible")).toHaveAttribute("title", /Żaneta/);
  await expect(page.locator("#score-name-1")).toHaveValue("Łukasz");
  await page.locator("#score-name-0").fill("Błażej");
  await expect(page.locator("#score-name-0")).toHaveValue("Błażej");
  expect(await page.evaluate(() => window.__mikroSprint.scores[0].name)).toBe("Błażej");
  expect(await page.evaluate(() => localStorage.getItem("mikro-sprint-player-name"))).toBe("Błażej");
  await expect(page.locator(".score-leader:visible")).toHaveAttribute("title", /Błażej/);
  await page.locator("#score-name-0").blur();
  await page.locator("#scoreboard-toggle").click();
  await expect(page.locator("#scoreboard-details")).toBeHidden();
  await expect(page.locator("#scoreboard-colors")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");
  await page.keyboard.down("ArrowUp");
  try {
    await expect(page.locator(".score-leader:visible")).toHaveAttribute("title", /Łukasz/);
  } finally {
    await page.keyboard.up("ArrowUp");
  }
});

test("Mikro Sprint settings persist language and name, and open during a local race", async ({ page }) => {
  await page.goto("/micro-m/");
  await expect(page.locator("#online-leave")).toBeVisible();
  await page.locator("#settings-open").click();
  await expect(page.locator("#settings-dialog")).toBeVisible();
  await page.locator("#settings-language").selectOption("sv");
  await expect(page.locator("#settings-title")).toHaveText("INSTÄLLNINGAR");
  await page.locator("#driver-name-1").fill("Åsa");
  await page.locator("#settings-close").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.locator("#start")).toHaveText("Spela lokalt");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await page.locator("#settings-open").click();
  await expect(page.locator("#driver-name-1")).toHaveValue("Åsa");
  await page.locator("#settings-close").click();
  await page.locator("#bots").selectOption("0");
  await page.locator("#start").click();
  await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");
  await page.locator("#settings-open").click();
  await page.locator("#driver-name-1").fill("Eva");
  await expect(page.locator(".score-leader:visible")).toHaveAttribute("title", /Eva/);
  await page.locator("#settings-language").selectOption("pl");
  await expect(page.locator("#settings-title")).toHaveText("USTAWIENIA");
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings-dialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__mikroSprint.state)).toBe("racing");
  await expect(page.locator(".score-leader:visible")).toHaveAttribute("title", /Eva/);
  await page.locator("#online-leave").click();
  await expect(page.locator("#start")).toBeVisible();
  await page.locator("#settings-open").click();
  await expect(page.locator("#driver-name-1")).toHaveValue("Eva");
});

// Legacy bookmarks and room invitations must retain their query and fragment.
for (const [oldRoute, newRoute] of [['mikro-sprint', 'micro-m'], ['nocny-kurs', 'grand-t']]) {
  test(`legacy ${oldRoute} links redirect to ${newRoute}`, async ({ page }) => {
    // Avoid joining a real online room: the redirect itself must preserve its code.
    await page.route(url => url.pathname === `/${newRoute}/` && url.search === '?version=120', route => route.fulfill({ contentType: 'text/html', body: '<title>Redirect destination</title>' }));
    for (const suffix of ['/', '/index.html']) {
      await page.goto(`/${oldRoute}${suffix}?version=120#room=ABCDEF`);
      await expect(page).toHaveURL(`/${newRoute}/?version=120#room=ABCDEF`);
    }
  });
}
