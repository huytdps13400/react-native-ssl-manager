# pin-cli Specification

## Purpose
TBD - created by archiving change add-pinning-hardening-suite. Update Purpose after archive.
## Requirements
### Requirement: Pin Extraction Command

The package SHALL expose a CLI (`react-native-ssl-manager`) with a
`pins <host>` command that connects to the host over TLS, computes the
`sha256/<base64 SPKI SHA-256>` pin for every certificate in the served chain,
and prints a ready-to-paste `ssl_config.json` snippet. It SHALL use only Node
built-ins (no openssl dependency) and SHALL warn when fewer than 2 pins would
be configured.

#### Scenario: Extract pins from a live host

- **WHEN** `npx react-native-ssl-manager pins example.com` runs against a
  reachable TLS host
- **THEN** the leaf and intermediate SPKI pins are printed with their subject
  names, plus a JSON config snippet

#### Scenario: PEM file input

- **WHEN** `pins --pem cert.pem` is given a PEM certificate file
- **THEN** the SPKI pin for that certificate is printed without any network
  connection

### Requirement: Pin-Drift Verification Command

The CLI SHALL provide a `verify` command that reads `ssl_config.json`,
connects to every configured domain, and compares the served chain's SPKI
pins against the configured pins. Exit code SHALL be `0` when every enforced
domain matches and non-zero when any enforced domain mismatches (CI-friendly).
Audit-mode domains produce warnings only. The command SHALL warn when a
configured `expirationDate` is within 30 days.

#### Scenario: All pins match

- **WHEN** every configured domain serves a chain containing at least one
  configured pin
- **THEN** `verify` prints per-domain OK results and exits `0`

#### Scenario: Drift detected

- **WHEN** an enforced domain serves a chain matching none of its pins
- **THEN** `verify` prints the served pins and exits non-zero

#### Scenario: Expiring pin-set warning

- **WHEN** a domain's `expirationDate` is within 30 days
- **THEN** `verify` prints an expiration warning for that domain

### Requirement: OTA Bundle Authoring Commands

The CLI SHALL provide `keygen` (generate an Ed25519 keypair) and
`sign --config <path> --key <private-key>` (produce a signed OTA bundle JSON
compatible with `updatePinsFromUrl`, with configurable `--expires-in`).

#### Scenario: Keygen produces usable keypair

- **WHEN** `keygen` runs
- **THEN** it writes an Ed25519 private key (PEM) and prints the base64 raw
  public key for use in `updatePinsFromUrl`

#### Scenario: Sign produces verifiable bundle

- **WHEN** `sign` runs over a valid `ssl_config.json` with a keygen-generated
  key
- **THEN** the output bundle verifies against the corresponding public key
  and contains the config as its payload

