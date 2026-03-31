## ADDED Requirements

### Requirement: Expo Plugin Registration
The library SHALL provide an Expo config plugin that can be registered in `app.json` or `app.config.js` under the `plugins` array, accepting an optional `sslConfigPath` parameter (default: `ssl_config.json`).

#### Scenario: Plugin with default config path
- **WHEN** the plugin is added as `["react-native-ssl-manager"]` without options
- **THEN** the plugin uses `ssl_config.json` from the project root

#### Scenario: Plugin with custom config path
- **WHEN** the plugin is added as `["react-native-ssl-manager", { "sslConfigPath": "./custom/path.json" }]`
- **THEN** the plugin uses the specified path for the SSL configuration file

### Requirement: iOS Auto-Configuration
The Expo plugin SHALL automatically add the `ssl_config.json` file to the iOS Xcode project bundle resources during prebuild.

#### Scenario: iOS prebuild copies config
- **WHEN** `npx expo prebuild` runs on an Expo project with the plugin enabled
- **THEN** the SSL config file is added to the Xcode project as a bundle resource

### Requirement: Android Auto-Configuration
The Expo plugin SHALL automatically copy the `ssl_config.json` file to the Android `assets` directory and ensure the INTERNET permission is present in `AndroidManifest.xml` during prebuild.

#### Scenario: Android prebuild copies config and sets permission
- **WHEN** `npx expo prebuild` runs on an Expo project with the plugin enabled
- **THEN** the SSL config file is copied to `android/app/src/main/assets/`
- **AND** the `INTERNET` permission is present in the Android manifest
