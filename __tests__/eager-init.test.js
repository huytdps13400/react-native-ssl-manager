/**
 * Contract tests for eager SSL pinning initialization, the runtime
 * configuration API, and configurable Network Security Config expiration.
 *
 * These assert the wiring is present in source so the security guarantee
 * ("pinning is enforced at launch without a JS call") cannot silently
 * regress. They do not build the native targets.
 */

const fs = require('fs');
const path = require('path');
const {
  generateNscXml,
  mergeNscXml,
  resolveExpiration,
} = require('../scripts/nsc-utils');

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

describe('Configurable NSC expiration', () => {
  const sha256Keys = {
    'api.example.com': ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='],
  };

  it('uses a custom expiration when provided', () => {
    const xml = generateNscXml(sha256Keys, '2030-01-01');
    expect(xml).toContain('<pin-set expiration="2030-01-01">');
  });

  it('defaults to one year from now', () => {
    const expected = resolveExpiration();
    const xml = generateNscXml(sha256Keys);
    expect(xml).toContain(`<pin-set expiration="${expected}">`);
  });

  it('threads expiration through merge', () => {
    const base = generateNscXml(
      {
        'a.example.com': [
          'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        ],
      },
      '2031-06-01'
    );
    const merged = mergeNscXml(base, sha256Keys, '2031-06-01');
    expect(merged).toContain(
      '<domain includeSubdomains="true">api.example.com</domain>'
    );
    expect(merged).toContain('expiration="2031-06-01"');
  });
});
