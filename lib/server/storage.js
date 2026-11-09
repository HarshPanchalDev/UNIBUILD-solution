import "server-only";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "./crypto.js";
import { invalid } from "../loyalty/errors.js";

// Local disk storage under STORAGE_DIR (default ./storage). Files are served through
// /api/files/... with access checks — never from /public. Swap for S3/R2 by replacing these two functions.
const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage");

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const IMAGE_TYPES = [
  { ext: "jpg", type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", type: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "webp", type: "image/webp", test: (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
];

/** Check the real file type from its first bytes (not the file name). */
export function detectImage(buffer) {
  return IMAGE_TYPES.find((t) => buffer.length > 12 && t.test(buffer)) ?? null;
}

export async function saveImage(file, prefix) {
  if (!file || typeof file.arrayBuffer !== "function") throw invalid("Choose an image file");
  if (file.size > IMAGE_MAX_BYTES) throw invalid("Image must be 2 MB or smaller");
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectImage(buffer);
  if (!kind) throw invalid("Only JPG, PNG or WebP images are allowed");
  return saveBuffer(buffer, prefix, kind.ext);
}

export async function saveBuffer(buffer, prefix, ext) {
  const safePrefix = prefix.replace(/[^a-z0-9/-]/gi, "");
  const key = `${safePrefix}/${new Date().toISOString().slice(0, 7)}/${randomToken(12)}.${ext.replace(/[^a-z0-9]/gi, "")}`;
  const full = path.join(ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer);
  return key;
}

export async function readStored(key) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw invalid("Bad file path");
  return readFile(full);
}

export function contentTypeFor(key) {
  const ext = key.split(".").pop().toLowerCase();
  return { jpg: "image/jpeg", png: "image/png", webp: "image/webp", csv: "text/csv", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }[ext] ?? "application/octet-stream";
}

export const fileUrl = (key) => (key ? `/api/files/${key}` : null);
