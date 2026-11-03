import { expect, test } from "@playwright/test";

test("a first visit gets exactly one session, even when the page loads data in parallel", async ({ page }) => {
  const issued = new Set<string>();
  page.on("response", async (response) => {
    for (const header of await response.headersArray()) {
      if (header.name.toLowerCase() !== "set-cookie") continue;
      const match = /(?:^|\n)pivot_session=([^;]+)/.exec(header.value);
      if (match) issued.add(match[1]);
    }
  });
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const cookie = (await page.context().cookies()).find((item) => item.name === "pivot_session");
  expect(cookie).toBeDefined();
  expect([...issued]).toEqual([cookie!.value]);
  const sessionId = await page.evaluate(() => fetch("/api/session").then((response) => response.json()).then((value) => value.sessionId as string));
  expect(sessionId).toBe(cookie!.value);
});
