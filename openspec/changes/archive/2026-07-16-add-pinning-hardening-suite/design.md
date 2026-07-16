# Design — Pinning hardening suite

## Context

The library enforces SPKI pinning natively (TrustKit on iOS; NSC + OkHttp
`CertificatePinner` on Android) from a single `ssl_config.json`. All four new
capabilities must stay backward compatible with existing configs and avoid
breaking the eager-init bootstrap path.

## Goals / Non-Goals

- Goals: rollout-safe pinning (audit), observability (events + report URIs),
  fail-open expiration, signed OTA pin distribution, zero-dependency CLI.
- Non-Goals: app attestation / anti-tamper, mTLS, WebView pinning (future
  changes); guaranteed delivery of failure reports.

## Decisions

- **Config shape**: extended metadata lives in a separate optional `domains`
  map keyed by the same hostnames as `sha256Keys`, plus top-level `reportUris`.
  Rationale: `sha256Keys` is consumed by four independent readers (iOS, two
  Android clients, NSC generators in JS + Groovy); changing its value type
  would be a breaking cross-cutting change. A sidecar map degrades gracefully:
  old readers ignore it.
- **Nitro surface**: extended config crosses the bridge as a JSON string via a
  new `setSSLConfigJson(configJson: string)` method; the existing struct-typed
  `setSSLConfig` remains for compatibility. Rationale: both native sides
  already persist and parse the config as a JSON string; a string avoids
  fragile nested-struct codegen and keeps one canonical serialization.
- **Failure events**: ONE native callback slot (`setPinningFailureCallback`);
  the JS layer fans out to N listeners and returns unsubscribe functions.
  Rationale: minimal native surface, no listener-id bookkeeping in two native
  languages.
- **Android audit mode**: audit domains are excluded from `CertificatePinner`
  and from the NSC pin-set (both are enforcing mechanisms); a network
  interceptor computes served SPKI pins via `CertificatePinner.pin(cert)` after
  the handshake and reports mismatches without failing the call. Enforced-mode
  failures are observed via an OkHttp `EventListener` that recognizes
  `SSLPeerUnverifiedException` from pin validation and parses served pins from
  its message.
- **iOS audit/expiration**: native TrustKit options (`kTSKEnforcePinning`,
  `kTSKExpirationDate`, `kTSKIncludeSubdomains`, `kTSKReportUris`) — no custom
  validation code. JS events come from the existing
  `pinningValidatorCallback`.
- **Expiration**: honored at three layers — TrustKit (iOS), NSC `pin-set
  expiration` attribute (Android OS), and a build-time skip in both OkHttp
  client factories (Android runtime). All fail-open by design (documented
  trade-off, mirrors Android platform semantics).
- **OTA update trust**: Ed25519 over the exact bundle bytes
  (`payload` is base64 of the canonical JSON; signature verifies the decoded
  bytes). Verification runs in JS via `tweetnacl` (auditable, 0 transitive
  deps). Freshness: bundle `expiresAt` plus caller `maxAgeMs` on `issuedAt`.
  Any failure leaves the active config untouched (fallback = no-op).
  Trade-off: JS-level verification is tamperable by an attacker who already
  controls the JS bundle — accepted, since such an attacker can call
  `setSSLConfig` directly; the signature protects the *transport channel*.
- **CLI**: Node built-ins only (`tls`, `crypto.X509Certificate`,
  Ed25519 via `crypto.generateKeyPairSync`/`sign`). Command logic lives in
  `scripts/cli-utils.js` (unit-testable, no I/O at import time);
  `scripts/cli.js` is the thin argv wrapper exposed as a `bin`.

## Risks / Trade-offs

- Expiration fail-open gives attackers a post-date window → surfaced in docs;
  `verify` CLI warns when expiration is near so teams rotate on time.
- Report POSTs from the app could loop through a pinned/failing domain →
  report URIs hosts are never pinned-validated for reporting purposes
  (Android reporter uses a plain OkHttpClient; iOS TrustKit's reporter already
  handles this), plus per-host dedup.
- Nitrogen regeneration touches many generated files → generated code is
  committed as-is from the tool, never hand-edited.

## Migration Plan

No migration required: configs without `domains`/`reportUris` behave exactly
as before. Rollback = revert; persisted runtime configs remain parseable by
old code (unknown keys were already tolerated).

## Open Questions

- None blocking. Future: monotonic version persistence for OTA anti-rollback
  across process restarts (currently in-memory per session).
