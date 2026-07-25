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

#### Scenario: One foreign URL among valid ones
- **WHEN** a request mixes valid blob URLs with one URL outside the store
- **THEN** the whole request is rejected and none of the valid URLs are fetched
