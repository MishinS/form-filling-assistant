## 1. API: null body → 400 (WR-02)

- [x] 1.1 Add a failing route test: `POST` with body `"null"` (valid JSON null)
  from a full user expects `400` and `setAccent` not called. **Test:**
  `app/api/account/accent/route.test.ts` (red).
- [x] 1.2 Add a route test for the DB-throw path: `setAccent` rejects → `500`.
  **Test:** `app/api/account/accent/route.test.ts` (red — path currently
  reachable but uncovered).
- [x] 1.3 Fix `app/api/account/accent/route.ts` to coalesce a `null`/absent body
  to `{}` (`((await req.json()) as … | null) ?? {}`) so invalid input 400s.
  **Test:** `app/api/account/accent/route.test.ts` (all green, incl. existing
  guest/401/valid cases).

## 2. Client: honest failure + revert (WR-01)

- [x] 2.1 Write failing tests for a new pure helper `lib/accent-persist.ts`:
  `persistAccent(a)` returns `true` on `res.ok`, `false` on non-ok, `false` when
  `fetch` rejects (stub `global.fetch`). **Test:** `lib/accent-persist.test.ts`
  (red).
- [x] 2.2 Implement `lib/accent-persist.ts` (`persistAccent(a: AccentId): Promise<boolean>`
  — POST `/api/account/accent`, return `res.ok`, map any throw to `false`).
  **Test:** `lib/accent-persist.test.ts` (green).
- [x] 2.3 Rewire `lib/accent.tsx` `setAccent` to capture the previous accent,
  apply optimistically, `await persistAccent`, and on `false` revert state + DOM
  attr + cookie to the previous accent; widen the contract to
  `(a) => Promise<boolean>`. **Test:** manual — pick an accent with the network
  forced to fail (DevTools offline) → swatch and page revert; `npx tsc --noEmit`.
- [x] 2.4 Add `accent_save_err` RU + EN strings to `lib/seed/pt.ts`. **Test:**
  manual — key resolves in both locales (no raw key shown).
- [x] 2.5 Update `components/settings/PreferencesCard.tsx` to `await setAccent`
  and `show(t("accent_save_err"))` on `false`. **Test:** manual — forced-fail
  save shows the toast and the swatch returns to the prior accent.

## 3. Verification

- [x] 3.1 Run the affected suites green: `npx vitest run app/api/account/accent lib/accent-persist`.
  **Test:** all pass.
- [x] 3.2 Typecheck + lint clean: `npx tsc --noEmit` and `npm run lint`.
  **Test:** both exit 0.
