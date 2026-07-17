# Change: Pinning hardening suite — audit mode, failure reporting, expiration, OTA updates, CLI

## Why

Static, silently-enforced pinning is the top cause of pinning-induced outages
(cert rotation bricking installed apps) and the top adoption blocker ("how do I
know it's working?"). With CA/Browser Forum cert lifetimes shrinking
(200 days now → 47 days by 2029), pin rotation becomes routine; the library
needs rollout-safety (report-only mode), observability (failure events +
report URIs), fail-open circuit breakers (expiration), key-continuity tooling
(pin extraction / drift verification CLI), and out-of-band pin distribution
(signed OTA updates).

## What Changes

- Extend `ssl_config.json` / `SslPinningConfig` with an optional per-domain
  `domains` metadata map (`enforcePinning`, `expirationDate`,
  `includeSubdomains`) and a top-level `reportUris` list. `sha256Keys` stays
  unchanged — fully backward compatible.
- **Audit (report-only) mode**: `enforcePinning: false` validates pins and
  reports mismatches without blocking connections (iOS TrustKit
  `kTSKEnforcePinning=false`; Android audit interceptor, domain excluded from
  `CertificatePinner` and NSC pin-set).
- **Pin-failure reporting**: JS `addPinningFailureListener()` receives
  `{host, enforced, servedPins, message, timestamp}` events; optional
  `reportUris` receive HPKP-style JSON POSTs (TrustKit native on iOS, reporter
  with dedup on Android).
- **Per-domain pin expiration**: fail-open after `expirationDate`
  (TrustKit `kTSKExpirationDate`, NSC `pin-set expiration`, runtime skip in
  OkHttp clients).
- **OTA signed pin updates**: `updatePinsFromUrl(url, {publicKey})` fetches an
  Ed25519-signed pin bundle, verifies signature + freshness, applies via
  `setSSLConfig`, falls back to the active config on any failure.
- **CLI** (`npx react-native-ssl-manager <cmd>`): `pins` (extract SPKI pins
  from a live host or PEM), `verify` (diff live chains against
  `ssl_config.json`, CI-friendly exit codes), `keygen` + `sign` (Ed25519
  keypair and signed OTA bundle authoring).
- Nitro spec additions: `setSSLConfigJson(configJson)` and
  `setPinningFailureCallback(cb)` (single native callback; JS fans out to
  multiple listeners). Existing methods unchanged.

## Impact

- Affected specs: `ssl-pinning-config` (new), `pin-failure-reporting` (new),
  `ota-pin-updates` (new), `pin-cli` (new),
  `android-network-security-config` (modified)
- Affected code:
  - JS: `src/index.ts`, `src/types/SslPinningConfig.ts`, `src/config.ts` (new),
    `src/ota.ts` (new), `src/specs/SslManager.nitro.ts`
  - iOS: `ios/SharedLogic.swift`, `ios/HybridSslManager.swift`
  - Android: `android/src/main/java/com/usesslpinning/*`,
    `android/src/main/java/com/margelo/nitro/sslmanager/HybridSslManager.kt`,
    `android/ssl-pinning-setup.gradle`
  - Generated: `nitrogen/generated/**` (nitrogen re-run)
  - Tooling: `scripts/cli.js` (new), `scripts/cli-utils.js` (new),
    `scripts/nsc-utils.js`, `app.plugin.js`, `package.json` (bin, tweetnacl dep)
  - Tests: `__tests__/*`, docs: `README.md`, `CHANGELOG.md`
