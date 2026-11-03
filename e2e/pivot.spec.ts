import { expect, test } from "@playwright/test";
import { createClient } from "@libsql/client";
import AxeBuilder from "@axe-core/playwright";

test.use({ serviceWorkers: "block" });

async function createBasicPivot(page: import("@playwright/test").Page, goal = "late night scrolling") {
  await page.goto("/onboarding");
  await page.getByLabel("Name this pivot").fill(goal);
  await page.getByRole("button", { name: /Save.*pivot/ }).click();
  await page.getByRole("button", { name: /Finish setup/ }).click();
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
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

async function executeWhenDatabaseIsAvailable(db: ReturnType<typeof createClient>, statement: { sql: string; args: string[] }) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await db.execute(statement);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("SQLITE_BUSY") || attempt === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Database did not become available");
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
  await Promise.all([page.waitForResponse("**/api/closed-loop"), page.getByRole("button", { name: "Yes, it helped" }).click()]);
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
  await expect(page.getByRole("heading", { name: "This sounds heavier than what Pivot is built for." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Call 988/ })).toBeVisible();
});

test("crisis language shows the support card instead of a habit suggestion", async ({ page }) => {
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await expect(page.getByText("Your note is sent to Google Gemini for this suggestion and is never stored.")).toBeVisible();
  await page.getByLabel(/Anything else on your mind/).fill("I feel suicidal");
  await page.getByRole("button", { name: /Show me a next step/ }).click();
  await expect(page.getByRole("heading", { name: "This sounds heavier than what Pivot is built for." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Try this for/ })).toHaveCount(0);
  await expect(page.getByText(/call or text 988 \(Suicide & Crisis Lifeline\) any time/)).toBeVisible();
  await expect(page.getByRole("link", { name: "988", exact: true })).toHaveAttribute("href", "tel:988");
  await expect(page.getByRole("link", { name: /Call 988/ })).toHaveAttribute("href", "tel:988");
  await expect(page.getByRole("link", { name: "findahelpline.com" })).toHaveAttribute("href", "https://findahelpline.com");
  await expect(page.getByRole("link", { name: "Text 988" })).toHaveAttribute("href", "sms:988");
  await expect(page.getByRole("link", { name: "chat online" })).toHaveAttribute("href", "https://988lifeline.org/chat/");
  await expect(page.getByText("If you are in immediate danger, call your local emergency number (911 in the US).")).toBeVisible();
  await page.getByRole("button", { name: "Back to Pivot" }).click();
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await expect(page.getByLabel(/Anything else on your mind/)).toHaveValue("");
});

for (const note of ["I want to die", "im feeling sucidal", "kms", "I can't go on anymore", "took too many pills"]) {
  test(`crisis phrasing ${JSON.stringify(note)} shows crisis resources without waiting for the server`, async ({ page }) => {
    await createBasicPivot(page);
    const recommendationRequests: string[] = [];
    page.on("request", (request) => { if (request.url().includes("/api/recommendation")) recommendationRequests.push(request.url()); });
    await page.getByRole("button", { name: /I’m having an urge/ }).click();
    await page.getByLabel(/Anything else on your mind/).fill(note);
    await page.getByRole("button", { name: /Show me a next step/ }).click();
    await expect(page.getByRole("heading", { name: "This sounds heavier than what Pivot is built for." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Try this for/ })).toHaveCount(0);
    expect(recommendationRequests).toEqual([]);
  });
}

test("the server still routes crisis language to support when the client check is bypassed", async ({ page }) => {
  await createBasicPivot(page);
  const response = await page.request.post("/api/recommendation", { data: { context: "I feel suicidal", replacements: [{ id: "walk", name: "Take a short walk", detail: "", duration: "5 min" }], pivotId: "missing" } });
  const body = await response.json();
  expect(body.route).toBe("support");
  expect(body.replacementId).toBeUndefined();
});

test("crisis resources are above the fold on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByLabel(/Anything else on your mind/).fill("I feel suicidal");
  await page.getByRole("button", { name: /Show me a next step/ }).click();
  await expect(page.getByRole("heading", { name: "This sounds heavier than what Pivot is built for." })).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole("link", { name: /Call 988/ })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Text 988" })).toBeInViewport();
});

test("everyday idioms still get a normal suggestion", async ({ page }) => {
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByLabel(/Anything else on your mind/).fill("this commute is killing me");
  await page.getByRole("button", { name: /Show me a next step/ }).click();
  await expect(page.getByRole("heading", { name: /Try this for/ })).toBeVisible();
});

