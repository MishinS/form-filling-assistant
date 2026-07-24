"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type AccentId, ACCENT_COOKIE, DEFAULT_ACCENT } from "./accent-core";
import { persistAccent } from "./accent-persist";

type Ctx = { accent: AccentId; setAccent: (a: AccentId) => Promise<boolean> };
const AccentContext = createContext<Ctx | null>(null);

function writeCookie(a: AccentId) {
  document.cookie = `${ACCENT_COOKIE}=${a};path=/;max-age=31536000;samesite=lax`;
}
function applyAttr(a: AccentId) {
  const d = document.documentElement;
  if (a === DEFAULT_ACCENT) delete d.dataset.accent; // base :root value
  else d.dataset.accent = a;
}

export function AccentProvider({ children, initialAccent }: { children: ReactNode; initialAccent: AccentId }) {
  const [accent, setAccentState] = useState<AccentId>(initialAccent);

  // Reconcile DOM + cookie to the server-supplied value on mount — covers a new device
  // whose accent cookie was absent (pre-paint left the base blue there).
  useEffect(() => { applyAttr(initialAccent); writeCookie(initialAccent); }, [initialAccent]);

  // Apply optimistically, then persist. On failure revert state + DOM + cookie to
  // the previously persisted value so the local cookie never diverges from the DB
  // (which the mount effect reconciles to). Resolves true iff the DB write stuck.
  const setAccent = async (a: AccentId): Promise<boolean> => {
    const prev = accent;
    if (a === prev) return true;
    setAccentState(a);
    applyAttr(a);
    writeCookie(a);
    const ok = await persistAccent(a);
    if (!ok) {
      setAccentState(prev);
      applyAttr(prev);
      writeCookie(prev);
    }
    return ok;
  };

  return <AccentContext.Provider value={{ accent, setAccent }}>{children}</AccentContext.Provider>;
}

export function useAccent(): Ctx {
  const c = useContext(AccentContext);
  if (!c) throw new Error("useAccent must be used within AccentProvider");
  return c;
}
