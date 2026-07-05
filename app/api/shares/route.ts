// Manage the shares the signed-in user has GRANTED (who can see their library).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import {
  listSharesByOwner,
  upsertShare,
  type ShareRow,
} from "@/lib/shares";

// Client-facing shape: hide the internal shared_with_id, expose whether the
// invitee has an account yet ("accepted").
function toShareDto(s: ShareRow) {
  return {
    id: s.id,
    email: s.shared_with_email,
    permission: s.permission,
    accepted: s.shared_with_id !== null,
    created_at: s.created_at,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json(listSharesByOwner(user.id).map(toShareDto));
}

const shareSchema = z.object({
  email: z.string().email().max(255),
  permission: z.enum(["read", "write"]).default("read"),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email, permission } = parsed.data;
  // Sharing with yourself is a no-op you'd never want to see in the list.
  if (email.trim().toLowerCase() === user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "You already have access to your own library" },
      { status: 400 }
    );
  }

  const share = upsertShare(user.id, email, permission);
  return NextResponse.json(toShareDto(share), { status: 201 });
}
