"use client";
import { useId, type CSSProperties } from "react";

/*
 * Spoked settings gear that spins smoothly while hovered. Ported from the owner's
 * design handoff (form_filling_assistent/settings_cog_handoff): 64×64 canvas,
 * 12 teeth, 6 spokes; windows are cut through via an SVG mask, visible metal fills
 * with currentColor. Keyframes/selectors live in app/globals.css (.settings-cog).
 * spin="host" spins while an ancestor `.settings-cog-host` is hovered — use it
 * inside buttons so the whole button is the hover target.
 */
const C = 32;
const TEETH = 12;
const SPOKES = 6;

type Props = {
  size?: number;
  spin?: "hover" | "host" | "always" | "none";
  style?: CSSProperties;
  className?: string;
  "aria-hidden"?: boolean;
};

export default function SettingsCog({
  size = 20, spin = "hover", style, className = "", "aria-hidden": ariaHidden,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const teeth = [];
  for (let i = 0; i < TEETH; i++) {
    teeth.push(
      <rect key={i} x="28.6" y="2" width="6.8" height="9.2" rx="1.7"
            transform={`rotate(${(i * 360) / TEETH} ${C} ${C})`} />,
    );
  }
  const spokes = [];
  for (let i = 0; i < SPOKES / 2; i++) {
    spokes.push(
      <rect key={i} x="29.4" y="11" width="5.2" height="42" rx="2.6"
            transform={`rotate(${(i * 360) / SPOKES} ${C} ${C})`} />,
    );
  }
  return (
    <svg className={`settings-cog ${className}`} data-spin={spin}
         width={size} height={size} viewBox="0 0 64 64"
         role={ariaHidden ? undefined : "img"}
         aria-label={ariaHidden ? undefined : "Settings"}
         aria-hidden={ariaHidden}
         style={{ flex: "none", display: "block", ...style }}>
      <defs>
        <mask id={uid} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect x="0" y="0" width="64" height="64" fill="#000" />
          <g fill="#fff">{teeth}</g>
          <circle cx={C} cy={C} r="24" fill="#fff" />
          <circle cx={C} cy={C} r="17.6" fill="#000" />
          <g fill="#fff">{spokes}</g>
          <circle cx={C} cy={C} r="7" fill="#fff" />
          <circle cx={C} cy={C} r="3.6" fill="#000" />
          <circle cx={C} cy={C} r="1.5" fill="#fff" />
        </mask>
      </defs>
      <g className="cog-rotor">
        <rect x="0" y="0" width="64" height="64" fill="currentColor" mask={`url(#${uid})`} />
      </g>
    </svg>
  );
}
