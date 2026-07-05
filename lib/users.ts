// User accounts, password hashing, and the account-lifecycle rules (admin
// bootstrap, orphan-snippet claiming, pending-share resolution). All three
// login methods — password, Google, GitHub — funnel through here so there is
// exactly one row per person, keyed by their (verified) email.

import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "./db";

export type Role = "admin" | "user";

// Full row, including the password hash — never send this to the client.
export type UserRow = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  password_hash: string | null;
  role: Role;
  disabled: number;
  created_at: string;
  updated_at: string;
};

// Client-safe shape (no hash), plus whether a password is set.
export type PublicUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  disabled: boolean;
  hasPassword: boolean;
  created_at: string;
};

const BCRYPT_COST = 12;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    role: u.role,
    disabled: Boolean(u.disabled),
    hasPassword: Boolean(u.password_hash),
    created_at: u.created_at,
  };
}

export function getUserByEmail(email: string): UserRow | undefined {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
}

// Bulk display-name/email lookup, keyed by id — used to label snippets shown in
// the "Shared with me" view with their owner.
export function getUsersByIds(
  ids: string[]
): Record<string, { name: string; email: string }> {
  if (ids.length === 0) return {};
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT id, name, email FROM users WHERE id IN (${placeholders})`)
    .all(...ids) as { id: string; name: string; email: string }[];
  const map: Record<string, { name: string; email: string }> = {};
  for (const r of rows) map[r.id] = { name: r.name, email: r.email };
  return map;
}

function countUsers(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number })
    .n;
}

// Role policy: if ADMIN_EMAIL is configured, only that address is admin.
// Otherwise the very first account to be created bootstraps as admin.
function determineRole(email: string): Role {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (configured) return normalizeEmail(email) === configured ? "admin" : "user";
  return countUsers() === 0 ? "admin" : "user";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

// Snippets created before auth existed have owner_id NULL. The first admin
// adopts them so the pre-auth library isn't stranded.
function claimOrphanSnippets(userId: string): void {
  db.prepare(
    "UPDATE snippets SET owner_id = ? WHERE owner_id IS NULL"
  ).run(userId);
}

// A share created for an email that had no account yet is "pending"; bind it to
// the real user id once that person exists.
function resolvePendingShares(userId: string, email: string): void {
  db.prepare(
    "UPDATE library_shares SET shared_with_id = ? WHERE shared_with_email = ? AND shared_with_id IS NULL"
  ).run(userId, normalizeEmail(email));
}

type CreateUserInput = {
  email: string;
  name?: string;
  password?: string;
  image?: string | null;
  role?: Role;
};

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const email = normalizeEmail(input.email);
  const id = randomUUID();
  const role = input.role ?? determineRole(email);
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : null;

  db.prepare(
    `INSERT INTO users (id, email, name, image, password_hash, role)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, email, input.name?.trim() || "", input.image ?? null, passwordHash, role);

  if (role === "admin") claimOrphanSnippets(id);
  resolvePendingShares(id, email);

  return getUserById(id)!;
}

// Called on OAuth sign-in. Reuses an existing account (matched by verified
// email) so Google + GitHub + password can all point at one person; otherwise
// creates a passwordless account.
export async function upsertOAuthUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<UserRow> {
  const existing = getUserByEmail(input.email);
  if (existing) {
    // Backfill a display name / avatar if we didn't have one yet.
    const name = existing.name || input.name?.trim() || "";
    const image = existing.image || input.image || null;
    if (name !== existing.name || image !== existing.image) {
      db.prepare(
        "UPDATE users SET name = ?, image = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(name, image, existing.id);
    }
    return getUserById(existing.id)!;
  }
  return createUser({
    email: input.email,
    name: input.name ?? "",
    image: input.image ?? null,
  });
}

// Returns the user iff the password matches and the account is enabled.
export async function verifyCredentials(
  email: string,
  password: string
): Promise<UserRow | null> {
  const user = getUserByEmail(email);
  if (!user || user.disabled || !user.password_hash) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  return ok ? user : null;
}

export function selfRegistrationEnabled(): boolean {
  return process.env.ALLOW_SELF_REGISTRATION === "true";
}

// ---- Admin dashboard operations -------------------------------------------

export type AdminUser = PublicUser & { snippet_count: number };

export function listUsers(): AdminUser[] {
  const rows = db
    .prepare(
      `SELECT u.*,
              (SELECT COUNT(*) FROM snippets s WHERE s.owner_id = u.id) AS snippet_count
       FROM users u
       ORDER BY u.created_at ASC`
    )
    .all() as (UserRow & { snippet_count: number })[];
  return rows.map((r) => ({
    ...toPublicUser(r),
    snippet_count: Number(r.snippet_count ?? 0),
  }));
}

export function countAdmins(): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND disabled = 0")
      .get() as { n: number }
  ).n;
}

// Partial update of a user's profile/role/status/password. Only provided fields
// change. Returns the updated row, or undefined if the id doesn't exist.
export async function adminUpdateUser(
  id: string,
  fields: {
    name?: string;
    role?: Role;
    disabled?: boolean;
    password?: string;
  }
): Promise<UserRow | undefined> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (fields.name !== undefined) {
    sets.push("name = ?");
    values.push(fields.name.trim());
  }
  if (fields.role !== undefined) {
    sets.push("role = ?");
    values.push(fields.role);
  }
  if (fields.disabled !== undefined) {
    sets.push("disabled = ?");
    values.push(fields.disabled ? 1 : 0);
  }
  if (fields.password !== undefined) {
    sets.push("password_hash = ?");
    values.push(await hashPassword(fields.password));
  }
  if (sets.length === 0) return getUserById(id);

  sets.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return getUserById(id);
}

// Remove a user and everything tied to them: their snippets, shares they
// granted, and shares granted TO them. Wrapped in a transaction.
export function adminDeleteUser(id: string): boolean {
  const tx = db.transaction((userId: string) => {
    db.prepare("DELETE FROM snippets WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM library_shares WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM library_shares WHERE shared_with_id = ?").run(userId);
    const res = db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    return res.changes > 0;
  });
  return tx(id) as boolean;
}
