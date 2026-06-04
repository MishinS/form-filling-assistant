import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { parseUsers, verifyCredentials } from "@/lib/auth/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = typeof creds?.email === "string" ? creds.email : "";
        const password = typeof creds?.password === "string" ? creds.password : "";
        const user = await verifyCredentials(email, password, parseUsers(process.env.AUTH_USERS));
        // NextAuth wants an `id`; use the email. Returning null → CredentialsSignin error.
        return user ? { id: user.email, email: user.email, name: user.name } : null;
      },
    }),
  ],
});
