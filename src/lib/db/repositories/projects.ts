import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "../connection";
import type { Project } from "../types";

export function createProject(db: Db, input: { name: string; description?: string | null; settings_json?: string }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO projects(id,name,description,settings_json,created_at,updated_at) VALUES (?,?,?,?,?,?)`
  ).run(id, input.name, input.description ?? null, input.settings_json ?? "{}", now, now);
  return getProject(db, id)!;
}

export function getProject(db: Db, id: string): Project | undefined {
  return db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Project | undefined;
}

export function listProjects(db: Db): Project[] {
  return db.prepare(`SELECT * FROM projects ORDER BY updated_at DESC`).all() as Project[];
}

export function updateProject(db: Db, id: string, patch: Partial<Pick<Project, "name" | "description" | "settings_json" | "archived_at">>) {
  const current = getProject(db, id);
  if (!current) return undefined;
  const now = new Date().toISOString();
  const next = { ...current, ...patch, updated_at: now };
  db.prepare(
    `UPDATE projects SET name=?, description=?, settings_json=?, archived_at=?, updated_at=? WHERE id=?`
  ).run(next.name, next.description, next.settings_json, next.archived_at, now, id);
  return getProject(db, id);
}

export function deleteProject(db: Db, id: string) {
  const info = db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
  return info.changes > 0;
}
