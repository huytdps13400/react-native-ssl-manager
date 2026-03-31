## ADDED Requirements

### Requirement: Set SSL Pinning State
The library SHALL export a `setUseSSLPinning(usePinning: boolean): Promise<void>` function that enables or disables SSL certificate pinning at runtime by persisting the state to native storage (UserDefaults on iOS, SharedPreferences on Android).

#### Scenario: Enable SSL pinning
- **WHEN** `setUseSSLPinning(true)` is called
- **THEN** the SSL pinning state is persisted as enabled
- **AND** the promise resolves without error

#### Scenario: Disable SSL pinning
- **WHEN** `setUseSSLPinning(false)` is called
- **THEN** the SSL pinning state is persisted as disabled
- **AND** the promise resolves without error

#### Scenario: App restart required
- **WHEN** the SSL pinning state is changed via `setUseSSLPinning`
- **THEN** the change SHALL take effect only after an application restart, because SSL pinning is configured at the native networking layer

### Requirement: Get SSL Pinning State
The library SHALL export a `getUseSSLPinning(): Promise<boolean>` function that returns the current SSL pinning state from native storage.

#### Scenario: Retrieve enabled state
- **WHEN** SSL pinning was previously set to `true`
- **AND** `getUseSSLPinning()` is called
- **THEN** the promise resolves with `true`

#### Scenario: Retrieve disabled state
- **WHEN** SSL pinning was previously set to `false`
- **AND** `getUseSSLPinning()` is called
- **THEN** the promise resolves with `false`

### Requirement: TypeScript Type Exports
The library SHALL export the following TypeScript types:
- `SslPinningConfig`: an interface with a `sha256Keys` property mapping domain strings to arrays of SHA-256 pin strings
- `SslPinningError`: an interface extending `Error` with an optional `code` property

#### Scenario: Type availability
- **WHEN** a consumer imports types from `react-native-ssl-manager`
- **THEN** `SslPinningConfig` and `SslPinningError` types are available for use
