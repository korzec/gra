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
    expect(blocking.move).toBe(false); // Like Nocny Kurs: no global touchmove cancellation.
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
    expect(before.steer).toBeGreaterThan(0);
    expect(before.joyGas).toBeGreaterThan(0);
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
    expect(active.steer).toBeGreaterThan(0);
    await gas.dispatchEvent("pointerup", { pointerId: 203, pointerType: "touch" });
    expect((await page.evaluate(() => window.__mikroSprint.touch)).gas).toBe(true);
    await gas.dispatchEvent("pointercancel", { pointerId: 204, pointerType: "touch" });
    expect((await page.evaluate(() => window.__mikroSprint.touch)).gas).toBe(false);
    await fire.dispatchEvent("pointercancel", { pointerId: 205, pointerType: "touch" });
    expect((await page.evaluate(() => window.__mikroSprint.touch)).fire).toBe(false);
    await stick.dispatchEvent("pointercancel", { pointerId: 201, pointerType: "touch" });
    const cleared = await page.evaluate(() => window.__mikroSprint.touch);
    expect(cleared.stickPointerId).toBe(null);
    expect(cleared.steer).toBe(0);
    expect(cleared.joyGas).toBe(0);

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
