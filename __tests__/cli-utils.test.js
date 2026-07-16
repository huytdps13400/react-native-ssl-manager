/**
 * CLI core logic: SPKI pin computation (known-answer against openssl),
 * pin-drift verification, keypair/bundle authoring, duration parsing.
 */

const fs = require('fs');
const path = require('path');
const {
  spkiPinFromPem,
  configSnippetFromChain,
  verifyConfig,
  generateKeypair,
  signBundle,
  verifyBundle,
  parseDuration,
} = require('../scripts/cli-utils');

const PIN_A = 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const PIN_B = 'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=';

describe('spkiPinFromPem', () => {
  it('matches the openssl-computed SPKI SHA-256 pin for the fixture cert', () => {
    // Expected value computed independently with:
    //   openssl x509 -in test-cert.pem -pubkey -noout \
    //     | openssl pkey -pubin -outform DER \
    //     | openssl dgst -sha256 -binary | openssl enc -base64
    const pem = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'test-cert.pem'),
      'utf8'
    );
    expect(spkiPinFromPem(pem)).toBe(
      'sha256/BnM9W0GmWmQ6VZ77wgiMyQ3OpqTqtfApsWRFEfDO1jU='
    );
  });
});

describe('configSnippetFromChain', () => {
  it('takes leaf + first intermediate', () => {
    const snippet = configSnippetFromChain('api.example.com', [
      { pin: PIN_A, isLeaf: true },
      { pin: PIN_B, isLeaf: false },
      { pin: 'sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=', isLeaf: false },
    ]);
    expect(snippet).toEqual({
      sha256Keys: { 'api.example.com': [PIN_A, PIN_B] },
    });
  });
});

describe('verifyConfig', () => {
  const NOW = Date.parse('2026-07-16T12:00:00Z');
  const connectServing = (pins) => async () => pins.map((pin) => ({ pin }));

  it('reports OK and exit 0 when a served pin matches', async () => {
    const { results, exitCode } = await verifyConfig(
      { sha256Keys: { 'api.example.com': [PIN_A, PIN_B] } },
      { connect: connectServing([PIN_A]), now: NOW }
    );
    expect(results[0].status).toBe('OK');
    expect(exitCode).toBe(0);
  });

  it('reports MISMATCH and exit 1 for enforced drift', async () => {
    const { results, exitCode } = await verifyConfig(
      { sha256Keys: { 'api.example.com': [PIN_A] } },
      { connect: connectServing([PIN_B]), now: NOW }
    );
    expect(results[0].status).toBe('MISMATCH');
    expect(exitCode).toBe(1);
  });

  it('reports AUDIT_MISMATCH with exit 0 for audit-mode drift', async () => {
    const { results, exitCode } = await verifyConfig(
      {
        sha256Keys: { 'api.example.com': [PIN_A] },
        domains: { 'api.example.com': { enforcePinning: false } },
      },
      { connect: connectServing([PIN_B]), now: NOW }
    );
    expect(results[0].status).toBe('AUDIT_MISMATCH');
    expect(exitCode).toBe(0);
  });

  it('skips expired domains as fail-open with exit 0', async () => {
    const { results, exitCode } = await verifyConfig(
      {
        sha256Keys: { 'api.example.com': [PIN_A] },
        domains: { 'api.example.com': { expirationDate: '2026-01-01' } },
      },
      { connect: connectServing([PIN_B]), now: NOW }
    );
    expect(results[0].status).toBe('EXPIRED_SKIPPED');
    expect(exitCode).toBe(0);
  });

  it('warns when the expiration date is within 30 days', async () => {
    const { results } = await verifyConfig(
      {
        sha256Keys: { 'api.example.com': [PIN_A] },
        domains: { 'api.example.com': { expirationDate: '2026-08-01' } },
      },
      { connect: connectServing([PIN_A]), now: NOW }
    );
    expect(results[0].status).toBe('OK');
    expect(results[0].expiresSoon).toBe(true);
  });

  it('treats connection errors on enforced domains as failures', async () => {
    const { results, exitCode } = await verifyConfig(
      { sha256Keys: { 'api.example.com': [PIN_A] } },
      {
        connect: async () => {
          throw new Error('boom');
        },
        now: NOW,
      }
    );
    expect(results[0].status).toBe('ERROR');
    expect(exitCode).toBe(1);
  });
});

describe('keygen / sign / verify (node-side)', () => {
  it('generates a keypair whose bundles verify, and rejects foreign signatures', () => {
    const { privateKeyPem, publicKeyBase64 } = generateKeypair();
    expect(privateKeyPem).toContain('BEGIN PRIVATE KEY');
    expect(Buffer.from(publicKeyBase64, 'base64').length).toBe(32);

    const config = { sha256Keys: { 'api.example.com': [PIN_A, PIN_B] } };
    const bundle = signBundle(config, privateKeyPem, {
      version: 7,
      now: Date.parse('2026-07-16T00:00:00Z'),
    });
    const payload = verifyBundle(bundle, publicKeyBase64);
    expect(payload.version).toBe(7);
    expect(payload.config).toEqual(config);

    const other = generateKeypair();
    expect(() => verifyBundle(bundle, other.publicKeyBase64)).toThrow(
      /does not verify/
    );
  });
});

describe('parseDuration', () => {
  it('parses days, hours, minutes', () => {
    expect(parseDuration('30d')).toBe(30 * 24 * 3600 * 1000);
    expect(parseDuration('12h')).toBe(12 * 3600 * 1000);
    expect(parseDuration('45m')).toBe(45 * 60 * 1000);
  });

  it('rejects unknown formats', () => {
    expect(() => parseDuration('1w')).toThrow(/Invalid duration/);
    expect(() => parseDuration('soon')).toThrow(/Invalid duration/);
  });
});