test("privacy and terms pages are linked from settings", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { name: "Your data, plainly." })).toBeVisible();
  await expect(page.getByText(/never saved by Pivot/)).toBeVisible();
  await expect(page.getByText(/sent to Google’s Gemini API|sent to Google's Gemini API/)).toBeVisible();
  await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Terms" }).click();
  await expect(page.getByRole("heading", { name: "The short version." })).toBeVisible();
  await expect(page.getByText(/not medical or mental-health treatment/)).toBeVisible();
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

test("custom tags reject invalid and built-in duplicates without optimistic UI", async ({ page }) => {
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  const input = page.getByLabel("Add your own tag");
  await input.fill("x");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("status")).toContainText("between 2 and 40");
  await input.fill("bored");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("status")).toContainText("already available");
  await expect(page.getByRole("button", { name: "Bored" })).toHaveCount(1);
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

test("a failed action start stays retryable", async ({ page }) => {
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.route("**/api/intervention", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Unavailable" }) }));
  await page.getByRole("button", { name: /Start this action/ }).click();
  await expect(page.getByRole("heading", { name: /Try this for/ })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("try starting it again");
});

test("an active action protects its pivot from edits and deletion", async ({ page }) => {
  await createBasicPivot(page);
  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.getByRole("button", { name: /Start this action/ }).click();
  const statuses = await page.evaluate(async () => {
    const state = await fetch("/api/state").then((response) => response.json());
    const pivot = state.pivots[0];
    const body = JSON.stringify({ goal: pivot.goal, replacements: pivot.replacements });
    const edited = await fetch(`/api/pivots/${pivot.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
    const deleted = await fetch(`/api/pivots/${pivot.id}`, { method: "DELETE" });
    const replaced = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pivots: state.pivots }) });
    return [edited.status, deleted.status, replaced.status];
  });
  expect(statuses).toEqual([409, 409, 409]);
  await page.getByRole("button", { name: /I’m done for now/ }).click();
  await page.getByRole("button", { name: "Much lighter" }).click();
  await page.getByRole("button", { name: "Yes, it helped" }).click();
  await expect(page.getByRole("status")).toContainText("Check-in saved");
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

test("concurrent pivot creation preserves both independent pivots", async ({ request }) => {
  await request.get("/api/state");
  const replacement = { id: "walk", name: "Take a short walk", detail: "A reset", duration: "5 min" };
  const responses = await Promise.all([
    request.post("/api/pivots", { data: { goal: "Morning news", replacements: [replacement] } }),
    request.post("/api/pivots", { data: { goal: "Evening news", replacements: [replacement] } }),
  ]);
  expect(responses.every((response) => response.status() === 201)).toBe(true);
  const snapshot = await (await request.get("/api/state")).json();
  expect(snapshot.pivots.map((pivot: { goal: string }) => pivot.goal).sort()).toEqual(["Evening news", "Morning news"]);
  await request.delete("/api/session");
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

test("a completed and deleted check-in leaves no intervention records behind", async ({ page }) => {
  await createBasicPivot(page);
  const sessionId = (await page.context().cookies()).find((cookie) => cookie.name === "pivot_session")?.value;
  expect(sessionId).toBeTruthy();

  await page.getByRole("button", { name: /I’m having an urge/ }).click();
  await page.getByRole("button", { name: "Skip and show me something" }).click();
  await page.getByRole("button", { name: /Start this action/ }).click();
  await page.getByRole("button", { name: /I’m done for now/ }).click();
  await page.getByRole("button", { name: "Much lighter" }).click();
  await page.getByRole("button", { name: "Yes, it helped" }).click();

  const db = createClient({ url: "file:./data/pivot-e2e.db" });
  const completed = await executeWhenDatabaseIsAvailable(db, {
    sql: "SELECT COUNT(*) AS count FROM active_interventions WHERE session_id = ?",
    args: [sessionId!],
  });
  expect(Number(completed.rows[0].count)).toBe(1);

  await page.getByRole("button", { name: "History" }).click();
  await Promise.all([page.waitForResponse("**/api/history/**"), page.getByRole("button", { name: /Delete Take a short walk History entry/ }).click()]);

  const counts = await Promise.all([
    executeWhenDatabaseIsAvailable(db, { sql: "SELECT COUNT(*) AS count FROM active_interventions WHERE session_id = ?", args: [sessionId!] }),
    executeWhenDatabaseIsAvailable(db, { sql: "SELECT COUNT(*) AS count FROM urge_sessions WHERE session_id = ?", args: [sessionId!] }),
    executeWhenDatabaseIsAvailable(db, { sql: "SELECT COUNT(*) AS count FROM recommendations WHERE urge_session_id IN (SELECT id FROM urge_sessions WHERE session_id = ?)", args: [sessionId!] }),
    executeWhenDatabaseIsAvailable(db, { sql: "SELECT COUNT(*) AS count FROM follow_ups WHERE intervention_id IN (SELECT id FROM active_interventions WHERE session_id = ?)", args: [sessionId!] }),
  ]);
  expect(counts.map((result) => Number(result.rows[0].count))).toEqual([0, 0, 0, 0]);
  db.close();
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
  const sessionId = (await (await request.get("/api/session")).json()).sessionId as string;
  expect((await request.delete("/api/session")).ok()).toBeTruthy();
  expect((await (await request.get("/api/state")).json()).pivots).toEqual([]);
  const db = createClient({ url: "file:./data/pivot-e2e.db" });
  const rateLimits = await executeWhenDatabaseIsAvailable(db, { sql: "SELECT COUNT(*) AS count FROM rate_limits WHERE key LIKE '%:' || ?", args: [sessionId] });
  expect(Number(rateLimits.rows[0].count)).toBe(0);
  db.close();
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

test("app shell supports keyboard skipping and authenticated account state", async ({ page }) => {
  await createBasicPivot(page);
  await expect(page.getByRole("heading", { name: "Ready when you are." })).toBeVisible();
  await page.reload();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.route("**/api/account", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, authenticated: true, user: { login: "pivot-tester", name: "Pivot Tester" } }) }));
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Signed in as @pivot-tester" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Account and settings/ })).toContainText("@pivot-tester");
  await expect(page.getByRole("button", { name: /Sign out/ })).toBeVisible();
});

test("security headers are present", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("primary pages have no automated accessibility violations", async ({ page }) => {
  for (const path of ["/onboarding", "/", "/settings"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${path}: ${results.violations.map((violation) => `${violation.id} - ${violation.help}`).join(", ")}`).toEqual([]);
  }
});
