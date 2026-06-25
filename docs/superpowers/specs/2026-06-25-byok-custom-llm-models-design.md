# BYO-Key Custom LLM Models — Design

**Date:** 2026-06-25
**Status:** Approved (design); pending implementation plan
**Topic:** Registered users add their own LLM model via API key in Settings → LLM section.

## Goal

A **registered** user can add their own LLM model by entering an API key (and the
model details) in the Settings → LLM section. On successful validation the model
appears in the extraction-model picker and can be selected like any built-in model.
Failures (invalid key, model unavailable, rate limit, bad endpoint, etc.) surface
as clear, typed messages. Guests are excluded. Keys are stored encrypted, write-only.

## Non-Goals (YAGNI)

- No persistence of the *selected* model across reloads (selection stays ephemeral
  as today; the custom-models *list* persists in the DB and re-merges into the picker).
- No per-model usage metering, billing display, or quotas (the user pays their provider).
- No org/team sharing of keys — keys are strictly per-user (by email).
- No silent fallback from a custom model to the app's free pool.

## Decisions (locked)

1. **All provider variants** via a single OpenAI-compatible client with presets —
   not N native adapters.
2. Custom model runs **standalone**: only the user's key/model; **no fallback** to the
   app's free pool; `freeOnly` does not apply. On failure → explicit typed error.
3. **Write-only keys**: never returned to the client after save; shown masked with
   the first 2 and last 4 characters visible, the rest asterisks (e.g. `sk••••••ab12`).
4. **Consent disclaimer** ("all risks on the user", standard text) accepted at
   registration; existing users acknowledge risk in the add-model form.

## Approach

Generalize the existing OpenAI-compatible `openrouter.ts` adapter into
`openaiCompatModel({ baseUrl, apiKey, modelSlug })`, reusing the existing prompt /
JSON-repair / field-mapping pipeline. Provider **presets** prefill the base URL:

| Preset      | Base URL (default)                          | Notes |
|-------------|---------------------------------------------|-------|
| OpenRouter  | `https://openrouter.ai/api/v1`              | user's own OR key; any slug incl. paid |
| OpenAI      | `https://api.openai.com/v1`                 | |
| Anthropic   | `https://api.anthropic.com/v1`              | OpenAI-compat endpoint |
| Google      | `https://generativelanguage.googleapis.com/v1beta/openai` | Gemini OpenAI-compat layer |
| Custom      | user-entered                                | Ollama / LM Studio / proxies; SSRF-guarded |

