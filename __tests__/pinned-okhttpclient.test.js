const fs = require('fs');
const path = require('path');

describe('PinnedOkHttpClient', () => {
  const ktFilePath = path.join(
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

  let ktContent;

  beforeAll(() => {
    ktContent = fs.readFileSync(ktFilePath, 'utf8');
  });

  it('file exists', () => {
    expect(fs.existsSync(ktFilePath)).toBe(true);
  });

  it('is declared as a singleton object', () => {
    expect(ktContent).toContain('object PinnedOkHttpClient');
  });

  it('exposes getInstance(context) returning OkHttpClient', () => {
    expect(ktContent).toMatch(/fun getInstance\(context:\s*Context\):\s*OkHttpClient/);
  });

  it('uses @JvmStatic for Java interop', () => {
    expect(ktContent).toContain('@JvmStatic');
  });

  it('implements CertificatePinner configuration', () => {
    expect(ktContent).toContain('CertificatePinner.Builder()');
  });

  it('reads ssl_config.json from assets', () => {
    expect(ktContent).toContain('ssl_config.json');
  });

  it('checks SharedPreferences for pinning state', () => {
    expect(ktContent).toContain('useSSLPinning');
    expect(ktContent).toContain('SharedPreferences');
  });

  it('provides invalidate method for state changes', () => {
    expect(ktContent).toMatch(/fun invalidate\(\)/);
  });

  it('uses volatile for thread-safe singleton', () => {
    expect(ktContent).toContain('@Volatile');
  });

  it('invalidates singleton when pinning state changes', () => {
    // Verifies the pattern: if state changed, set instance to null
    expect(ktContent).toContain('if (useSSLPinning != lastPinningState)');
    expect(ktContent).toContain('instance = null');
  });
});
