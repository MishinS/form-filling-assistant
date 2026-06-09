"use client";
import { useI18n } from "@/lib/i18n";
import { Logo, Btn, Icon } from "@/components/primitives";
import ModelSelect from "./ModelSelect";
import { signOut } from "next-auth/react";
import type { SessionUser } from "./AppShell";

type Props = { route: string; user: SessionUser; onNavigate: (id: string) => void; onNewFill: () => void };

export default function Sidebar({ route, user, onNavigate, onNewFill }: Props) {
  const { t } = useI18n();
  const items = [
    { id: "fills", icon: "layers", k: "nav_fills" },
    { id: "templates", icon: "grid", k: "nav_templates" },
    { id: "sources", icon: "file", k: "nav_sources" },
    { id: "settings", icon: "gear", k: "nav_settings" },
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
              className="row gap-12" style={{ padding: "10px 12px", borderRadius: "var(--r-md)", textAlign: "left",
                background: on ? "var(--surface-3)" : "transparent", color: on ? "var(--text)" : "var(--text-2)",
                fontWeight: on ? 600 : 500, fontSize: 13.5, transition: "all .12s" }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
              <Icon name={it.icon} size={16} />{t(it.k)}
            </button>
          );
        })}
      </div>

      <div className="grow" />
      {/* LLM model picker */}
      <ModelSelect />

      <div className="row gap-10" style={{ marginTop: 16, padding: "14px 4px 0", borderTop: "1px solid var(--line)", alignItems: "center" }}>
        <button onClick={() => onNavigate("settings")} title={t("nav_settings")}
          className="row gap-10" style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", padding: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: 99, background: "var(--surface-hi)", border: "1px solid var(--line-2)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 600, flex: "none" }}>
            {(user.name || user.email || "?").trim().slice(0, 2).toUpperCase()}
          </span>
          <div className="col" style={{ lineHeight: 1.2, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name || "—"}</span>
            <span className="dim" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</span>
          </div>
        </button>
        <button onClick={() => signOut({ callbackUrl: "/login" })} title={t("sign_out")} aria-label={t("sign_out")}
          className="dim" style={{ width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", flex: "none" }}>
          <Icon name="arrowR" size={15} />
        </button>
      </div>
    </div>
  );
}
