## MODIFIED Requirements

### Requirement: Document parsing with locators
The system SHALL parse each uploaded blob into a `ParsedDoc` — normalized text
blocks with locators (PDF → page, XLSX → sheet+cell, DOCX → paragraph) plus
`scannedPages` flags and warnings (`lib/parse/index.ts`).

The parse endpoint SHALL fetch only URLs belonging to the application's own blob
store. Because the endpoint is reachable by an anonymous guest session, a
user-supplied URL is untrusted input: the system MUST validate every URL in a
request against the store allowlist **before** issuing any request, and MUST
reject the whole request with `400` when any of them fails, so that no
attacker-chosen host — internal service, link-local metadata endpoint, or
arbitrary external server — is ever contacted on the caller's behalf. Rejection
MUST NOT depend on whether the response would be parseable.

The store allowlist SHALL identify one specific blob store, not the blob-hosting
service as a whole. The system MUST derive the expected host from the credential
it writes and deletes with (`BLOB_READ_WRITE_TOKEN`), so that the store being
validated against is by construction the store being used; a URL on any other
blob store MUST be rejected exactly as an unrelated host is. When the store
identity cannot be determined — the credential is absent or does not parse — the
system MUST reject every URL rather than fall back to a broader allowlist, since
no legitimate blob URL can exist in that state.

#### Scenario: Successful parse
- **WHEN** `/api/parse` receives blob URLs of supported documents
- **THEN** it returns `ParsedDoc[]` with text blocks, locators, and page counts

#### Scenario: Guest source cleanup
- **WHEN** a guest session parses uploaded sources
- **THEN** the blobs are deleted from storage immediately after parsing

#### Scenario: URL outside the blob store
- **WHEN** a request contains a source URL on any other host, or a non-`https`
  scheme, or a literal IP address
- **THEN** the request is rejected with `400`, no outbound request is made, and no
  blob is deleted

#### Scenario: URL on a different blob store
- **WHEN** a request contains a well-formed URL on the blob-hosting service but
  under a store other than the application's own
- **THEN** the request is rejected with `400` and no outbound request is made

#### Scenario: Store identity cannot be determined
- **WHEN** the blob write credential is absent or does not parse
- **THEN** every source URL is rejected with `400`, including one that would
  otherwise be a valid URL on the application's own store, and the endpoint does
  not fail with a server error

#### Scenario: One foreign URL among valid ones
- **WHEN** a request mixes valid blob URLs with one URL outside the store
- **THEN** the whole request is rejected and none of the valid URLs are fetched
