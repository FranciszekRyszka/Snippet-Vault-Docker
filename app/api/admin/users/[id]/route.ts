// Admin: update or delete a single user. Guards against locking every admin out.
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAdminUser,
  getSessionUser,
  unauthorized,
  forbidden,
} from "@/lib/api-auth";
import {
  getUserById,
  adminUpdateUser,
  adminDeleteUser,
  countAdmins,
  toPublicUser,
} from "@/lib/users";

async function guard() {
  const admin = await getAdminUser();
  if (admin) return { admin };
  return { response: (await getSessionUser()) ? forbidden() : unauthorized() };
}

const updateSchema = z.object({
  name: z.string().max(100).optional(),
  role: z.enum(["admin", "user"]).optional(),
  disabled: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard();
  if (g.response) return g.response;
  const admin = g.admin;

  const { id } = await params;
  const target = getUserById(id);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const fields = parsed.data;

  // Lock-out guard: don't let the last active admin lose admin/active status.
  const targetCurrentlyCounts = target.role === "admin" && !target.disabled;
  const willBeAdmin = (fields.role ?? target.role) === "admin";
  const willBeActive =
    fields.disabled !== undefined ? !fields.disabled : !target.disabled;
  const targetWillCount = willBeAdmin && willBeActive;
  if (targetCurrentlyCounts && !targetWillCount && countAdmins() <= 1) {
    return NextResponse.json(
      { error: "You can't remove the last remaining admin" },
      { status: 400 }
    );
  }

  // Extra self-safety: an admin can't strip their own admin role (use another
  // admin account for that), which also avoids surprising self-lockout.
  if (id === admin.id && fields.role === "user") {
    return NextResponse.json(
      { error: "You can't remove your own admin role" },
      { status: 400 }
    );
  }

  const updated = await adminUpdateUser(id, fields);
  return NextResponse.json(toPublicUser(updated!));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard();
  if (g.response) return g.response;
  const admin = g.admin;

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json(
      { error: "You can't delete your own account" },
      { status: 400 }
    );
  }
  const target = getUserById(id);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.role === "admin" && !target.disabled && countAdmins() <= 1) {
    return NextResponse.json(
      { error: "You can't delete the last remaining admin" },
      { status: 400 }
    );
  }

  adminDeleteUser(id);
  return NextResponse.json({ success: true });
}
