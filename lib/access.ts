// Authorization sets for snippet access. A user can always reach their own
// library; library sharing widens that to include owners who shared with them.
// This is the single place that resolves "whose snippets may I read/write" — the
// snippet routes consult it, so the sharing rules live in exactly one spot.
import { db } from "./db";

// Owners who granted the user any access to their library.
function sharedReadOwnerIds(userId: string): string[] {
  const rows = db
    .prepare(
      "SELECT DISTINCT owner_id FROM library_shares WHERE shared_with_id = ?"
    )
    .all(userId) as { owner_id: string }[];
  return rows.map((r) => r.owner_id);
}

// Owners who granted the user write access to their library.
function sharedWriteOwnerIds(userId: string): string[] {
  const rows = db
    .prepare(
      "SELECT DISTINCT owner_id FROM library_shares WHERE shared_with_id = ? AND permission = 'write'"
    )
    .all(userId) as { owner_id: string }[];
  return rows.map((r) => r.owner_id);
}

// Just the shared-in owners (for the "Shared with me" view).
export function sharedInOwnerIds(userId: string): string[] {
  return sharedReadOwnerIds(userId);
}

// All owners whose snippets the user may read: self + shared-in.
export function readableOwnerIds(userId: string): string[] {
  return [userId, ...sharedReadOwnerIds(userId)];
}

// All owners whose snippets the user may modify: self + shared-in-with-write.
export function writableOwnerIds(userId: string): string[] {
  return [userId, ...sharedWriteOwnerIds(userId)];
}
