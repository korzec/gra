const { test, expect } = require("@playwright/test");
const pages = ["/", "/micro-m/", "/grand-t/", "/swietliki/", "/lesne-jednorozce/"];

async function publishedPage(page, latest) {
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:8765") return route.continue();
    if (url.pathname === "/version.json") {
      return route.fulfill({ json: { version: latest, build_sha: "new-build" } });
    }
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const body = (await response.text())
      .replaceAll("__BUILD_SHA__", "current-build")
      .replaceAll("__RELEASE_VERSION__", "v130");
    await route.fulfill({ response, body });
  });
}
for (const path of pages) {
  test("shared top-bar update indicator on " + path, async ({ page }) => {
    await publishedPage(page, "v131");
    await page.goto(path);
    const control = page.locator("header .release-control");
    await expect(control.locator(".release-version")).toHaveText("v130");
    await expect(control.locator(".release-latest")).toHaveText("v131");
    await expect(control.locator(".release-refresh")).toBeVisible();
    await expect(page.locator(".release-control")).toHaveCount(1);
    await expect(page.locator("a .release-refresh, #update-notice")).toHaveCount(0);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThan(76);
      const button = await control.locator(".release-refresh").boundingBox();
      expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".release-refresh")),
        { x: button.x + button.width / 2, y: button.y + button.height / 2 })).toBe(true);
    }
  });
}
test("no update button when current; no global Space reload shortcut", async ({ page }) => {
  await publishedPage(page, "v130");
  await page.goto("/");
  await expect(page.locator(".release-version")).toHaveText("v130");
  await expect(page.locator(".release-refresh")).toBeHidden();
  await expect(page.locator(".release-next")).toBeHidden();
  await page.unrouteAll();
  await publishedPage(page, "v131");
  await page.goto("/");
  await expect(page.locator(".release-refresh")).toBeVisible();
  expect(await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", {
    code: "Space", key: " ", bubbles: true, cancelable: true
  })))).toBe(true);
});
test("refresh preserves the URL query and fragment", async ({ page }) => {
  await publishedPage(page, "v131");
  await page.goto("/?keep=yes#room-test");
  await page.locator(".release-refresh").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("version")).toBe("v131");
  const url = new URL(page.url());
  expect(url.searchParams.get("keep")).toBe("yes");
  expect(url.searchParams.get("build")).toBe("new-build");
  expect(url.searchParams.has("reload")).toBe(true);
  expect(url.hash).toBe("#room-test");
});
