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
    // Persist client session.update({ name }) / ({ image }) into the JWT so the
    // sidebar/ProfileCard reflect a rename or avatar change without a re-login.
    jwt({ token, trigger, session }) {
      if (trigger === "update" && session) {
        const s = session as { name?: unknown; image?: unknown };
        if (typeof s.name === "string") token.name = s.name;
        if ("image" in s) token.picture = (s.image as string | null) ?? null;
      }
      return token;
    },
  },
};
