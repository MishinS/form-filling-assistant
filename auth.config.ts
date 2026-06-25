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
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, trigger, session, user }) {
      if (user) token.role = (user as { role?: "user" | "guest" }).role ?? "user";
      if (trigger === "update" && session) {
        const s = session as { name?: unknown; image?: unknown };
        if (typeof s.name === "string") token.name = s.name;
        if ("image" in s) token.picture = (s.image as string | null) ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.role = (token.role as "user" | "guest") ?? "user";
      return session;
    },
  },
};
