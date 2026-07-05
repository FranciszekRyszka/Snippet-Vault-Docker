import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config: NO database or Node-only imports here, because this
// module is pulled into `middleware.ts`, which runs on the Edge runtime.
// The db-backed providers and the sign-in callback live in `auth.ts`.
//
// Route gating and the token<->session field wiring (both db-free) live here so
// they're shared by the middleware and the full server config.

// Anyone can reach these without being signed in.
const PUBLIC_PATHS = ["/signin", "/signup"];

export const authConfig: NextAuthConfig = {
  // JWT sessions: required by the Credentials provider and readable at the edge
  // without a database round-trip.
  session: { strategy: "jwt" },
  trustHost: true,
  // Render auth errors (e.g. a rejected/allowlist-blocked sign-in) on our own
  // sign-in page via ?error=<code> instead of the default NextAuth error page.
  pages: { signIn: "/signin", error: "/signin" },
  // Providers are attached in auth.ts (they need the database). Middleware only
  // decodes the existing JWT, so it needs none.
  providers: [],
  callbacks: {
    // Runs in middleware for every matched request. Returning false redirects to
    // the sign-in page; returning a Response short-circuits with it.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isPublic = PUBLIC_PATHS.some((p) =>
        nextUrl.pathname.startsWith(p)
      );
      if (isPublic) {
        // Already signed in? Bounce away from the sign-in/up pages.
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      if (!isLoggedIn) return false;
      // The admin area is admin-only; send everyone else back to the app.
      if (nextUrl.pathname.startsWith("/admin")) {
        const role = (auth?.user as { role?: string } | undefined)?.role;
        if (role !== "admin") return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
    // Copy our db user id + role onto the token at sign-in (when `user` is set),
    // and expose them on the session. Neither touches the database.
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      // token.uid/role are carried on the JWT (set above). Cast because v5 types
      // the token via @auth/core/jwt, which our augmentation doesn't reach.
      if (token.uid && session.user) {
        session.user.id = String(token.uid);
        session.user.role = (token.role as "admin" | "user") ?? "user";
      }
      return session;
    },
  },
};
