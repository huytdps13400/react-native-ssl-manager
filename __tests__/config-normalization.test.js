/**
 * Validation of the extended SslPinningConfig (domains metadata + reportUris).
 */

const { normalizeSslConfig, SslConfigError, isExpired } = require('../src/config');

const PIN_A = 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const PIN_B = 'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=';

describe('normalizeSslConfig', () => {
  it('accepts a legacy config with only sha256Keys', () => {
    const config = { sha256Keys: { 'api.example.com': [PIN_A, PIN_B] } };
    expect(normalizeSslConfig(config)).toBe(config);
  });

  it('accepts a full extended config', () => {
    const config = {
      sha256Keys: { 'api.example.com': [PIN_A, PIN_B] },
      domains: {
        'api.example.com': {
          enforcePinning: false,
          expirationDate: '2027-06-30',
          includeSubdomains: false,
        },
      },
      reportUris: ['https://reports.example.com/pins'],
    };
    expect(normalizeSslConfig(config)).toBe(config);
  });

  it('rejects a config without sha256Keys', () => {
    expect(() => normalizeSslConfig({})).toThrow(SslConfigError);
    expect(() => normalizeSslConfig(null)).toThrow(SslConfigError);
  });

  it('rejects an empty sha256Keys map', () => {
    expect(() => normalizeSslConfig({ sha256Keys: {} })).toThrow(
      /at least one host/
    );
  });

  it('rejects hosts without pins and malformed pins', () => {
    expect(() =>
      normalizeSslConfig({ sha256Keys: { 'api.example.com': [] } })
    ).toThrow(/at least one/);
    expect(() =>
      normalizeSslConfig({ sha256Keys: { 'api.example.com': ['nonsense'] } })
    ).toThrow(/invalid pin/);
    expect(() =>
      normalizeSslConfig({ sha256Keys: { 'api.example.com': ['sha256/short'] } })
    ).toThrow(/invalid pin/);
  });

  it('rejects invalid expirationDate values', () => {
    const base = { sha256Keys: { 'api.example.com': [PIN_A, PIN_B] } };
    expect(() =>
      normalizeSslConfig({
        ...base,
        domains: { 'api.example.com': { expirationDate: '30-06-2027' } },
      })
    ).toThrow(/expirationDate/);
    expect(() =>
      normalizeSslConfig({
        ...base,
        domains: { 'api.example.com': { expirationDate: 'soon' } },
      })
    ).toThrow(/expirationDate/);
  });

  it('rejects non-boolean option types', () => {
    const base = { sha256Keys: { 'api.example.com': [PIN_A, PIN_B] } };
    expect(() =>
      normalizeSslConfig({
        ...base,
        domains: { 'api.example.com': { enforcePinning: 'no' } },
      })
    ).toThrow(/enforcePinning/);
  });

  it('rejects non-https report URIs', () => {
    const base = { sha256Keys: { 'api.example.com': [PIN_A, PIN_B] } };
    expect(() =>
      normalizeSslConfig({ ...base, reportUris: ['http://insecure.example.com'] })
    ).toThrow(/https/);
  });

  it('carries error codes on SslConfigError', () => {
    try {
      normalizeSslConfig({ sha256Keys: {} });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('INVALID_CONFIGURATION');
    }
  });
});

describe('isExpired', () => {
  it('is active through the end of the expiration day (UTC)', () => {
    const endOfDay = Date.parse('2027-06-30T23:59:59.999Z');
    expect(isExpired('2027-06-30', endOfDay)).toBe(false);
    expect(isExpired('2027-06-30', endOfDay + 1)).toBe(true);
  });

  it('is not expired long before the date', () => {
    expect(isExpired('2027-06-30', Date.parse('2026-01-01T00:00:00Z'))).toBe(
      false
    );
  });
});
