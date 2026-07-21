import { expect, test } from "@playwright/test";

async function createBasicPivot(page: import("@playwright/test").Page, goal = "late night scrolling") {
  await page.goto("/onboarding");
  await page.getByLabel("Name this pivot").fill(goal);
  await page.getByRole("button", { name: /Save.*pivot/ }).click();
  await page.getByRole("button", { name: /Finish setup/ }).click();
}

test("new user can complete a pivot and review history", async ({ page }) => {
  await page.goto("/onboarding");
  await page.waitForTimeout(500);
  await page.getByLabel("Name this pivot").fill("late night scrolling");
  await page.getByRole("button", { name: /Save.*pivot/ }).click();
  await page.getByRole("button", { name: /Finish setup/ }).click();
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
  await page.goto("/onboarding");
  await page.waitForTimeout(500);
  await page.getByLabel("Name this pivot").fill("late night scrolling");
  await page.getByRole("button", { name: /Save.*pivot/ }).click();
  await page.getByRole("button", { name: /Finish setup/ }).click();
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByLabel(/Anything else on your mind/).fill("I want to hurt myself");
  await page.getByRole("button", { name: /Show me a next step/ }).click();
  await expect(page.getByRole("heading", { name: "This may need more than a pivot." })).toBeVisible();
});

test("active intervention survives refresh", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel("Name this pivot").fill("late night scrolling");
  await page.getByRole("button", { name: /Save.*pivot/ }).click();
  await page.getByRole("button", { name: /Finish setup/ }).click();
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.getByRole("button", { name: /Start this action/ }).click();
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Take a short walk" })).toBeVisible();
});

test("setup supports multiple goals and a custom replacement", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel("Name this pivot").fill("late night scrolling");
  await page.getByLabel(/Add your own action/).fill("Sketch for five minutes");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: /Save.*pivot/ }).click();
  await page.getByLabel("Name this pivot").fill("checking email");
  await page.getByLabel(/Add your own action/).fill("Read a page");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: /Save this pivot/ }).click();
  await expect(page.getByText("late night scrolling")).toBeVisible();
  await expect(page.getByText("checking email")).toBeVisible();
  await page.getByRole("button", { name: /Finish setup/ }).click();
  await expect(page.getByText("late night scrolling")).toBeVisible();
  await expect(page.getByRole("button", { name: "checking email" })).toBeVisible();
});

test("main route does not render onboarding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What would you like to pivot away from?" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: /Set up your first pivot/ })).toBeVisible();
});

test("urge context accepts a custom tag", async ({ page }) => {
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByLabel("Add your own tag").fill("lonely");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("button", { name: "lonely" })).toHaveClass(/active/);
});

test("switching pivots uses the selected pivot replacement set", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByLabel("Name this pivot").fill("late scrolling");
  await page.getByRole("button", { name: /Take a short walk/ }).click();
  await page.getByRole("button", { name: /Slow breathing/ }).click();
  await page.getByRole("button", { name: /Stretch your shoulders/ }).click();
  await page.getByLabel(/Add your own action/).fill("Sketch quietly");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: /Save.*pivot/ }).click();
  await page.getByLabel("Name this pivot").fill("checking email");
  await page.getByRole("button", { name: /Take a short walk/ }).click();
  await page.getByRole("button", { name: /Slow breathing/ }).click();
  await page.getByRole("button", { name: /Stretch your shoulders/ }).click();
  await page.getByLabel(/Add your own action/).fill("Read one page");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: /Save this pivot/ }).click();
  await page.getByRole("button", { name: /Finish setup/ }).click();
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
  await page.getByRole("button", { name: "checking email", exact: true }).click();
  await expect(page.getByRole("heading", { name: "checking email" })).toBeVisible();
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await expect(page.getByRole("heading", { name: "Read one page" })).toBeVisible();
});

test("settings exposes pivot, account, and privacy controls", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anonymous for now" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete all my data" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Add pivot/ })).toBeVisible();
});

test("privacy event can be created and deleted for the anonymous session", async ({ request }) => {
  const created = await request.post("/api/events", { data: { type: "follow_up_completed", payload: { replacementId: "walk", helpful: true } } });
  expect(created.ok()).toBeTruthy();
  const eventId = (await created.json()).eventId as string;
  const deleted = await request.delete(`/api/events?id=${eventId}`);
  expect(deleted.ok()).toBeTruthy();
  await expect(deleted.json()).resolves.toEqual({ deleted: true });
});

test("anonymous session deletion removes pivot state", async ({ request }) => {
  const saved = await request.post("/api/state", { data: { pivots: [{ id: "pivot-delete-test", goal: "checking email", replacements: [{ id: "walk", name: "Take a short walk", detail: "A reset", duration: "5 min" }] }] } });
  expect(saved.ok()).toBeTruthy();
  expect((await request.get("/api/state")).ok()).toBeTruthy();
  expect((await (await request.get("/api/state")).json()).pivots).toHaveLength(1);
  expect((await request.delete("/api/session")).ok()).toBeTruthy();
  expect((await (await request.get("/api/state")).json()).pivots).toEqual([]);
});
