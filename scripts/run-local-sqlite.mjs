import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const command = process.argv[2];
const args = process.argv.slice(3);
if (!command) throw new Error("A command is required");

await mkdir(path.resolve("data"), { recursive: true });
const nextBin = path.resolve("node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, command, ...args], {
  stdio: "inherit",
  env: { ...process.env, TURSO_DATABASE_URL: process.env.LOCAL_DB_URL ?? "file:./data/pivot.db", COOKIE_SECURE: "false" },
});
child.on("exit", (code, signal) => { if (signal) process.kill(process.pid, signal); else process.exit(code ?? 1); });
