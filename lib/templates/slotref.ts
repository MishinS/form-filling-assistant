// Validates a field address for an HTML template: the name of a slot the
// template's skeleton declares. Deliberately narrow — an address is a key into a
// fixed list, never a path, a selector, or anything that could carry markup.

export type SlotRefResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: "empty" | "format" | "unknown" };

const SLOT_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function validateSlotRef(input: string, allowedSlots: string[]): SlotRefResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };
  if (!SLOT_RE.test(raw)) return { ok: false, reason: "format" };
  if (!allowedSlots.includes(raw)) return { ok: false, reason: "unknown" };
  return { ok: true, normalized: raw };
}

/** Slot names a skeleton declares, in the order they appear. */
export function slotsOf(skeleton: string): string[] {
  return Array.from(skeleton.matchAll(/<!--slot:([A-Za-z0-9_-]+)-->/g), (m) => m[1]);
}
