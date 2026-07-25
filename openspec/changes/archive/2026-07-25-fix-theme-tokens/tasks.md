## 1. Tokens

- [x] 1.1 Add `--ok-border`, `--warn-border`, `--bad-border`, `--info-bg`,
  `--muted-bg`, `--hover` to the dark `:root` block in `app/globals.css` with the
  values from the design table (dark column reproduces today's literals).
  **Test:** `app/theme-tokens.test.ts` — "declares every semantic token in both
  theme blocks".
- [x] 1.2 Add the same six tokens to `:root[data-theme="light"]` with the light
  column values. **Test:** same guard test.

## 2. Replace the frozen literals

- [x] 2.1 `components/review/ReviewStep.tsx`: lines 61 and 85 →
  `var(--warn-border)`, line 73 → `var(--bad-border)`. **Test:** guard test finds
  no literal in the file; `npx tsc --noEmit` clean.
- [x] 2.2 `components/templates/MiniSheet.tsx`: lines 25 and 32 →
  `var(--warn-border)`. **Test:** guard test + tsc.
- [x] 2.3 `components/wizard/DoneStep.tsx:75` → `var(--ok-border)`. **Test:**
  guard test + tsc.
- [x] 2.4 `components/primitives.tsx:144`: `info` → `var(--info-bg)`, `muted` →
  `var(--muted-bg)` in the `StatusDot` tone map. **Test:** guard test + tsc.
- [x] 2.5 `components/shell/Sidebar.tsx:78,89` and
  `components/shell/ModelSelect.tsx:46` hover handlers → `var(--hover)`.
  **Test:** guard test + tsc.

## 3. Regression guard

- [x] 3.1 Write `app/theme-tokens.test.ts` first against the un-migrated tree so it
  reports all ten literals (confirms the scan actually catches this defect class),
  then run it after the migration. **Test:** the file itself — red before task 2
  listing 11 literals across the 10 audited lines (`primitives.tsx:144` carries
  two), green after.
- [x] 3.2 In the same test, assert every new token is declared in both the dark and
  the light block of `globals.css` (parse the two `:root` blocks), so a token added
  to one theme only fails. **Test:** `app/theme-tokens.test.ts` — red before task 1,
  green after.
- [x] 3.3 Document the exemption list in the test file with the reason per entry
  (black shadows, modal scrims, `SettingsCog` SVG mask fills) so future additions
  are deliberate. **Test:** covered by 3.1 — the allowlisted literals do not trip
  the scan. `PreferencesCard` needed no entry: its swatches render
  `ACCENTS[].hex` through a variable.

## 4. Verification

- [x] 4.1 Full suite, typecheck, lint: `npx vitest run` → 76 files / 515 tests
  pass; `npx tsc --noEmit` exits 0; `npm run lint` reports 0 errors (2 pre-existing
  `<img>` warnings).
- [x] 4.2 Confirm dark theme is unchanged by construction: each replaced dark value
  equals the literal it replaced. Two deliberate exceptions, both from the audit:
  `ReviewStep.tsx:73` (`rgba(224,108,108,.35)` → `--bad-border` .35 of the real
  `--bad`) and `MiniSheet.tsx:25` (`.5` → the `.4` `--warn-border` tint).
  **Test:** diff reviewed against the design table.
- [x] 4.3 `npx openspec validate --strict fix-theme-tokens` → valid.
- [x] 4.4 Manual visual check in the light theme — performed 2026-07-25 against a
  local dev server: review screen warn/bad borders, template MiniSheet marker,
  DoneStep success ring, StatusDot info/muted pills, and sidebar + model-menu
  hover all inspected by eye in the light theme. No discrepancies found.
