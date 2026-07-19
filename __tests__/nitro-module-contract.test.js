/**
 * Nitro Module + feature surface contract tests.
 *
 * Previous hardening commits (OTA, failure reporting, expiration, eager init,
 * runtime config) are covered here as structural contracts so they cannot
 * silently regress without a device build. Runtime device E2E is still needed
 * for TrustKit / OkHttp handshake verification.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const exists = (...p) => fs.existsSync(path.join(root, ...p));

describe('Nitro module packaging', () => {
  it('declares nitro peer dependency and nitrogen codegen config', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.peerDependencies['react-native-nitro-modules']).toBeDefined();
    expect(exists('nitro.json')).toBe(true);
    expect(exists('NitroSslManager.podspec')).toBe(true);
  });

  it('ships generated nitrogen outputs for both platforms', () => {
    expect(
      exists(
        'nitrogen',
        'generated',
        'ios',
        'swift',
        'HybridSslManagerSpec.swift'
      )
    ).toBe(true);
    expect(
      exists(
        'nitrogen',
        'generated',
        'android',
        'kotlin',
        'com',
        'margelo',
        'nitro',
        'sslmanager',
        'HybridSslManagerSpec.kt'
      )
    ).toBe(true);
    expect(
      exists('nitrogen', 'generated', 'shared', 'c++', 'HybridSslManagerSpec.hpp')
    ).toBe(true);
  });

  it('autolinks SslManager → HybridSslManager', () => {
    const cfg = JSON.parse(read('nitro.json'));
    expect(cfg.autolinking.SslManager.ios.implementationClassName).toBe(
      'HybridSslManager'
    );
    expect(cfg.autolinking.SslManager.android.implementationClassName).toBe(
      'HybridSslManager'
    );
  });
});

describe('Nitro HybridObject API surface', () => {
  const spec = () => read('src', 'specs', 'SslManager.nitro.ts');
  const index = () => read('src', 'index.ts');

  it('spec exposes pinning control + runtime config + failure callback', () => {
    const s = spec();
    for (const name of [
      'setUseSSLPinning',
      'getUseSSLPinning',
      'setSSLConfigJson',
      'getPinnedDomains',
      'setPinningFailureCallback',
    ]) {
      expect(s).toContain(name);
    }
  });

  it('JS entry creates HybridObject and re-exports public API', () => {
    const i = index();
    expect(i).toContain("createHybridObject<SslManager>('SslManager')");
    expect(i).toContain('export const setUseSSLPinning');
    expect(i).toContain('export const getUseSSLPinning');
    expect(i).toContain('export const setSSLConfig');
    expect(i).toContain('export const getPinnedDomains');
    expect(i).toContain('export const addPinningFailureListener');
    expect(i).toContain('export const updatePinsFromUrl');
    expect(i).toContain('export const isSSLManagerAvailable');
  });

  it('iOS HybridSslManager implements the full bridge', () => {
    const swift = read('ios', 'HybridSslManager.swift');
    expect(swift).toContain('class HybridSslManager');
    expect(swift).toContain('setSSLConfigJson');
    expect(swift).toContain('setPinningFailureCallback');
    expect(swift).toContain('SharedLogic.bootstrapIfEnabled');
  });

  it('Android HybridSslManager implements the full bridge', () => {
    const kotlin = read(
      'android',
      'src',
      'main',
      'java',
      'com',
      'margelo',
      'nitro',
      'sslmanager',
      'HybridSslManager.kt'
    );
    expect(kotlin).toContain('class HybridSslManager');
    expect(kotlin).toContain('setSSLConfigJson');
    expect(kotlin).toContain('setPinningFailureCallback');
  });
});

describe('Hardening suite features present in native + JS', () => {
  it('OTA verify path uses tweetnacl Ed25519', () => {
    const ota = read('src', 'ota.ts');
    expect(ota).toContain('tweetnacl');
    expect(ota).toContain('verifyOtaBundle');
    expect(ota).toContain('OTA_INVALID_SIGNATURE');
  });

  it('config normalization supports enforcePinning + expirationDate', () => {
    const cfg = read('src', 'config.ts');
    expect(cfg).toContain('enforcePinning');
    expect(cfg).toContain('expirationDate');
    expect(cfg).toContain('normalizeSslConfig');
  });

  it('iOS SharedLogic handles audit/enforce + expiration + reportUris', () => {
    const shared = read('ios', 'SharedLogic.swift');
    expect(shared).toContain('kTSKEnforcePinning');
    expect(shared).toContain('kTSKExpirationDate');
    expect(shared).toContain('kTSKReportUris');
    expect(shared).toContain('bootstrapIfEnabled');
  });

  it('Android has failure reporter + audit interceptor + config store', () => {
    expect(
      exists(
        'android',
        'src',
        'main',
        'java',
        'com',
        'usesslpinning',
        'PinningFailureReporter.kt'
      )
    ).toBe(true);
    expect(
      exists(
        'android',
        'src',
        'main',
        'java',
        'com',
        'usesslpinning',
        'AuditPinningInterceptor.kt'
      )
    ).toBe(true);
    expect(
      exists(
        'android',
        'src',
        'main',
        'java',
        'com',
        'usesslpinning',
        'SslConfigStore.kt'
      )
    ).toBe(true);
  });

  it('CLI exposes pins / verify / sign / keygen', () => {
    const cli = read('scripts', 'cli.js');
    expect(cli).toContain("case 'pins'");
    expect(cli).toContain("case 'verify'");
    expect(cli).toContain("case 'sign'");
    expect(cli).toContain("case 'keygen'");
  });
});

describe('Expo plugin registration', () => {
  it('package.json points expo.plugin at app.plugin.js', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.expo.plugin).toBe('./app.plugin.js');
    expect(exists('app.plugin.js')).toBe(true);
  });

  it('example-expo registers the plugin with sslConfigPath', () => {
    const appJson = JSON.parse(read('example-expo', 'app.json'));
    const plugins = appJson.expo.plugins;
    const sslPlugin = plugins.find(
      (p) =>
        p === 'react-native-ssl-manager' ||
        (Array.isArray(p) && p[0] === 'react-native-ssl-manager')
    );
    expect(sslPlugin).toBeTruthy();
    if (Array.isArray(sslPlugin)) {
      expect(sslPlugin[1].sslConfigPath).toBeTruthy();
    }
  });
});
