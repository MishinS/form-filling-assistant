// lib/accent-persist.ts — pure network helper for accent persistence.
// No React/DOM; the provider owns the optimistic state, this owns the POST.
import type { AccentId } from "./accent-core";

/**
 * Persist the accent for the signed-in user. Resolves `true` only when the
 * server confirms the write (2xx); a non-ok response or any thrown/rejected
 * request resolves `false` so the caller can revert honestly.
 */
export async function persistAccent(accent: AccentId): Promise<boolean> {
  try {
    const res = await fetch("/api/account/accent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
