"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Shield,
  Trash2,
  Pencil,
  Users,
} from "lucide-react";
import {
  adminListUsers,
  adminDeleteUser,
  type AdminUser,
} from "@/lib/admin-api";
import { UserFormDialog } from "./user-form-dialog";

export function AdminDashboard({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await adminListUsers());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onDelete(u: AdminUser) {
    if (
      !confirm(
        `Delete ${u.email}? This permanently removes their ${u.snippet_count} prompt(s) and any shares. This cannot be undone.`
      )
    )
      return;
    try {
      await adminDeleteUser(u.id);
      setUsers((list) => list.filter((x) => x.id !== u.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete user");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              User management
            </h1>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {users.length} user{users.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New user
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Sign-in</th>
                  <th className="px-4 py-2.5 font-medium">Prompts</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {u.name || "—"}
                        {u.id === currentUserId && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {u.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent text-muted-foreground"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.disabled ? (
                        <span className="text-xs font-medium text-destructive">
                          disabled
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-green-600 dark:text-green-500">
                          active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.hasPassword ? "password" : "OAuth only"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.snippet_count}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(u)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label={`Edit ${u.email}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(u)}
                          disabled={u.id === currentUserId}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                          aria-label={`Delete ${u.email}`}
                          title={
                            u.id === currentUserId
                              ? "You can't delete your own account"
                              : "Delete user"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {creating && (
        <UserFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}
      {editing && (
        <UserFormDialog
          mode="edit"
          user={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
