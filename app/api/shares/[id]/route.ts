// Revoke a share the signed-in user granted.
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { deleteShare } from "@/lib/shares";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  // Scoped to owner_id, so you can only revoke your own shares.
  const ok = deleteShare(user.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
