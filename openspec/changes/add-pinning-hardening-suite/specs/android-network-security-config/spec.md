## MODIFIED Requirements

### Requirement: XML Generation from SSL Config

The library SHALL generate an Android `network_security_config.xml` file from
`ssl_config.json` at build time, containing `<pin-set>` entries for each
enforced domain with its SHA-256 public key pins. Domains configured with
`enforcePinning: false` (audit mode) SHALL NOT receive a `<pin-set>` (NSC has
no report-only mode; audit validation happens in the OkHttp layer). A
`domains.<host>.expirationDate` SHALL be emitted as the `expiration`
attribute on that domain's `<pin-set>`; when absent, the `pin-set` carries no
expiration. `includeSubdomains` on the `<domain>` element SHALL reflect
`domains.<host>.includeSubdomains` (default `true`).

#### Scenario: Generate XML from valid ssl_config.json

- **WHEN** `ssl_config.json` contains domains with SHA-256 pins
- **THEN** the library generates `res/xml/network_security_config.xml` with
  corresponding `<domain-config>` and `<pin-set>` entries
- **AND** each domain defaults to `includeSubdomains="true"`
- **AND** each pin uses `digest="SHA-256"` with the base64-encoded hash
  (without `sha256/` prefix)

#### Scenario: Generate XML with multiple domains

- **WHEN** `ssl_config.json` contains `api.example.com` with 2 pins and
  `api.dev.example.com` with 1 pin
- **THEN** the generated XML contains two `<domain-config>` blocks, one for
  each domain
- **AND** `api.example.com` has two `<pin>` elements and `api.dev.example.com`
  has one `<pin>` element

#### Scenario: Audit-mode domain excluded from pin-set

- **WHEN** `domains["api.example.com"].enforcePinning` is `false`
- **THEN** the generated XML contains no `<pin-set>` for `api.example.com`

#### Scenario: Configured expiration emitted

- **WHEN** `domains["api.example.com"].expirationDate` is `2027-06-30`
- **THEN** that domain's `<pin-set>` carries `expiration="2027-06-30"`

#### Scenario: No default expiration

- **WHEN** no `expirationDate` is configured for a domain
- **THEN** that domain's `<pin-set>` has no `expiration` attribute (pins do
  not silently fail open)

#### Scenario: ssl_config.json not found

- **WHEN** `ssl_config.json` does not exist in any expected location
- **THEN** the library SHALL NOT generate XML
- **AND** SHALL log a warning message
