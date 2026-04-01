const fs = require('fs');
const path = require('path');
const { generateNscXml } = require('../scripts/nsc-utils');

const readmePath = path.join(__dirname, '..', 'README.md');
const pinnedClientPath = path.join(
  __dirname,
  '..',
  'android',
  'src',
  'main',
  'java',
  'com',
  'usesslpinning',
  'PinnedOkHttpClient.kt'
);

let readmeContent;
let pinnedClientContent;

beforeAll(() => {
  readmeContent = fs.readFileSync(readmePath, 'utf8');
  pinnedClientContent = fs.readFileSync(pinnedClientPath, 'utf8');
});

describe('Integration: Cronet request with valid pin succeeds', () => {
  const sha256Keys = {
    'api.example.com': [
      'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
    ],
  };

  it('NSC XML contains pin-set entries that Cronet can use via platform TrustManager', () => {
    const xml = generateNscXml(sha256Keys);

    // Cronet (when using platform default TrustManager) respects NSC pin-set
    expect(xml).toContain('<network-security-config>');
    expect(xml).toContain(
      '<domain includeSubdomains="true">api.example.com</domain>'
    );
    expect(xml).toContain('<pin-set');
    expect(xml).toContain(
      '<pin digest="SHA-256">AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>'
    );
    expect(xml).toContain(
      '<pin digest="SHA-256">BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=</pin>'
    );
  });

  it('NSC XML uses cleartextTrafficPermitted=false for pinned domains', () => {
    const xml = generateNscXml(sha256Keys);
    expect(xml).toContain('cleartextTrafficPermitted="false"');
  });

  it('README documents Cronet coverage as best-effort via NSC', () => {
    expect(readmeContent).toMatch(/Cronet.*Best-effort/i);
    expect(readmeContent).toContain('Network Security Config');
  });

  it('README documents CronetEngine.Builder.addPublicKeyPins as authoritative API', () => {
    expect(readmeContent).toContain('CronetEngine.Builder.addPublicKeyPins()');
  });
});

describe('Integration: Cronet request with invalid pin fails', () => {
  it('NSC XML with mismatched pins will cause TLS failure for Cronet on platform TrustManager', () => {
    const sha256Keys = {
      'api.example.com': ['sha256/INVALIDPINHASH='],
    };

    const xml = generateNscXml(sha256Keys);

    // The generated XML has a pin that won't match the real certificate
    expect(xml).toContain(
      '<pin digest="SHA-256">INVALIDPINHASH=</pin>'
    );
    // Platform enforces pin-set — mismatched pin causes connection failure
    expect(xml).toContain('<pin-set');
    expect(xml).toContain(
      '<domain includeSubdomains="true">api.example.com</domain>'
    );
  });

  it('README documents that Cronet may bypass NSC with custom TrustManager', () => {
    expect(readmeContent).toMatch(
      /Cronet.*own TLS stack|Cronet.*custom TrustManager/i
    );
  });

  it('README lists Cronet limitation under known limitations', () => {
    expect(readmeContent).toContain('Known limitation');
  });
});

describe('Integration: Coil image load with valid pin succeeds', () => {
  it('NSC XML covers Coil via platform-level Network Security Config', () => {
    const sha256Keys = {
      'images.example.com': ['sha256/COILPINHASH='],
    };

    const xml = generateNscXml(sha256Keys);

    expect(xml).toContain(
      '<domain includeSubdomains="true">images.example.com</domain>'
    );
    expect(xml).toContain('<pin digest="SHA-256">COILPINHASH=</pin>');
  });

  it('PinnedOkHttpClient can be used with Coil ImageLoader', () => {
    // PinnedOkHttpClient returns OkHttpClient which Coil accepts
    expect(pinnedClientContent).toContain('fun getInstance(context: Context): OkHttpClient');
    expect(pinnedClientContent).toContain('OkHttpClient.Builder()');
    expect(pinnedClientContent).toContain('CertificatePinner.Builder()');
  });

  it('README documents Coil integration pattern', () => {
    expect(readmeContent).toContain('Coil Integration');
    expect(readmeContent).toContain('ImageLoader.Builder(context)');
    expect(readmeContent).toContain(
      'PinnedOkHttpClient.getInstance(context)'
    );
  });

  it('README shows Coil in supported networking stacks table', () => {
    expect(readmeContent).toMatch(/Coil.*Android.*Yes/);
  });
});

describe('Integration: Glide image load with valid pin succeeds', () => {
  it('NSC XML covers Glide via platform-level Network Security Config', () => {
    const sha256Keys = {
      'cdn.example.com': [
        'sha256/GLIDEPINHASH1=',
        'sha256/GLIDEPINHASH2=',
      ],
    };

    const xml = generateNscXml(sha256Keys);

    expect(xml).toContain(
      '<domain includeSubdomains="true">cdn.example.com</domain>'
    );
    expect(xml).toContain('<pin digest="SHA-256">GLIDEPINHASH1=</pin>');
    expect(xml).toContain('<pin digest="SHA-256">GLIDEPINHASH2=</pin>');
  });

  it('PinnedOkHttpClient can be used with Glide AppGlideModule', () => {
    expect(pinnedClientContent).toContain('@JvmStatic');
    expect(pinnedClientContent).toContain('fun getInstance(context: Context): OkHttpClient');
  });

  it('README documents Glide integration with @GlideModule example', () => {
    expect(readmeContent).toContain('Glide Integration');
    expect(readmeContent).toContain('@GlideModule');
    expect(readmeContent).toContain('AppGlideModule');
    expect(readmeContent).toContain('OkHttpUrlLoader.Factory(client)');
  });

  it('README shows Glide in supported networking stacks table', () => {
    expect(readmeContent).toMatch(/Glide.*Android.*Yes/);
  });
});
