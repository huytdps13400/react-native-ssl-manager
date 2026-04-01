## ADDED Requirements

### Requirement: iOS Networking Stack Coverage Documentation
The library SHALL document in the README that the iOS implementation (via TrustKit with `kTSKSwizzleNetworkDelegates: true`) automatically covers most URLSession-based networking stacks without additional configuration.

#### Scenario: README lists supported iOS stacks
- **WHEN** a developer reads the README "Supported Networking Stacks" section
- **THEN** they find that the following iOS stacks are covered:
  - `fetch` (React Native networking)
  - `URLSession` (Foundation)
  - `SDWebImage`
  - `Alamofire`
  - Any library using `URLSession` under the hood

#### Scenario: README lists iOS limitations
- **WHEN** a developer reads the README
- **THEN** they find that custom TLS stacks not using `URLSession` are NOT covered
- **AND** this is clearly marked as a known limitation

#### Scenario: Complex delegate or swizzling conflict limitation
- **WHEN** a developer reads the README
- **THEN** they find that apps with complex custom `URLSessionDelegate` implementations or other swizzling libraries may experience conflicts with TrustKit's swizzling
- **AND** this is clearly marked as a known limitation

### Requirement: Supported Stacks Summary Table
The README SHALL include a summary table showing which networking stacks are covered on each platform and by which mechanism.

#### Scenario: Platform coverage table in README
- **WHEN** a developer reads the "Supported Networking Stacks" section
- **THEN** they find a table with columns: Stack, Platform, Covered, Mechanism
- **AND** the table includes entries for: OkHttp, Cronet, WebView, Coil, Glide, URLSession, SDWebImage, Alamofire
