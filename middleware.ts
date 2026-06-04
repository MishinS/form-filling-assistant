// Builds a NextAuth instance from the EDGE-SAFE config only (no bcrypt). Unauthenticated
// requests to matched routes hit authorized()=false → redirect to /login?callbackUrl=...
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Run on everything EXCEPT API routes (they self-guard with 401), Next internals,
  // static assets, and the login page itself.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts|login).*)"],
};
