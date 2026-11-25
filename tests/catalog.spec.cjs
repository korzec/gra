const { test, expect } = require("@playwright/test");

const expected = [
  { href: "swietliki/", name: "Świetliki", online: false },
  { href: "lesne-jednorozce/", name: "Leśne Jednorożce", online: false },
  { href: "micro-m/", name: "Micro M", online: true },
  { href: "grand-t/", name: "Grand T", online: true }
];

test("compact catalog lists actual modes and canonical game links", async ({page}) => {
  await page.goto("/");
  const cards = page.locator(".game-card");
  await expect(cards).toHaveCount(4);
  for (const [i, game] of expected.entries()) {
    const card = cards.nth(i);
    await expect(card).toHaveAttribute("href", game.href);
    await expect(card.getByRole("heading")).toHaveText(game.name);
    await expect(card.locator('[data-mode="local"]')).toHaveText("Lokalna · 1–8");
    await expect(card.locator('[data-mode="online"]')).toHaveCount(game.online ? 1 : 0);
    if (game.online) await expect(card.locator('[data-mode="online"]')).toHaveText("Online · do 8");
    await expect(card.locator("img")).toBeVisible();
  }
  await cards.nth(2).click();
  await expect(page).toHaveURL(/\/micro-m\/$/);
});

test("compact mobile catalog stays readable and fits narrow screens", async ({page}) => {
  for (const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:844});
    await page.goto("/");
    const geometry = await page.locator(".game-card").evaluateAll(cards => cards.map(card => {
      const b = card.getBoundingClientRect();
      return {left:b.left,right:b.right,top:b.top,height:b.height,scroll:card.scrollWidth,client:card.clientWidth};
    }));
    expect(geometry.length).toBe(4);
    for (const b of geometry) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width + 1);
      expect(b.height).toBeLessThan(175);
      expect(b.scroll).toBeLessThanOrEqual(b.client + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width <= 760) expect(geometry[3].top).toBeGreaterThan(geometry[2].top);
    else expect(geometry[0].top).toBe(geometry[1].top);
  }
});
