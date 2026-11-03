import { expect, test } from "@playwright/test";

test("Android-sized Settings exposes install help with usable touch targets", async ({ page }) => {
  await page.goto("/settings");
  const install = page.getByRole("button", { name: "Install Pivot" });
  await expect(install).toBeVisible();
  const box = await install.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await install.click();
  await expect(page.getByText("Choose Add to Home screen or Install app.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("standalone Android mode applies full-height app styling and hides install", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => query === "(display-mode: standalone)" ? {
        matches: true,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return true; },
      } : nativeMatchMedia(query),
    });
  });
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Install Pivot" })).not.toBeVisible();
  const standaloneHeight = await page.locator(".app-shell").evaluate((element) => Number.parseFloat(getComputedStyle(element).minHeight));
  expect(standaloneHeight).toBeGreaterThanOrEqual(await page.evaluate(() => window.innerHeight));
});
