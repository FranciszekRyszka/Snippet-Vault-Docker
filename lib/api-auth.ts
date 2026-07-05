// Server-side helpers for the API route handlers: read the authenticated user
// from the session, and a canned 401. Middleware already gates these routes, but
// the handlers check again (defense in depth) and need the user id to scope
// queries to the owner.
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  role: "admin" | "user";
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as SessionUser;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Returns the user only if they're a signed-in admin, else null — callers pair
// this with forbidden()/unauthorized() to guard the admin API.
export async function getAdminUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}
