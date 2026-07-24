## Why

Two audit findings (2026-07-23) make accent personalization lie about whether a
choice was saved. A failed `POST /api/account/accent` is treated as success, so
the user's pick silently reverts on the next page load (WR-01); and a malformed
request body crashes the route with a 500 instead of a clean 400 (WR-02). Both
undermine a settings surface that otherwise implies "saved" semantics.

## What Changes

- **Accent save is honest about failure (`lib/accent.tsx`, `PreferencesCard`).**
  `setAccent` currently fires the POST and never inspects `res.ok`, so any
  non-2xx (or a network error) is swallowed. The DB stays on the old value while
  the local cookie holds the new one; on the next load the mount reconciliation
  seeds the UI from the DB and silently overwrites the user's choice. The client
  will check `res.ok`, **revert** the optimistic accent (state + DOM + cookie) to
  the previously persisted value on failure, and surface a localized error toast
  at the call site (which sits inside `ToastProvider`). This keeps the cookie and
  the DB from diverging, so the existing mount reconciliation is no longer
  destructive.
- **Accent API returns 400, not 500, on a bad body (`app/api/account/accent`).**
  `req.json()` accepts the literal `null` as valid JSON, so the `catch` never
  fires and `body` is `null` despite the `Record<string, unknown>` cast;
  dereferencing `body.accent` then throws a `TypeError` → framework 500. The
  route will coalesce a `null`/absent body to `{}` so an invalid/missing accent
  is a deterministic 400 (and stops polluting error monitoring with 500s).
- **Tests close the audited gaps (IN-09).** Route: body `"null"` → 400, and the
  `setAccent` DB-throw path → 500. Client: a pure `persistAccent` helper (fetch →
  boolean, network reject → false) is extracted and unit-tested.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `accounts`: strengthen the **Theme, accent, and language personalization**
  requirement so accent persistence is transactional from the user's point of
  view — a non-persisted change must not survive as if saved, and malformed
  input yields 400 rather than 500.

## Impact

- Code: `lib/accent.tsx` (res.ok check + revert + `Promise<boolean>` contract),
  a new pure `lib/accent-persist.ts` (fetch helper), `components/settings/PreferencesCard.tsx`
  (await + error toast), `app/api/account/accent/route.ts` (null-body → 400),
  one new i18n key `accent_save_err` in `lib/seed/pt.ts`.
- Tests: `app/api/account/accent/route.test.ts` (+2 cases), new
  `lib/accent-persist.test.ts`.
- No schema, dependency, or API-shape changes. `setAccent`'s return type widens
  from `void` to `Promise<boolean>`; the only caller is `PreferencesCard`.

## Non-goals

- No change to the source-of-truth model (DB remains authoritative for
  cross-device seeding; the mount reconciliation in `accent.tsx` is left intact
  because the revert removes the divergence that made it destructive).
- No retry/queue/offline-sync for failed saves — failure reverts and informs,
  it does not attempt background reconciliation.
- No new error-styled toast variant; the existing toast component is reused.
- No changes to theme or language persistence (only accent is affected).
