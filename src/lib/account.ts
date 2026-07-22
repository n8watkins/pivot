import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";

type GitHubIdentity = {
  id: string;
  login: string;
  avatarUrl: string | null;
};

type LinkedAccount = {
  accountId: string;
  sessionId: string;
};

export async function linkGitHubAccount(db: Client, currentSessionId: string, identity: GitHubIdentity): Promise<LinkedAccount> {
  const now = new Date().toISOString();
  const currentSession = await db.execute({ sql: "SELECT account_id as accountId FROM anonymous_sessions WHERE id = ?", args: [currentSessionId] });
  const linkedAccountId = currentSession.rows[0]?.accountId ? String(currentSession.rows[0].accountId) : null;
  let sourceSessionId = currentSessionId;

  if (linkedAccountId) {
    const linkedIdentity = await db.execute({ sql: "SELECT provider_account_id as providerAccountId FROM accounts WHERE id = ?", args: [linkedAccountId] });
    if (String(linkedIdentity.rows[0]?.providerAccountId ?? "") !== identity.id) {
      sourceSessionId = randomUUID();
      await db.execute({ sql: "INSERT INTO anonymous_sessions (id, created_at) VALUES (?, ?)", args: [sourceSessionId, now] });
    }
  }

  const existingAccount = await db.execute({ sql: "SELECT id, canonical_session_id as canonicalSessionId FROM accounts WHERE provider = 'github' AND provider_account_id = ?", args: [identity.id] });
  const accountRow = existingAccount.rows[0];
  if (!accountRow) {
    const accountId = randomUUID();
    await db.batch([
      { sql: "INSERT INTO accounts (id, provider, provider_account_id, login, avatar_url, canonical_session_id, created_at, updated_at) VALUES (?, 'github', ?, ?, ?, ?, ?, ?)", args: [accountId, identity.id, identity.login, identity.avatarUrl, sourceSessionId, now, now] },
      { sql: "UPDATE anonymous_sessions SET account_id = ? WHERE id = ?", args: [accountId, sourceSessionId] },
    ], "write");
    return { accountId, sessionId: sourceSessionId };
  }

  const accountId = String(accountRow.id);
  const canonicalSessionId = String(accountRow.canonicalSessionId);
  await db.execute({ sql: "UPDATE accounts SET login = ?, avatar_url = ?, updated_at = ? WHERE id = ?", args: [identity.login, identity.avatarUrl, now, accountId] });
  if (canonicalSessionId !== sourceSessionId) {
    await db.batch([
      { sql: "UPDATE pivots SET session_id = ? WHERE session_id = ?", args: [canonicalSessionId, sourceSessionId] },
      { sql: "UPDATE goals SET session_id = ? WHERE session_id = ?", args: [canonicalSessionId, sourceSessionId] },
      { sql: "UPDATE replacements SET session_id = ? WHERE session_id = ?", args: [canonicalSessionId, sourceSessionId] },
      { sql: "UPDATE context_tags SET session_id = ? WHERE session_id = ?", args: [canonicalSessionId, sourceSessionId] },
      { sql: "UPDATE urge_sessions SET session_id = ? WHERE session_id = ?", args: [canonicalSessionId, sourceSessionId] },
      { sql: "UPDATE active_interventions SET session_id = ? WHERE session_id = ?", args: [canonicalSessionId, sourceSessionId] },
      { sql: "UPDATE privacy_events SET session_id = ? WHERE session_id = ?", args: [canonicalSessionId, sourceSessionId] },
      { sql: "INSERT INTO notification_preferences (session_id, cadence, timezone, updated_at) SELECT ?, cadence, timezone, updated_at FROM notification_preferences WHERE session_id = ? ON CONFLICT(session_id) DO UPDATE SET cadence = excluded.cadence, timezone = excluded.timezone, updated_at = excluded.updated_at WHERE excluded.updated_at >= notification_preferences.updated_at", args: [canonicalSessionId, sourceSessionId] },
      { sql: "DELETE FROM notification_preferences WHERE session_id = ?", args: [sourceSessionId] },
      { sql: "DELETE FROM notification_deliveries WHERE subscription_id IN (SELECT source.id FROM push_subscriptions source WHERE source.session_id = ? AND EXISTS (SELECT 1 FROM push_subscriptions target WHERE target.session_id = ? AND target.endpoint = source.endpoint))", args: [sourceSessionId, canonicalSessionId] },
      { sql: "DELETE FROM push_subscriptions WHERE session_id = ? AND endpoint IN (SELECT endpoint FROM push_subscriptions WHERE session_id = ?)", args: [sourceSessionId, canonicalSessionId] },
      { sql: "UPDATE push_subscriptions SET session_id = ?, updated_at = ? WHERE session_id = ?", args: [canonicalSessionId, now, sourceSessionId] },
      { sql: "DELETE FROM rate_limits WHERE key LIKE '%:' || ?", args: [sourceSessionId] },
      { sql: "DELETE FROM anonymous_sessions WHERE id = ?", args: [sourceSessionId] },
      { sql: "UPDATE anonymous_sessions SET account_id = ? WHERE id = ?", args: [accountId, canonicalSessionId] },
    ], "write");
  }
  return { accountId, sessionId: canonicalSessionId };
}
