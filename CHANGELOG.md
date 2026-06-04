# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
