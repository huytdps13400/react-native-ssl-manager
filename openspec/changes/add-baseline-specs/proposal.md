# Change: Add baseline specs for existing library capabilities

## Why
The react-native-ssl-manager library is production-ready with established features (SSL pinning API, JSON configuration, Expo plugin, dual-architecture support, cross-platform native implementations) but has no OpenSpec specs documenting its behavior. Adding baseline specs enables spec-driven development for future changes.

## What Changes
- Add `ssl-pinning-api` spec: documents the core JS API (`setUseSSLPinning`, `getUseSSLPinning`)
- Add `ssl-configuration` spec: documents the `ssl_config.json` format, placement, and validation rules
- Add `expo-plugin` spec: documents the Expo plugin auto-configuration behavior
- Add `architecture-support` spec: documents New Architecture (TurboModule) and Legacy Architecture support
- Add `platform-native` spec: documents iOS (TrustKit) and Android (OkHttp) native SSL pinning implementations

## Impact
- Affected specs: none (all new baseline specs)
- Affected code: none (documentation of existing behavior only)
