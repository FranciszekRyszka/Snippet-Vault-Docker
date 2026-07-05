"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  adminCreateUser,
  adminUpdateUser,
  type AdminUser,
} from "@/lib/admin-api";

type Props = {
  mode: "create" | "edit";
  user?: AdminUser;
  isSelf?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

// Create a new account, or edit an existing one (name, role, enabled state, and
// an optional password reset). Reused for both flows.
export function UserFormDialog({ mode, user, isSelf, onClose, onSaved }: Props) {
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">(user?.role ?? "user");
  const [disabled, setDisabled] = useState<boolean>(user?.disabled ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "create" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "edit" && password && password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        await adminCreateUser({ email, password, name, role });
      } else if (user) {
        await adminUpdateUser(user.id, {
          name,
          role,
          disabled,
          ...(password ? { password } : {}),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={onClose}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">
            {mode === "create" ? "New user" : `Edit ${user?.email}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              disabled={mode === "edit"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">
              {mode === "create" ? "Password" : "Reset password"}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required={mode === "create"}
              placeholder={mode === "edit" ? "Leave blank to keep current" : ""}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Role</label>
              <select
                value={role}
                disabled={mode === "edit" && isSelf}
                onChange={(e) => setRole(e.target.value as "admin" | "user")}
                className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                title={
                  mode === "edit" && isSelf
                    ? "You can't change your own role"
                    : undefined
                }
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {mode === "edit" && (
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-sm font-medium text-foreground">
                  Status
                </label>
                <label className="flex h-[38px] items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={disabled}
                    onChange={(e) => setDisabled(e.target.checked)}
                  />
                  Disabled
                </label>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : mode === "create" ? "Create user" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
