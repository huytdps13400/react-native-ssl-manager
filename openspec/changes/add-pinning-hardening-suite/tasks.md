## 1. Config schema & JS API

- [x] 1.1 Extend `SslPinningConfig` types with `domains` metadata and `reportUris`
- [x] 1.2 Add `src/config.ts` normalization/validation (pin format, expiration date format, defaults)
- [x] 1.3 Wire `setSSLConfig` to serialize the full extended config through `setSSLConfigJson`
- [x] 1.4 Add `addPinningFailureListener` JS fan-out over the single native callback

## 2. Nitro spec & codegen

- [x] 2.1 Add `setSSLConfigJson`, `setPinningFailureCallback`, `PinningFailureEvent` to `SslManager.nitro.ts`
- [x] 2.2 Run nitrogen and commit regenerated bridges

## 3. iOS

- [x] 3.1 Parse `domains`/`reportUris` in `SharedLogic.parseFullConfig` consumers
- [x] 3.2 Map per-domain `enforcePinning`, `expirationDate`, `includeSubdomains` to TrustKit keys; set `kTSKReportUris`
- [x] 3.3 Dispatch failure events from `pinningValidatorCallback` to the registered callback
- [x] 3.4 Implement new HybridSslManager methods

## 4. Android

- [x] 4.1 Add `SslConfig` parsing of `domains`/`reportUris` (shared reader)
- [x] 4.2 Exclude audit + expired domains from `CertificatePinner` in `SslPinningFactory` and `PinnedOkHttpClient`
- [x] 4.3 Add audit network interceptor (SPKI compare via `CertificatePinner.pin`, report, never block)
- [x] 4.4 Add failure `EventListener` for enforced pin failures; parse served pins from exception message
- [x] 4.5 Add `PinningFailureReporter` (listener dispatch + `reportUris` POST with dedup)
- [x] 4.6 Implement new HybridSslManager methods

## 5. NSC generation

- [x] 5.1 `nsc-utils.js`: skip pin-set for audit domains, add `expiration` attribute, honor `includeSubdomains`
- [x] 5.2 Mirror the same logic in `android/ssl-pinning-setup.gradle`
- [x] 5.3 Pass full config through `app.plugin.js`

## 6. OTA updates

- [x] 6.1 Add `src/ota.ts` with `updatePinsFromUrl` (fetch, Ed25519 verify, freshness, apply)
- [x] 6.2 Add `tweetnacl` dependency

## 7. CLI

- [x] 7.1 `scripts/cli-utils.js`: SPKI pin computation, chain walk, verify diff, keygen, sign/verify bundle
- [x] 7.2 `scripts/cli.js` argv wrapper + `bin` entry in package.json
- [x] 7.3 CLI `pins`, `verify`, `keygen`, `sign` commands working end-to-end

## 8. Tests & docs

- [x] 8.1 Tests: NSC audit/expiration/subdomains generation + merge
- [x] 8.2 Tests: CLI utils (SPKI from fixture cert, verify diff logic)
- [x] 8.3 Tests: OTA sign→verify roundtrip, tamper + expiry rejection
- [x] 8.4 Tests: config normalization
- [x] 8.5 All existing + new tests pass (`bun test`), `tsc --noEmit` clean
- [x] 8.6 README + CHANGELOG updated
