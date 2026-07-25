## Context

`app/globals.css` defines a full dual-theme semantic palette: `:root` carries the
dark values and `:root[data-theme="light"]` overrides them, with the accent as a
separate axis (`:root[data-accent="…"]`). Components style themselves with inline
`style={{ … }}` objects referencing `var(--token)`. That discipline holds for
text, surfaces, lines, and the accent — 15 `var(--accent)` uses across 10 files —
but the palette stops short of three things components actually needed: tinted
status *borders*, status-pill *fills* for `info`/`muted`, and neutral *hover*
feedback. Where a token was missing, the author inlined the dark-theme value.

The audit found exactly ten such literals, in six files:

| Literal | Sites | Meaning |
|---|---|---|
| `rgba(215,177,105,.4)` / `.5` | `ReviewStep.tsx:61,85`, `MiniSheet.tsx:25,32` | dark `--warn` tint |
| `rgba(224,108,108,.35)` | `ReviewStep.tsx:73` | a red matching neither theme |
| `rgba(127,179,140,.3)` | `DoneStep.tsx:75` | dark `--ok` tint |
| `rgba(142,167,196,.13)` | `primitives.tsx:144` | dark `--info` fill |
| `rgba(255,255,255,.05)` | `primitives.tsx:144` | muted pill fill |
| `rgba(255,255,255,.04)` | `Sidebar.tsx:78,89`, `ModelSelect.tsx:46` | menu hover |

## Goals / Non-Goals

**Goals:**
- Every one of those sites reads a token; both theme blocks define it.
- Dark theme is pixel-identical afterwards, except the one off-token red.
- The next frozen literal fails a test instead of surviving to the next audit.

**Non-Goals:**
- Re-tuning the existing palette or the accent presets.
- Replacing inline styles with a class system.

## Decisions

### Six tokens, named after their role, not their color

`--ok-border` / `--warn-border` / `--bad-border` / `--info-bg` / `--muted-bg` /
`--hover`, appended to both theme blocks. Role names keep the token list
readable next to the existing `--ok-bg` / `--warn-bg` / `--bad-bg` trio: `*-bg`
is the .12–.13 fill, `*-border` is the stronger tint used for a 1px edge.

Values, each derived from the base color already in its own block:

| Token | Dark (from) | Light (from) |
|---|---|---|
| `--ok-border` | `rgba(127,179,140,.3)` (`--ok` #7fb38c) | `rgba(47,125,67,.28)` (`--ok` #2f7d43) |
| `--warn-border` | `rgba(215,177,105,.4)` (`--warn` #d7b169) | `rgba(138,99,16,.32)` (`--warn` #8a6310) |
| `--bad-border` | `rgba(207,138,120,.35)` (`--bad` #cf8a78) | `rgba(176,69,45,.3)` (`--bad` #b0452d) |
| `--info-bg` | `rgba(142,167,196,.13)` (`--info` #8ea7c4) | `rgba(58,110,165,.12)` (`--info` #3a6ea5) |
| `--muted-bg` | `rgba(255,255,255,.05)` | `rgba(16,24,22,.05)` |
| `--hover` | `rgba(255,255,255,.04)` | `rgba(16,24,22,.05)` |

The dark column reproduces the current literals verbatim, so dark-theme rendering
is unchanged by construction. The light neutrals reuse `16,24,22` — the base the
light block already uses for `--line`/`--line-2` — so hover and muted pills sit in
the same neutral family as the rest of the light theme.

The single deliberate visual change in dark theme is `ReviewStep.tsx:73`, whose
`rgba(224,108,108,.35)` was a third red belonging to no theme; it becomes
`--bad-border` derived from the real `--bad`.

*Alternative considered:* `color-mix(in srgb, var(--bad) 35%, transparent)` at the
use site, which would need no new tokens. Rejected — it spreads the alpha choices
back across components (the thing being fixed), and the codebase targets a Tauri
webview where keeping to plain custom properties avoids a support question for
zero benefit.

### `MiniSheet.tsx:25` uses `--warn-border` even though it is a fill

That 7px bar is a selection marker, not a surface: `--warn-bg` (.13) is too faint
to read as selected, and the literal it replaces was `.5` — closer to the border
tint than the fill. It takes `--warn-border`. The alternative (a seventh token for
one call site) is not worth its name.

### The guard is a source scan, not a visual test

There is no rendering-test infrastructure here by convention, and a screenshot
test would not catch the actual defect class (a literal that *looks* fine in the
theme the author is using). `app/theme-tokens.test.ts` walks `components/**/*.tsx`
and `app/**/*.tsx` and fails on any `rgba(`/`hsl(`/hex color literal in a source
line, minus an explicit allowlist:

- `rgba(0,0,0,…)` — black shadows,
- `rgba(6,9,8,…)` — modal scrims,
- `components/shell/SettingsCog.tsx` — `#000`/`#fff` SVG mask fills.

`PreferencesCard`'s accent swatches need no exemption: they render `ACCENTS[].hex`
from `lib/accent-core.ts` through a variable, so no literal appears in the
component. `*.test.*` files are skipped — they never render.

The failure message names the file, line, and the token to use instead, so the
guard teaches rather than merely blocks. Adding a genuinely theme-independent
color later means adding a line to the allowlist — a visible decision in review,
which is what the spec requires.

## Risks / Trade-offs

- **The scan is regex-based and could false-positive** on a non-color string that
  looks like a literal (an `#RRGGBB` inside a data URL or copy) → the allowlist is
  per-file-and-pattern and the test names exactly what tripped it; a legitimate case
  is one line to add, and a false negative (missing a literal) is the failure mode
  the change is meant to prevent, so the bias is set toward strictness.
- **Light-theme alphas are judgment calls**, not derived by a formula → they were
  chosen so the light tint carries the same visual weight as the dark one against
  its own surface; all six are single-line changes if they read too strong in use.
- **Two tokens (`--muted-bg`, `--hover`) share the same light value** → intentional;
  they differ in dark, and keeping them separate preserves the distinct roles.
