// Augment NextAuth's types with the fields we carry: the canonical database
// user id and the role. Keeps `session.user.id`, `user.role`, and `token.role`
// type-safe across the app.
import type { DefaultSession } from "next-auth";

type Role = "admin" | "user";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
  }
}
