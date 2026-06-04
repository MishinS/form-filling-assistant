// Edge-safe NextAuth config: NO node-only imports (no bcryptjs, no Credentials authorize).
// middleware.ts builds its NextAuth instance from this alone, so bcrypt never hits the Edge bundle.
// The real Credentials provider is added in auth.ts (Node).
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // real provider added in auth.ts
  callbacks: {
    // Used by middleware: matched routes (see middleware matcher) require a session.
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
