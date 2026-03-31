## ADDED Requirements

### Requirement: New Architecture Support
The library SHALL support React Native's New Architecture (Fabric/TurboModules) on React Native 0.68+ by providing a TurboModule specification via codegen and conditional native compilation.

#### Scenario: TurboModule loads on New Architecture
- **WHEN** the host app has New Architecture enabled
- **THEN** the library registers as a TurboModule and exposes `setUseSSLPinning` and `getUseSSLPinning` through the TurboModule interface

### Requirement: Legacy Architecture Support
The library SHALL support React Native's Legacy Architecture (Bridge-based) by providing a standard native module with `@ReactMethod` (Android) and `RCT_EXPORT_METHOD` (iOS) bindings.

#### Scenario: Bridge module loads on Legacy Architecture
- **WHEN** the host app uses Legacy Architecture
- **THEN** the library registers as a bridge-based native module and exposes `setUseSSLPinning` and `getUseSSLPinning` through `NativeModules`

### Requirement: Automatic Architecture Detection
The JavaScript layer SHALL automatically detect the active architecture at runtime and use the appropriate native module interface without requiring manual configuration by the consumer.

#### Scenario: Auto-detection selects correct module
- **WHEN** the library is imported in a React Native app
- **THEN** it first attempts to load via TurboModule registry
- **AND** falls back to `NativeModules` if TurboModule is unavailable
