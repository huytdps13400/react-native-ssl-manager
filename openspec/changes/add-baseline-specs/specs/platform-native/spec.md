## ADDED Requirements

### Requirement: iOS SSL Pinning via TrustKit
The iOS native implementation SHALL use the TrustKit framework to perform SSL certificate pinning. It SHALL configure TrustKit with domains and SHA-256 pins from `ssl_config.json`, enabling subdomain pinning and pin enforcement.

#### Scenario: TrustKit configured on initialization
- **WHEN** SSL pinning is enabled and the app initializes on iOS
- **THEN** TrustKit is configured with the domains and pins from the bundled `ssl_config.json`
- **AND** HTTPS connections to pinned domains are validated against the configured pins

#### Scenario: Pinned request succeeds with valid certificate
- **WHEN** an HTTPS request is made to a pinned domain
- **AND** the server certificate matches a configured SHA-256 pin
- **THEN** the request succeeds

#### Scenario: Pinned request fails with invalid certificate
- **WHEN** an HTTPS request is made to a pinned domain
- **AND** the server certificate does not match any configured SHA-256 pin
- **THEN** the request fails with an SSL handshake error

### Requirement: Android SSL Pinning via OkHttp
The Android native implementation SHALL use OkHttp's `CertificatePinner` to perform SSL certificate pinning. It SHALL build a custom `OkHttpClient` with pins from `ssl_config.json` and intercept HTTP requests through a factory pattern.

#### Scenario: OkHttp configured on initialization
- **WHEN** SSL pinning is enabled and the app initializes on Android
- **THEN** a custom `OkHttpClient` is created with `CertificatePinner` configured from the assets `ssl_config.json`
- **AND** HTTPS connections to pinned domains are validated against the configured pins

#### Scenario: Pinned request succeeds with valid certificate
- **WHEN** an HTTPS request is made to a pinned domain on Android
- **AND** the server certificate matches a configured SHA-256 pin
- **THEN** the request succeeds

#### Scenario: Pinned request fails with invalid certificate
- **WHEN** an HTTPS request is made to a pinned domain on Android
- **AND** the server certificate does not match any configured SHA-256 pin
- **THEN** the request fails with a certificate pinning error

### Requirement: Native State Persistence
The native layer SHALL persist the SSL pinning enabled/disabled state using platform-appropriate storage: `UserDefaults` on iOS and `SharedPreferences` on Android (under the `AppSettings` context).

#### Scenario: iOS state persisted in UserDefaults
- **WHEN** `setUseSSLPinning` is called on iOS
- **THEN** the boolean value is stored in `UserDefaults`
- **AND** survives app restarts

#### Scenario: Android state persisted in SharedPreferences
- **WHEN** `setUseSSLPinning` is called on Android
- **THEN** the boolean value is stored in `SharedPreferences`
- **AND** survives app restarts
