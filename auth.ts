import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { authConfig } from "./auth.config";
import {
  verifyCredentials,
  upsertOAuthUser,
  getUserByEmail,
} from "@/lib/users";

// This module is Node-only (it imports the SQLite-backed user store). It's used
// by the API route handlers and server components, NOT by middleware.

// Password login always works. Each OAuth provider is added only when its
// client id/secret are present, so the app boots fine before you register the
// OAuth apps — and lights up the button the moment you add the credentials.
const providers: Provider[] = [
  Credentials({
    credentials: { email: {}, password: {} },
    authorize: async (creds) => {
      const email = creds?.email;
      const password = creds?.password;
      if (typeof email !== "string" || typeof password !== "string") return null;
      const user = await verifyCredentials(email, password);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    })
  );
}

// Provider ids (minus "credentials") the sign-in page should render buttons for.
export const enabledOAuthProviders = providers
  .map((p) => (typeof p === "function" ? p().id : p.id))
  .filter((id) => id !== "credentials");

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    // For OAuth logins, resolve (or create) the canonical account by verified
    // email and reject disabled users. Credentials logins are already vetted in
    // authorize().
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" || account?.provider === "github") {
        const email = user.email ?? (profile?.email as string | undefined);
        if (!email || typeof email !== "string") return false;
        const dbUser = await upsertOAuthUser({
          email,
          name: user.name ?? (profile?.name as string | undefined),
          image: user.image ?? (profile?.picture as string | undefined),
        });
        if (dbUser.disabled) return false;
        user.id = dbUser.id;
        user.role = dbUser.role;
      }
      return true;
    },
    // Authoritative id + role, read from the DB at sign-in by email. This does
    // NOT depend on signIn() mutations reaching the token (which is unreliable
    // in Auth.js v5 for OAuth), so admin promotions take effect on next login
    // for password AND OAuth accounts alike. Overrides the edge jwt in
    // auth.config; that one only passes the token through on later requests.
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      if (user && email) {
        const dbUser = getUserByEmail(email);
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
  },
});
