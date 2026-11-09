// Database backup: dumps the MySQL database from DATABASE_URL to backups/unibuild-YYYY-MM-DD_HHMM.sql.gz
// and keeps the newest BACKUP_KEEP files (default 30).
// Usage:  npm run db:backup
// Needs the mysqldump tool from MySQL. If it is not on PATH, set MYSQLDUMP_PATH in .env, e.g.
//   MYSQLDUMP_PATH="C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe"
// Schedule it daily (Linux crontab:  0 2 * * * cd /var/www/unibuild && npm run db:backup >> logs/backup.log 2>&1;
// Windows: Task Scheduler running "npm run db:backup" in the project folder).
import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { createGzip } from "node:zlib";
import path from "node:path";
import { pipeline } from "node:stream/promises";

if (existsSync(".env") && typeof process.loadEnvFile === "function") process.loadEnvFile(".env");

const url = process.env.DATABASE_URL;
if (!url) fail("DATABASE_URL is not set (.env)");
const db = new URL(url);
const database = decodeURIComponent(db.pathname.replace(/^\//, ""));
const dir = path.resolve(process.env.BACKUP_DIR || "./backups");
const keep = Math.max(1, Number(process.env.BACKUP_KEEP || 30));

function fail(msg) {
  console.error(`Backup failed: ${msg}`);
  process.exit(1);
}

function findMysqldump() {
  if (process.env.MYSQLDUMP_PATH) return process.env.MYSQLDUMP_PATH;
  if (process.platform === "win32") {
    for (const v of ["8.4", "8.0", "9.0", "9.1", "9.2", "9.3", "9.4"]) {
      const p = `C:\\Program Files\\MySQL\\MySQL Server ${v}\\bin\\mysqldump.exe`;
      if (existsSync(p)) return p;
    }
  }
  return "mysqldump";
}

const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).slice(0, 16).replace(" ", "_").replace(":", "");
await mkdir(dir, { recursive: true });
const file = path.join(dir, `${database}-${stamp}.sql.gz`);

const args = [
  `--host=${db.hostname}`,
  `--port=${db.port || 3306}`,
  `--user=${decodeURIComponent(db.username)}`,
  "--single-transaction", // consistent copy without locking the shop out
  "--no-tablespaces", // avoids needing the PROCESS privilege
  "--routines",
  "--triggers",
  "--default-character-set=utf8mb4",
  database,
];
// Password goes through the environment, not the command line (not visible in the process list).
const child = spawn(findMysqldump(), args, { env: { ...process.env, MYSQL_PWD: decodeURIComponent(db.password) }, stdio: ["ignore", "pipe", "pipe"] });
let errText = "";
child.stderr.on("data", (d) => (errText += d));
child.on("error", (e) => {
  if (e.code === "ENOENT") fail('mysqldump not found. Set MYSQLDUMP_PATH in .env (see the top of scripts/backup-db.js).');
  fail(e.message);
});
const exited = new Promise((resolve) => child.on("close", resolve));

let dumped = 0;
child.stdout.on("data", (d) => (dumped += d.length));
await pipeline(child.stdout, createGzip(), createWriteStream(file));
const code = await exited;
if (code !== 0) {
  await rm(file, { force: true });
  fail(errText.trim() || `mysqldump exited with code ${code}`);
}
const size = (await stat(file)).size;
if (dumped < 2000) {
  await rm(file, { force: true });
  fail(`mysqldump returned almost nothing (${dumped} bytes). Check the database name and user rights.`);
}
console.log(`Backup saved: ${file} (${(dumped / 1024).toFixed(0)} KB data, ${(size / 1024).toFixed(0)} KB compressed)`);

// Keep only the newest `keep` backups of this database
const old = (await readdir(dir)).filter((f) => f.startsWith(`${database}-`) && f.endsWith(".sql.gz")).sort().reverse().slice(keep);
for (const f of old) {
  await rm(path.join(dir, f));
  console.log(`Removed old backup: ${f}`);
}
