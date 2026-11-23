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
