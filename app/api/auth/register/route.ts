// Self-service registration. Disabled by default — gated on
// ALLOW_SELF_REGISTRATION so a world-facing instance doesn't accept unbounded
// signups. Admins create accounts through the admin dashboard instead.
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getUserByEmail,
  createUser,
  selfRegistrationEnabled,
  toPublicUser,
} from "@/lib/users";

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  if (!selfRegistrationEnabled()) {
    return NextResponse.json(
      { error: "Self-registration is disabled" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;
  if (getUserByEmail(email)) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const user = await createUser({ email, password, name });
  return NextResponse.json(toPublicUser(user), { status: 201 });
}
