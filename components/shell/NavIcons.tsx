"use client";
import type { CSSProperties, ReactNode } from "react";

/*
 * Three animated sidebar nav icons, ported from the owner's design handoff
 * (form_filling_assistent/fill_forms (1)/nav_icons_handoff — the approved
 * "variant B" set). Each is stroke-based, inherits currentColor, and loops a
 * micro-animation while triggered. Keyframes/selectors live in app/globals.css
 * (.nav-ic) — mirrors how SettingsCog moved its CSS out of the handoff's runtime
 * style injection. trigger="host" animates while an ancestor `.nav-icon-host`
 * is hovered — put that class on the nav row so the whole row is the hit target.
 *
 *   LayersIcon → Заполнения / Fills     — sheets cascade into a stack
 *   GridIcon   → Шаблоны / Templates    — cells breathe toward the center
 *   FileIcon   → Источники / Sources    — inner lines write left-to-right
 */
type Trigger = "host" | "hover" | "always" | "none";
type Props = {
  size?: number;
  trigger?: Trigger;
  style?: CSSProperties;
  className?: string;
  "aria-hidden"?: boolean;
};

function NavSvg({
  kind, label, children,
  size = 16, trigger = "host", style, className = "", "aria-hidden": ariaHidden,
}: Props & { kind: string; label: string; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16"
         className={`nav-ic ni-${kind} ${className}`.trim()} data-trigger={trigger}
         role={ariaHidden ? undefined : "img"}
         aria-label={ariaHidden ? undefined : label}
         aria-hidden={ariaHidden}
         style={{ flex: "none", display: "block", ...style }}>
      {children}
    </svg>
  );
}

export function LayersIcon(props: Props) {
  return (
    <NavSvg kind="layers" label="Fills" {...props}>
      <path className="ni-part l-top" d="M8 2.5 14 5.5 8 8.5 2 5.5Z" />
      <path className="ni-part l-mid" d="M2 8.5 8 11.5 14 8.5" />
      <path className="ni-part l-bot" d="M2 11 8 14 14 11" />
    </NavSvg>
  );
}

export function GridIcon(props: Props) {
  return (
    <NavSvg kind="grid" label="Templates" {...props}>
      <path className="ni-part g1" d="M2.5 2.5h4v4h-4Z" />
      <path className="ni-part g2" d="M9.5 2.5h4v4h-4Z" />
      <path className="ni-part g3" d="M2.5 9.5h4v4h-4Z" />
      <path className="ni-part g4" d="M9.5 9.5h4v4h-4Z" />
    </NavSvg>
  );
}

export function FileIcon(props: Props) {
  return (
    <NavSvg kind="file" label="Sources" {...props}>
      <path d="M4 2.5h8v11h-8Z" />
      <path className="ni-line t1" pathLength={100} d="M6 5.5h4" />
      <path className="ni-line t2" pathLength={100} d="M6 8h4" />
      <path className="ni-line t3" pathLength={100} d="M6 10.5h2.5" />
    </NavSvg>
  );
}
