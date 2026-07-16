## ADDED Requirements

### Requirement: Extended Per-Domain Configuration

The configuration SHALL accept an optional `domains` map keyed by hostname —
in both `ssl_config.json` and the runtime `setSSLConfig` payload — alongside
the existing `sha256Keys` map, with per-domain options:

- `enforcePinning` (boolean, default `true`) — when `false`, pin validation
  runs in report-only (audit) mode and never blocks connections.
- `expirationDate` (string, `YYYY-MM-DD`, optional) — after this date pinning
  for the domain is disabled (fail-open) on both platforms.
- `includeSubdomains` (boolean, default `true`) — whether pins apply to
  subdomains.

A top-level optional `reportUris` (array of HTTPS URLs) SHALL also be
accepted. Configurations without `domains`/`reportUris` SHALL behave exactly
as before (backward compatible).

#### Scenario: Legacy config unchanged

- **WHEN** a config contains only `sha256Keys`
- **THEN** every domain is enforced, has no expiration, and includes
  subdomains — identical to previous behavior

#### Scenario: Audit-mode domain

- **WHEN** `domains["api.example.com"].enforcePinning` is `false`
- **AND** a request to `api.example.com` presents a certificate chain matching
  none of the configured pins
- **THEN** the request completes normally
- **AND** a pin-failure event is emitted with `enforced: false`

#### Scenario: Expired pin-set fails open

- **WHEN** `domains["api.example.com"].expirationDate` is in the past
- **THEN** pin validation for `api.example.com` is skipped on both platforms
- **AND** connections succeed regardless of the served certificate

#### Scenario: Invalid expiration date rejected

- **WHEN** `setSSLConfig` is called with an `expirationDate` not matching
  `YYYY-MM-DD`
- **THEN** the returned promise rejects and the active configuration is
  unchanged

### Requirement: Runtime Configuration via JSON String

The native module SHALL expose `setSSLConfigJson(configJson: string)` that
validates, persists, and applies the full extended configuration. The JS
`setSSLConfig` SHALL serialize extended configs through this method. The
struct-typed native `setSSLConfig` remains supported.

#### Scenario: Extended config round-trips

- **WHEN** JS calls `setSSLConfig` with `sha256Keys`, `domains`, and
  `reportUris`
- **THEN** the full configuration (including `domains` and `reportUris`) is
  persisted natively and used on the next (re)initialization

#### Scenario: Malformed JSON rejected

- **WHEN** `setSSLConfigJson` receives a string that is not valid JSON or
  lacks a non-empty `sha256Keys` map
- **THEN** the promise rejects with an error code and the active
  configuration is unchanged
