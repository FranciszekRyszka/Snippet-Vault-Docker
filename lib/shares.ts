// Library sharing: an owner grants another person (by email) read or write
// access to their whole library. If the target has no account yet the share is
// "pending" (shared_with_id NULL) and binds on their first login
// (see lib/users.ts:resolvePendingShares).
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { normalizeEmail, getUserByEmail } from "./users";

export type Permission = "read" | "write";

export type ShareRow = {
  id: string;
  owner_id: string;
  shared_with_email: string;
  shared_with_id: string | null;
  permission: Permission;
  created_at: string;
};

export function isPermission(v: unknown): v is Permission {
  return v === "read" || v === "write";
}

export function listSharesByOwner(ownerId: string): ShareRow[] {
  return db
    .prepare(
      "SELECT * FROM library_shares WHERE owner_id = ? ORDER BY created_at DESC"
    )
    .all(ownerId) as ShareRow[];
}

// Grant (or update the permission of) a share. Upserts on (owner, email) and
// resolves the target user id if that person already has an account.
export function upsertShare(
  ownerId: string,
  email: string,
  permission: Permission
): ShareRow {
  const normEmail = normalizeEmail(email);
  const target = getUserByEmail(normEmail);
  const existing = db
    .prepare(
      "SELECT * FROM library_shares WHERE owner_id = ? AND shared_with_email = ?"
    )
    .get(ownerId, normEmail) as ShareRow | undefined;

  if (existing) {
    db.prepare(
      "UPDATE library_shares SET permission = ?, shared_with_id = ? WHERE id = ?"
    ).run(permission, target?.id ?? null, existing.id);
    return db
      .prepare("SELECT * FROM library_shares WHERE id = ?")
      .get(existing.id) as ShareRow;
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO library_shares (id, owner_id, shared_with_email, shared_with_id, permission)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, ownerId, normEmail, target?.id ?? null, permission);
  return db
    .prepare("SELECT * FROM library_shares WHERE id = ?")
    .get(id) as ShareRow;
}

export function deleteShare(ownerId: string, shareId: string): boolean {
  const res = db
    .prepare("DELETE FROM library_shares WHERE id = ? AND owner_id = ?")
    .run(shareId, ownerId);
  return res.changes > 0;
}
