// Admin: list and create users. Admin-only (checked here in addition to the
// middleware page gate).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser, unauthorized, forbidden } from "@/lib/api-auth";
import {
  listUsers,
  getUserByEmail,
  createUser,
  toPublicUser,
} from "@/lib/users";
import { getSessionUser } from "@/lib/api-auth";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    // Distinguish "not logged in" from "logged in but not admin".
    return (await getSessionUser()) ? forbidden() : unauthorized();
  }
  return NextResponse.json(listUsers());
}

const createSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().max(100).optional(),
  role: z.enum(["admin", "user"]).default("user"),
});

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return (await getSessionUser()) ? forbidden() : unauthorized();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email, password, name, role } = parsed.data;
  if (getUserByEmail(email)) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const user = await createUser({ email, password, name, role });
  return NextResponse.json(toPublicUser(user), { status: 201 });
}
