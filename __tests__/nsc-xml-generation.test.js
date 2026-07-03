const { generateNscXml, mergeNscXml } = require('../scripts/nsc-utils');

describe('Network Security Config XML Generation', () => {
  describe('generateNscXml', () => {
    it('generates valid XML from a single domain with one pin', () => {
      const sha256Keys = {
        'api.example.com': [
          'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        ],
      };

      const xml = generateNscXml(sha256Keys);

      expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(xml).toContain('<network-security-config>');
      expect(xml).toContain('</network-security-config>');
      expect(xml).toContain(
        '<domain-config cleartextTrafficPermitted="false">'
      );
      expect(xml).toContain(
        '<domain includeSubdomains="true">api.example.com</domain>'
      );
      expect(xml).toContain(
        '<pin digest="SHA-256">AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>'
      );
      // sha256/ prefix should be stripped
      expect(xml).not.toContain('sha256/');
    });

    it('generates XML with multiple domains and multiple pins', () => {
      const sha256Keys = {
        'api.example.com': [
          'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
        ],
        'api.dev.example.com': [
          'sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
        ],
      };

      const xml = generateNscXml(sha256Keys);

      // Two pinned domain-config blocks plus the dev cleartext block
      const domainConfigCount = (xml.match(/<domain-config/g) || []).length;
      expect(domainConfigCount).toBe(3);

      // api.example.com has 2 pins
      expect(xml).toContain('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
      expect(xml).toContain('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=');

      // api.dev.example.com has 1 pin
      expect(xml).toContain(
        '<domain includeSubdomains="true">api.dev.example.com</domain>'
      );
      expect(xml).toContain('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=');
    });

    it('emits a pin-set with no expiration (pins never silently stop enforcing)', () => {
      const sha256Keys = {
        'api.example.com': [
          'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        ],
      };

      const xml = generateNscXml(sha256Keys);

      // A `pin-set expiration` would make Android silently stop enforcing pins
      // after the date (a build-time fail-open), so it must NOT be present.
      expect(xml).toContain('<pin-set>');
      expect(xml).not.toMatch(/expiration=/);
    });

    it('strips sha256/ prefix from pins', () => {
      const sha256Keys = {
        'api.example.com': ['sha256/ABC123='],
      };

      const xml = generateNscXml(sha256Keys);

      expect(xml).toContain('<pin digest="SHA-256">ABC123=</pin>');
      expect(xml).not.toContain('sha256/ABC123=');
    });

    it('handles pins without sha256/ prefix gracefully', () => {
      const sha256Keys = {
        'api.example.com': ['RAWPIN123='],
      };

      const xml = generateNscXml(sha256Keys);

      expect(xml).toContain('<pin digest="SHA-256">RAWPIN123=</pin>');
    });
  });

  describe('mergeNscXml', () => {
    const existingXmlWithDebugOverrides = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <debug-overrides>
        <trust-anchors>
            <certificates src="user" />
        </trust-anchors>
    </debug-overrides>
    <base-config cleartextTrafficPermitted="false" />
</network-security-config>`;

    it('preserves existing debug-overrides and base-config when merging', () => {
      const sha256Keys = {
        'api.example.com': [
          'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        ],
      };

      const merged = mergeNscXml(existingXmlWithDebugOverrides, sha256Keys);

      // Existing elements preserved
      expect(merged).toContain('<debug-overrides>');
      expect(merged).toContain('<trust-anchors>');
      expect(merged).toContain('<certificates src="user" />');
      expect(merged).toContain(
        '<base-config cleartextTrafficPermitted="false" />'
      );

      // New domain-config added
      expect(merged).toContain(
        '<domain includeSubdomains="true">api.example.com</domain>'
      );
      expect(merged).toContain('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    });

    it('replaces pin-set for an already-existing domain', () => {
      const existingXmlWithDomain = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.example.com</domain>
        <pin-set expiration="2025-01-01">
            <pin digest="SHA-256">OLDPIN=</pin>
        </pin-set>
    </domain-config>
</network-security-config>`;

      const sha256Keys = {
        'api.example.com': ['sha256/NEWPIN='],
      };

      const merged = mergeNscXml(existingXmlWithDomain, sha256Keys);

      // Old pin should be gone
      expect(merged).not.toContain('OLDPIN=');
      // New pin should be present
      expect(merged).toContain('NEWPIN=');
      // Domain still present
      expect(merged).toContain('api.example.com');
    });

    it('adds new domain without affecting existing domains', () => {
      const existingXmlWithDomain = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">existing.example.com</domain>
        <pin-set expiration="2025-01-01">
            <pin digest="SHA-256">EXISTINGPIN=</pin>
        </pin-set>
    </domain-config>
</network-security-config>`;

      const sha256Keys = {
        'new.example.com': ['sha256/NEWPIN='],
      };

      const merged = mergeNscXml(existingXmlWithDomain, sha256Keys);

      // Existing domain preserved
      expect(merged).toContain('existing.example.com');
      expect(merged).toContain('EXISTINGPIN=');
      // New domain added
      expect(merged).toContain('new.example.com');
      expect(merged).toContain('NEWPIN=');

      // Two pinned domain-config blocks plus the injected dev cleartext block
      const domainConfigCount = (merged.match(/<domain-config/g) || []).length;
      expect(domainConfigCount).toBe(3);
    });
  });

  describe('dev cleartext config (issue #9)', () => {
    it('generateNscXml includes a cleartext localhost domain-config', () => {
      const xml = generateNscXml({
        'api.example.com': ['sha256/AAA='],
      });

      expect(xml).toContain(
        '<domain-config cleartextTrafficPermitted="true">'
      );
      expect(xml).toContain(
        '<domain includeSubdomains="false">localhost</domain>'
      );
      expect(xml).toContain(
        '<domain includeSubdomains="false">10.0.2.2</domain>'
      );
      expect(xml).toContain(
        '<domain includeSubdomains="false">10.0.3.2</domain>'
      );
      // The pinned domain still enforces its pins.
      expect(xml).toContain(
        '<domain includeSubdomains="true">api.example.com</domain>'
      );
    });

    it('generateNscXml emits exactly one dev cleartext block', () => {
      const xml = generateNscXml({
        'api.example.com': ['sha256/AAA='],
        'api.other.com': ['sha256/BBB='],
      });

      const cleartextBlocks = (
        xml.match(/cleartextTrafficPermitted="true"/g) || []
      ).length;
      expect(cleartextBlocks).toBe(1);
    });

    it('mergeNscXml injects the dev cleartext block when absent', () => {
      const existing = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
</network-security-config>`;

      const merged = mergeNscXml(existing, {
        'api.example.com': ['sha256/AAA='],
      });

      expect(merged).toContain('cleartextTrafficPermitted="true"');
      expect(merged).toContain(
        '<domain includeSubdomains="false">localhost</domain>'
      );
    });

    it('mergeNscXml does not duplicate an existing localhost cleartext block', () => {
      const existing = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>`;

      const merged = mergeNscXml(existing, {
        'api.example.com': ['sha256/AAA='],
      });

      const cleartextBlocks = (
        merged.match(/cleartextTrafficPermitted="true"/g) || []
      ).length;
      expect(cleartextBlocks).toBe(1);
    });
  });
});
