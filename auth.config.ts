// Edge-safe NextAuth config: NO node-only imports (no bcryptjs, no Credentials authorize).
// middleware.ts builds its NextAuth instance from this alone, so bcrypt never hits the Edge bundle.
// The real Credentials provider is added in auth.ts (Node).
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  // Trust the Host header. Required for self-hosted `next start` (and any non-Vercel
  // host): without it production auth() throws UntrustedHost and returns a truthy
  // error object instead of null — which would silently bypass truthiness guards.
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // real provider added in auth.ts
  callbacks: {
    // Used by middleware: matched routes (see middleware matcher) require a session.
    authorized({ auth }) {
      return !!auth?.user;
    },
    // Let the client's session.update({ name }) (after a profile rename) persist into
    // the JWT so the sidebar/Topbar reflect the new name without a re-login.
    jwt({ token, trigger, session }) {
      if (trigger === "update" && session && typeof (session as { name?: unknown }).name === "string") {
        token.name = (session as { name: string }).name;
      }
      return token;
    },
  },
};
