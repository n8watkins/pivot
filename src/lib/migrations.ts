import type { Client } from "@libsql/client";

const migrations = [
  {
    version: 1,
    statements: [
      "CREATE TABLE IF NOT EXISTS anonymous_sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, label TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS replacements (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, label TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', duration TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS urge_sessions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, intensity INTEGER NOT NULL, context_type TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, urge_session_id TEXT NOT NULL, replacement_id TEXT NOT NULL, source TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', first_step TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS active_interventions (id TEXT PRIMARY KEY, recommendation_id TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT)",
      "CREATE TABLE IF NOT EXISTS follow_ups (id TEXT PRIMARY KEY, intervention_id TEXT NOT NULL, outcome TEXT NOT NULL, helpfulness INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS privacy_events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)",
      "CREATE INDEX IF NOT EXISTS idx_goals_session ON goals(session_id)",
      "CREATE INDEX IF NOT EXISTS idx_replacements_session ON replacements(session_id)",
      "CREATE INDEX IF NOT EXISTS idx_urge_sessions_session ON urge_sessions(session_id)",
      "CREATE INDEX IF NOT EXISTS idx_follow_ups_intervention ON follow_ups(intervention_id)",
    ],
  },
  {
    version: 2,
    statements: [
      "ALTER TABLE goals ADD COLUMN created_at TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE recommendations ADD COLUMN created_at TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE follow_ups ADD COLUMN created_at TEXT NOT NULL DEFAULT ''",
    ],
  },
  {
    version: 3,
    statements: [
      "ALTER TABLE active_interventions ADD COLUMN session_id TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE active_interventions ADD COLUMN replacement_id TEXT NOT NULL DEFAULT ''",
    ],
  },
  {
    version: 4,
    statements: [
      "CREATE TABLE IF NOT EXISTS pivots (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, label TEXT NOT NULL, created_at TEXT NOT NULL)",
      "ALTER TABLE goals ADD COLUMN pivot_id TEXT",
      "ALTER TABLE replacements ADD COLUMN pivot_id TEXT",
      "CREATE INDEX IF NOT EXISTS idx_pivots_session ON pivots(session_id)",
      "CREATE INDEX IF NOT EXISTS idx_goals_pivot ON goals(pivot_id)",
      "CREATE INDEX IF NOT EXISTS idx_replacements_pivot ON replacements(pivot_id)",
    ],
  },
  {
    version: 5,
    statements: [
      "CREATE TABLE IF NOT EXISTS context_tags (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, label TEXT NOT NULL, created_at TEXT NOT NULL)",
      "CREATE INDEX IF NOT EXISTS idx_context_tags_session ON context_tags(session_id)",
    ],
  },
  {
    version: 6,
    statements: [
      "CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_account_id TEXT NOT NULL, login TEXT NOT NULL, avatar_url TEXT, canonical_session_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_provider_identity ON accounts(provider, provider_account_id)",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_canonical_session ON accounts(canonical_session_id)",
      "ALTER TABLE anonymous_sessions ADD COLUMN account_id TEXT",
      "CREATE INDEX IF NOT EXISTS idx_anonymous_sessions_account ON anonymous_sessions(account_id)",
    ],
  },
  {
    version: 7,
    statements: [
      "ALTER TABLE urge_sessions ADD COLUMN pivot_id TEXT",
      "ALTER TABLE urge_sessions ADD COLUMN pivot_label TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE active_interventions ADD COLUMN pivot_id TEXT",
      "ALTER TABLE recommendations ADD COLUMN replacement_label TEXT NOT NULL DEFAULT ''",
      "CREATE INDEX IF NOT EXISTS idx_urge_sessions_pivot ON urge_sessions(pivot_id)",
      "CREATE INDEX IF NOT EXISTS idx_active_interventions_pivot ON active_interventions(pivot_id)",
    ],
  },
  {
    version: 8,
    statements: [
      "ALTER TABLE active_interventions ADD COLUMN reason TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE active_interventions ADD COLUMN first_step TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE active_interventions ADD COLUMN source TEXT NOT NULL DEFAULT 'fallback'",
    ],
  },
] as const;

async function hasColumn(db: Client, table: string, column: string) {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

export async function migrate(db: Client) {
  await db.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = await db.execute("SELECT version FROM schema_migrations ORDER BY version");
  const appliedVersions = new Set(applied.rows.map((row) => Number(row.version)));
  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;
    for (const statement of migration.statements) {
      if (statement.startsWith("ALTER TABLE")) {
        const match = statement.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/);
        if (match && await hasColumn(db, match[1], match[2])) continue;
      }
      await db.execute(statement);
    }
    await db.execute({ sql: "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", args: [migration.version, new Date().toISOString()] });
  }
}
