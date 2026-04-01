## Context
The library currently pins SSL on Android only through React Native's `OkHttpClientFactory`. Third-party libraries (Cronet, Coil, Glide) create their own HTTP clients that bypass this pinning entirely. Android's platform-level Network Security Config is the standard solution — it's enforced by the OS for all networking stacks that use the default `TrustManager`.

On iOS, TrustKit with `kTSKSwizzleNetworkDelegates: true` already covers most URLSession-based traffic, but this is not documented. TrustKit's swizzling may conflict with complex custom delegates or other swizzling libraries.

## Goals / Non-Goals
- Goals:
  - Cover all standard Android networking stacks (Cronet, OkHttp, WebView, Coil, Glide) with a single platform-level config
  - Expose reusable pinned OkHttp client for native module authors
  - Document iOS URLSession coverage clearly
- Non-Goals:
  - Hook into Glide/Coil programmatically (too fragile); a future optional `react-native-ssl-manager-glide` artifact may provide first-class support
  - Provide built-in Ktor CIO engine support (CIO uses a custom TrustManager; manual integration is documented instead)
  - Change iOS implementation (already working)

## Decisions

### Decision 1: Use Android Network Security Config XML
- **What**: Generate `res/xml/network_security_config.xml` from `ssl_config.json` at build time
- **Why**: Platform-level enforcement covers ALL networking stacks without per-library hooks
- **Alternatives considered**:
  - Per-library hooking (Glide registry, Ktor engine injection) — rejected: fragile, high conflict risk
  - Custom TrustManagerFactory — rejected: doesn't cover Cronet

### Decision 2: Generate XML at build time, not ship it
- **What**: XML is generated during Gradle build / Expo prebuild from `ssl_config.json`
- **Why**: Keeps single source of truth (`ssl_config.json`), avoids config drift

### Decision 3: Merge with existing Network Security Config
- **What**: If app already has `network_security_config.xml`, merge pin-set entries rather than overwrite
- **Why**: Many apps have custom NSC for debug certificates, cleartext traffic, etc.

### Decision 4: Expose PinnedOkHttpClient as opt-in API
- **What**: Public singleton `PinnedOkHttpClient.getInstance(context)` returning configured OkHttpClient
- **Why**: Native module authors (Glide custom modules, Ktor engines) can opt-in to use the same pinned client

### Decision 5: Layered Cronet Strategy
- **What**: Treat Cronet NSC coverage as "best-effort" rather than guaranteed. Document `CronetEngine.Builder.addPublicKeyPins()` as the authoritative Cronet-specific pinning API.
- **Why**: No authoritative documentation confirms Cronet always respects NSC `<pin-set>` directives. Cronet may use its own TLS stack rather than the platform default `TrustManager`. NSC coverage depends on Cronet using the platform default, which is not guaranteed across all configurations.
- **Trade-off**: Less clean marketing story, but more accurate and prevents developer surprise in production.

## Risks / Trade-offs
- **Risk**: App has custom `network_security_config.xml` → **Mitigation**: Detect and merge, don't overwrite. Log warning if existing config found.
- **Risk**: Network Security Config doesn't support runtime toggle (always enforced) → **Mitigation**: Only generate pin-set when SSL pinning is enabled at build time. Runtime toggle continues via OkHttp `CertificatePinner` for RN fetch layer.
- **Risk**: Cronet with custom TrustManager bypasses NSC → **Mitigation**: Document as known limitation (rare edge case).

## Open Questions
- Should XML generation be opt-in (config flag) or always-on when `ssl_config.json` exists?
- Should pin expiration date be configurable or use a sensible default (e.g., 1 year)?
