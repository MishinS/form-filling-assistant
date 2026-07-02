"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type AccentId, ACCENT_COOKIE, DEFAULT_ACCENT } from "./accent-core";

type Ctx = { accent: AccentId; setAccent: (a: AccentId) => void };
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

  const setAccent = (a: AccentId) => {
    setAccentState(a);
    applyAttr(a);
    writeCookie(a);
    // Durable, cross-device. Fire-and-forget: the cookie already persists the choice on
    // this device, so a failed POST needs no rollback or user-facing error.
    void fetch("/api/account/accent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent: a }),
    }).catch(() => { /* cookie persists locally; DB re-syncs on the next change */ });
  };

  return <AccentContext.Provider value={{ accent, setAccent }}>{children}</AccentContext.Provider>;
}

export function useAccent(): Ctx {
  const c = useContext(AccentContext);
  if (!c) throw new Error("useAccent must be used within AccentProvider");
  return c;
}
