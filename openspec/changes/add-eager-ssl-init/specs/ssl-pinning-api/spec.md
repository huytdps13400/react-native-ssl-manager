## ADDED Requirements

### Requirement: Eager initialization at app launch

SSL pinning SHALL be initialized at application launch without requiring any
JavaScript call, on both iOS and Android, whenever pinning is enabled and a
valid configuration is available.

#### Scenario: iOS pins enforced without a JS call

- **WHEN** an app bundles `ssl_config.json` and never calls a JS method from this module
- **THEN** TrustKit is initialized at launch and pinned connections are enforced

#### Scenario: Android pins enforced without a JS call

- **WHEN** an app bundles `ssl_config.json` and never calls a JS method from this module
- **THEN** the pinned `OkHttpClientFactory` is installed before the React Native bridge starts and pinned connections are enforced

### Requirement: TrustKit initialized at most once per process

The iOS implementation SHALL initialize TrustKit at most once per process and
SHALL NOT crash if initialization is requested again.

#### Scenario: Repeated initialization is safe

- **WHEN** initialization is triggered by both the launch bootstrap and a later JS call
- **THEN** TrustKit is configured exactly once and no exception is raised

#### Scenario: Disabling at runtime on iOS

- **WHEN** `setUseSSLPinning(false)` is called after TrustKit has initialized
- **THEN** the preference is stored and the change takes effect on the next app launch

### Requirement: Runtime configuration API

The module SHALL expose `setSSLConfig(config)` to update pins at runtime and
`getPinnedDomains()` to retrieve the currently configured domains.

#### Scenario: Update configuration at runtime

- **WHEN** `setSSLConfig` is called with a valid configuration
- **THEN** the configuration is persisted and used for subsequent pinning

#### Scenario: Query configured domains

- **WHEN** `getPinnedDomains()` is called
- **THEN** it resolves with the list of domains in the active configuration

### Requirement: Failures surfaced to JavaScript

Native failures (invalid configuration, missing config) SHALL reject the
corresponding JavaScript promise with an error code rather than resolving
silently.

#### Scenario: Invalid configuration rejects

- **WHEN** `setSSLConfig` receives malformed JSON
- **THEN** the returned promise rejects with an error code

#### Scenario: Missing native module warns

- **WHEN** the native module is unavailable and a JS method is called
- **THEN** a warning is emitted so the no-op is not mistaken for active pinning
