## ADDED Requirements

### Requirement: Configuration File Format
The library SHALL read SSL pinning configuration from a JSON file with the following structure:
- A required `sha256Keys` object mapping domain hostnames to arrays of SHA-256 certificate pin strings
- An optional `domains` object mapping environment names to domain hostnames
- Each pin string MUST follow the format `sha256/<base64-encoded-hash>=` with a 44-character base64 value

#### Scenario: Valid configuration with multiple domains
- **WHEN** the configuration file contains multiple domains under `sha256Keys`
- **AND** each domain has at least one valid SHA-256 pin
- **THEN** the library initializes SSL pinning for all listed domains

#### Scenario: Invalid pin format rejected
- **WHEN** a pin string does not match the `sha256/<base64>` format or has incorrect length
- **THEN** the library SHALL reject the configuration with a validation error

### Requirement: Configuration File Naming and Placement
The configuration file MUST be named exactly `ssl_config.json` and placed in the project root directory (same level as `package.json` or `app.json`).

#### Scenario: Config file in project root
- **WHEN** `ssl_config.json` exists in the project root
- **THEN** the library locates and reads the configuration during initialization

#### Scenario: Config file missing
- **WHEN** `ssl_config.json` is not found in the expected location
- **THEN** the library SHALL fall back gracefully without crashing

### Requirement: Native Bundle Inclusion
On iOS, the configuration file SHALL be included in the app bundle. On Android, it SHALL be placed in the assets directory so it is accessible at runtime.

#### Scenario: iOS bundle access
- **WHEN** the app launches on iOS
- **THEN** the native layer reads `ssl_config.json` from the main bundle

#### Scenario: Android assets access
- **WHEN** the app launches on Android
- **THEN** the native layer reads `ssl_config.json` from the assets directory
