/**
 * OTA bundle verification: full authoring→verification roundtrip between the
 * CLI signer (node crypto Ed25519) and the app-side verifier (tweetnacl), plus
 * tamper, expiry, and rollback rejection.
 */

const { generateKeypair, signBundle } = require('../scripts/cli-utils');
const {
  verifyOtaBundle,
  base64ToBytes,
  utf8Decode,
  OtaError,
} = require('../src/ota');

const PIN_A = 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const PIN_B = 'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=';
const CONFIG = { sha256Keys: { 'api.example.com': [PIN_A, PIN_B] } };

const NOW = Date.parse('2026-07-16T12:00:00Z');

describe('CLI sign → app verify roundtrip', () => {
  const { privateKeyPem, publicKeyBase64 } = generateKeypair();

  it('verifies and returns the signed config', () => {
    const bundle = signBundle(CONFIG, privateKeyPem, {
      version: 3,
      expiresInMs: 30 * 24 * 3600 * 1000,
      now: NOW,
    });
    const result = verifyOtaBundle(bundle, { publicKey: publicKeyBase64 }, NOW);
    expect(result.version).toBe(3);
    expect(result.domains).toEqual(['api.example.com']);
    expect(result.config.sha256Keys['api.example.com']).toEqual([PIN_A, PIN_B]);
  });

  it('rejects a tampered payload', () => {
    const bundle = signBundle(CONFIG, privateKeyPem, { now: NOW });
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        version: 99,
        issuedAt: new Date(NOW).toISOString(),
        config: { sha256Keys: { 'evil.example.com': [PIN_A, PIN_B] } },
      }),
      'utf8'
    ).toString('base64');
    expect(() =>
      verifyOtaBundle(
        { payload: tamperedPayload, signature: bundle.signature },
        { publicKey: publicKeyBase64 },
        NOW
      )
    ).toThrow(/does not verify/);
  });

  it('rejects a signature from a different key', () => {
    const other = generateKeypair();
    const bundle = signBundle(CONFIG, other.privateKeyPem, { now: NOW });
    try {
      verifyOtaBundle(bundle, { publicKey: publicKeyBase64 }, NOW);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(OtaError);
      expect(error.code).toBe('OTA_INVALID_SIGNATURE');
    }
  });

  it('rejects an expired bundle (expiresAt in the past)', () => {
    const bundle = signBundle(CONFIG, privateKeyPem, {
      now: NOW - 10 * 24 * 3600 * 1000,
      expiresInMs: 24 * 3600 * 1000,
    });
    try {
      verifyOtaBundle(bundle, { publicKey: publicKeyBase64 }, NOW);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('OTA_EXPIRED');
    }
  });

  it('rejects a bundle older than maxAgeMs', () => {
    const bundle = signBundle(CONFIG, privateKeyPem, {
      now: NOW - 2 * 24 * 3600 * 1000,
    });
    try {
      verifyOtaBundle(
        bundle,
        { publicKey: publicKeyBase64, maxAgeMs: 24 * 3600 * 1000 },
        NOW
      );
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('OTA_EXPIRED');
    }
  });

  it('rejects rollback to an older bundle', () => {
    const oldIssued = NOW - 3600 * 1000;
    const bundle = signBundle(CONFIG, privateKeyPem, { now: oldIssued });
    try {
      verifyOtaBundle(
        bundle,
        { publicKey: publicKeyBase64, minIssuedAt: NOW },
        NOW
      );
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('OTA_ROLLBACK');
    }
  });

  it('rejects a bundle whose config fails validation', () => {
    const bundle = signBundle(
      { sha256Keys: { 'api.example.com': ['garbage'] } },
      privateKeyPem,
      { now: NOW }
    );
    expect(() =>
      verifyOtaBundle(bundle, { publicKey: publicKeyBase64 }, NOW)
    ).toThrow(/invalid pin/);
  });

  it('rejects malformed bundles and bad public keys', () => {
    expect(() =>
      verifyOtaBundle({}, { publicKey: publicKeyBase64 }, NOW)
    ).toThrow(/payload/);
    const bundle = signBundle(CONFIG, privateKeyPem, { now: NOW });
    try {
      verifyOtaBundle(bundle, { publicKey: 'AAAA' }, NOW);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('OTA_INVALID_PUBLIC_KEY');
    }
  });
});

describe('base64/utf8 helpers (no atob/TextDecoder dependency)', () => {
  it('round-trips binary data', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255, 128, 64]);
    expect(Buffer.from(base64ToBytes(bytes.toString('base64')))).toEqual(bytes);
  });

  it('decodes multi-byte UTF-8', () => {
    const text = 'pinning ✔ tiếng Việt 🔒';
    const encoded = Buffer.from(text, 'utf8');
    expect(utf8Decode(new Uint8Array(encoded))).toBe(text);
  });

  it('rejects invalid base64', () => {
    expect(() => base64ToBytes('not*base64!')).toThrow();
  });
});
