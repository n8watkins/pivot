import { expect, test } from "@playwright/test";

test("manifest exposes installable Android metadata and icons", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/manifest+json");
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "Pivot - A small next step",
    short_name: "Pivot",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f5f7f2",
    theme_color: "#4d6d5a",
  });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/icons/pivot-maskable-192.png", sizes: "192x192", purpose: "maskable" }),
    expect.objectContaining({ src: "/icons/pivot-maskable-512.png", sizes: "512x512", purpose: "maskable" }),
  ]));
  for (const path of ["/icons/pivot-192.png", "/icons/pivot-512.png", "/icons/pivot-maskable-192.png", "/icons/pivot-maskable-512.png", "/apple-icon.png"]) {
    const icon = await request.get(path);
    expect(icon.ok()).toBeTruthy();
    expect(icon.headers()["content-type"]).toBe("image/png");
  }
});

test("pages link the theme-aware SVG favicon, an ICO fallback and the Apple touch icon", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", /\/icon\.svg/);
  await expect(page.locator('link[rel="icon"][href*="favicon.ico"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /\/apple-icon\.png/);
  const svg = await (await request.get("/icon.svg")).text();
  expect(svg).toContain("prefers-color-scheme: dark");
  expect((await request.get("/favicon.ico")).ok()).toBeTruthy();
});

test("the logo is labelled once for screen readers", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("footer.safety-footer").getByRole("img", { name: "Pivot" })).toBeVisible();
  await expect(page.locator(".brand svg.logo-mark").first()).toHaveAttribute("aria-hidden", "true");
});

test("settings offers the browser install prompt and manual Chrome instructions", async ({ page }) => {
  await page.goto("/settings");
  const install = page.getByRole("button", { name: "Install Pivot" });
  await expect(install).toBeVisible();
  await install.click();
  await expect(page.getByText("Open Pivot in Chrome on Android.")).toBeVisible();

  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: async () => { (window as typeof window & { __pivotInstallPrompted?: boolean }).__pivotInstallPrompted = true; } },
      userChoice: { value: Promise.resolve({ outcome: "accepted", platform: "web" }) },
    });
    window.dispatchEvent(event);
  });
  await install.click();
  await expect(page.getByRole("status")).toContainText("added to your device");
  expect(await page.evaluate(() => (window as typeof window & { __pivotInstallPrompted?: boolean }).__pivotInstallPrompted)).toBe(true);
});

test("installed display mode hides the install control", async ({ page }) => {
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
});

test("service worker update is non-blocking and user controlled", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { __pivotUpdateRequested?: boolean };
    const registration = {
      waiting: { postMessage: () => { state.__pivotUpdateRequested = true; } },
      installing: null,
      addEventListener() {},
      removeEventListener() {},
      update: async () => undefined,
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        register: async () => registration,
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
  await page.goto("/");
  const prompt = page.getByRole("complementary", { name: "Pivot update available" });
  await expect(prompt).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
  await prompt.getByRole("button", { name: "Update", exact: true }).click();
  expect(await page.evaluate(() => (window as typeof window & { __pivotUpdateRequested?: boolean }).__pivotUpdateRequested)).toBe(true);
});

test("service worker provides an offline fallback without intercepting APIs", async ({ page, request }) => {
  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBeTruthy();
  expect(worker.headers()["cache-control"]).toContain("max-age=0");
  const source = await worker.text();
  expect(source).toContain('url.pathname.startsWith("/api/")');

  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
  });
  await page.context().setOffline(true);
  try {
    await page.goto("/not-cached-while-offline", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Pivot will be here when your connection returns." })).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
});
