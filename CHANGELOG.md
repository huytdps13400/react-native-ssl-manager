# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Audit (report-only) mode** — per-domain `enforcePinning: false` in the new
  optional `domains` config map: pins are validated and mismatches reported,
  but connections are never blocked. iOS maps to TrustKit
  `kTSKEnforcePinning: false`; Android excludes the domain from
  `CertificatePinner`/NSC and validates via a report-only network interceptor.
  The safe way to roll pinning out to production.
- **Pin-failure reporting** — `addPinningFailureListener(listener)` delivers
  `{host, enforced, servedPins, message, timestamp}` events to JS for both
  enforced blocks and audit observations; optional top-level `reportUris`
  receive HPKP-style JSON POSTs (TrustKit-native on iOS; deduplicated
  best-effort reporter on Android).
- **Per-domain pin expiration** — `domains.<host>.expirationDate`
  (`YYYY-MM-DD`) fails open after the date on both platforms (TrustKit
  `kTSKExpirationDate`, NSC `pin-set expiration`, and a runtime skip in both
  OkHttp clients) so abandoned installs never brick.
- **`includeSubdomains` control** — per-domain subdomain coverage (default
  `true`); OkHttp `CertificatePinner` now covers subdomains (`**.host`) to
  match the NSC/TrustKit behavior documented all along.
- **Signed over-the-air pin updates** — `updatePinsFromUrl(url, {publicKey})`
  fetches an Ed25519-signed bundle, verifies signature + freshness
  (`expiresAt`, `maxAgeMs`) + session rollback, then applies it. Invalid
  bundles reject with coded `OtaError`s and never touch the active config.
- **CLI** — `npx react-native-ssl-manager` (alias `ssl-manager`), Node
  built-ins only: `pins <host>` (SPKI extraction + config snippet, `--pem`
  offline mode), `verify` (live pin-drift check with CI exit codes and
  30-day expiration warnings), `keygen` + `sign` (Ed25519 OTA bundle
  authoring).
- **Nitro API** — `setSSLConfigJson(json)` (full extended config across the
  bridge) and `setPinningFailureCallback`/`clearPinningFailureCallback`.
- `normalizeSslConfig` validation exported from JS: pin format, date format,
  https-only report URIs, and a warning when an enforced domain ships a
  single pin.

### Changed
- `setSSLConfig` accepts the extended configuration (`domains`, `reportUris`)
  and validates before crossing the bridge. Legacy `sha256Keys`-only configs
  behave exactly as before.
- Android pinning internals refactored into `SslConfigStore`,
  `PinningClientConfigurator`, `AuditPinningInterceptor`,
  `PinningFailureEventListener`, and `PinningFailureReporter`, shared by the
  RN networking factory and `PinnedOkHttpClient`.

## [2.0.3] - 2026-07-03

