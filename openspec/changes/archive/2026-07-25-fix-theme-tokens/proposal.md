## Why

The 2026-07-23 UI audit scored Color 2/4: the token architecture in
`app/globals.css` is complete and dual-theme, but ten dark-theme color literals
are frozen into component styles, so the light theme is not actually a theme
there. `rgba(215,177,105,…)` (dark `--warn`) renders the wrong hue against light
`--warn` #8a6310; `rgba(224,108,108,.35)` is a third red matching neither theme's
`--bad`; and the menu hover `rgba(255,255,255,.04)` is white-on-white — light-theme
users get no hover feedback at all. Every one of these has a token-shaped fix; what
is missing is the tokens themselves.

## What Changes

- **Six semantic tokens are added to both theme blocks** in `app/globals.css`:
  `--ok-border`, `--warn-border`, `--bad-border` (tinted borders for status
  surfaces), `--info-bg`, `--muted-bg` (status-pill fills), and `--hover`
  (neutral hover feedback). Each is derived from that theme's own base color.
- **All ten frozen literals are replaced** with the new tokens:
  `components/review/ReviewStep.tsx` (3), `components/templates/MiniSheet.tsx` (2),
  `components/shell/Sidebar.tsx` (2), `components/shell/ModelSelect.tsx` (1),
  `components/primitives.tsx` (2 in the `StatusDot` tone map),
  `components/wizard/DoneStep.tsx` (1).
- **The off-token red is corrected**: `ReviewStep.tsx:73` picks up `--bad-border`
  derived from the actual `--bad` of each theme instead of its own third red.
- **A regression guard is added**: a Vitest source scan fails when a component
  introduces a color literal outside the documented allowlist (scrims and black
  shadows), so the next frozen literal is caught at test time rather than in a
  later audit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `accounts`: the theme/accent/language personalization capability gains a
  requirement that themed color values resolve through tokens defined in every
  theme block — a theme switch must actually change every semantic color, and
  components must not freeze one theme's values into their styles.

## Non-goals

- No change to the palette itself: existing token values, the accent presets, and
  the contrast guard are untouched; the new tokens are derived from colors already
  in each theme block.
- Not touching the deliberately theme-independent literals: modal scrims
  (`rgba(6,9,8,.72)`), black shadows, the light-only `::selection` rule, and
  `SettingsCog`'s internal mask fills.
- No move to Tailwind theme config or CSS-in-JS; inline `style` with `var(--…)` stays
  the established pattern.
- Not addressing the other UI-audit pillars (typography scale, spacing rhythm,
  modal focus management) — separate work.

## Impact

- **Code:** `app/globals.css` (+12 declarations), six component files
  (literal → `var(--…)`), new `app/theme-tokens.test.ts`.
- **Visual:** dark theme is unchanged by construction (new token values equal the
  literals they replace, except the corrected `--bad-border`); light theme gains
  correct status-border hues, a visible menu hover, and a non-white muted pill.
- **APIs / deps / data:** none.
