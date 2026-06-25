import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { role?: "user" | "guest" } & DefaultSession["user"];
  }
  interface User {
    role?: "user" | "guest";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "user" | "guest";
  }
}
