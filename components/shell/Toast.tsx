"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ToastCtx = { show: (msg: string) => void };
const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(m);
    timer.current = setTimeout(() => setMsg(null), 3500);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {msg && (
        <div role="status" className="fade-in" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, background: "var(--surface-2)", border: "1px solid var(--line)", borderLeft: "3px solid var(--ok)",
          borderRadius: "var(--r-md)", padding: "12px 18px", fontSize: 13, fontWeight: 600, maxWidth: "min(560px, 92vw)",
          boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>{msg}</div>
      )}
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
