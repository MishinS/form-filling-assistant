"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { STATUS, STR, type StatusKey } from "@/lib/seed/pt";

/* ---- Icons: simple stroke set ---- */
const ICONS: Record<string, string> = {
  search:   "M11 11 14.5 14.5 M12.5 7.5a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  plus:     "M8 3.5v9 M3.5 8h9",
  upload:   "M8 10.5V3 M5 6l3-3 3 3 M3.5 11.5v1A1.5 1.5 0 0 0 5 14h6a1.5 1.5 0 0 0 1.5-1.5v-1",
  download: "M8 3v7.5 M5 7.5 8 10.5 11 7.5 M3.5 12.5h9",
  file:     "M4 2.5h5l3 3v8a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5Z M9 2.5v3h3",
  check:    "M3.5 8.5 6.5 11.5 12.5 5",
  checkc:   "M5.5 8 7.3 9.8 10.8 6 M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z",
  arrowR:   "M3.5 8h9 M9 4.5 12.5 8 9 11.5",
  arrowL:   "M12.5 8h-9 M7 4.5 3.5 8 7 11.5",
  x:        "M4 4l8 8 M12 4l-8 8",
  edit:     "M10.5 3.5 12.5 5.5 5.5 12.5 3 13 3.5 10.5Z",
  trash:    "M3.5 4.5h9 M6 4.5V3.5h4v1 M5 4.5l.5 9h5l.5-9",
  layers:   "M8 2.5 14 5.5 8 8.5 2 5.5Z M2 8.5 8 11.5 14 8.5 M2 11 8 14 14 11",
  clock:    "M8 4.5V8l2.2 1.3 M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z",
  chevD:    "M4 6.5 8 10.5 12 6.5",
  chevR:    "M6.5 4 10.5 8 6.5 12",
  alert:    "M8 5.5v3.5 M8 11.2v.1 M8 2.2l6 11H2Z",
  eye:      "M1.8 8S4 4 8 4s6.2 4 6.2 4-2.2 4-6.2 4S1.8 8 1.8 8Z M8 9.6A1.6 1.6 0 1 0 8 6.4a1.6 1.6 0 0 0 0 3.2Z",
  globe:    "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z M2 8h12 M8 2c1.8 2 1.8 10 0 12 M8 2c-1.8 2-1.8 10 0 12",
  sparkle:  "M8 1.5 9.4 6 14 8 9.4 10 8 14.5 6.6 10 2 8 6.6 6Z",
  spin:     "M8 2.2v2.2 M8 11.6v2.2 M2.2 8h2.2 M11.6 8h2.2 M3.9 3.9l1.6 1.6 M10.5 10.5l1.6 1.6 M12.1 3.9l-1.6 1.6 M5.5 10.5l-1.6 1.6",
  link:     "M6.5 9.5 9.5 6.5 M7 4.5 8.5 3a2.1 2.1 0 0 1 3 3l-1.5 1.5 M9 11.5 7.5 13a2.1 2.1 0 0 1-3-3L6 8.5",
  grid:     "M2.5 2.5h4v4h-4Z M9.5 2.5h4v4h-4Z M2.5 9.5h4v4h-4Z M9.5 9.5h4v4h-4Z",
  doc:      "M4 2.5h8v11h-8Z M6 5.5h4 M6 8h4 M6 10.5h2.5",
  dot:      "M8 9.5A1.5 1.5 0 1 0 8 6.5a1.5 1.5 0 0 0 0 3Z",
  bolt:     "M9 1.5 3.5 9H7l-.8 5.5L12 6.5H8.2Z",
  sun:      "M8 10.5A2.5 2.5 0 1 0 8 5.5a2.5 2.5 0 0 0 0 5Z M8 1.8v1.7 M8 12.5v1.7 M1.8 8h1.7 M12.5 8h1.7 M3.6 3.6l1.2 1.2 M11.2 11.2l1.2 1.2 M12.4 3.6l-1.2 1.2 M4.8 11.2l-1.2 1.2",
  moon:     "M13 9.5A5.5 5.5 0 0 1 6.5 3 5.5 5.5 0 1 0 13 9.5Z",
};

