const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateNscXml, mergeNscXml } = require('../scripts/nsc-utils');

describe('Postinstall / RN CLI XML generation (E2E-style)', () => {
  let tmpDir;
  let androidDir;
  let xmlDir;
  let xmlPath;
  let manifestPath;

  const sslConfig = {
    sha256Keys: {
      'api.example.com': [
        'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
      ],
    },
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsc-test-'));
    androidDir = path.join(tmpDir, 'android', 'app', 'src', 'main');
    xmlDir = path.join(androidDir, 'res', 'xml');
    xmlPath = path.join(xmlDir, 'network_security_config.xml');
    manifestPath = path.join(androidDir, 'AndroidManifest.xml');

    fs.mkdirSync(xmlDir, { recursive: true });
    fs.writeFileSync(
      manifestPath,
      `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:name=".MainApplication" android:label="@string/app_name">
    </application>
</manifest>`
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates XML and patches manifest when no existing NSC', () => {
    const xml = generateNscXml(sslConfig.sha256Keys);
    fs.writeFileSync(xmlPath, xml);

    // Verify XML was written
    expect(fs.existsSync(xmlPath)).toBe(true);
    const content = fs.readFileSync(xmlPath, 'utf8');
    expect(content).toContain('<network-security-config>');
    expect(content).toContain('api.example.com');
    expect(content).toContain('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');

    // Simulate manifest patching
    let manifestContent = fs.readFileSync(manifestPath, 'utf8');
    if (!manifestContent.includes('android:networkSecurityConfig')) {
      manifestContent = manifestContent.replace(
        /(<application\b[^>]*)(>)/,
        '$1 android:networkSecurityConfig="@xml/network_security_config"$2'
      );
      fs.writeFileSync(manifestPath, manifestContent);
    }

    const updatedManifest = fs.readFileSync(manifestPath, 'utf8');
    expect(updatedManifest).toContain(
      'android:networkSecurityConfig="@xml/network_security_config"'
    );
  });

  it('merges with existing NSC preserving debug-overrides', () => {
    const existingXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <debug-overrides>
        <trust-anchors>
            <certificates src="user" />
        </trust-anchors>
    </debug-overrides>
</network-security-config>`;
    fs.writeFileSync(xmlPath, existingXml);

    const merged = mergeNscXml(existingXml, sslConfig.sha256Keys);
    fs.writeFileSync(xmlPath, merged);

    const content = fs.readFileSync(xmlPath, 'utf8');
    expect(content).toContain('<debug-overrides>');
    expect(content).toContain('api.example.com');
  });

  it('does not patch manifest if NSC reference already exists', () => {
    const manifestWithNsc = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:name=".MainApplication" android:networkSecurityConfig="@xml/custom_nsc">
    </application>
</manifest>`;
    fs.writeFileSync(manifestPath, manifestWithNsc);

    let manifestContent = fs.readFileSync(manifestPath, 'utf8');
    if (!manifestContent.includes('android:networkSecurityConfig')) {
      manifestContent = manifestContent.replace(
        /(<application\b[^>]*)(>)/,
        '$1 android:networkSecurityConfig="@xml/network_security_config"$2'
      );
      fs.writeFileSync(manifestPath, manifestContent);
    }

    const result = fs.readFileSync(manifestPath, 'utf8');
    // Should still have the original custom reference, not the default one
    expect(result).toContain('@xml/custom_nsc');
    expect(result).not.toContain('@xml/network_security_config');
  });
});
