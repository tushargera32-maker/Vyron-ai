import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "aether.db");

let dbInstance: Db | null = null;

export function getDatabasePath(): string {
  return process.env.AETHER_DB_PATH || DEFAULT_DB_PATH;
}

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function openDatabase(dbPath = getDatabasePath()): Db {
  if (dbPath !== ":memory:") ensureDirForFile(dbPath);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

export function getDb(): Db {
  if (!dbInstance) dbInstance = openDatabase();
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function withTempDb<T>(fn: (db: Db) => T): T {
  const db = openDatabase(":memory:");
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