type IconProps = { name: string; size?: number; stroke?: number; fill?: boolean; style?: CSSProperties; className?: string };
export function Icon({ name, size = 16, stroke = 1.6, fill = false, style, className }: IconProps) {
  const d = ICONS[name] || "";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}
         style={{ flex: "none", display: "block", ...style }}
         fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"}
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/* ---- Logo: animated four-point spark mark ----
 * Ported from the owner's design handoff (sparkle_logo_handoff). The main star
 * pulses + rotates and a secondary spark twinkles while an ancestor `.logo-host`
 * is hovered (trigger="host"). Keyframes/selectors live in app/globals.css
 * (.sparkle-logo) — same porting pattern as SettingsCog/NavIcons. */
type LogoProps = {
  size?: number;
  trigger?: "host" | "hover" | "always" | "none";
  style?: CSSProperties;
  className?: string;
  "aria-hidden"?: boolean;
};
export function Logo({ size = 22, trigger = "host", style, className = "", "aria-hidden": ariaHidden }: LogoProps) {
  return (
    <svg className={`sparkle-logo ${className}`.trim()} data-trigger={trigger}
         width={size} height={size} viewBox="0 0 24 24"
         role={ariaHidden ? undefined : "img"}
         aria-label={ariaHidden ? undefined : "Form-Filling Assistant"}
         aria-hidden={ariaHidden}
         style={{ flex: "none", display: "block", ...style }}>
      <path className="sl-star" d="M12 2.5 14.4 9.6 21.5 12 14.4 14.4 12 21.5 9.6 14.4 2.5 12 9.6 9.6Z" />
      <path className="sl-spark" style={{ strokeWidth: 1.7 }} d="M18.5 4 19.3 6.2 21.5 7 19.3 7.8 18.5 10 17.7 7.8 15.5 7 17.7 6.2Z" />
    </svg>
  );
}

/* ---- Button ---- */
type BtnProps = {
  children?: ReactNode; variant?: "primary" | "ghost" | "subtle" | "quiet";
  size?: "sm" | "md" | "lg"; icon?: string; iconRight?: string;
  onClick?: () => void; disabled?: boolean; full?: boolean; style?: CSSProperties;
  type?: "button" | "submit" | "reset";
};
export function Btn({ children, variant = "ghost", size = "md", icon, iconRight, onClick, disabled, full, style, type }: BtnProps) {
  const sizes = {
    sm: { h: 32, px: 12, fs: 13, gap: 6 },
    md: { h: 40, px: 16, fs: 14, gap: 8 },
    lg: { h: 48, px: 22, fs: 15, gap: 9 },
  }[size];
  const variants = {
    primary: { background: "var(--accent)", color: "var(--accent-text)", border: "1px solid var(--accent)" },
    ghost:   { background: "transparent", color: "var(--text)", border: "1px solid var(--line-2)" },
    subtle:  { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--line)" },
    quiet:   { background: "transparent", color: "var(--text-2)", border: "1px solid transparent" },
  }[variant];
  // Hover lift (echoes Card's translateY) + soft shadow signals the button is live;
  // press-scale composes on top. Pressed wins over hover.
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const transform = disabled ? "none" : pressed ? "scale(.975)" : hover ? "translateY(-1px)" : "none";
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: sizes.gap,
        height: sizes.h, padding: `0 ${sizes.px}px`, borderRadius: "var(--pill)",
        fontSize: sizes.fs, fontWeight: 600, letterSpacing: "-.01em", whiteSpace: "nowrap",
        width: full ? "100%" : "auto", opacity: disabled ? .45 : 1,
        cursor: disabled ? "not-allowed" : "pointer", transform,
        boxShadow: hover && !disabled ? "0 6px 16px -8px rgba(0,0,0,.45)" : "none",
        transition: "transform .12s var(--ease), box-shadow .15s, background .15s, border-color .15s, opacity .15s",
        ...variants, ...style,
      }}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}>
      {icon && <Icon name={icon} size={sizes.fs + 2} />}
      {children}
      {iconRight && <Icon name={iconRight} size={sizes.fs + 2} />}
    </button>
  );
}

