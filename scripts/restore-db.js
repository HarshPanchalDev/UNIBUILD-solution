// Restore a backup made by scripts/backup-db.js into the database in DATABASE_URL.
// THIS REPLACES THE CURRENT DATA. Take a fresh backup first.
// Usage:  npm run db:restore -- backups/unibuild-2026-11-09_0200.sql.gz --yes
// Needs the mysql client. If it is not on PATH, set MYSQL_PATH in .env, e.g.
//   MYSQL_PATH="C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe"
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

if (existsSync(".env") && typeof process.loadEnvFile === "function") process.loadEnvFile(".env");

const file = process.argv.find((a) => a.endsWith(".sql.gz") || a.endsWith(".sql"));
const confirmed = process.argv.includes("--yes");
function fail(msg) {
  console.error(`Restore failed: ${msg}`);
  process.exit(1);
}
if (!file || !existsSync(file)) fail("give the backup file, e.g. npm run db:restore -- backups/unibuild-2026-11-09_0200.sql.gz --yes");
if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set (.env)");
const db = new URL(process.env.DATABASE_URL);
const database = decodeURIComponent(db.pathname.replace(/^\//, ""));
if (!confirmed) fail(`this will REPLACE all data in database "${database}" with ${file}. Add --yes to continue.`);

function findMysql() {
  if (process.env.MYSQL_PATH) return process.env.MYSQL_PATH;
  if (process.platform === "win32") {
    for (const v of ["8.4", "8.0", "9.0", "9.1", "9.2", "9.3", "9.4"]) {
      const p = `C:\\Program Files\\MySQL\\MySQL Server ${v}\\bin\\mysql.exe`;
      if (existsSync(p)) return p;
    }
  }
  return "mysql";
}

const child = spawn(
  findMysql(),
  [`--host=${db.hostname}`, `--port=${db.port || 3306}`, `--user=${decodeURIComponent(db.username)}`, "--default-character-set=utf8mb4", database],
  { env: { ...process.env, MYSQL_PWD: decodeURIComponent(db.password) }, stdio: ["pipe", "inherit", "pipe"] },
);
let errText = "";
child.stderr.on("data", (d) => (errText += d));
child.on("error", (e) => fail(e.code === "ENOENT" ? "mysql client not found. Set MYSQL_PATH in .env." : e.message));
const exited = new Promise((resolve) => child.on("close", resolve));
const source = createReadStream(file);
await pipeline(file.endsWith(".gz") ? source.pipe(createGunzip()) : source, child.stdin);
const code = await exited;
if (code !== 0) fail(errText.trim() || `mysql exited with code ${code}`);
console.log(`Restored ${file} into "${database}".`);
