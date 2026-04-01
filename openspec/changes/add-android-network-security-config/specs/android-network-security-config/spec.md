## ADDED Requirements

### Requirement: XML Generation from SSL Config
The library SHALL generate an Android `network_security_config.xml` file from `ssl_config.json` at build time, containing `<pin-set>` entries for each domain with its SHA-256 public key pins.

#### Scenario: Generate XML from valid ssl_config.json
- **WHEN** `ssl_config.json` contains domains with SHA-256 pins
- **THEN** the library generates `res/xml/network_security_config.xml` with corresponding `<domain-config>` and `<pin-set>` entries
- **AND** each domain has `includeSubdomains="true"`
- **AND** each pin uses `digest="SHA-256"` with the base64-encoded hash (without `sha256/` prefix)

#### Scenario: Generate XML with multiple domains
- **WHEN** `ssl_config.json` contains `api.example.com` with 2 pins and `api.dev.example.com` with 1 pin
- **THEN** the generated XML contains two `<domain-config>` blocks, one for each domain
- **AND** `api.example.com` has two `<pin>` elements and `api.dev.example.com` has one `<pin>` element

#### Scenario: Pin expiration date
- **WHEN** XML is generated
- **THEN** each `<pin-set>` SHALL include an `expiration` attribute
- **AND** the default expiration is 1 year from the build date

#### Scenario: ssl_config.json not found
- **WHEN** `ssl_config.json` does not exist in any expected location
- **THEN** the library SHALL NOT generate XML
- **AND** SHALL log a warning message

### Requirement: Merge with Existing Network Security Config
The library SHALL detect if the app already has a `network_security_config.xml` and merge pin-set entries rather than overwriting the entire file.

#### Scenario: App has existing NSC with debug overrides
- **WHEN** the app has an existing `network_security_config.xml` with `<debug-overrides>`
- **AND** `ssl_config.json` contains pin entries
- **THEN** the library adds `<domain-config>` entries with `<pin-set>` to the existing XML
- **AND** preserves all existing configurations (`<debug-overrides>`, `<base-config>`, other `<domain-config>`)

#### Scenario: App has existing NSC with same domain
- **WHEN** the existing XML already has a `<domain-config>` for `api.example.com`
- **AND** `ssl_config.json` also has pins for `api.example.com`
- **THEN** the library SHALL update the `<pin-set>` for that domain with the new pins
- **AND** log a warning that existing pins were replaced

#### Scenario: No existing NSC
- **WHEN** the app does not have a `network_security_config.xml`
- **THEN** the library creates a new XML file with `<network-security-config>` root element

### Requirement: AndroidManifest Patching
The library SHALL ensure `AndroidManifest.xml` references the generated `network_security_config.xml` via `android:networkSecurityConfig="@xml/network_security_config"` on the `<application>` element.

#### Scenario: Manifest without NSC reference
- **WHEN** the `<application>` element does not have `android:networkSecurityConfig`
- **THEN** the library adds `android:networkSecurityConfig="@xml/network_security_config"` to it

#### Scenario: Manifest with existing NSC reference
- **WHEN** the `<application>` element already has `android:networkSecurityConfig`
- **THEN** the library SHALL NOT modify the manifest
- **AND** SHALL log that existing reference was preserved

### Requirement: Platform-Level Coverage
When Network Security Config is active, the following Android networking stacks SHALL be covered by SSL pinning without any additional per-library configuration:

- OkHttp (React Native fetch/axios)
- Cronet (react-native-nitro-fetch) — best-effort; depends on Cronet using the platform default TrustManager
- Android WebView
- Coil/Ktor with OkHttp engine (react-native-nitro-image)
- Glide/OkHttp3 (react-native-fast-image)
- HttpURLConnection
- Any stack using the platform default TrustManager

#### Scenario: Cronet request with valid pin (best-effort)
- **WHEN** Network Security Config is active with pins for `api.example.com`
- **AND** a Cronet-based library makes an HTTPS request to `api.example.com`
- **AND** Cronet is using the platform default TrustManager
- **AND** the server certificate matches a configured pin
- **THEN** the request succeeds

#### Scenario: Cronet request with invalid pin (best-effort)
- **WHEN** Network Security Config is active with pins for `api.example.com`
- **AND** a Cronet-based library makes an HTTPS request to `api.example.com`
- **AND** Cronet is using the platform default TrustManager
- **AND** the server certificate does NOT match any configured pin
- **THEN** the request fails with an SSL/TLS error

#### Scenario: Cronet with custom TLS — not guaranteed
- **WHEN** Network Security Config is active with pins for `api.example.com`
- **AND** a Cronet-based library is configured with a custom TLS stack or custom `TrustManager`
- **THEN** Network Security Config pin enforcement is NOT guaranteed
- **AND** developers SHOULD use `CronetEngine.Builder.addPublicKeyPins()` for authoritative Cronet pinning

#### Scenario: Coil image load with valid pin
- **WHEN** Network Security Config is active with pins for `images.example.com`
- **AND** Coil (via OkHttp engine) loads an image from `https://images.example.com/photo.jpg`
- **AND** the server certificate matches a configured pin
- **THEN** the image loads successfully

#### Scenario: Coil image load with invalid pin
- **WHEN** Network Security Config is active with pins for `images.example.com`
- **AND** Coil loads an image from `https://images.example.com/photo.jpg`
- **AND** the server certificate does NOT match any configured pin
- **THEN** the image load fails with an SSL/TLS error

#### Scenario: Glide image load with valid pin
- **WHEN** Network Security Config is active with pins for `cdn.example.com`
- **AND** Glide (via OkHttp3) loads an image from `https://cdn.example.com/image.png`
- **AND** the server certificate matches a configured pin
- **THEN** the image loads successfully

#### Scenario: Glide image load with invalid pin
- **WHEN** Network Security Config is active with pins for `cdn.example.com`
- **AND** Glide loads an image from `https://cdn.example.com/image.png`
- **AND** the server certificate does NOT match any configured pin
- **THEN** the image load fails with an SSL/TLS error

#### Scenario: WebView request with valid pin
- **WHEN** Network Security Config is active with pins for `web.example.com`
- **AND** an Android WebView loads `https://web.example.com/page`
- **AND** the server certificate matches a configured pin
- **THEN** the page loads successfully

#### Scenario: Known limitation — custom TrustManager
- **WHEN** a library builds Cronet or OkHttp with a custom `TrustManager` that bypasses the system default
- **THEN** Network Security Config MAY be bypassed
- **AND** this is a documented limitation
