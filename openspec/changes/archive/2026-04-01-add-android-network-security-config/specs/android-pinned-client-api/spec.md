## ADDED Requirements

### Requirement: Public Pinned OkHttpClient Singleton
The library SHALL expose a public `PinnedOkHttpClient` object with a `getInstance(context: Context): OkHttpClient` method that returns an OkHttpClient configured with certificate pinning from `ssl_config.json`.

#### Scenario: Get pinned client when SSL pinning enabled
- **WHEN** SSL pinning is enabled
- **AND** a native module calls `PinnedOkHttpClient.getInstance(context)`
- **THEN** an OkHttpClient with `CertificatePinner` configured from `ssl_config.json` is returned
- **AND** the client is a singleton (same instance on repeated calls)

#### Scenario: Get client when SSL pinning disabled
- **WHEN** SSL pinning is disabled
- **AND** a native module calls `PinnedOkHttpClient.getInstance(context)`
- **THEN** a plain OkHttpClient without certificate pinning is returned

#### Scenario: Config change invalidates singleton
- **WHEN** `setUseSSLPinning` is called to change the pinning state
- **AND** `PinnedOkHttpClient.getInstance(context)` is called after
- **THEN** a new client reflecting the updated pinning state is returned

### Requirement: Glide Integration Documentation
The library SHALL document how to integrate the pinned OkHttpClient with Glide via a custom `AppGlideModule`.

#### Scenario: Glide integration example
- **WHEN** a developer reads the integration documentation
- **THEN** they find a code example showing how to create a `@GlideModule` that uses `PinnedOkHttpClient.getInstance(context)` as the OkHttp integration for Glide

### Requirement: Coil/Ktor Integration Documentation
The library SHALL document how to use the pinned OkHttpClient with Coil's `ImageLoader` and Ktor's OkHttp engine.

#### Scenario: Coil integration example
- **WHEN** a developer reads the integration documentation
- **THEN** they find a code example showing how to build a Coil `ImageLoader` with `PinnedOkHttpClient.getInstance(context)` as the `okHttpClient`

#### Scenario: Ktor OkHttp engine example
- **WHEN** a developer reads the integration documentation
- **THEN** they find a code example showing how to configure Ktor's `OkHttp` engine with `PinnedOkHttpClient.getInstance(context)` as the `preconfigured` client

### Requirement: Ktor CIO Engine Documentation
The library SHALL document how to manually configure SSL pinning with Ktor's CIO engine using a custom `TrustManager`, since CIO does not use OkHttp and is not covered by Network Security Config or `PinnedOkHttpClient`.

#### Scenario: Ktor CIO engine manual pinning example
- **WHEN** a developer reads the integration documentation
- **THEN** they find a code example showing how to configure Ktor's `CIO` engine with a custom `TrustManagerFactory` that validates certificate pins from `ssl_config.json`
- **AND** the example includes the necessary Kotlin imports and API calls
