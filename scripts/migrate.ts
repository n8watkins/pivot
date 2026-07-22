import { createClient } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { migrate } from "../src/lib/migrations";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is required");

async function main() {
  if (url!.startsWith("file:")) await mkdir(dirname(resolve(url!.slice(5).split("?")[0])), { recursive: true });
  const db = createClient({
    url: url!,
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  });
  await migrate(db);
  db.close();
  console.log("Pivot database migrations are current.");
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Database migration failed.");
  process.exitCode = 1;
});
