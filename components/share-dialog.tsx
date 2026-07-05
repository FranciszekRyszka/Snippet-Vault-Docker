"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Trash2, Loader2, Users } from "lucide-react";
import {
  listShares,
  createShare,
  deleteShare,
  type Share,
} from "@/lib/tauri-api";

// Manage who the current user has shared their library with: add by email with
// a read/write permission, and revoke.
export function ShareDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [shares, setShares] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setShares(await listShares());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shares");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!open) return null;

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createShare(email.trim(), permission);
      setEmail("");
      setPermission("read");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to share");
    } finally {
      setSubmitting(false);
    }
  }

  async function onRevoke(id: string) {
    try {
      await deleteShare(id);
      setShares((s) => s.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Share your library
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="mb-3 text-xs text-muted-foreground">
            People you share with can view your prompts. Grant{" "}
            <strong>write</strong> to let them edit and delete too. If they
            don&apos;t have an account yet, the invite applies when they sign up.
          </p>

          <form onSubmit={onAdd} className="flex gap-2">
            <input
              type="email"
              required
              placeholder="teammate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={permission}
              onChange={(e) =>
                setPermission(e.target.value as "read" | "write")
              }
              className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="read">Read</option>
              <option value="write">Write</option>
            </select>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              Share
            </button>
          </form>

          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

          <div className="mt-4">
            {loading ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : shares.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                You haven&apos;t shared with anyone yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {shares.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {s.email}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {s.permission}
                        </span>
                        {!s.accepted && (
                          <span className="text-[10px] text-muted-foreground">
                            pending
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRevoke(s.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Revoke ${s.email}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
