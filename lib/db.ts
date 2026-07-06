import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Where the SQLite file lives. In Docker this is a bind/volume mount so the data
// survives container restarts. Override with DATABASE_PATH; otherwise default to
// ./data/snippets.db relative to the app's working directory.
const dbPath =
  process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim()
    ? process.env.DATABASE_PATH
    : path.join(process.cwd(), "data", "snippets.db");

// The connection is created lazily on first use, not at import time. `next build`
// imports every API route module (in ~15 parallel workers) purely to collect page
// data — it never invokes the handlers — so opening the database and running
// migrations at import made all those workers race on one SQLite file, which
// intermittently failed the build. With lazy init the build never touches the DB;
// at runtime the single server process initializes once, synchronously, on the
// first query.
let connection: Database.Database | null = null;

function initDb(): Database.Database {
  if (connection) return connection;

  // Ensure the parent directory exists — on first boot the mounted volume may be
  // empty, and better-sqlite3 won't create missing directories itself.
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const database = new Database(dbPath);

  // Enable WAL mode for better concurrency.
  database.pragma("journal_mode = WAL");
  // Wait (don't immediately error) if another connection holds a write lock. The
  // server is single-process, but a rolling deploy can briefly run two containers
  // against one mounted file, so keep the timeout as defence.
  database.pragma("busy_timeout = 5000");

  // Initialize the database schema.
  database.exec(`
    CREATE TABLE IF NOT EXISTS snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      code TEXT NOT NULL,
      language TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_snippets_language ON snippets(language);
    CREATE INDEX IF NOT EXISTS idx_snippets_created_at ON snippets(created_at);

    -- Accounts. A user may authenticate via password (password_hash set) and/or
    -- OAuth (password_hash NULL). One row per person, keyed by verified email.
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT DEFAULT '',
      image TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    -- Library-level sharing: owner grants another person (by email) access to
    -- their whole library. shared_with_id is filled in when that person exists;
    -- until then the share is "pending" and resolves on their first login.
    CREATE TABLE IF NOT EXISTS library_shares (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      shared_with_email TEXT NOT NULL,
      shared_with_id TEXT,
      permission TEXT NOT NULL DEFAULT 'read',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(owner_id, shared_with_email)
    );
    CREATE INDEX IF NOT EXISTS idx_shares_owner ON library_shares(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shares_with ON library_shares(shared_with_id);
  `);

  // Migrations: add columns introduced after the initial schema to older
  // databases. Each is guarded so it runs at most once.
  const existingColumns = new Set(
    (
      database.prepare("PRAGMA table_info(snippets)").all() as { name: string }[]
    ).map((c) => c.name)
  );
  const addColumn = (name: string, definition: string) => {
    if (existingColumns.has(name)) return;
    try {
      database.exec(`ALTER TABLE snippets ADD COLUMN ${definition}`);
    } catch (err) {
      // A second process (e.g. mid rolling-deploy) may have added it between our
      // PRAGMA read and now. Idempotent: swallow the duplicate, rethrow the rest.
      if (!(err instanceof Error) || !/duplicate column/i.test(err.message)) {
        throw err;
      }
    }
    existingColumns.add(name);
  };
  addColumn("favorite", "favorite INTEGER NOT NULL DEFAULT 0");
  addColumn("model", "model TEXT NOT NULL DEFAULT ''");
  addColumn("copy_count", "copy_count INTEGER NOT NULL DEFAULT 0");
  addColumn("last_used_at", "last_used_at TEXT");
  // Multi-user: every snippet belongs to a user. Rows created before auth existed
  // have owner_id NULL ("orphans") and are invisible until the first admin claims
  // them on first login (see lib/users.ts:claimOrphanSnippets).
  addColumn("owner_id", "owner_id TEXT");
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_snippets_owner ON snippets(owner_id)"
  );

  connection = database;
  return connection;
}

// Lazy singleton: accessing any property (db.prepare, db.transaction, db.exec, …)
// initializes the connection on first use and forwards to it, bound so methods
// keep the right `this`. This keeps the plain `db.prepare(...)` call sites across
// the codebase unchanged while deferring all I/O to runtime.
export const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const database = initDb();
    const value = Reflect.get(database, prop) as unknown;
    return typeof value === "function" ? value.bind(database) : value;
  },
});

export type Snippet = {
  id: number;
  title: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
  favorite: boolean;
  model: string;
  copy_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

// Parse the stored JSON tags array, tolerating a corrupt/malformed cell rather
// than throwing — one bad row must not 500 the entire list.
function parseTags(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

// Helper to convert DB row (with JSON tags) to Snippet type
export function rowToSnippet(row: Record<string, unknown>): Snippet {
  return {
    ...row,
    tags: parseTags(row.tags),
    favorite: Boolean(row.favorite),
    model: (row.model as string) ?? "",
    copy_count: Number(row.copy_count ?? 0),
    last_used_at: (row.last_used_at as string) ?? null,
  } as Snippet;
}
