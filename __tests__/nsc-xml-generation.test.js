const { generateNscXml, mergeNscXml } = require('../scripts/nsc-utils');

describe('Network Security Config XML Generation', () => {
  describe('generateNscXml', () => {
    it('generates valid XML from a single domain with one pin', () => {
      const sha256Keys = {
        'api.example.com': ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='],
      };

      const xml = generateNscXml(sha256Keys);

      expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(xml).toContain('<network-security-config>');
      expect(xml).toContain('</network-security-config>');
      expect(xml).toContain('<domain-config cleartextTrafficPermitted="false">');
      expect(xml).toContain(
        '<domain includeSubdomains="true">api.example.com</domain>'
      );
      expect(xml).toContain('<pin digest="SHA-256">AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>');
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

      // Two domain-config blocks
      const domainConfigCount = (xml.match(/<domain-config/g) || []).length;
      expect(domainConfigCount).toBe(2);

      // api.example.com has 2 pins
      expect(xml).toContain('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
      expect(xml).toContain('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=');

      // api.dev.example.com has 1 pin
      expect(xml).toContain(
        '<domain includeSubdomains="true">api.dev.example.com</domain>'
      );
      expect(xml).toContain('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=');
    });

    it('includes expiration date in YYYY-MM-DD format', () => {
      const sha256Keys = {
        'api.example.com': ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='],
      };

      const xml = generateNscXml(sha256Keys);

      // Should have expiration attribute matching YYYY-MM-DD
      const expirationMatch = xml.match(/expiration="(\d{4}-\d{2}-\d{2})"/);
      expect(expirationMatch).not.toBeNull();

      // Expiration should be ~1 year from now
      const expDate = new Date(expirationMatch[1]);
      const now = new Date();
      const diffMs = expDate.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(360);
      expect(diffDays).toBeLessThan(370);
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
        'api.example.com': ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='],
      };

      const merged = mergeNscXml(existingXmlWithDebugOverrides, sha256Keys);

      // Existing elements preserved
      expect(merged).toContain('<debug-overrides>');
      expect(merged).toContain('<trust-anchors>');
      expect(merged).toContain('<certificates src="user" />');
      expect(merged).toContain('<base-config cleartextTrafficPermitted="false" />');

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

      // Two domain-config blocks
      const domainConfigCount = (merged.match(/<domain-config/g) || []).length;
      expect(domainConfigCount).toBe(2);
    });
  });
});
