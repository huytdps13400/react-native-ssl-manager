# Change: Add Android Network Security Config and public pinned client API

## Why
Currently, Android SSL pinning only hooks into React Native's networking layer via `OkHttpClientFactory`. Libraries using their own HTTP clients (Cronet via nitro-fetch, Coil/Ktor via nitro-image, Glide/OkHttp3 via FastImage) completely bypass SSL pinning. On iOS, TrustKit already swizzles all URLSession delegates, covering all networking stacks — but this is not documented clearly.

## What Changes
- **Android Network Security Config XML generation**: Auto-generate `res/xml/network_security_config.xml` from `ssl_config.json` at build time, covering Cronet, OkHttp, WebView, Coil, Glide, and all platform-level networking
- **Expo plugin update**: Add XML generation + AndroidManifest patching to Expo plugin prebuild
- **Postinstall update**: Add XML generation for React Native CLI projects
- **Public PinnedOkHttpClient API**: Expose a singleton pinned OkHttp client for native modules to reuse
- **iOS documentation**: Document that URLSession/SDWebImage/Alamofire are already covered via TrustKit swizzling

## Impact
- Affected specs: `ssl-configuration`, `expo-plugin`, `platform-native` (from baseline)
- Affected code:
  - `app.plugin.js` — Expo plugin (add XML generation)
  - `scripts/postinstall.js` — CLI auto-setup (add XML generation)
  - `android/src/main/java/com/usesslpinning/PinnedOkHttpClient.kt` — new public API
  - `android/src/main/res/xml/` — generated at build time, not shipped
- **NOT affected**: iOS native code (already works), JS API surface (no changes)

## Scope Limitations
- **Will NOT** auto-hook Glide registry (conflict risk with custom GlideModule)
- **Will NOT** support Ktor CIO engine (niche, requires custom TrustManager)
- **Will NOT** add iOS method swizzling (already done by TrustKit)
