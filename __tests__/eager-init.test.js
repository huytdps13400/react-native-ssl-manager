/**
 * Contract tests for eager SSL pinning initialization and the Nitro runtime
 * configuration API.
 *
 * These assert the wiring is present in source so the security guarantee
 * ("pinning is enforced at launch without a JS call") cannot silently regress.
 * They do not build the native targets.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

describe('iOS eager initialization', () => {
  const bootstrap = () => read('ios', 'SslManagerBootstrap.mm');
  const shared = () => read('ios', 'SharedLogic.swift');

  it('runs a +load bootstrap at app launch', () => {
    expect(bootstrap()).toContain('+ (void)load');
    expect(bootstrap()).toContain('bootstrapIfEnabled');
  });

  it('exposes SharedLogic to the ObjC runtime under a stable name', () => {
    expect(shared()).toContain('@objc(SharedLogic)');
    expect(shared()).toContain('func bootstrapIfEnabled()');
  });

  it('guards TrustKit so it initializes at most once', () => {
    const src = shared();
    expect(src).toContain('trustKitInitialized');
    const guardIndex = src.indexOf('if trustKitInitialized');
    const initIndex = src.indexOf('TrustKit.initSharedInstance');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(initIndex).toBeGreaterThan(guardIndex);
  });
});

describe('Android eager initialization', () => {
  it('provides an androidx.startup Initializer that installs the factory', () => {
    const init = read(
      'android',
      'src',
      'main',
      'java',
      'com',
      'usesslpinning',
      'SslPinningInitializer.kt'
    );
    expect(init).toContain('androidx.startup.Initializer');
    expect(init).toContain('UseSslPinningModuleImpl.initialize');
  });

  it('registers the initializer in both manifests', () => {
    for (const name of ['AndroidManifest.xml', 'AndroidManifestNew.xml']) {
      const manifest = read('android', 'src', 'main', name);
      expect(manifest).toContain('androidx.startup.InitializationProvider');
      expect(manifest).toContain('com.usesslpinning.SslPinningInitializer');
    }
  });

  it('declares the androidx.startup dependency', () => {
    expect(read('android', 'build.gradle')).toContain(
      'androidx.startup:startup-runtime'
    );
  });
});

describe('Nitro module wiring', () => {
  it('declares the HybridObject spec with the runtime API', () => {
    const spec = read('src', 'specs', 'SslManager.nitro.ts');
    expect(spec).toContain('interface SslManager');
    expect(spec).toContain('setUseSSLPinning');
    expect(spec).toContain('getUseSSLPinning');
    expect(spec).toContain('setSSLConfig');
    expect(spec).toContain('getPinnedDomains');
  });

  it('autolinks SslManager to HybridSslManager on both platforms', () => {
    const cfg = JSON.parse(read('nitro.json'));
    expect(cfg.autolinking.SslManager.ios.implementationClassName).toBe(
      'HybridSslManager'
    );
    expect(cfg.autolinking.SslManager.android.implementationClassName).toBe(
      'HybridSslManager'
    );
  });

  it('exports the runtime API from the JS entrypoint', () => {
    const index = read('src', 'index.ts');
    expect(index).toContain('createHybridObject');
    expect(index).toContain('export const setSSLConfig');
    expect(index).toContain('export const getPinnedDomains');
    expect(index).toContain('export const isSSLManagerAvailable');
  });

  it('is implemented natively on both platforms', () => {
    const swift = read('ios', 'HybridSslManager.swift');
    expect(swift).toContain('class HybridSslManager');
    expect(swift).toContain('setSSLConfig');
    expect(swift).toContain('getPinnedDomains');

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
    expect(kotlin).toContain('setSSLConfig');
    expect(kotlin).toContain('getPinnedDomains');
  });
});

describe('JS fallback honesty', () => {
  it('throws (not silently no-ops) and exposes availability when unlinked', () => {
    const index = read('src', 'index.ts');
    // No silent no-op shim that pretends pinning is active.
    expect(index).toContain('Native module is not available');
    expect(index).toContain('isSSLManagerAvailable');
  });
});
