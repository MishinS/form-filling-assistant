## Context

740 tests, 33 s wall (≈3 s in tests, the rest import/transform). Baseline coverage
over `lib/**`, `app/api/**`, `components/**/*-core.ts`: lines 85.6 %, branches
81.1 %. Largest files: `lib/templates/validate.test.ts` (38), `lib/render/html.test.ts`
(31), `app/api/mappings/route.test.ts` (29), `lib/fill/xlsx.test.ts` (26),
`app/api/fill/route.test.ts` (26).

## Decisions

### D1. Keep rule: risk × uniqueness

A test stays only if (a) a regression it catches would be a security hole, wrong
money/document output, lost data, or a broken core pipeline step, **and** (b) no
kept test already catches the same regression. Sources: risk-based testing;
"test behaviour, not implementation" and "change-detector tests considered
harmful" (Google Testing Blog); Testing Trophy — prefer the boundary a user or
caller actually hits (route, module API) over internal helpers.

### D2. What goes

- Change detectors: exact model catalog, prompt wording and the PT prompt baseline
  string, field counts/strategy splits, house colours, i18n key enumeration beyond
  the keys composed at runtime.
- Pure view/formatting helpers: accent, contrast, theme, plural, byte/locator
  formatting, ETA, picker-row mappers, file-name sanitising, review groups.
- Layer duplicates: variants of the same validation (SSRF host variants stay in
  `blob-url.test.ts`, the route keeps one), "401" plus "403 guest" on the same
  guard (one auth test per route, guest where the route has a guest rule).

### D3. Mechanics

A throwaway Node script over the TypeScript compiler API removes every `it`/`test`
call whose full name (describe path + title) matches no entry of a per-file keep
list, then removes describes left empty and deletes files with nothing left. The
script and keep list live in the change's scratch space, not in the repo.
Unused imports left behind are removed by hand, guided by
`tsc --noUnusedLocals`.

### D4. Verification

Full suite green, `tsc` clean, coverage re-measured with the same include set and
compared to the baseline per file; any critical module whose line coverage drops
sharply gets a representative test back.

Outcome: 740 → 266 tests, 90 → 74 files, 6.3k → ~3.2k lines. Coverage lines
85.6 → 74.7 %, branches 81.1 → 63.5 %. The per-file diff put most of the drop in
view helpers, formatting, UI logic cores and GET/error paths of low-risk routes.
It also surfaced real gaps, restored: auth on the `DELETE` handlers of avatar,
mappings and `templates/[id]`; the guest PT fill and the custom-template fill;
the paid-primary fallback that must not re-race the paid model.

## Risks / Trade-offs

- [A removed test was the only guard of a real behaviour] → coverage diff per file
  before/after; modules with a large drop are reviewed by hand.
- [Criteria drift back] → `TESTING.md` states the rule; reviews apply it.
