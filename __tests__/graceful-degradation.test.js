/**
 * Tests for the certificate-rotation graceful-degradation features (issue #4):
 * configurable global `expiration` (fail-open) and `enforcePinning: false`
 * (monitor mode), across the build scripts and native source contracts.
 */

const fs = require('fs');
const path = require('path');
const {
  isPinningEnforced,
  getConfigExpiration,
  generateNscXml,
} = require('../scripts/nsc-utils');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

describe('config policy helpers', () => {
  it('treats pinning as enforced by default', () => {
    expect(isPinningEnforced({ sha256Keys: {} })).toBe(true);
    expect(isPinningEnforced(undefined)).toBe(true);
  });

  it('honors enforcePinning: false (monitor mode)', () => {
    expect(isPinningEnforced({ enforcePinning: false })).toBe(false);
    expect(isPinningEnforced({ enforcePinning: true })).toBe(true);
  });

  it('reads a global expiration field', () => {
    expect(getConfigExpiration({ expiration: '2030-01-01' })).toBe(
      '2030-01-01'
    );
    expect(getConfigExpiration({ expiration: '  2030-01-01  ' })).toBe(
      '2030-01-01'
    );
    expect(getConfigExpiration({})).toBeUndefined();
    expect(getConfigExpiration({ expiration: '' })).toBeUndefined();
  });

  it('the config expiration can drive NSC generation', () => {
    const cfg = {
      sha256Keys: {
        'api.example.com': [
          'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        ],
      },
      expiration: '2029-09-09',
    };
    const xml = generateNscXml(cfg.sha256Keys, getConfigExpiration(cfg));
    expect(xml).toContain('<pin-set expiration="2029-09-09">');
  });
});

describe('build scripts skip NSC in monitor mode', () => {
  it('app.plugin.js checks isPinningEnforced before generating NSC', () => {
    const plugin = read('app.plugin.js');
    expect(plugin).toContain('isPinningEnforced');
    expect(plugin).toContain('getConfigExpiration');
  });

  it('postinstall.js checks isPinningEnforced', () => {
    expect(read('scripts', 'postinstall.js')).toContain('isPinningEnforced');
  });

  it('gradle skips generation when enforcePinning is false', () => {
    const gradle = read('android', 'ssl-pinning-setup.gradle');
    expect(gradle).toContain('enforcePinning == false');
    expect(gradle).toContain('json?.expiration');
  });
});

describe('iOS honors expiration and enforcePinning', () => {
  it('sets kTSKExpirationDate and a configurable kTSKEnforcePinning', () => {
    const swift = read('ios', 'SharedLogic.swift');
    expect(swift).toContain('kTSKExpirationDate');
    expect(swift).toContain('kTSKEnforcePinning: enforcePinning');
    expect(swift).toContain('"enforcePinning"');
    expect(swift).toContain('"expiration"');
  });
});

describe('Android runtime honors the policy', () => {
  it('provides a shared SslPinningPolicy', () => {
    const policy = read(
      'android',
      'src',
      'main',
      'java',
      'com',
      'usesslpinning',
      'SslPinningPolicy.kt'
    );
    expect(policy).toContain('fun shouldEnforce');
    expect(policy).toContain('enforcePinning');
    expect(policy).toContain('expiration');
  });

  it('the factory and pinned client gate pinning on the policy', () => {
    const factory = read(
      'android',
      'src',
      'main',
      'java',
      'com',
      'usesslpinning',
      'SslPinningFactory.kt'
    );
    const pinned = read(
      'android',
      'src',
      'main',
      'java',
      'com',
      'usesslpinning',
      'PinnedOkHttpClient.kt'
    );
    expect(factory).toContain('SslPinningPolicy.shouldEnforce');
    expect(pinned).toContain('SslPinningPolicy.shouldEnforce');
  });
});
