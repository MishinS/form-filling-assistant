## Context

Batch mode (`components/batch/BatchModal.tsx` + `lib/batch/*`) fills one template
from many source files and packages the results into a ZIP. Two audit findings
(2026-07-23) let a run lose results silently:

1. **`lib/batch/zip.ts`** de-duplicates on the sanitized *base* name via a
   `Map<base, count>`, but the generated candidate `<base> (n).xlsx` is written
   straight into `files: Record<string, Uint8Array>` without checking whether
   that final key is already taken. Inputs `report`, `report`, `report (2)`
   produce keys `report.xlsx`, `report (2).xlsx`, `report (2).xlsx` — the third
   overwrites the second, so `zipSync` gets one fewer entry.
2. **`BatchModal.tsx:138`** the overlay `<div … onClick={onClose}>` closes on any
   backdrop click. `runBatch` (`lib/batch/run-batch.ts`) is a plain awaited loop
   with no abort wiring, so unmounting the modal mid-run abandons the promise and
   drops all state (`items`, `doneItems`) — every result is lost with no warning.

Constraints: logic lives in pure `lib/` modules tested by co-located Vitest
`*.test.ts`; React components stay thin and are not render-tested; user-facing
strings go through `lib/i18n`. The fix must keep `zipOutputs`'s signature and its
output for non-colliding inputs unchanged.

## Goals / Non-Goals

**Goals:**
- Guarantee the ZIP entry count equals the number of filled workbooks for any
  combination of names (no silent drops).
- Prevent a backdrop click or header ✕ from destroying a running batch, and
  require confirmation before discarding a finished-but-unsaved batch.
- Cover the dedup fix with a co-located unit test that reproduces the collision.

**Non-Goals:**
- Making a running batch cancellable/abortable (dismissal is blocked, not
  turned into a cancel).
- Persisting results across an intentional close, or auto-downloading them.
- Touching the pipeline, NDJSON parsing, or extraction race logic.

## Decisions

**D1 — Dedup on the final entry name, not the base.**
Replace the `Map<base, count>` with a `Set<finalName>` (or a `while (used.has())`
loop). For each entry, compute `<base>.xlsx`; if taken, try `<base> (2).xlsx`,
`<base> (3).xlsx`, … until an unused name is found, then record it. This closes
the collision-with-generated-name hole because the *actual* key going into
`files` is what gets checked. Alternative considered: keep the base counter but
also add a taken-name check — rejected as two sources of truth that can still
diverge. The `while` loop is O(n) worst-case per entry but n is tiny (batch
sizes are user-selected handfuls of files).

**D2 — Guard close instead of adding abort machinery.**
Introduce a single `requestClose()` in `BatchModal` that all dismissal paths call
(backdrop `onClick`, header ✕). Behavior: if `running` → ignore (no-op). Else if
there are completed results not yet downloaded (`doneItems` has a `done` item and
no download happened) → `confirm()` before calling `onClose`. Else → `onClose()`
directly. Backdrop and ✕ both route through `requestClose`. Alternative
considered: wiring `AbortController` through `runBatch`/`runOne` so a close
cancels cleanly — deferred to the separate cancel feature (Non-goal); it is a
larger change to the pipeline signature and not needed to stop *accidental* loss.

**D3 — Track "downloaded" with a boolean flag.**
Add `const [saved, setSaved] = useState(false)`; `download()` sets it true on
success. The confirm in D2 only fires when `doneItems` has downloadable results
and `!saved`. Keeps the guard from nagging users who already saved.

**D4 — Confirm copy goes through i18n.**
The confirmation prompt uses a new `batch_discard_confirm` key (RU + EN) added to
`lib/i18n`, consistent with the bilingual convention. Native `window.confirm` is
acceptable here — it matches the app's "no new modal primitives for a yes/no"
posture and keeps the change small.

## Risks / Trade-offs

- **`window.confirm` is synchronous/blocking and unstyled** → Acceptable for a
  destructive-discard guard; revisit only if design wants a themed dialog. Not on
  the running path, so no UX cost during processing.
- **Blocking close while running could trap a user if a batch hangs** → The batch
  is sequential and per-file failures are already caught as `error` without
  aborting, so the loop always terminates; once `running` flips false the modal
  is dismissable again. Documented as acceptable; a real cancel is the follow-up.
- **Dedup `while` loop on pathological inputs** → Bounded by batch size (handful
  of files); no practical DoS surface.

## Migration Plan

Pure code change, no data or API migration. Ship both fixes together (they share
the "batch data loss" theme). Rollback is a plain revert of the two files + test;
`zipOutputs` output is unchanged for all previously-working inputs, so no
downstream contract shifts.

## Open Questions

- Should a *finished* batch also block backdrop-close entirely (like running)
  instead of confirming? Current decision: confirm, so a user who genuinely wants
  to discard can. Revisit if audit/UX prefers hard-block.
