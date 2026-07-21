import { expect, test } from "@playwright/test";

test("new user can complete a pivot and review history", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);
  await page.getByLabel("Add a change").pressSequentially("late night scrolling");
  await page.getByLabel("Add a change").press("Tab");
  await expect(page.getByRole("button", { name: /Continue/ })).toBeEnabled();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await expect(page.getByRole("heading", { name: /Try this for/ })).toBeVisible();
  await page.getByRole("button", { name: /Start this action/ }).click();
  await expect(page.getByRole("heading", { name: "Take a short walk" })).toBeVisible();
  await page.getByRole("button", { name: /I’m done for now/ }).click();
  await page.getByRole("button", { name: "Much lighter" }).click();
  await page.getByRole("button", { name: /History/ }).click();
  await expect(page.getByRole("heading", { name: "Small moments count." })).toBeVisible();
  await expect(page.getByText("Take a short walk")).toBeVisible();
});

test("high-risk context routes away from a normal recommendation", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);
  await page.getByLabel("Add a change").pressSequentially("late night scrolling");
  await page.getByLabel("Add a change").press("Tab");
  await expect(page.getByRole("button", { name: /Continue/ })).toBeEnabled();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByLabel(/Anything else on your mind/).fill("I want to hurt myself");
  await page.getByRole("button", { name: /Show me a next step/ }).click();
  await expect(page.getByRole("heading", { name: "This may need more than a pivot." })).toBeVisible();
});

test("active intervention survives refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Add a change").pressSequentially("late night scrolling");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.getByRole("button", { name: /Start this action/ }).click();
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Take a short walk" })).toBeVisible();
});

test("setup supports multiple goals and a custom replacement", async ({ page }) => {
  await page.goto("/");
  const goalInput = page.getByLabel("Add a change");
  await goalInput.pressSequentially("late night scrolling");
  await page.getByRole("button", { name: "Add" }).nth(0).click();
  await goalInput.pressSequentially("checking email");
  await page.getByRole("button", { name: "Add" }).nth(0).click();
  await goalInput.pressSequentially("skipping meals");
  await page.getByRole("button", { name: "Add" }).nth(0).click();
  await goalInput.pressSequentially("avoiding hard conversations");
  await page.getByRole("button", { name: "Add" }).nth(0).click();
  await page.getByLabel(/Add your own action/).pressSequentially("Sketch for five minutes");
  await page.getByRole("button", { name: "Add" }).nth(1).click();
  await page.getByLabel(/Add your own action/).pressSequentially("Read a page");
  await page.getByRole("button", { name: "Add" }).nth(1).click();
  await page.getByLabel(/Add your own action/).pressSequentially("Call a friend");
  await page.getByRole("button", { name: "Add" }).nth(1).click();
  await expect(page.getByRole("button", { name: /Sketch for five minutes/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Call a friend/ })).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByText("late night scrolling · checking email · skipping meals · avoiding hard conversations")).toBeVisible();
});

test("privacy event can be created and deleted for the anonymous session", async ({ request }) => {
  const created = await request.post("/api/events", { data: { type: "follow_up_completed", payload: { replacementId: "walk", helpful: true } } });
  expect(created.ok()).toBeTruthy();
  const eventId = (await created.json()).eventId as string;
  const deleted = await request.delete(`/api/events?id=${eventId}`);
  expect(deleted.ok()).toBeTruthy();
  await expect(deleted.json()).resolves.toEqual({ deleted: true });
});
