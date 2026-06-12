"use client";
import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Logo, Btn, Icon } from "@/components/primitives";
import ModelSelect from "./ModelSelect";
import SettingsCog from "./SettingsCog";
import { signOut } from "next-auth/react";
import type { SessionUser } from "./AppShell";

type Props = { route: string; user: SessionUser; onNavigate: (id: string) => void; onNewFill: () => void };

export default function Sidebar({ route, user, onNavigate, onNewFill }: Props) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);
  const items = [
    { id: "fills", icon: "layers", k: "nav_fills" },
    { id: "templates", icon: "grid", k: "nav_templates" },
    { id: "sources", icon: "file", k: "nav_sources" },
    { id: "settings", icon: "", k: "nav_settings" },
  ];
  return (
    <div className="col" style={{ width: 244, flex: "none", borderRight: "1px solid var(--line)", background: "var(--surface-1)", padding: "20px 16px" }}>
      <div className="row gap-10" style={{ padding: "4px 8px 22px" }}>
        <Logo size={22} />
        <div className="col" style={{ lineHeight: 1.05 }}>
          <span className="display nowrap" style={{ fontSize: 14.5, fontWeight: 600 }}>Form-Filling</span>
          <span className="mono dim nowrap" style={{ fontSize: 9.5, letterSpacing: ".18em" }}>ASSISTANT</span>
        </div>
      </div>

      <Btn variant="primary" size="md" icon="plus" full onClick={onNewFill} style={{ marginBottom: 22 }}>{t("new_fill")}</Btn>

      <div className="col gap-2">
        {items.map(it => {
          const on = route === it.id;
          return (
            <button key={it.id} onClick={() => onNavigate(it.id)}
              className={`row gap-12${it.id === "settings" ? " settings-cog-host" : ""}`} style={{ padding: "10px 12px", borderRadius: "var(--r-md)", textAlign: "left",
                background: on ? "var(--surface-3)" : "transparent", color: on ? "var(--text)" : "var(--text-2)",
                fontWeight: on ? 600 : 500, fontSize: 13.5, transition: "all .12s" }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
              {it.id === "settings" ? <SettingsCog size={16} spin="host" aria-hidden /> : <Icon name={it.icon} size={16} />}{t(it.k)}
            </button>
          );
        })}
      </div>

      <div className="grow" />
      {/* LLM model picker */}
      <ModelSelect />

      {/* user menu */}
      <div ref={menuRef} style={{ position: "relative", marginTop: 16, padding: "14px 4px 0", borderTop: "1px solid var(--line)" }}>
        {menuOpen && (
          <div role="menu" className="fade-in" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 4, right: 4, zIndex: 30,
            background: "var(--surface-hi)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-md)",
            padding: 5, boxShadow: "0 18px 50px rgba(0,0,0,.55)" }}>
            <button role="menuitem" onClick={() => { setMenuOpen(false); onNavigate("settings"); }}
              className="row gap-10 settings-cog-host" style={{ width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: "var(--r-sm)", background: "transparent", transition: "background .12s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              <SettingsCog size={15} spin="host" className="muted" aria-hidden /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("nav_settings")}</span>
            </button>
            <button role="menuitem" onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
              className="row gap-10" style={{ width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: "var(--r-sm)", background: "transparent", transition: "background .12s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              <Icon name="arrowR" size={15} className="muted" /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("sign_out")}</span>
            </button>
          </div>
        )}

        <button onClick={() => setMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={menuOpen} title={user.name || user.email}
          className="row gap-10" style={{ width: "100%", textAlign: "left", background: "transparent", padding: 0, alignItems: "center" }}>
          <span style={{ width: 30, height: 30, borderRadius: 99, overflow: "hidden", background: "var(--surface-hi)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 600, flex: "none" }}>
            {user.image
              ? <img src={user.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (user.name || user.email || "?").trim().slice(0, 2).toUpperCase()}
          </span>
          <div className="col" style={{ lineHeight: 1.2, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name || "—"}</span>
            <span className="dim" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</span>
          </div>
          <Icon name="chevD" size={14} className="muted" style={{ flex: "none", transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform .18s var(--ease)" }} />
        </button>
      </div>
    </div>
  );
}
