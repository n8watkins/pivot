import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the landing page explains Pivot and starts setup", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { level: 1, name: "A pause button for the urge." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start your first pivot/ }).first()).toHaveAttribute("href", "/onboarding");
  await expect(page.getByRole("link", { name: /Open the app/ })).toHaveAttribute("href", "/");
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page.getByRole("heading", { name: "Three steps, and one of them takes a minute." })).toBeInViewport();
  await page.getByRole("link", { name: /Start your first pivot/ }).first().click();
  await expect(page.getByRole("heading", { name: "What would you like to pivot away from?" })).toBeVisible();
});

test("the landing page keeps the crisis lines one tap away", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page.getByRole("navigation", { name: "Pivot" }).getByRole("link", { name: "Crisis lines" })).toHaveAttribute("href", "/help");
  await expect(page.locator(".welcome-crisis").getByRole("link", { name: "988" })).toHaveAttribute("href", "tel:988");
  await expect(page.locator(".welcome-honest").getByRole("link", { name: "911" })).toHaveAttribute("href", "tel:911");
  await expect(page.locator("footer.safety-footer").getByRole("link", { name: "All crisis lines" })).toHaveAttribute("href", "/help");
  await page.getByRole("navigation", { name: "Pivot" }).getByRole("link", { name: "Crisis lines" }).click();
  await expect(page.getByRole("heading", { name: "Talk to someone now." })).toBeVisible();
});

test("the landing page works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { level: 1, name: "A pause button for the urge." })).toBeVisible();
  await expect(page.locator(".welcome-crisis").getByRole("link", { name: "988" })).toHaveAttribute("href", "tel:988");
  await expect(page.getByRole("img", { name: /I'm having an urge button/ })).toBeVisible();
  await context.close();
});

test("the install hint shows the iPhone steps on iOS", async ({ page }) => {
  await page.goto("/welcome?platform=ios");
  const card = page.locator(".welcome-install-card");
  await expect(card.getByRole("heading", { name: "Add Pivot to your phone" })).toBeVisible();
  await expect(card.getByText("Add to Home Screen")).toBeVisible();
  await expect(card.getByText(/iOS 16.4 or later/)).toBeVisible();
});

for (const [name, viewport] of [["phone", { width: 390, height: 844 }], ["small phone", { width: 320, height: 640 }], ["desktop", { width: 1440, height: 900 }]] as const) {
  test(`the landing page has no horizontal overflow or serious accessibility issues on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/welcome");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => violation.id)).toEqual([]);
  });
}

test("a first visit to the app links to the landing page and to setup", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Set up your first pivot/ })).toHaveAttribute("href", "/onboarding");
  await page.getByRole("link", { name: /New here\? See how Pivot works/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "A pause button for the urge." })).toBeVisible();
});
