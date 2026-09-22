# Testing

A test earns its place when a regression it catches would be **costly** and **no
other test already catches it**. Everything else is maintenance with no payoff.

## Write a test for

- **Security boundaries** — every route handler (each method) has one auth test:
  401 without a session, or 403 for a guest where the route has a guest rule.
  SSRF / blob-origin checks, secret storage, HTML escaping, the navi editor subset,
  markup or catalogs never taken from a request body.
- **Money and document correctness** — amounts, the payment schedule, cells written
  into the workbook, dates, the rendered passport.
- **Data loss** — ZIP de-duplication, batch failures surfaced, values persisted.
- **The pipeline contract** — parse → rules+LLM merge → review → fill/render; the
  model race, the paid fallback and `freeOnly` (they spend money); JSON recovery.
- **A bug you just fixed** — one test that reproduces it.

## Do not write a test for

- **Change detectors** — exact model catalog, prompt wording, field counts, house
  colours, lists of i18n keys (only keys composed at runtime, like `ed_err_${code}`).
- **Pure view and formatting helpers** — labels, plural forms, byte formatting,
  theme and accent plumbing, picker-row mappers.
- **A second copy of the same check at another layer** — host variants live in
  `lib/upload/blob-url.test.ts`, the route keeps one "rejects before fetching".
- **Several near-identical inputs** — keep the boundary case, not the whole table.

## Where

Test at the boundary a caller hits — the route or the module's public function —
not the helper behind it. Co-located `*.test.ts`, Vitest, no React rendering tests
(logic lives in `*-core.ts`).
