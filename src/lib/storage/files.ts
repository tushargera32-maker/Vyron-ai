import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_ROOT = path.join(process.cwd(), "data");
const UPLOAD_ROOT = path.join(DATA_ROOT, "uploads");

export function ensureSafeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  return UPLOAD_ROOT;
}

export function resolveManagedPath(relativeOrName: string) {
  const full = path.resolve(UPLOAD_ROOT, relativeOrName);
  const root = path.resolve(UPLOAD_ROOT);
  if (!full.startsWith(root)) throw new Error("Invalid storage path");
  return full;
}

export async function saveUpload(buffer: Buffer, originalName: string) {
  await ensureUploadDir();
  const safe = ensureSafeFilename(originalName);
  const stored = `${Date.now()}-${randomUUID()}-${safe}`;
  const full = resolveManagedPath(stored);
  await fs.writeFile(full, buffer);
  return { storedName: stored, relativePath: path.join("data", "uploads", stored).replace(/\\/g, "/"), fullPath: full };
}

export async function readManagedFile(relativePath: string) {
  // relativePath like data/uploads/...
  const normalized = relativePath.replace(/^data[\\/]uploads[\\/]/, "");
  const full = resolveManagedPath(normalized);
  return fs.readFile(full);
}

export async function deleteManagedFile(relativePath: string) {
  try {
    const normalized = relativePath.replace(/^data[\\/]uploads[\\/]/, "");
    const full = resolveManagedPath(normalized);
    await fs.unlink(full);
  } catch {}
}