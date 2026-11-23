const { test, expect } = require("@playwright/test");

test("Mikro Sprint is linked from the catalog and runs a pool race", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a.game-card[href="mikro-sprint/"]')).toBeVisible();
  await expect(page.locator(".game-count")).toContainText("04 GRY");
  await page.locator('a.game-card[href="mikro-sprint/"]').click();
  await expect(page).toHaveURL(/\/mikro-sprint\/$/);
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
  expect(await page.evaluate(() => window.__mikroSprint.pickups)).toBe(6);
});

test("The bathtub race supports multiple people and touch controls", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto("/mikro-sprint/");
    await page.locator('label.track-choice').nth(1).click();
    await expect(page.locator('input[name="track"][value="bath"]')).toBeChecked();
    await page.locator("#players").selectOption("2");
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
    await page.goto("/mikro-sprint/");
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
    const geometry = await page.evaluate(() => window.__mikroSprint.minimap);
    expect(geometry.width).toBeLessThanOrEqual(110);
    expect(geometry.height).toBeLessThan(70);
    expect(geometry.x + geometry.width).toBeGreaterThan(375);
    expect(geometry.y).toBeGreaterThan(50);
    expect(geometry.y).toBeLessThan(90);

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
    await page.goto("/mikro-sprint/");
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
    await page.goto("/mikro-sprint/");
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
    await page.goto("/mikro-sprint/");
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

test("World-space controls steer to map directions, not relative to car heading", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto("/mikro-sprint/");
    await page.locator("#start").click();
    await expect.poll(() => page.evaluate(() => window.__mikroSprint.state), { timeout: 8000 }).toBe("racing");
    const initial = await page.evaluate(() => window.__mikroSprint.cars[0]);

    // W points the car north on the static map and also applies throttle.
    await page.keyboard.down("w");
    await page.waitForTimeout(500);
    await page.keyboard.up("w");
    const north = await page.evaluate(() => window.__mikroSprint.cars[0]);
    const wrapped = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
    const northTarget = -Math.PI / 2;
    expect(Math.abs(wrapped(northTarget - north.angle))).toBeLessThan(Math.abs(wrapped(northTarget - initial.angle)));
    expect(Math.hypot(north.x - initial.x, north.y - initial.y)).toBeGreaterThan(10);

    // The joystick's right direction must be positive world X, regardless
    // of the vehicle orientation after the previous steering operation.
    const stick = page.locator("#steering-stick");
    const bounds = await stick.boundingBox();
    const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
    await stick.dispatchEvent("pointerdown", { pointerId: 741, pointerType: "touch", clientX: cx, clientY: cy });
    await stick.dispatchEvent("pointermove", { pointerId: 741, pointerType: "touch", clientX: cx + bounds.width * 0.32, clientY: cy });
    const vector = await page.evaluate(() => window.__mikroSprint.touch);
    expect(vector.x).toBeGreaterThan(0);
    expect(Math.abs(vector.y)).toBeLessThan(0.001);
    await page.waitForTimeout(400);
    const east = await page.evaluate(() => window.__mikroSprint.cars[0]);
    expect(Math.abs(wrapped(-east.angle))).toBeLessThan(Math.abs(wrapped(-north.angle)));
    await stick.dispatchEvent("pointerup", { pointerId: 741, pointerType: "touch" });

    // Coasting is preserved: releasing the stick does not reset velocity.
    const beforeCoast = await page.evaluate(() => window.__mikroSprint.cars[0]);
    expect(Math.hypot(beforeCoast.vx, beforeCoast.vy)).toBeGreaterThan(1);
    await page.waitForTimeout(100);
    const afterCoast = await page.evaluate(() => window.__mikroSprint.cars[0]);
    expect(Math.hypot(afterCoast.x - beforeCoast.x, afterCoast.y - beforeCoast.y)).toBeGreaterThan(0.5);
  } finally {
    await context.close();
  }
});
