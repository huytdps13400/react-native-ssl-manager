## 1. Eager initialization (independent of JS)

- [x] 1.1 iOS: add `@objc(SharedLogic)` and a non-throwing `bootstrapIfEnabled()`
- [x] 1.2 iOS: add `+load` bootstrap in `UseSslPinningModule.mm` (always compiled)
- [x] 1.3 Android: add `SslPinningInitializer` (androidx.startup) installing the factory
- [x] 1.4 Android: register the initializer provider in both manifests
- [x] 1.5 Android: add `androidx.startup:startup-runtime` dependency

## 2. Harden iOS TrustKit lifecycle

- [x] 2.1 Guard `TrustKit.initSharedInstance` so it runs at most once
- [x] 2.2 Document iOS runtime-disable requires app restart

## 3. Runtime configuration API

- [x] 3.1 JS: add `setSSLConfig` and `getPinnedDomains` to the TurboModule spec
- [x] 3.2 JS: implement and export them in `src/index.tsx`
- [x] 3.3 iOS: implement `setSSLConfig` / `getPinnedDomains` in native
- [x] 3.4 Android: implement `setSSLConfig` / `getPinnedDomains` in native
- [x] 3.5 Prefer runtime config over bundled config when present

## 4. Error reporting

- [x] 4.1 Reject native promises with error codes on genuine failures
- [x] 4.2 JS fallback warns when the native module is unavailable

## 5. Config robustness

- [x] 5.1 Parse JSON directly first; only clean on failure (iOS)
- [x] 5.2 Configurable NSC pin-set expiration (`pinExpiration` + Gradle property)
- [x] 5.3 Replace pbxproj regex with `withXcodeProject` in the Expo plugin

## 6. Graceful degradation for cert rotation (issue #4)

- [x] 6a.1 iOS: apply `kTSKExpirationDate` and configurable `kTSKEnforcePinning`
- [x] 6a.2 Android: shared `SslPinningPolicy` (expiration + enforcePinning) gating the OkHttp path
- [x] 6a.3 Build scripts: skip NSC in monitor mode; expiration from config field
- [x] 6a.4 Docs: Cloudflare rotation recipe + new config fields

## 7. Tests & docs

- [x] 6.1 Tests for eager-init contract and runtime API surface
- [x] 6.2 Tests for configurable expiration
- [x] 6.3 Update README and CHANGELOG
