import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchAll, type SearchResults } from "@/lib/db/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // session- and query-dependent

const EMPTY: SearchResults = { fills: [], sources: [] };

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.email;
  if (!userId) return NextResponse.json(EMPTY, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json(EMPTY); // skip the DB on 0–1 chars

  try {
    return NextResponse.json(await searchAll(userId, q));
  } catch {
    return NextResponse.json(EMPTY); // DB unreachable → empty, never 500
  }
}
