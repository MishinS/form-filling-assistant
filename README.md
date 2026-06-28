# Form-Filling Assistant — Web

Production Next.js 14 (App Router) + TypeScript + Tailwind recreation of the
Form-Filling Assistant hi-fi prototype. Upload invoices / contracts / quotes →
extract fields → fill a template (first: «Платёжное требование» ПТ-Ф15) →
export. RU/EN bilingual. Accent `#0b5394`.

## This slice

**Mock-first UI** (handoff phases 1–2): every screen rendered on typed seed
data — shell, dashboard, fill wizard (upload → processing → review → done),
templates gallery, field-to-cell mapping editor, and sources/settings stubs.

Out of scope here (later phases): real document parsing, LLM extraction,
Excel/PDF export, auth, and a live database. The Drizzle schema in
`lib/db/schema.ts` is authored as the persistence contract but **not wired** to
a runtime DB.

## Develop

```bash
npm run dev     # dev server on http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm test        # Vitest unit tests (logic: contrast, i18n)
```

## Layout

- `app/(app)/` — routed screens behind the Sidebar + Topbar shell.
- `components/` — ported UI (primitives, shell, dashboard, wizard, review, templates).
- `lib/seed/pt.ts` — typed seed (ПТ template, fields with real cell addresses, history).
- `lib/i18n.tsx` — RU/EN provider + `useI18n()` hook.
- `lib/types.ts`, `lib/db/schema.ts` — domain types + Drizzle persistence contract.

## Reference

- Spec: `../docs/superpowers/specs/2026-06-01-ffa-web-scaffold-design.md`
- Plan: `../docs/superpowers/plans/2026-06-01-ffa-web-scaffold.md`
- Prototype (visual ground truth): `../docs/handoff/design_handoff_form_filling/`
