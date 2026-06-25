import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { parseUsers, verifyCredentials } from "@/lib/auth/users";
import { getUserByEmail } from "@/lib/db/users";
import { getAvatar } from "@/lib/db/avatars";
import { guestUser } from "@/lib/auth/guest";

// Look up the user's avatar; a DB failure must never block login.
async function avatarFor(email: string): Promise<string | null> {
  try { return await getAvatar(email); } catch { return null; }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = typeof creds?.email === "string" ? creds.email : "";
        const password = typeof creds?.password === "string" ? creds.password : "";

        // 1) env users (the owner fallback — works even if the DB is unreachable)
        const envUser = await verifyCredentials(email, password, parseUsers(process.env.AUTH_USERS));
        if (envUser) return { id: envUser.email, email: envUser.email, name: envUser.name, image: await avatarFor(envUser.email) };

        // 2) DB users (registered via /register). DB errors → null (login fails, never crashes).
        if (email && password) {
          try {
            const dbUser = await getUserByEmail(email);
            if (dbUser && (await bcrypt.compare(password, dbUser.passwordHash))) {
              return { id: dbUser.email, email: dbUser.email, name: dbUser.name, image: await avatarFor(dbUser.email) };
            }
          } catch {
            return null;
          }
        }
        return null;
      },
    }),
    Credentials({
      id: "guest",
      name: "Guest",
      credentials: {},
      authorize: async () => guestUser(),
    }),
  ],
});
