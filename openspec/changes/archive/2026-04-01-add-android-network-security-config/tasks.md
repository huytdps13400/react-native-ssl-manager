## 1. Android Network Security Config Generation
- [x] 1.1 Create utility function to convert `ssl_config.json` → `network_security_config.xml` format
- [x] 1.2 Add XML generation to `ssl-pinning-setup.gradle` (runs before `mergeAssets`)
- [x] 1.3 Add merge logic: detect existing `network_security_config.xml` and merge `<pin-set>` entries
- [x] 1.4 Patch `AndroidManifest.xml` to reference `@xml/network_security_config` if not already present
- [x] 1.5 Add configurable pin expiration date (default: 1 year from build)

## 2. Expo Plugin Update
- [x] 2.1 Add `withAndroidNetworkSecurityConfig` modifier to `app.plugin.js`
- [x] 2.2 Generate XML during prebuild from `ssl_config.json`
- [x] 2.3 Merge with existing NSC if present
- [x] 2.4 Auto-patch AndroidManifest via `withAndroidManifest` modifier

## 3. Postinstall Update (RN CLI)
- [x] 3.1 Add XML generation to `scripts/postinstall.js` for RN CLI projects
- [x] 3.2 Detect and merge existing `network_security_config.xml`

## 4. Public PinnedOkHttpClient API
- [x] 4.1 Create `PinnedOkHttpClient.kt` singleton exposing `getInstance(context): OkHttpClient`
- [x] 4.2 Reuse existing `SslPinningFactory` pin configuration logic
- [x] 4.3 Document integration for Glide/Coil/Ktor in README

## 5. iOS Documentation
- [x] 5.1 Update README: document that TrustKit swizzling covers URLSession, SDWebImage, Alamofire
- [x] 5.2 Add "Supported Networking Stacks" section to README

## 6. Testing & Validation
- [x] 6.1 Unit test: XML generation from various `ssl_config.json` inputs
- [x] 6.2 Unit test: XML merge with existing NSC
- [x] 6.3 Unit test: PinnedOkHttpClient singleton returns configured client
- [x] 6.4 Integration test: Cronet request with valid pin succeeds
- [x] 6.5 Integration test: Cronet request with invalid pin fails
- [x] 6.6 Integration test: Coil image load with valid pin succeeds
- [x] 6.7 Integration test: Glide image load with valid pin succeeds
- [x] 6.8 E2E test: Expo prebuild generates correct XML and manifest
- [x] 6.9 E2E test: RN CLI postinstall generates correct XML
- [x] 6.10 Validate with `openspec validate add-android-network-security-config --strict`
