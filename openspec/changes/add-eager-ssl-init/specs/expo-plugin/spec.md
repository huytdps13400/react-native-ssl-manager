## ADDED Requirements

### Requirement: Configurable pin expiration

The Expo config plugin and build scripts SHALL allow the Network Security Config
pin-set `expiration` to be configured, defaulting to one year from the build
date when not specified.

#### Scenario: Custom expiration via plugin option

- **WHEN** the plugin is configured with `pinExpiration: "2027-12-31"`
- **THEN** the generated `network_security_config.xml` uses that expiration date

#### Scenario: Default expiration

- **WHEN** no expiration is configured
- **THEN** the generated `network_security_config.xml` expires one year from the build date

### Requirement: Robust Xcode project integration

The Expo config plugin SHALL add `ssl_config.json` to the iOS Xcode project
using the Xcode project API rather than regex string manipulation of
`project.pbxproj`.

#### Scenario: Resource added once

- **WHEN** prebuild runs and `ssl_config.json` is present
- **THEN** the file is added to the app target's resources exactly once and prebuild does not fail
