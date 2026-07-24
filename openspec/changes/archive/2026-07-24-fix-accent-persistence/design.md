## Context

Accent personalization has two persistence layers: a device-local cookie (read
by the pre-paint inline script in `app/layout.tsx` to avoid a flash) and a
durable per-user row in `user_accents` (read at SSR in `app/(app)/layout.tsx`
via `getAccent`, passed to `AccentProvider` as `initialAccent`). The DB value is
the cross-device source of truth; the cookie is a fast local mirror.

Two audit findings (2026-07-23):

- **WR-01 (`lib/accent.tsx`)** — `setAccent` optimistically writes state + DOM +
  cookie, then fires `POST /api/account/accent` fire-and-forget. It never checks
  `res.ok`, so any non-2xx is treated as success, and only a network rejection
  hits `.catch`. When the POST does not persist, the cookie holds the new accent
  while the DB holds the old one. On the next load, SSR seeds `initialAccent`
  from the DB and the mount effect (`accent.tsx:22`) reconciles DOM + cookie to
  it — silently overwriting the user's choice. The settings surface implies
  "saved" semantics, so the loss is invisible.
- **WR-02 (`app/api/account/accent/route.ts:15-17`)** — `req.json()` parses the
  body `null` successfully, so `catch` does not fire; `body` is `null` despite
  the `Record<string, unknown>` cast, and `body.accent` throws → framework 500.

Constraint that shapes the fix: `ToastProvider` is mounted **inside**
`AccentProvider` (`app/(app)/layout.tsx:70,72`), so `AccentProvider.setAccent`
cannot call `useToast`. The natural place for the toast is the call site,
`PreferencesCard`, which sits inside `ToastProvider` and already uses `useI18n`.

## Goals / Non-Goals

**Goals:**
- A non-persisted accent change never survives as if saved; the UI reflects only
  the actually-persisted value and tells the user when a save fails.
- The accent API returns a deterministic 400 for malformed/missing bodies and
  stops emitting 500s for them.
- Cover the exact previously-broken paths with automated tests.

**Non-Goals:**
- No change to the DB-as-source-of-truth model or to the mount reconciliation
  (it becomes correct once the client can no longer let cookie and DB diverge).
- No retry/queue/offline sync — failure reverts and informs.
- No new error-variant toast; reuse the existing component.
- Theme and language persistence are untouched.

## Decisions

**D1 — Check `res.ok` and revert on failure (honest failure).**
`setAccent(a)` captures the previously persisted accent, applies the new one
optimistically (state + `applyAttr` + cookie), then awaits the POST. On a non-ok
response *or* a thrown/rejected request, it restores the previous accent across
all three surfaces and reports failure. Alternative considered: trust the local
cookie over the DB on mount and re-sync the DB. Rejected — a divergent cookie is
ambiguous (a failed local write vs. a stale cookie from another device where a
newer choice was made), so trusting it can resurrect a stale accent. Reverting
keeps the DB authoritative and the two layers consistent, which is why the mount
effect needs no change.

**D2 — Surface the failure at the call site via `Promise<boolean>`.**
Because of the provider nesting, `setAccent` widens from `() => void` to
`(a) => Promise<boolean>` (`true` = persisted, `false` = failed & reverted). Its
only caller, `PreferencesCard`, awaits it and on `false` shows
`t("accent_save_err")` through `useToast`. Alternative considered: reorder
providers so `ToastProvider` wraps `AccentProvider` and toast from inside the
provider. Rejected as a broader structural change with wider blast radius for a
focused fix; the return-value contract is smaller and keeps `accent.tsx` free of
the toast/i18n dependencies.

**D3 — Extract a pure `persistAccent` for testability.**
Per the repo convention (logic in pure `lib/` modules, thin React, no render
tests), factor the network call into `lib/accent-persist.ts`:
`persistAccent(a): Promise<boolean>` — POST, return `res.ok`, map any throw to
`false`. Unit-tested by stubbing `global.fetch` (ok, non-ok, reject). The
provider keeps only the thin optimistic-apply + revert wiring, verified
manually.

**D4 — Coalesce a null/absent body to `{}` in the route.**
```ts
let body: Record<string, unknown> = {};
try { body = ((await req.json()) as Record<string, unknown> | null) ?? {}; }
catch { /* keep {} → 400 below */ }
if (!isAccentId(body.accent)) return NextResponse.json({ error: "accent" }, { status: 400 });
```
`isAccentId(undefined)` is `false`, so an empty/`null`/invalid body deterministically
400s. The guard/auth ordering (403 guest, 401 unauth) is unchanged.

## Risks / Trade-offs

- **In-flight navigation cannot revert** → If the user changes accent and
  navigates away before the POST resolves, no revert can run; the next load
  seeds from the DB (old value) and the cookie is reconciled to it. This is a
  narrow window versus the current always-on silent loss, and the outcome is a
  *consistent* (if not-yet-saved) state, not a divergent one. Accepted;
  documented in Open Questions.
- **Error reuses the success-styled (green-bordered) toast** → Same trade-off
  already accepted for `dl_excel_err` in `DoneStep`. A dedicated error variant is
  out of scope.
- **`setAccent` contract widens to `Promise<boolean>`** → Single caller updated
  in the same change; no external consumers.

## Migration Plan

Pure code change, no data/schema/API-shape migration. Rollback is a plain revert
of the touched files; the accent DB row format and the POST contract are
unchanged.

## Open Questions

- Should a failed save also *retry* once before reverting (transient blips)?
  Current decision: no — revert + inform is simpler and honest; a retry/queue can
  be a later enhancement if telemetry shows frequent transient failures.
