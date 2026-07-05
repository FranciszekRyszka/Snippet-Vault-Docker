import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next 16's "proxy" convention (the former "middleware"). Built from the
// db-free config so it stays Edge-safe: it only decodes the JWT and applies the
// `authorized` gate — no database access happens here.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Run on everything EXCEPT: NextAuth's own routes (must stay public to log
  // in), Next internals, the favicon, and any static file (has an extension).
  // Application pages and /api/snippets ARE matched, so they're protected.
  matcher: ["/((?!api/auth|_next|favicon.ico|.*\\.[\\w]+$).*)"],
};
