/**
 * Contract tests for eager SSL pinning initialization and the runtime
 * configuration API.
 *
 * These assert the wiring is present in source so the security guarantee
 * ("pinning is enforced at launch without a JS call") cannot silently
 * regress. They do not build the native targets.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

describe('iOS eager initialization', () => {
  const mm = () => read('ios', 'UseSslPinningModule.mm');
  const shared = () => read('ios', 'SharedLogic.swift');

  it('runs a +load bootstrap at app launch', () => {
    expect(mm()).toContain('+ (void)load');
    expect(mm()).toContain('bootstrapIfEnabled');
  });

  it('exposes SharedLogic to the ObjC runtime under a stable name', () => {
    expect(shared()).toContain('@objc(SharedLogic)');
    expect(shared()).toContain('func bootstrapIfEnabled()');
  });

  it('guards TrustKit so it initializes at most once', () => {
    const src = shared();
    expect(src).toContain('trustKitInitialized');
    // The guard must short-circuit before a second initSharedInstance.
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

describe('Runtime configuration API', () => {
  it('is declared on the TurboModule spec', () => {
    const spec = read('src', 'NativeUseSslPinning.ts');
    expect(spec).toContain('setSSLConfig');
    expect(spec).toContain('getPinnedDomains');
  });

  it('is exported from the JS entrypoint', () => {
    const index = read('src', 'index.tsx');
    expect(index).toContain('export const setSSLConfig');
    expect(index).toContain('export const getPinnedDomains');
  });

  it('is implemented natively on both platforms', () => {
    const impl = read(
      'android',
      'src',
      'main',
      'java',
      'com',
      'usesslpinning',
      'UseSslPinningModuleImpl.kt'
    );
    expect(impl).toContain('fun setSSLConfig');
    expect(impl).toContain('fun getPinnedDomains');

    const swift = read('ios', 'UseSslPinningModule.swift');
    expect(swift).toContain('setSSLConfig');
    expect(swift).toContain('getPinnedDomains');
  });
});

describe('JS fallback honesty', () => {
  it('returns false (not true) when the native module is missing', () => {
    const index = read('src', 'index.tsx');
    // The fallback getUseSSLPinning must resolve false so a no-op is not
    // mistaken for active pinning.
    expect(index).toMatch(/getUseSSLPinning:[\s\S]*?Promise\.resolve\(false\)/);
    expect(index).toContain('Native module is not available');
  });
});
