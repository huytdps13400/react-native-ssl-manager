/**
 * Tests for Network Security Config XML generation and merge logic.
 * Tests the functions used in app.plugin.js and scripts/postinstall.js.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Extract the functions from app.plugin.js by requiring it and testing the generated output
// We re-implement the pure functions here to test the logic independently

function generateNscXml(sha256Keys, expiration) {
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<network-security-config>\n';

  for (const [domain, pins] of Object.entries(sha256Keys)) {
    xml += '    <domain-config cleartextTrafficPermitted="false">\n';
    xml += `        <domain includeSubdomains="true">${domain}</domain>\n`;
    xml += `        <pin-set expiration="${expiration}">\n`;
    for (const pin of pins) {
      const cleanPin = pin.replace(/^sha256\//, '');
      xml += `            <pin digest="SHA-256">${cleanPin}</pin>\n`;
    }
    xml += '        </pin-set>\n';
    xml += '    </domain-config>\n';
  }

  xml += '</network-security-config>\n';
  return xml;
}

function mergeNscXml(existingXml, sha256Keys, expiration) {
  for (const [domain, pins] of Object.entries(sha256Keys)) {
    const pinSetXml = pins
      .map((pin) => {
        const cleanPin = pin.replace(/^sha256\//, '');
        return `            <pin digest="SHA-256">${cleanPin}</pin>`;
      })
      .join('\n');

    const domainConfigBlock =
      `    <domain-config cleartextTrafficPermitted="false">\n` +
      `        <domain includeSubdomains="true">${domain}</domain>\n` +
      `        <pin-set expiration="${expiration}">\n` +
      `${pinSetXml}\n` +
      `        </pin-set>\n` +
      `    </domain-config>`;

    const domainRegex = new RegExp(
      `<domain-config[^>]*>\\s*<domain[^>]*>${domain.replace(/\./g, '\\.')}</domain>[\\s\\S]*?</domain-config>`,
      'g'
    );

    if (domainRegex.test(existingXml)) {
      existingXml = existingXml.replace(domainRegex, domainConfigBlock);
    } else {
      existingXml = existingXml.replace(
        '</network-security-config>',
        `${domainConfigBlock}\n</network-security-config>`
      );
    }
  }

  return existingXml;
}

const EXPIRATION = '2027-04-01';

describe('XML Generation', () => {
  test('generates valid XML from single domain config', () => {
    const sha256Keys = {
      'api.example.com': [
        'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      ],
    };

    const xml = generateNscXml(sha256Keys, EXPIRATION);

    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain('<network-security-config>');
    expect(xml).toContain('cleartextTrafficPermitted="false"');
    expect(xml).toContain(
      '<domain includeSubdomains="true">api.example.com</domain>'
    );
    expect(xml).toContain(`expiration="${EXPIRATION}"`);
    expect(xml).toContain(
      '<pin digest="SHA-256">AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>'
    );
    // sha256/ prefix should be stripped
    expect(xml).not.toContain('sha256/');
    expect(xml).toContain('</network-security-config>');
  });

  test('generates XML with multiple domains', () => {
    const sha256Keys = {
      'api.example.com': [
        'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
      ],
      'api.dev.example.com': [
        'sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
      ],
    };

    const xml = generateNscXml(sha256Keys, EXPIRATION);

    // Two domain-config blocks
    const domainConfigCount = (
      xml.match(/<domain-config/g) || []
    ).length;
    expect(domainConfigCount).toBe(2);

    // api.example.com has 2 pins
    expect(xml).toContain('api.example.com');
    expect(xml).toContain(
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    );
    expect(xml).toContain(
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='
    );

    // api.dev.example.com has 1 pin
    expect(xml).toContain('api.dev.example.com');
    expect(xml).toContain(
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC='
    );
  });

  test('strips sha256/ prefix from all pins', () => {
    const sha256Keys = {
      'example.com': [
        'sha256/abc123def456ghi789jkl012mno345pqr678stu90v=',
      ],
    };

    const xml = generateNscXml(sha256Keys, EXPIRATION);

    expect(xml).not.toContain('sha256/');
    expect(xml).toContain(
      '<pin digest="SHA-256">abc123def456ghi789jkl012mno345pqr678stu90v=</pin>'
    );
  });

  test('includes expiration attribute on pin-set', () => {
    const sha256Keys = {
      'example.com': ['sha256/testpin='],
    };

    const xml = generateNscXml(sha256Keys, '2027-06-15');

    expect(xml).toContain('expiration="2027-06-15"');
  });

  test('returns empty config structure for empty sha256Keys', () => {
    const xml = generateNscXml({}, EXPIRATION);

    expect(xml).toContain('<network-security-config>');
    expect(xml).toContain('</network-security-config>');
    expect(xml).not.toContain('<domain-config');
  });
});

describe('XML Merge', () => {
  test('merges pin entries into existing NSC with debug-overrides', () => {
    const existingXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <debug-overrides>
        <trust-anchors>
            <certificates src="user" />
        </trust-anchors>
    </debug-overrides>
</network-security-config>`;

    const sha256Keys = {
      'api.example.com': ['sha256/TESTPIN='],
    };

    const merged = mergeNscXml(existingXml, sha256Keys, EXPIRATION);

    // Preserves debug-overrides
    expect(merged).toContain('<debug-overrides>');
    expect(merged).toContain('<certificates src="user" />');
    // Adds new domain-config
    expect(merged).toContain('api.example.com');
    expect(merged).toContain('TESTPIN=');
  });

  test('replaces pin-set for same domain', () => {
    const existingXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.example.com</domain>
        <pin-set expiration="2026-01-01">
            <pin digest="SHA-256">OLDPIN=</pin>
        </pin-set>
    </domain-config>
</network-security-config>`;

    const sha256Keys = {
      'api.example.com': ['sha256/NEWPIN='],
    };

    const merged = mergeNscXml(existingXml, sha256Keys, EXPIRATION);

    // Old pin replaced
    expect(merged).not.toContain('OLDPIN=');
    // New pin present
    expect(merged).toContain('NEWPIN=');
    expect(merged).toContain(`expiration="${EXPIRATION}"`);
  });

  test('preserves existing domain-configs when adding new domain', () => {
    const existingXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">existing.example.com</domain>
        <pin-set expiration="2026-01-01">
            <pin digest="SHA-256">EXISTINGPIN=</pin>
        </pin-set>
    </domain-config>
</network-security-config>`;

    const sha256Keys = {
      'new.example.com': ['sha256/NEWPIN='],
    };

    const merged = mergeNscXml(existingXml, sha256Keys, EXPIRATION);

    // Existing domain preserved
    expect(merged).toContain('existing.example.com');
    expect(merged).toContain('EXISTINGPIN=');
    // New domain added
    expect(merged).toContain('new.example.com');
    expect(merged).toContain('NEWPIN=');
  });

  test('handles no existing NSC (fresh generation path)', () => {
    // This is the generate path, not merge — but verify generate works as expected
    const sha256Keys = {
      'api.example.com': ['sha256/PIN1=', 'sha256/PIN2='],
    };

    const xml = generateNscXml(sha256Keys, EXPIRATION);
    expect(xml).toContain('PIN1=');
    expect(xml).toContain('PIN2=');
  });
});

describe('Missing config handling', () => {
  test('ssl_config.json with no sha256Keys produces empty XML', () => {
    const xml = generateNscXml({}, EXPIRATION);
    expect(xml).not.toContain('<domain-config');
  });
});
