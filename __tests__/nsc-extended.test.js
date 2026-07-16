/**
 * Extended NSC generation: audit-mode exclusion, pin-set expiration, and
 * includeSubdomains from the optional `domains` metadata.
 */

const { generateNscXml, mergeNscXml } = require('../scripts/nsc-utils');

const PIN_A = 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const PIN_B = 'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=';

describe('generateNscXml with extended domains metadata', () => {
  it('keeps legacy behavior when no domains metadata is given', () => {
    const xml = generateNscXml({ 'api.example.com': [PIN_A, PIN_B] });
    expect(xml).toContain(
      '<domain includeSubdomains="true">api.example.com</domain>'
    );
    expect(xml).toContain('<pin-set>');
    expect(xml).not.toContain('expiration=');
  });

  it('excludes audit-mode domains from the pin-set entirely', () => {
    const xml = generateNscXml(
      {
        'api.example.com': [PIN_A, PIN_B],
        'audit.example.com': [PIN_A, PIN_B],
      },
      { 'audit.example.com': { enforcePinning: false } }
    );
    expect(xml).toContain(
      '<domain includeSubdomains="true">api.example.com</domain>'
    );
    expect(xml).not.toContain('audit.example.com');
  });

  it('emits a configured expirationDate as the pin-set expiration attribute', () => {
    const xml = generateNscXml(
      { 'api.example.com': [PIN_A, PIN_B] },
      { 'api.example.com': { expirationDate: '2027-06-30' } }
    );
    expect(xml).toContain('<pin-set expiration="2027-06-30">');
  });

  it('adds no expiration attribute when not configured', () => {
    const xml = generateNscXml(
      { 'api.example.com': [PIN_A] },
      { 'api.example.com': { includeSubdomains: false } }
    );
    expect(xml).not.toContain('expiration=');
  });

  it('honors includeSubdomains: false', () => {
    const xml = generateNscXml(
      { 'api.example.com': [PIN_A] },
      { 'api.example.com': { includeSubdomains: false } }
    );
    expect(xml).toContain(
      '<domain includeSubdomains="false">api.example.com</domain>'
    );
  });

  it('still emits the dev cleartext block when all domains are audit-mode', () => {
    const xml = generateNscXml(
      { 'audit.example.com': [PIN_A] },
      { 'audit.example.com': { enforcePinning: false } }
    );
    expect(xml).toContain('<domain includeSubdomains="false">localhost</domain>');
    expect(xml).not.toContain('pin-set');
  });
});

describe('mergeNscXml with extended domains metadata', () => {
  const baseXml =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<network-security-config>\n' +
    '    <debug-overrides>\n' +
    '        <trust-anchors><certificates src="user" /></trust-anchors>\n' +
    '    </debug-overrides>\n' +
    '</network-security-config>\n';

  it('adds expiration attribute to merged pin-sets', () => {
    const merged = mergeNscXml(
      baseXml,
      { 'api.example.com': [PIN_A] },
      { 'api.example.com': { expirationDate: '2028-01-15' } }
    );
    expect(merged).toContain('<pin-set expiration="2028-01-15">');
    expect(merged).toContain('<debug-overrides>');
  });

  it('does not add audit-mode domains when merging', () => {
    const merged = mergeNscXml(
      baseXml,
      { 'audit.example.com': [PIN_A] },
      { 'audit.example.com': { enforcePinning: false } }
    );
    expect(merged).not.toContain('audit.example.com');
  });

  it('removes a previously pinned domain that switched to audit mode', () => {
    const withPins = mergeNscXml(baseXml, { 'api.example.com': [PIN_A] });
    expect(withPins).toContain('api.example.com');

    const afterAudit = mergeNscXml(
      withPins,
      { 'api.example.com': [PIN_A] },
      { 'api.example.com': { enforcePinning: false } }
    );
    expect(afterAudit).not.toContain('<domain includeSubdomains="true">api.example.com</domain>');
    expect(afterAudit).toContain('<debug-overrides>');
  });

  it('honors includeSubdomains: false when merging a new domain', () => {
    const merged = mergeNscXml(
      baseXml,
      { 'api.example.com': [PIN_A] },
      { 'api.example.com': { includeSubdomains: false } }
    );
    expect(merged).toContain(
      '<domain includeSubdomains="false">api.example.com</domain>'
    );
  });
});
