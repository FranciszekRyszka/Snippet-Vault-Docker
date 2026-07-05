// Client helpers for the admin user-management API. Web-only.

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: "admin" | "user";
  disabled: boolean;
  hasPassword: boolean;
  created_at: string;
  snippet_count: number;
};

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === "string") return body.error;
  } catch {
    /* no body */
  }
  return fallback;
}

export async function adminListUsers(): Promise<AdminUser[]> {
  const res = await fetch("/api/admin/users");
  if (!res.ok) throw new Error(await parseError(res, "Failed to load users"));
  return res.json();
}

export async function adminCreateUser(input: {
  email: string;
  password: string;
  name?: string;
  role: "admin" | "user";
}): Promise<AdminUser> {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to create user"));
  return res.json();
}

export async function adminUpdateUser(
  id: string,
  fields: {
    name?: string;
    role?: "admin" | "user";
    disabled?: boolean;
    password?: string;
  }
): Promise<AdminUser> {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to update user"));
  return res.json();
}

export async function adminDeleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseError(res, "Failed to delete user"));
}
