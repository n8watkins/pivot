import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "./migrations";
import { linkGitHubAccount } from "./account";

const clients: ReturnType<typeof createClient>[] = [];

async function createTestDatabase() {
  const db = createClient({ url: "file::memory:" });
  clients.push(db);
  await migrate(db);
  return db;
}

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

describe("GitHub account linking", () => {
  it("keeps the first anonymous session and merges later device data into it", async () => {
    const db = await createTestDatabase();
    await db.execute("INSERT INTO anonymous_sessions (id, created_at) VALUES ('first-session', '2026-01-01')");
    await db.execute("INSERT INTO anonymous_sessions (id, created_at) VALUES ('second-session', '2026-01-02')");
    await db.execute("INSERT INTO pivots (id, session_id, label, created_at) VALUES ('second-pivot', 'second-session', 'Evening snacks', '2026-01-02')");

    const firstLink = await linkGitHubAccount(db, "first-session", { id: "github-123", login: "pivot-user", avatarUrl: null });
    const secondLink = await linkGitHubAccount(db, "second-session", { id: "github-123", login: "renamed-user", avatarUrl: "https://avatars.githubusercontent.com/u/123" });

    expect(firstLink.sessionId).toBe("first-session");
    expect(secondLink).toEqual({ accountId: firstLink.accountId, sessionId: "first-session" });
    const pivot = await db.execute("SELECT session_id as sessionId FROM pivots WHERE id = 'second-pivot'");
    expect(pivot.rows[0]?.sessionId).toBe("first-session");
    const discardedSession = await db.execute("SELECT id FROM anonymous_sessions WHERE id = 'second-session'");
    expect(discardedSession.rows).toHaveLength(0);
    const account = await db.execute({ sql: "SELECT login, avatar_url as avatarUrl FROM accounts WHERE id = ?", args: [firstLink.accountId] });
    expect(account.rows[0]).toMatchObject({ login: "renamed-user", avatarUrl: "https://avatars.githubusercontent.com/u/123" });
  });

  it("does not attach one GitHub identity to another identity's data", async () => {
    const db = await createTestDatabase();
    await db.execute("INSERT INTO anonymous_sessions (id, created_at) VALUES ('shared-browser', '2026-01-01')");
    await db.execute("INSERT INTO pivots (id, session_id, label, created_at) VALUES ('private-pivot', 'shared-browser', 'Private pivot', '2026-01-01')");
    await linkGitHubAccount(db, "shared-browser", { id: "github-first", login: "first-user", avatarUrl: null });

    const secondAccount = await linkGitHubAccount(db, "shared-browser", { id: "github-second", login: "second-user", avatarUrl: null });

    expect(secondAccount.sessionId).not.toBe("shared-browser");
    const secondPivots = await db.execute({ sql: "SELECT id FROM pivots WHERE session_id = ?", args: [secondAccount.sessionId] });
    expect(secondPivots.rows).toHaveLength(0);
    const originalPivot = await db.execute("SELECT session_id as sessionId FROM pivots WHERE id = 'private-pivot'");
    expect(originalPivot.rows[0]?.sessionId).toBe("shared-browser");
  });
});
