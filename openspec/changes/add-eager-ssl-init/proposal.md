# Change: Eager SSL pinning initialization and runtime config API

## Why

SSL pinning currently activates only as a side effect of the native module's
constructor running. With the New Architecture (TurboModules) and on iOS, the
native module is instantiated lazily — only the first time JavaScript touches
it. As a result, configuring pinning purely through the Expo config plugin (or
the bundled `ssl_config.json`) does **not** enforce pinning until the app calls
a JS method such as `getUseSSLPinning()`. On iOS this means no pinning at all
until that call, because iOS pinning is 100% runtime (TrustKit), with no
build-time fallback. This is a silent security gap.

This change makes pinning initialize at app launch independent of the JS module
lifecycle, hardens the TrustKit lifecycle, exposes a runtime configuration API,
and improves error reporting and config defaults.

## What Changes

- Initialize SSL pinning at process start, independent of JS:
  - iOS: an Objective-C `+load` bootstrap invokes TrustKit initialization at
    app launch.
  - Android: an `androidx.startup` Initializer installs the pinned
    `OkHttpClientFactory` before `Application.onCreate` completes.
- Harden iOS TrustKit lifecycle: guard `initSharedInstance` so it runs at most
  once per process (prevents the "already initialized" crash). Document that
  toggling pinning off requires an app restart on iOS. **BREAKING**: none, but
  runtime-disable semantics on iOS are clarified.
- Add a runtime configuration API (JS + native, both platforms):
  - `setSSLConfig(config)` — update pins at runtime.
  - `getPinnedDomains()` — list currently configured domains.
- Surface native failures to JS via rejected promises with error codes instead
  of swallowing them silently.
- Make the JS fallback (native module missing) emit a clear warning so a
  no-op is not mistaken for active pinning.
- Make the Network Security Config pin-set `expiration` configurable via a
  plugin option (`pinExpiration`) and a Gradle property.
- Parse `ssl_config.json` with a standard JSON parse first, only falling back to
  string-cleaning when needed.
- Replace the brittle regex manipulation of `project.pbxproj` in the Expo
  plugin with the `withXcodeProject` / `xcode` API.
- Add tests covering the eager-init contract, the runtime API, and configurable
  expiration.

## Impact

- Affected specs: `ssl-pinning-api`, `expo-plugin`
- Affected code:
  - iOS: `ios/SharedLogic.swift`, `ios/UseSslPinningModule.swift`,
    `ios/UseSslPinningModule.mm`
  - Android: `android/src/main/java/com/usesslpinning/*`,
    `android/src/{old,new}arch/.../UseSslPinningModule.kt`,
    `android/src/main/AndroidManifest*.xml`, `android/build.gradle`,
    `android/ssl-pinning-setup.gradle`
  - JS: `src/index.tsx`, `src/NativeUseSslPinning.ts`, `src/UseSslPinning.types.ts`
  - Plugin/scripts: `app.plugin.js`, `scripts/nsc-utils.js`, `scripts/postinstall.js`
  - Docs/tests: `README.md`, `CHANGELOG.md`, `__tests__/*`