### Added
- **iOS: launch-time diagnostics for SSL pinning.** The native layer now logs to
  the device console (prefix `[RNSSLManager]`) so it is visible whether pinning
  was **skipped** — and via which flag — or **initialized for domains X**, and
  which host a **blocked** connection failed on. Makes debugging e2e/mock issues
  (#9) straightforward via Console.app or `xcrun simctl spawn booted log stream`.

### Fixed
- **iOS: the `RNSSLManagerDisabled` off-switch now also accepts string values**
  (`YES` / `true` / `1`), not only a real boolean. A flag set via a build setting
  or `xcconfig` (which reaches `Info.plist` as a string) was previously ignored.
  Affects the Info.plist, `NSUserDefaults`, env var and launch-arg channels.

## [2.0.2] - 2026-07-03

### Added
- **iOS: build/launch-time off-switch for TrustKit**, so e2e tests (Detox) that
  hit a mocked backend are not blocked by pin validation. TrustKit is installed
  at launch via an Objective-C `+load` hook and swizzles `NSURLSession`
  process-wide before any JS runs, so `setUseSSLPinning(false)` is too late for a
  test run. Pinning is now skipped entirely (no swizzling) when any of these is
  set — with no effect on production builds:
  - `Info.plist` boolean `RNSSLManagerDisabled = YES` (build-time exclude)
  - launch argument `--disable-ssl-pinning` (e.g. Detox launchArgs)
  - `NSUserDefaults` key `RNSSLManagerDisabled` (e.g. Detox `launchArgs: { RNSSLManagerDisabled: true }`)
  - environment variable `RN_SSL_MANAGER_DISABLED=1` (Xcode scheme / CI)

  ([#9](https://github.com/huytdps13400/react-native-ssl-manager/issues/9))

## [2.0.1] - 2026-07-03

### Fixed
- **Android: the generated `network_security_config.xml` now permits cleartext
  traffic to local dev hosts** (`localhost`, `10.0.2.2`, `10.0.3.2`). Once the
  generated config is referenced from the manifest it overrides React Native's
  default debug network security config, which previously left the app unable to
  reach the Metro bundle in debug builds. The dev-host cleartext block is added
  by every generation path (Gradle plugin, Expo config plugin, and postinstall)
  and is not duplicated when merging into a config that already declares it.
  ([#9](https://github.com/huytdps13400/react-native-ssl-manager/issues/9))

## [2.0.0] - 2026-06-05

### Changed (BREAKING)
- **Rebuilt as a [Nitro Module](https://nitro.margelo.com).** The native modules
  and the JS bridge are now generated by `nitrogen` from a
  `SslManager.nitro.ts` HybridObject spec, replacing the TurboModule/bridge
  implementation. This removes the old/new-architecture branching and the
  hand-written JSI/bridge code.
- **Requires React Native 0.75+** (New Architecture) and a new peer dependency
  **`react-native-nitro-modules`** that consumers must install.
- **`setSSLConfig(config)`** now takes a typed `SslPinningConfig` object (a JSON
  string is still accepted for backwards compatibility and parsed before
  crossing the native boundary).
- When the native module is not linked, the API now **throws** (with a clear
  message) and `isSSLManagerAvailable()` reports `false`, instead of silently
  resolving no-ops — a no-op gave a false sense of security.
- iOS podspec renamed to `NitroSslManager`.

### Removed (security)
- The Android Network Security Config no longer emits a `pin-set expiration`.
  A pin-set expiration silently stops enforcing pins after the date (a
  build-time fail-open); pins now never expire and are always enforced.

### Unchanged
- SSL pinning is still initialized **eagerly at app launch** independent of JS
  (iOS TrustKit via an ObjC `+load` bootstrap; Android OkHttp + NSC via an
  `androidx.startup` initializer). The runtime API (`setUseSSLPinning`,
  `getUseSSLPinning`, `setSSLConfig`, `getPinnedDomains`, `isSSLManagerAvailable`)
  keeps the same names and behavior.

## [1.1.3] - 2026-06-05

### Removed (security)
- **Reverted the "graceful degradation" cert-rotation feature shipped in 1.1.2**
  (`expiration` fail-open and `enforcePinning: false` monitor mode). After
  community security review (#4), a time-windowed fail-open was deemed an
  unacceptable weakening of the pinning guarantee: during the window an
  attacker presenting a fraudulently issued but CA-valid certificate would no
  longer be blocked. Pinning is now **always enforced** again on both platforms.
  - iOS: TrustKit is always configured with `kTSKEnforcePinning: true` and no
    `kTSKExpirationDate`.
  - Android: the runtime `CertificatePinner` is always applied; removed the
    `SslPinningPolicy` enforce/expiry decision and the runtime OkHttp expiry
    check.
  - Removed the `expiration` / `enforcePinning` fields from `SslPinningConfig`
    and the `pinExpiration` Expo plugin option, `sslPinExpiration` Gradle
    property, and `SSL_PIN_EXPIRATION` env var.
- The bundled Network Security Config still emits the standard `pin-set`
  `expiration` (default 1 year from build) as before 1.1.2; it is no longer
  configurable via the removed options.

### Note
- 1.1.2 remains on npm (it cannot be unpublished). Upgrade to 1.1.3 to drop the
  fail-open behavior.

## [1.1.2] - 2026-06-04

### Tests / CI
- **Fixed the CI pipeline, which was failing on every run** at the dependency
  install step: the `setup` composite action now runs `corepack enable` so
  `yarn install` uses the pinned `yarn@3.6.1` (Yarn Berry) instead of the
  runner's global Yarn 1.x (which refused to run and skipped all jobs).
- Added JVM unit tests for the graceful-degradation policy
  (`SslPinningPolicyTest`) and a CI step running
  `:react-native-ssl-manager:testDebugUnitTest`.
- Fixed the empty `src/__tests__/setup.ts` being collected as a test (now
  ignored) and restored the Glide/Coil/Cronet documentation sections the
  existing doc tests assert, so `yarn test` is green again.

### Fixed
- **Metro/EAS bundling failure** (`Cannot find module .../lib/index.js`): the
  package's `main`/`module`/`types` pointed at `lib/`, which was never built
  (the `prepare` script is a no-op) and the source was excluded by `.npmignore`,
  so the published tarball contained no resolvable entry point. The package now
  ships the TypeScript source and points the entry fields at `./src/index.tsx`
  (consistent with `codegenConfig.jsSrcsDir`), which Metro/EAS transpiles
  directly. Removed the conflicting `.npmignore` in favor of the explicit
  `files` allowlist. Fixes #3.

### Added
- **Graceful degradation for certificate rotation** (#4): optional global
  `expiration` (`YYYY-MM-DD`) and `enforcePinning` fields in `ssl_config.json`.
  After `expiration`, pinning fails open on both platforms (iOS via
  `kTSKExpirationDate`, Android via the NSC `pin-set` expiration plus an
  equivalent runtime check in the OkHttp path) so cert rotation can't lock the
  app out. `enforcePinning: false` enables monitor mode (iOS TrustKit
  report-only; Android skips the `CertificatePinner` and NSC pin-set). Docs add
  a Cloudflare-style rotation recipe (pin the intermediate CA + backup pin).
- **Eager initialization**: SSL pinning is now initialized at app launch,
  independent of the (lazy) React Native module lifecycle. iOS uses an
  Objective-C `+load` bootstrap; Android uses an `androidx.startup` initializer.
  Pinning is enforced from a bundled `ssl_config.json` **without requiring any
  JavaScript call**.
- Runtime configuration API: `setSSLConfig(config)` and `getPinnedDomains()`.
- `isSSLManagerAvailable()` to detect whether the native module is linked.
- Configurable Network Security Config pin-set expiration via the Expo plugin
  option `pinExpiration`, the `sslPinExpiration` Gradle property, and the
  `SSL_PIN_EXPIRATION` env var for the CLI postinstall script.

### Changed
- iOS TrustKit is now guarded so it initializes at most once per process,
  preventing the "already initialized" crash. Disabling/changing pinning at
  runtime applies on the next app launch (documented).
- Native failures (invalid/missing config) now reject the JS promise with an
  error code instead of resolving silently.
- The JS fallback (native module missing) now resolves `getUseSSLPinning()` to
  `false` and warns, so a no-op is not mistaken for active pinning.
- Expo plugin adds `ssl_config.json` to the Xcode project via the Xcode project
  API instead of regex manipulation of `project.pbxproj`.
- iOS config parsing tries a direct JSON parse first, only falling back to
  string-cleaning when needed.

## [1.0.2] - 2025-08-12

### Fixed
- Expo plugin loading: đảm bảo `app.plugin.js` nằm trong gói publish và được trỏ đúng bằng `"expo": { "plugin": "./app.plugin.js" }`.
- Khắc phục lỗi “Cannot use import statement outside a module” khi Expo load sai entry.

### Changed
- Cập nhật `package.json.files` để include: `app.plugin.js`, `plugin/`, `android/`, `ios/`, `react-native-ssl-manager.podspec`, v.v.
- Cải thiện README: hướng dẫn cấu hình plugin trong `app.json`, yêu cầu đặt đúng tên `ssl_config.json`.

### Added
- Tag `v1.0.2` và hướng dẫn chuỗi lệnh commit/tag/publish.

## [1.0.1] - 2024-12-19

### Added
- ✨ **Expo Plugin Support** - Full integration with Expo config plugins
- 🏗️ **New Architecture Support** - TurboModule implementation for React Native 0.68+
- 🔄 **Legacy Architecture Compatibility** - Backward compatibility with older React Native versions
- 📦 **Bun Package Manager Support** - Full support for Bun with dedicated scripts and configuration
- 🧪 **Enhanced Example App** - Improved UI for testing SSL pinning functionality
- 🔧 **Auto-setup Scripts** - Post-install scripts for automatic configuration

### Changed
- 🎯 **Production Optimizations** - Removed debug logs and improved performance
- 📚 **Documentation** - Comprehensive README with installation and usage guides
- 🔧 **Build System** - Improved TypeScript compilation and build process

### Fixed
- 🐛 **Swift Compilation** - Fixed empty switch case compilation errors
- 🐛 **TypeScript Errors** - Resolved unused parameter warnings
- 🐛 **Expo Integration** - Fixed plugin configuration and auto-linking issues

### Technical Details
- **New Architecture**: Full TurboModule implementation with automatic detection
- **Expo Plugin**: Auto-configuration for both Android and iOS projects
- **Bun Support**: Native Bun scripts and configuration files
- **Build Output**: Optimized for production with clean codebase

## [1.0.0] - 2024-12-18

### Added
- 🔒 **SSL Certificate Pinning** - Core SSL pinning functionality
- 📱 **Cross-platform Support** - iOS and Android native implementations
- 🔄 **Dynamic SSL Control** - Enable/disable SSL pinning at runtime
- 📋 **JSON Configuration** - Simple configuration using ssl_config.json
- 🛠️ **Basic API** - setUseSSLPinning and getUseSSLPinning methods

### Initial Release
- Basic SSL pinning implementation
- Native modules for iOS and Android
- Simple configuration system
- Core API functionality
