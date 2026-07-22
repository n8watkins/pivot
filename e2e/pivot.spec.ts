import { expect, test } from "@playwright/test";

async function createBasicPivot(page: import("@playwright/test").Page, goal = "late night scrolling") {
  await page.goto("/onboarding");
  await page.getByLabel("Name this pivot").fill(goal);
  await page.getByRole("button", { name: /Save.*pivot/ }).click();
  await page.getByRole("button", { name: /Finish setup/ }).click();
}

async function createTwoCustomPivots(page: import("@playwright/test").Page) {
  await page.goto("/onboarding");
  for (const option of ["Take a short walk", "Slow breathing", "Stretch your shoulders"]) await page.getByRole("button", { name: option }).click();
  await page.getByLabel("Name this pivot").fill("Pivot alpha");
  await page.getByLabel(/Add your own action/).fill("Alpha action");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: /Save.*pivot/ }).click();
  for (const option of ["Take a short walk", "Slow breathing", "Stretch your shoulders"]) await page.getByRole("button", { name: option }).click();
  await page.getByLabel("Name this pivot").fill("Pivot beta");
  await page.getByLabel(/Add your own action/).fill("Beta action");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: /Save this pivot/ }).click();
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
  await expect(page.getByText("Put on your shoes and step outside.")).toBeVisible();
  await expect(page.getByText("Action in progress")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).not.toBeVisible();
  await page.getByRole("button", { name: /I’m done for now/ }).click();
  await expect(page.getByText("Check-in in progress")).toBeVisible();
  await page.getByRole("button", { name: "Much lighter" }).click();
  await page.getByRole("button", { name: "Yes, it helped" }).click();
  await expect(page.getByRole("status")).toContainText("Check-in saved");
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
  await expect(page.getByRole("heading", { name: "This may need immediate support." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Call 988/ })).toBeVisible();
});

test("unsupported clinical context routes to specialized support", async ({ page }) => {
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByLabel(/Anything else on your mind/).fill("I need help with an eating disorder");
  await page.getByRole("button", { name: /Show me a next step/ }).click();
  await expect(page.getByRole("heading", { name: "This needs specialized support." })).toBeVisible();
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

test("desktop urge actions stay visible without initial scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  const action = page.getByRole("button", { name: /Show me a next step/ });
  await expect(action).toBeVisible();
  const bounds = await action.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
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
  await expect(page.getByRole("button", { name: "late night scrolling" })).toBeVisible();
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

test("selected pivot and History survive refresh", async ({ page }) => {
  await createTwoCustomPivots(page);
  await page.getByRole("button", { name: "Pivot beta", exact: true }).click();
  await expect(page).toHaveURL(/pivot=/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pivot beta" })).toBeVisible();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page).toHaveURL(/screen=history/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Small moments count." })).toBeVisible();
});

test("switching pivots in History filters the visible entries", async ({ page }) => {
  await createTwoCustomPivots(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.getByRole("button", { name: /Start this action/ }).click();
  await page.getByRole("button", { name: /I’m done for now/ }).click();
  await page.getByRole("button", { name: "Much lighter" }).click();
  await page.getByRole("button", { name: "Yes, it helped" }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("Alpha action")).toBeVisible();
  await page.getByRole("button", { name: "Pivot beta", exact: true }).click();
  await expect(page).toHaveURL(/historyPivot=/);
  await expect(page.getByText("No check-ins for this pivot yet.")).toBeVisible();
  await expect(page.getByText("Alpha action")).not.toBeVisible();
});

test("stale recommendations cannot cross pivot boundaries", async ({ page }) => {
  await createTwoCustomPivots(page);
  await page.route("**/api/recommendation", async (route) => {
    const body = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ replacementId: body.replacements[0].id, reason: "Reason calculated for alpha.", firstStep: "Begin alpha.", alternatives: [], safety: "safe", source: "gemini" }) });
  });
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await expect(page.getByRole("button", { name: "Pivot beta", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Pause space" }).click();
  await page.waitForTimeout(650);
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
  await expect(page.getByText("Reason calculated for alpha.")).not.toBeVisible();
});

test("starting an action hides pivot navigation until persistence completes", async ({ page }) => {
  await createTwoCustomPivots(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.route("**/api/intervention", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.getByRole("button", { name: /Start this action/ }).click();
  await expect(page.getByText("Starting action")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).not.toBeVisible();
  await expect(page.getByText("Action in progress")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alpha action" })).toBeVisible();
  const state = await page.evaluate(() => fetch("/api/state").then((response) => response.json()));
  expect(state.active.pivotId).toBe(state.pivots.find((pivot: { goal: string }) => pivot.goal === "Pivot alpha").id);
});

test("structured recommendation controls reason, first step, and alternatives", async ({ page }) => {
  await createBasicPivot(page);
  await page.route("**/api/recommendation", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ replacementId: "breathe", reason: "Fits a quiet indoor moment.", firstStep: "Put both feet on the floor.", alternatives: ["stretch", "walk"], safety: "safe", source: "gemini" }) }));
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await expect(page.getByRole("heading", { name: "Slow breathing" })).toBeVisible();
  await expect(page.getByText("Fits a quiet indoor moment.")).toBeVisible();
  await expect(page.locator(".alternative strong")).toHaveText(["Stretch your shoulders", "Take a short walk"]);
  await page.getByRole("button", { name: /Start this action/ }).click();
  await expect(page.getByText("Put both feet on the floor.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Put both feet on the floor.")).toBeVisible();
});

