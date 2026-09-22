## Why

The suite has grown to 740 Vitest tests in 90 files (6.3k lines) — roughly one
test per 20 lines of production code. Most were written test-first per change and
never pruned, so the same behaviour is asserted at two or three layers (a validator
unit test, the route that calls it, the change's own scenario), catalog/prompt/copy
details are pinned as change detectors, and pure view helpers carry as many tests
as security boundaries. A red run no longer says "something important broke", and
every refactor pays for tests that guard nothing that matters.

## What Changes

- Keep only tests that guard a **critical risk**: a security boundary (auth/guest
  gates, SSRF and blob-origin checks, secret storage, HTML escaping, the navi
  subset, markup never arriving from a request), **money and document
  correctness** (amounts, payment schedule, cells written into the workbook,
  dates), **data loss** (ZIP de-duplication, batch failures surfaced), and the
  **core pipeline contract** (rules+LLM merge, model race and paid fallback, JSON
  recovery, parse → extract → fill → render).
- Remove change detectors (exact catalog contents, prompt wording, copy/i18n
  enumeration), tests of pure view/formatting helpers, and cases already covered at
  another layer — keeping one representative per behaviour and one auth test per
  route.
- Target: about a third of the current count. Coverage of `lib/`, `app/api/` and
  `*-core.ts` is expected to fall — the removed tests covered view helpers and
  duplicate layers — but no critical module may lose its only guard.
- Record the criteria so new changes add tests by the same rule.

## Non-goals

- No production code changes.
- No new test tooling in `package.json` (coverage is measured ad hoc for this change).
- No E2E/browser test layer.

## Capabilities

### New Capabilities

(none — test-suite hygiene, no behaviour change; `skip_specs: true`)

### Modified Capabilities

(none)

## Impact

Test files only (`*.test.ts`), plus a short testing-criteria note in the repo so
future changes follow it.