/* ---- Pill / Tag / Badge ---- */
type TagProps = { children: ReactNode; tone?: "line" | "solid" | "mono"; style?: CSSProperties; title?: string };
export function Tag({ children, tone = "line", style, title }: TagProps) {
  const tones = {
    line:  { color: "var(--text-2)", background: "transparent", border: "1px solid var(--line-2)" },
    solid: { color: "var(--text)",  background: "var(--surface-3)", border: "1px solid var(--line)" },
    mono:  { color: "var(--text-2)", background: "var(--surface-1)", border: "1px solid var(--line)", fontFamily: "var(--font-mono)" },
  }[tone];
  return (
    <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 24, padding: "0 9px",
      borderRadius: "var(--pill)", fontSize: 11.5, fontWeight: 600, letterSpacing: ".01em", ...tones, ...style }}>
      {children}
    </span>
  );
}

export function StatusDot({ status }: { status: StatusKey }) {
  const { lang } = useI18n();
  const s = STATUS[status];
  const toneColor = { ok: "var(--ok)", warn: "var(--warn)", info: "var(--info)", bad: "var(--bad)", muted: "var(--text-3)" }[s.tone];
  const toneBg = { ok: "var(--ok-bg)", warn: "var(--warn-bg)", info: "rgba(142,167,196,.13)", bad: "var(--bad-bg)", muted: "rgba(255,255,255,.05)" }[s.tone];
  const spinning = status === "processing";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 25, padding: "0 10px 0 8px",
      borderRadius: "var(--pill)", background: toneBg, color: toneColor, fontSize: 12, fontWeight: 600 }}>
      {spinning
        ? <Icon name="spin" size={11} className="spin" stroke={1.8} />
        : <span style={{ width: 6, height: 6, borderRadius: 99, background: "currentColor",
            animation: s.tone === "warn" ? "pulse 1.6s ease-in-out infinite" : "none" }} />}
      {STR[s.key][lang]}
    </span>
  );
}

/* ---- Confidence meter ---- */
export function Confidence({ level, label }: { level: "high" | "med" | "low"; label?: string }) {
  const map = { high: { n: 3, c: "var(--ok)" }, med: { n: 2, c: "var(--warn)" }, low: { n: 1, c: "var(--bad)" } }[level];
  return (
    <span title={label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ display: "inline-flex", gap: 2.5, alignItems: "flex-end" }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 3.5, height: 6 + i * 3, borderRadius: 1,
            background: i < map.n ? map.c : "var(--line-2)" }} />
        ))}
      </span>
    </span>
  );
}

/* ---- File glyph (type-coloured, no brand) ---- */
export function FileGlyph({ type, size = 36 }: { type: string; size?: number }) {
  const ext = ({ pdf: "PDF", xlsx: "XLS", xls: "XLS", docx: "DOC", doc: "DOC" } as Record<string, string>)[type] || "FILE";
  const accent = ({ PDF: "var(--bad)", XLS: "var(--ok)", DOC: "var(--info)", FILE: "var(--text-3)" } as Record<string, string>)[ext];
  return (
    <span style={{ width: size, height: size, borderRadius: 9, flex: "none", position: "relative",
      background: "var(--surface-3)", border: "1px solid var(--line-2)",
      display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 5, overflow: "hidden" }}>
      <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent, opacity: .85 }} />
      <span className="mono" style={{ fontSize: 9, fontWeight: 600, color: accent, letterSpacing: ".04em" }}>{ext}</span>
    </span>
  );
}

/* ---- Card ---- */
type CardProps = { children: ReactNode; pad?: number; style?: CSSProperties; hover?: boolean; onClick?: () => void };
export function Card({ children, pad = 20, style, hover, onClick }: CardProps) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: "var(--surface-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)",
        padding: pad, transition: "border-color .15s, background .15s, transform .15s var(--ease)",
        cursor: onClick ? "pointer" : "default",
        borderColor: hover && h ? "var(--line-strong)" : "var(--line)",
        transform: hover && h ? "translateY(-2px)" : "none", ...style }}>
      {children}
    </div>
  );
}

/* ---- Section eyebrow ---- */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="row gap-8" style={{ color: "var(--text-3)", marginBottom: 14 }}>
      <Logo size={13} trigger="none" aria-hidden />
      <span className="mono" style={{ fontSize: 11.5, letterSpacing: ".08em", textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}