test("choosing an alternative starts that exact action", async ({ page }) => {
  await createBasicPivot(page);
  await page.route("**/api/recommendation", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ replacementId: "breathe", reason: "Fits a quiet indoor moment.", firstStep: "Put both feet on the floor.", alternatives: ["stretch", "walk"], safety: "safe", source: "gemini" }) }));
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.getByRole("button", { name: /Stretch your shoulders/ }).click();
  await expect(page.getByRole("heading", { name: "Stretch your shoulders" })).toBeVisible();
  await expect(page.getByText("Let your arms hang, then slowly roll your shoulders back once.")).toBeVisible();
});

test("network failure uses a visible deterministic fallback", async ({ page }) => {
  await createBasicPivot(page);
  await page.route("**/api/recommendation", (route) => route.abort());
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await expect(page.getByRole("heading", { name: "Take a short walk" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("safe approved action locally");
});

test("settings exposes pivot, account, and privacy controls", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anonymous by default" })).toBeVisible();
  await expect(page.getByRole("button", { name: /GitHub sign-in needs configuration/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete all my data" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Add pivot/ })).toBeVisible();
});

test("account status remains available when GitHub OAuth is not configured", async ({ request }) => {
  const response = await request.get("/api/account");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toEqual({ configured: false, authenticated: false });
});

test("settings can edit, reorder, and delete a pivot", async ({ page }) => {
  await createBasicPivot(page);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Edit late night scrolling" }).click();
  await page.getByLabel("Pivot name").fill("evening scrolling");
  await page.getByRole("button", { name: /Make a glass of water/ }).click();
  await page.getByRole("button", { name: "Move Make a glass of water up" }).click();
  await page.getByRole("button", { name: "Save pivot" }).click();
  await expect(page.getByRole("link", { name: "Edit evening scrolling" })).toBeVisible();
  await page.getByRole("link", { name: "Edit evening scrolling" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete this pivot" }).click();
  await expect(page.getByText("Create your first pivot to get started.")).toBeVisible();
});

test("custom context tags persist and can be removed in settings", async ({ page }) => {
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByLabel("Add your own tag").fill("restless");
  await Promise.all([page.waitForResponse("**/api/tags"), page.getByRole("button", { name: "Add" }).click()]);
  await page.goto("/settings");
  await expect(page.getByText("restless")).toBeVisible();
  await page.getByRole("button", { name: "Remove restless" }).click();
  await expect(page.getByText("restless")).not.toBeVisible();
});

test("individual History entries can be deleted", async ({ page }) => {
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.getByRole("button", { name: /Start this action/ }).click();
  await page.getByRole("button", { name: /I’m done for now/ }).click();
  await page.getByRole("button", { name: "Much lighter" }).click();
  await Promise.all([page.waitForResponse("**/api/closed-loop"), page.getByRole("button", { name: "Yes, it helped" }).click()]);
  await page.reload();
  await page.getByRole("button", { name: /History/ }).click();
  await page.getByRole("button", { name: /Delete Take a short walk History entry/ }).click();
  await expect(page.getByText("Your first entry will appear here after a pivot.")).toBeVisible();
});

test("History keeps its pivot and action labels after that pivot is deleted", async ({ page }) => {
  await createBasicPivot(page, "evening snacking");
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.getByRole("button", { name: /Start this action/ }).click();
  await page.getByRole("button", { name: /I’m done for now/ }).click();
  await page.getByRole("button", { name: "About the same" }).click();
  await page.getByRole("button", { name: "Not this time" }).click();
  await page.goto("/settings");
  await page.getByRole("link", { name: "Edit evening snacking" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete this pivot" }).click();
  await page.goto("/");
  await page.getByRole("button", { name: /History/ }).click();
  await expect(page.getByText("Take a short walk")).toBeVisible();
  await expect(page.getByText(/evening snacking · About the same/)).toBeVisible();
});

test("lapse recovery is recorded without judgment", async ({ page }) => {
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.getByRole("button", { name: /Start this action/ }).click();
  await page.getByRole("button", { name: /I’m done for now/ }).click();
  await page.getByRole("button", { name: "I went back to it" }).click();
  await page.getByRole("button", { name: "Not this time" }).click();
  await expect(page.getByRole("status")).toContainText("Recorded without judgment");
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

test("data export contains the user's structured data and attachment headers", async ({ request }) => {
  const pivotId = `pivot-export-${crypto.randomUUID()}`;
  const saved = await request.post("/api/state", { data: { pivots: [{ id: pivotId, goal: "afternoon snacking", replacements: [{ id: "water", name: "Make a glass of water", detail: "A reset", duration: "3 min" }] }] } });
  expect(saved.ok()).toBeTruthy();
  const response = await request.get("/api/export");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-disposition"]).toContain("pivot-export-");
  const exported = await response.json();
  expect(exported.pivots[0].goal).toBe("afternoon snacking");
  expect(JSON.stringify(exported)).not.toContain("contextNote");
  expect((await request.delete("/api/session")).ok()).toBeTruthy();
});

test("health endpoint reports the SQLite runtime without secrets", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ status: "ok", persistence: "sqlite", persistentStorageReady: true });
});

test("narrow and reduced-motion layouts remain usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "What would you like to pivot away from?" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Setup progress" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("button", { name: "Take a short walk" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Take a short walk" }).click();
  await expect(page.getByRole("button", { name: "Take a short walk" })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const reducedTransition = await page.locator(".progress-track i").evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(reducedTransition).toBeLessThanOrEqual(0.001);
});

test("mobile shell keeps stats clear of the fixed navigation with large touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createBasicPivot(page);
  await expect(page.getByRole("button", { name: /I’m having an urge/ })).toBeVisible();
  await expect(page.locator(".shell-rail .rail-card").first()).toBeVisible();
  const geometry = await page.evaluate(() => {
    const urge = document.querySelector(".urge-button")!.getBoundingClientRect();
    const firstRailCard = document.querySelector(".shell-rail .rail-card")!.getBoundingClientRect();
    const pill = document.querySelector(".pivot-pill")!.getBoundingClientRect();
    return { railGap: firstRailCard.top - urge.bottom, pillHeight: pill.height };
  });
  expect(geometry.railGap).toBeLessThanOrEqual(40);
  expect(geometry.pillHeight).toBeGreaterThanOrEqual(44);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const bottomGeometry = await page.evaluate(() => ({ noteBottom: document.querySelector(".rail-note")!.getBoundingClientRect().bottom, tabTop: document.querySelector(".shell-tabbar")!.getBoundingClientRect().top }));
  expect(bottomGeometry.noteBottom).toBeLessThanOrEqual(bottomGeometry.tabTop);
  await page.goto("/settings");
  const editTarget = await page.getByRole("link", { name: "Edit late night scrolling" }).boundingBox();
  expect(editTarget).not.toBeNull();
  expect(editTarget!.width).toBeGreaterThanOrEqual(44);
  expect(editTarget!.height).toBeGreaterThanOrEqual(44);
});

test("settings stays single-column at compact desktop widths", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 768 });
  await page.goto("/settings");
  const columns = await page.locator(".settings-layout").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(1);
});

test("security headers are present", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
