## ADDED Requirements

### Requirement: Signed Over-the-Air Pin Updates

The library SHALL provide `updatePinsFromUrl(url, options)` (JavaScript) that
fetches a signed pin bundle, verifies its Ed25519 signature against
`options.publicKey` (base64, 32 bytes), verifies freshness, and applies the
contained configuration via `setSSLConfig`. On ANY failure (network,
signature, freshness, validation) the active configuration SHALL remain
unchanged and the promise SHALL reject with a coded error.

The bundle format is JSON: `{ "payload": "<base64>", "signature":
"<base64>" }` where `payload` decodes to
`{ "version": number, "issuedAt": ISO-8601, "expiresAt"?: ISO-8601,
"config": SslPinningConfig }` and `signature` is Ed25519 over the raw decoded
payload bytes.

#### Scenario: Valid bundle applied

- **WHEN** the fetched bundle's signature verifies against the provided
  public key
- **AND** `expiresAt` (if present) is in the future
- **THEN** `config` is applied via `setSSLConfig`
- **AND** the promise resolves with the applied version and domains

#### Scenario: Tampered bundle rejected

- **WHEN** the payload bytes do not verify against the signature
- **THEN** the promise rejects with code `OTA_INVALID_SIGNATURE`
- **AND** the active configuration is unchanged

#### Scenario: Stale bundle rejected

- **WHEN** the bundle's `expiresAt` is in the past, or `issuedAt` is older
  than `options.maxAgeMs`
- **THEN** the promise rejects with code `OTA_EXPIRED`
- **AND** the active configuration is unchanged

#### Scenario: Rollback within a session rejected

- **WHEN** a bundle with an `issuedAt` older than the last successfully
  applied bundle in this session is fetched
- **THEN** the promise rejects with code `OTA_ROLLBACK`
