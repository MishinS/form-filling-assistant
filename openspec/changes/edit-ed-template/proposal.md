## Why

The built-in «Паспорт Заказа и договора» (`ed-passport-html`) is fixed in the
repository: its field catalog (`ED_FIELDS`), its extraction instruction
(`ED_INSTRUCTION`) and its skeleton (`lib/render/templates/ed.html`) change only
with a deploy. The owner is the one who knows when a section label, a department
head, a hint or the layout must change, and today every such tweak — a fourth
«ЦФО», a renamed section, a new row, a sharper instruction — is a code change.
`/templates/ed` answers 404 and `builtins.ts` marks the catalog `fieldsLocked`
on purpose, so there is no path at all short of editing the repo.

## What Changes

- **A registered user can edit the ED template for themselves**, in three
  layers, on one editor page reached from the template gallery:
  - **Fields** — labels, LLM hints, required flag, default value, the constant
    («Запустил»), the option list of a choice field («ЦФО»), slot mode from the
    closed set; add and remove fields.
  - **Instruction** — the template's extraction instruction text.
  - **Skeleton** — the raw HTML with named slots, edited as text next to a live
    preview, with a helper to insert a slot token.
- **Every layer can be returned to its default** independently, and the whole
  template can be reset at once. A layer the user never touched follows the
  repository default, including future changes to it.
- **Saving is refused while the three layers disagree**: every slot in the
  skeleton must be addressed by exactly one field and every field must address a
  slot the skeleton declares; the skeleton must stay inside the navi editor
  subset (`checkSubset`, font-size list, no `id`). The editor shows the reason
  before the user presses save; the server re-checks.
- **The user's version is what runs.** Wizard, extraction (hosted and local
  paths) and fill resolve the ED template as *the user's layer, else the
  repository default*. The server loads the layers itself — the fill request
  still carries only values, so markup never arrives in a fill request body.
- **Guests keep the repository template** and see no edit action.
- Markup-bearing field properties (`paragraphHtml`, `listSeparator`) stay
  catalog-only, as `parseFieldList` already enforces; markup belongs to the
  skeleton, which is validated as a whole.

## Non-goals

- **Not a general HTML template builder.** Users still cannot create their own
  HTML templates; the LLM scan stays XLSX-only. Only the built-in ED template
  becomes editable.
- **No shared or team edits.** A user's version is visible to that user only;
  nobody changes the template for others without a deploy.
- **No WYSIWYG editor.** The skeleton is edited as HTML text; the preview is
  read-only.
- **No version history** of a user's edits beyond "mine" and "default".
- **No automatic merge** of a user's saved skeleton with a later repository
  change to `ed.html`; a user who saved a skeleton keeps it until they reset it.
- **PT and user XLSX templates are unchanged**; their mapping editor keeps its
  current behaviour.
- **No changes to navi.**

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `templates`: the built-in order-passport template becomes per-user editable
  in three layers with per-layer reset; per-user mappings widen from a field list
  to fields + instruction + skeleton for HTML templates; the combination is
  validated as a unit at save and at use.

This change depends on `ed-passport-html`, which introduces the ED template,
the `html-render` and `template-prompts` capabilities and the HTML-format
requirements in `templates`. `ed-passport-html` must be archived first; this
change is built on its branch (`feat/ed-passport-html`).

## Impact

- **Database**: `template_mappings` gains nullable `instruction` and `skeleton`
  text columns, and `fields` becomes nullable, so each layer can be absent
  independently (`null` = repository default). Applied with `drizzle-kit push`
  like previous schema changes. PT and custom-template rows are unaffected.
- **API**: `/api/mappings` reads and writes the three layers for `ed` with
  combined validation; `/api/extract` and `/api/fill` resolve the ED template
  from the user's row server-side instead of the static `ED_FIELDS` /
  `ed.html`; guests are never looked up.
- **Code**: a pure resolver/validator for the effective ED template in `lib/`
  (reusing `renderHtml`'s slot parsing, `checkSubset` and `parseFieldList` with
  `format: "html"`); `builtins.ts` stops locking the ED catalog for registered
  users; the wizard fetches the effective fields and instruction (the local-model
  path builds its prompt on the client); `/templates/ed` renders a new HTML
  template editor instead of 404; the gallery shows an edit action on the ED card
  for registered users; new strings in `lib/i18n.tsx` (RU/EN).
- **Untouched**: parsing, the model race, BYOK, `lib/render/html.ts` rendering
  rules, PT fill, batch mode.
