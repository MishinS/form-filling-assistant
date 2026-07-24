## MODIFIED Requirements

### Requirement: Theme, accent, and language personalization
The system SHALL persist theme, accent palette, and RU/EN language as cookies,
apply them pre-paint via the inline script in `app/layout.tsx`, persist accent
server-side for authenticated users (`user_accents`, guarded POST
`/api/account/accent`), and clear the accent cookie on sign-out. Accent colors
SHALL pass the luminance-based contrast guard (`lib/contrast.ts`).

Accent persistence SHALL be honest about failure: the client MUST inspect the
POST outcome and, when the change is not persisted (a non-2xx response or a
network error), MUST revert the optimistic accent (in-memory state, DOM
attribute, and cookie) to the previously persisted value and inform the user,
so that a local cookie never diverges from the stored value and no unsaved
choice survives to the next page load. The guarded accent API SHALL treat a
malformed or missing request body — including a JSON `null` body — as invalid
input and respond `400`, never a `500`.

#### Scenario: Accent across devices
- **WHEN** an authenticated user with a saved accent signs in elsewhere
- **THEN** the server-side accent seeds the UI before first paint

#### Scenario: Accent save fails
- **WHEN** the user selects an accent and the persistence POST returns a non-2xx
  response or the request errors
- **THEN** the selection reverts to the previously persisted accent and the user
  is shown an error notification, and no unsaved value remains in the cookie

#### Scenario: Malformed accent request body
- **WHEN** `POST /api/account/accent` receives a `null`, absent, or otherwise
  invalid body from an authenticated full user
- **THEN** the route responds `400` and persists nothing
