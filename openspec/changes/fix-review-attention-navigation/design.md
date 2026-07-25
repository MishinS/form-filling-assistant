## Context

`ReviewStep` classifies every row through `attentionOf` (`lib/review/attention.ts`)
and renders a tint plus a "N needs check" counter and a "К следующему →" button.
Two defects make the affordance a dead end:

- `ReviewStep.tsx:64` calls `focusNext(null)`, which resolves to `from = -1`, so
  `nextAttentionIndex` rescans from the top on every click and returns the first
  flagged row. There is no cursor. `nextAttentionIndex` itself steps and wraps
  correctly — the keyboard path (`onEnter` → `focusNext(f.id)`) proves it.
- `attentionOf` returns `"low"` whenever `conf === "low"`, and `conf` is frozen
  extraction metadata built once in `buildRows` (`conf: v?.confidence ?? "low"`).
  A field the extractor never returned is `low` by construction, so the rows the
  user fills by hand can never lose the tint. Nothing in the classifier's input
  represents "the user has dealt with this".

Both were confirmed with a throwaway reproduction before any fix was written:
filling an unreturned required field flips `required` → `low` rather than to
`null`, and three consecutive button clicks resolve to indices `[1, 1, 1]`.

Repo convention constrains the shape of the fix: logic belongs in pure `lib/`
modules with co-located Vitest tests, and React components stay thin — there are
no React rendering tests in this codebase.

## Goals / Non-Goals

**Goals:**

- Next-field navigation advances through flagged rows and terminates.
- A low-confidence flag is dismissible by the user, so the counter reaches zero.
- `invalid` and `required` remain live and re-flag when a value is cleared.
- The new decision logic lands in a pure, tested module, not in the component.

**Non-Goals:**

- Explanatory "why is this invalid" copy in Review (separate known UI gap).
- Recomputing or persisting `conf` after an edit — it stays frozen metadata.
- Marking a row reviewed on focus alone.
- Touching `nextAttentionIndex`, the precedence order, or `lib/review/validate.ts`.
- Fixing `ReviewStep`'s pre-existing staleness if `values` changes while the step
  stays mounted (`vals` is a once-only `useState` initializer). Out of scope; the
  reviewed set inherits the same lifetime and no worse.

## Decisions

**Reviewed state is a component-local `Set<string>` of field ids.**
It is ephemeral UI state: not persisted, not sent to `/api/fill`, not lifted into
the wizard. Lifting it would put it in the payload path for no benefit, since
nothing downstream consumes "the user looked at this".
*Alternative considered:* a `reviewed` flag on each row in `buildRows`. Rejected —
`buildRows` derives from props and would recompute the flag away on every render.

**`attentionOf` gains a required `reviewed: boolean` input.**
Precedence becomes `invalid > required > (low unless reviewed) > null`, keeping
one source of truth for classification.
*Alternative considered:* leave `attentionOf` untouched and filter reviewed rows
at the call site. Rejected — it splits the precedence rule across two places, and
the filter would have to re-derive which flag was the reason to know whether
suppression is legal. Making the field required rather than optional (defaulting
to `false`) forces the single production call site to be explicit; the two
existing unit tests are updated alongside.

**The navigation cursor is a ref holding the last focused field id**, updated by
an `onFocus` on every input (threaded `ReviewStep` → `FieldRow` → `FieldInput`,
which already had a focus handler for its border styling). `focusNext()` with no
argument steps from that cursor; `focusNext(id)` steps from an explicit row, which
is what Enter passes.

*Alternative considered and rejected during implementation:* reading
`document.activeElement` inside the button's click handler. This looks stateless
and cheap, but clicking a `<button>` moves focus to the button itself, so by the
time the handler runs the focused element is the button — resolving to `-1` and
reproducing the exact bug being fixed from the other end. Keyboard activation of
the button has the same problem. The ref does not care where focus currently is:
it records where the user last *was*, it is updated by our own programmatic
`.focus()` (which fires a focus event) as well as by clicks and Tab, and focus
moving to the button leaves it correctly pointing at the last row.

A consequence worth stating: `nextAttentionIndex` and `attentionOf` remain the
only pure logic here. No element→index helper is needed once the cursor stores an
id, so `orderedIds.indexOf(cursor)` — which already yields `-1` for a null or
unknown cursor — is the whole lookup.

**Enter marks reviewed, then navigates.** Marking is a state update, so
`attnById` during that same handler is one render stale — harmless, because
navigation starts strictly *after* the current row's index, so the stale entry is
never consulted.

**Date validation is narrowed to values that look like a calendar date**, rather
than loosened wholesale or resolved by changing `f10`'s `kind`. The decisive
evidence is that the two layers already disagreed: `lib/fill/values.ts` writes an
unparseable date value as text on purpose, while `lib/review/validate.ts` called
the same value invalid forever. The fill layer is the one that ships the value, so
review was the wrong one.
*Alternatives considered:* (1) change `f10` to `kind: "string"` — rejected, it
would stop a genuine date being written as a serial in both the ПТ and custom fill
paths; (2) accept every non-empty date value — rejected, it discards the
`31.02.2026` catch that makes the rule worth having; (3) let `reviewed` clear
`invalid` — rejected for the same reason it was rejected for required: an
impossible date should keep warning.
The shape test is `^\d{1,4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,4}$`. A consequence:
`"xx"` is now accepted for a date field. That is deliberate — free text and
garbage are indistinguishable without NLP, both are written verbatim by the fill
layer, and the validation is advisory.

**The pinned bar carries counts only; the detailed lists stay in flow.** Pinning
the whole header would waste vertical space on the heading and could let a long
missing-required list eat the viewport. The bar shows the attention count, the
missing-required count, and the button; the itemised warning and required blocks
scroll normally beneath it.
*Alternative considered:* making the existing header row sticky wholesale.
Rejected on the viewport-budget grounds above.

## Risks / Trade-offs

- **A user edits a low-confidence field and reverts it to the original value; the
  row stays reviewed.** → Intended. Reviewed means "the user has dealt with this",
  and they demonstrably read it.

- **Repeated Enter without reading could clear flags quickly.** → Accepted, and
  strictly better than today's "never clears". Enter is a deliberate per-field
  keystroke, unlike focus, which is why focus alone is excluded.

- **Enter marks reviewed only on single-line inputs.** → `FieldInput` binds the
  Enter handler to `<input>` but not `<textarea>`, deliberately, so multi-line
  fields keep newlines. Area fields are therefore reviewed by editing only. Left
  as is; adding a modifier chord for textareas is not worth the discoverability
  cost.

- **Reviewed ids outlive a row set change if `values` changes while mounted.** →
  Pre-existing staleness class (`vals` has it too); a stale id in the set simply
  matches nothing. Noted, not fixed here.

- **The tint and the counter now shrink as the user works, which changes the
  feel of the step.** → That is the point of the change; the light-theme tint
  tokens from `fix-theme-tokens` are unaffected since only the flag's lifetime
  changes, not its colour.
