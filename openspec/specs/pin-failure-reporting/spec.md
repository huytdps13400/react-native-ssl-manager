# pin-failure-reporting Specification

## Purpose
TBD - created by archiving change add-pinning-hardening-suite. Update Purpose after archive.
## Requirements
### Requirement: Pin-Failure Events to JavaScript

The library SHALL emit an event to JavaScript whenever pin validation fails
for a configured domain, in both enforced and audit modes.
`addPinningFailureListener(listener)` SHALL register a listener and return an
unsubscribe function; multiple listeners are supported (JS fan-out over a
single native callback).

Each event SHALL contain: `host` (string), `enforced` (boolean),
`servedPins` (array of `sha256/...` strings; MAY be empty on iOS),
`message` (string), and `timestamp` (epoch milliseconds).

#### Scenario: Enforced failure emits event

- **WHEN** a request to an enforced pinned domain fails pin validation
- **THEN** every registered listener receives an event with
  `enforced: true` and the failing `host`

#### Scenario: Audit failure emits event

- **WHEN** a request to an audit-mode domain presents a non-matching chain
- **THEN** listeners receive an event with `enforced: false`
- **AND** the request itself is not blocked

#### Scenario: Unsubscribe stops delivery

- **WHEN** the function returned by `addPinningFailureListener` is called
- **THEN** that listener receives no further events

### Requirement: Report URI Delivery

When `reportUris` is configured, the library SHALL POST a JSON report on pin
validation failure containing at least the hostname, whether pinning was
enforced, the configured pins, and (where available) the served certificate
pins. Delivery is best-effort: report failures SHALL never affect app
requests, and repeated identical failures SHALL be deduplicated per
host/pin-set within a session.

#### Scenario: Report posted on failure

- **WHEN** pin validation fails for `api.example.com`
- **AND** `reportUris` contains `https://reports.example.com/pins`
- **THEN** a JSON report is POSTed to that URI asynchronously

#### Scenario: Report endpoint down

- **WHEN** the report URI is unreachable
- **THEN** the original app request outcome is unaffected
- **AND** no error is thrown to JavaScript

