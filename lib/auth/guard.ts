import { NextResponse } from "next/server";

/** Uniform 401 for API routes called without a session. */
export function unauthorized() {
  return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
}
