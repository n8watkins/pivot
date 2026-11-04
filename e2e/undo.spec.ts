import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// "Deleted · Undo": deletes happen at once, a toast offers Undo for about six seconds, and only
// when it closes is the item gone for good. Deleting everything asks in an in-app dialog instead.

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  // A controllable clock, so the six-second toast can be run out without waiting for it.
  await page.clock.install();
});

const walk = { id: "walk", name: "Take a short walk", detail: "A reset", duration: "5 min" };

async function createPivots(page: Page, goals: string[]) {
  await page.goto("/settings");
  for (const goal of goals) {
    const response = await page.request.post("/api/pivots", { data: { goal, replacements: [walk] } });
    expect(response.status()).toBe(201);
  }
}

async function pivotNames(page: Page) {
  return page.locator(".settings-list .settings-pivot strong").allTextContents();
}

const toast = (page: Page, text: string | RegExp) => page.locator(".toast").filter({ hasText: text });

test("Undo brings a deleted pivot back in its old place", async ({ page }) => {
  await createPivots(page, ["Morning news", "Evening snacks", "Late scrolling"]);
  await page.goto("/settings/pivots");
  await expect.poll(() => pivotNames(page)).toEqual(["Morning news", "Evening snacks", "Late scrolling"]);

  await page.getByRole("link", { name: "Edit Evening snacks" }).click();
  await page.getByRole("button", { name: "Delete this pivot" }).click();
  await expect(page).toHaveURL(/\/settings\/pivots$/);
  await expect(toast(page, "“Evening snacks” deleted")).toBeVisible();
  await expect.poll(() => pivotNames(page)).toEqual(["Morning news", "Late scrolling"]);

  await Promise.all([page.waitForResponse("**/api/trash"), toast(page, "“Evening snacks” deleted").getByRole("button", { name: "Undo" }).click()]);
  await expect(toast(page, "deleted")).toHaveCount(0);
  await expect.poll(() => pivotNames(page)).toEqual(["Morning news", "Evening snacks", "Late scrolling"]);

  // Restored on the server too, with its actions: it survives a reload and well past the toast.
  await page.clock.runFor(10_000);
  await page.reload();
  await expect.poll(() => pivotNames(page)).toEqual(["Morning news", "Evening snacks", "Late scrolling"]);
  await page.getByRole("link", { name: "Edit Evening snacks" }).click();
  await expect(page.getByText("Take a short walk")).toBeVisible();
});

test("a deleted pivot stays deleted once the toast runs out", async ({ page }) => {
  await createPivots(page, ["Morning news", "Evening snacks"]);
  await page.goto("/settings/pivots");
  await page.getByRole("link", { name: "Edit Morning news" }).click();
  await page.getByRole("button", { name: "Delete this pivot" }).click();
  await expect(toast(page, "“Morning news” deleted")).toBeVisible();

  const finalized = page.waitForRequest((request) => request.url().endsWith("/api/trash") && request.postDataJSON()?.action === "finalize");
  await page.clock.runFor(6_500);
  await finalized;
  await expect(toast(page, "deleted")).toHaveCount(0);

  await page.reload();
  await expect.poll(() => pivotNames(page)).toEqual(["Evening snacks"]);
  const state = await page.evaluate(() => fetch("/api/state").then((response) => response.json()));
  expect(state.pivots.map((pivot: { goal: string }) => pivot.goal)).toEqual(["Evening snacks"]);
});

test("the toast is announced politely, keeps focus where it was and passes axe at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // No entrance animation, so axe measures the toast's real colors rather than a frame mid-fade.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await createPivots(page, ["Morning news"]);
  await page.goto("/settings");
  await page.request.post("/api/tags", { data: { label: "restless" } });
  await page.reload();
  const removeButton = page.getByRole("button", { name: "Remove restless" });
  await removeButton.click();
  const region = page.getByRole("region", { name: "Notifications" });
  const live = region.locator("[aria-live=polite]");
  await expect(live).toContainText("Tag “restless” removed");
  // The toast never takes focus; it is reachable from the keyboard.
  expect(await page.evaluate(() => document.activeElement?.closest(".toast"))).toBeNull();
  const box = await page.locator(".toast").boundingBox();
  const tabbar = await page.locator(".shell-tabbar").boundingBox();
  expect(box && tabbar && box.y + box.height <= tabbar.y).toBeTruthy();
  expect(box && box.x >= 16 && box.x + box.width <= 390 - 16).toBeTruthy();
  const results = await new AxeBuilder({ page }).include(".toast-region").analyze();
  expect(results.violations).toEqual([]);

  await region.getByRole("button", { name: "Undo" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Remove restless" })).toBeVisible();
});

test("Ctrl+Z undoes a History delete and the entry returns in place", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel("Name this pivot").fill("late night scrolling");
  await page.getByRole("button", { name: /Save.*pivot/ }).click();
  await page.getByRole("button", { name: /Finish setup/ }).click();
  for (const outcome of ["Much lighter", "About the same"]) {
    await page.getByRole("button", { name: /I’m having an urge/ }).click();
    await page.getByRole("button", { name: "Skip and show me something" }).click();
    await page.getByRole("button", { name: /Start this action/ }).click();
    await page.getByRole("button", { name: /I’m done for now/ }).click();
    await page.getByRole("button", { name: outcome }).click();
    await Promise.all([page.waitForResponse("**/api/closed-loop"), page.getByRole("button", { name: "Yes, it helped" }).click()]);
    await page.goto("/");
  }
  await page.getByRole("button", { name: /History/ }).first().click();
  const entries = page.locator(".history-list article p");
  await expect(entries).toHaveCount(2);
  const before = await entries.allTextContents();

  await page.getByRole("button", { name: /Delete Take a short walk History entry/ }).last().click();
  await expect(entries).toHaveCount(1);
  await expect(toast(page, "History entry “Take a short walk” deleted")).toBeVisible();
  await Promise.all([page.waitForResponse("**/api/trash"), page.keyboard.press("Control+z")]);
  await expect(entries).toHaveCount(2);
  expect(await entries.allTextContents()).toEqual(before);
  await page.reload();
  await page.getByRole("button", { name: /History/ }).first().click();
  await expect(entries).toHaveCount(2);
});

test("deleting all data asks in an in-app dialog that can be cancelled", async ({ page }) => {
  await createPivots(page, ["Morning news"]);
  await page.goto("/settings");
  let nativeDialog = false;
  page.on("dialog", (dialog) => { nativeDialog = true; void dialog.dismiss(); });

  const open = page.getByRole("button", { name: "Delete all my data" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Delete all your data?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("It cannot be undone.");
  const confirm = dialog.getByRole("button", { name: "Delete all my data" });
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByLabel(/Type “delete” to confirm/)).toBeFocused();

  // Escape cancels and focus returns to the button that opened it.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();

  await open.click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByText("Morning news").first()).toBeVisible();

  // The page behind the modal is inert: Tab never reaches it (it may pass through the browser's own UI).
  await page.getByRole("button", { name: "Delete all my data" }).click();
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => { const active = document.activeElement; return !active || active === document.body || Boolean(active.closest("dialog")); })).toBe(true);
  }
  await dialog.getByLabel(/Type “delete” to confirm/).fill("delete");
  await confirm.click();
  await page.waitForURL("**/onboarding");
  const state = await page.evaluate(() => fetch("/api/state").then((response) => response.json()));
  expect(state.pivots).toEqual([]);
  expect(nativeDialog).toBe(false);
});
