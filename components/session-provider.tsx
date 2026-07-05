"use client";

// Thin client wrapper so the root layout (a server component) can mount
// NextAuth's SessionProvider, enabling useSession()/signOut() in the tree.
import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