Rejected alternatives: N native adapters (3–4× code, native Anthropic/Google shapes
don't fit the pipeline); OpenRouter-key-only (excludes raw OpenAI/Anthropic keys).

## Data Flow

1. Custom model id scheme: **`custom:<uuid>`**. The client only ever sends this id
   in the extract request body — never the key or base URL.
2. `ModelSelect` fetches `GET /api/models` and merges the user's custom models into
   the picker under a "Свои" group (badge "ваш ключ" instead of free/paid).
3. `app/api/extract/route.ts`: when `body.model` starts with `custom:`, load the
   `user_models` row for the **session email**, decrypt the key server-side, build
   `openaiCompatModel`, and extract standalone (no race/fallback, `freeOnly` ignored).
   The row must belong to the session user or the request is rejected.

## Data Model (Drizzle + migration)

New table `user_models`:

| Column      | Type        | Notes |
|-------------|-------------|-------|
| `id`        | text PK     | uuid, surfaced to client as `custom:<id>` |
| `email`     | text        | owner, lowercased (matches `users.email`) |
| `label`     | text        | display name, e.g. "My GPT-4o" |
| `provider`  | text        | `openrouter` \| `openai` \| `anthropic` \| `google` \| `custom` |
| `baseUrl`   | text        | resolved endpoint (preset or custom) |
| `modelSlug` | text        | provider's model id, e.g. `gpt-4o` |
| `keyCipher` | text        | AES-256-GCM ciphertext, base64 `iv|tag|ct` |
| `createdAt` | timestamp   | defaultNow |
| `updatedAt` | timestamp   | |
| `lastOkAt`  | timestamp   | nullable; set on successful validation/use |

Add to `users`: `tosAcceptedAt timestamp` (nullable), `tosVersion text` (nullable).
A drizzle-kit migration is generated for both changes.

## Encryption

`lib/crypto/secrets.ts` — AES-256-GCM. Master key from env **`BYOK_ENCRYPTION_KEY`**
(32 bytes, base64). `encrypt(plain) → base64(iv|tag|ciphertext)`, `decrypt(blob) → plain`.
- Keys are write-only: never serialized back to the client.
- API responses include only a **masked** form for display: the first 2 and last 4
  characters visible, the rest asterisks, e.g. `sk••••••ab12` (keys of 6 chars or
  fewer are fully masked, no characters revealed).
- Changing a key = re-enter (which re-validates).
- Missing/invalid `BYOK_ENCRYPTION_KEY` fails closed at boot/use (no plaintext fallback).

## API Routes

All under `app/api/models/`, registered-users-only (reject guests via `isGuest`).

- **`GET /api/models`** — returns the user's custom models, each with
  `{ id, label, provider, modelSlug, maskedKey, lastOkAt }`. Never the plaintext key.
- **`POST /api/models`** — body `{ label, provider, baseUrl?, modelSlug, apiKey, acceptTos? }`.
  Steps: ensure consent — if `users.tosAcceptedAt` is null and `acceptTos !== true`,
  reject with `403 { code: "consent_required" }`; if null and `acceptTos === true`,
  record `tosAcceptedAt`/`tosVersion` now → resolve base URL (preset or validated
  custom) → **live validation probe** (a minimal chat completion with a short timeout)
  → on success encrypt key + insert row + return the masked row; on failure return a
  typed error (see taxonomy) and persist nothing.
- **`DELETE /api/models/[id]`** — delete; row must match the session email (else 404,
  no cross-user leakage).
- *(optional)* **`POST /api/models/[id]/test`** — re-run the validation probe; update
  `lastOkAt`.

## Error Taxonomy

The validation probe and extraction map provider/transport failures to typed codes,
rendered as friendly RU/EN text:

| Condition                         | Code              | Message (RU) |
|-----------------------------------|-------------------|--------------|
| 401 / 403 auth                    | `auth`            | «Ключ отклонён / нет доступа» |
| 404 / unknown model               | `model_not_found` | «Модель не найдена у провайдера» |
| 429                               | `rate_limited`    | «Лимит запросов исчерпан» |
| timeout / network / DNS           | `unreachable`     | «Провайдер недоступен» |
| 200 but non-JSON / unusable body  | `bad_response`    | «Модель ответила некорректно» |
| invalid / SSRF-blocked base URL   | `bad_endpoint`    | «Недопустимый адрес» |
| other 5xx                         | `provider_error`  | «Ошибка провайдера» |

## Security

- Registered users only; guests rejected at every `/api/models` route and at extract.
- Keys encrypted at rest, write-only, masked in all responses.
- **SSRF guard** for custom base URL: require `https`; reject private / loopback /
  link-local / unique-local / cloud-metadata (169.254.169.254) addresses; allowlist
  preset hosts; resolve DNS and re-check the resolved IP. Pragmatic, fail-closed.
- Consent: standard disclaimer text ("all risks on the user") shown at registration
  with a required checkbox (blocks submit); stored as `tosAcceptedAt` + `tosVersion`.
  Existing users (registered before consent) acknowledge the same risk via a checkbox
  in the add-model form, which sends `acceptTos: true` to `POST /api/models` and
  records `tosAcceptedAt`/`tosVersion` on first save.

## Frontend (Settings → LLM section)

`components/settings/ModelCard.tsx` gains a "Свои модели" subsection:

- **List** — each row shows **Тип LLM** (provider + model id) **и API key**
  masked (first 2 + last 4 visible, rest asterisks: `sk••••••ab12`), plus status
  (✓ / last error) and a delete action.
- **"Добавить модель"** → form: provider preset `<select>`, base URL field (shown only
  for Custom), model id, API key, label. Inline states: «проверка…» → «✓ добавлено» /
  «✗ <причина>». On success the new model appears immediately in the picker.

`components/shell/ModelSelect.tsx` fetches `/api/models` and merges the custom models
into the dropdown (built-in catalog + a "Свои" group with a "ваш ключ" badge).

Registration form (`components/auth/RegisterForm.tsx`): consent checkbox + standard
disclaimer text; submit blocked until checked; acceptance persisted on the new user.

## Testing (vitest, matching existing patterns)

- **Unit:** crypto round-trip (encrypt→decrypt, tamper rejected); key masking;
  SSRF guard (allow presets, block private/loopback/metadata); error classifier per
  HTTP status; `openaiCompatModel` against a mocked fetch (success + each error code);
  `registry.getModel` resolving `custom:` → loads row → builds adapter.
- **API routes:** `POST` validates + encrypts (probe mocked), rejects without consent;
  `GET` masks keys; `DELETE` enforces email scoping (cannot delete another user's row);
  guest rejected on all three; extract uses the user's key standalone (no fallback).
- **Components:** `ModelSelect` merges custom models; add-model form renders each error
  state; registration consent gate blocks submit until checked.

## Open Follow-ups (not in this slice)

- Persist the selected model per user across reloads.
- Re-test-all / health badge refresh in the list.
- Edit (rename/relabel) a custom model without re-entering the key.
