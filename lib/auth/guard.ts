import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Uniform 401 for API routes called without a session. */
export function unauthorized() {
  return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
}

/**
 * Returns a 401 Response when there's no authenticated user, else null.
 * Checks `session.user` explicitly — NOT bare truthiness — because in production
 * a misconfigured host makes auth() resolve to a truthy error object, which a
 * `!(await auth())` check would wave straight through. Call at the top of every
 * protected route: `const denied = await requireUser(); if (denied) return denied;`
 */
export async function requireUser(): Promise<Response | null> {
  const session = await auth();
  return session?.user ? null : unauthorized();
}
