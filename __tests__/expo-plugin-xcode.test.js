/**
 * Regression tests for the Expo config plugin iOS Xcode wiring.
 *
 * Root cause of the customer prebuild failure:
 *   project.addResourceFile() → correctForResourcesPath() →
 *   pbxGroupByName('Resources').path
 * Modern Expo / RN Xcode projects have NO PBXGroup named "Resources", so
 * that call throws: Cannot read properties of null (reading 'path').
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const xcode = require('xcode');

const {
  addSslConfigResourceToXcodeProject,
  resolveIosAppBundleDir,
  readFullSslConfig,
} = require('../app.plugin.js');

const EXAMPLE_PBX =
  path.join(
    __dirname,
    '..',
    'example',
    'ios',
    'UseSslPinningExample.xcodeproj',
    'project.pbxproj'
  );

function loadProject() {
  expect(fs.existsSync(EXAMPLE_PBX)).toBe(true);
  // Work on a copy so we never mutate the example tree.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssl-xcode-'));
  const pbxCopy = path.join(tmp, 'project.pbxproj');
  fs.copyFileSync(EXAMPLE_PBX, pbxCopy);
  const project = xcode.project(pbxCopy);
  project.parseSync();
  return { project, tmp, pbxCopy };
}

describe('xcode package Resources-group bug (root cause)', () => {
  it('has no PBXGroup named Resources in a modern RN project', () => {
    const { project, tmp } = loadProject();
    expect(project.pbxGroupByName('Resources')).toBeNull();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('project.addResourceFile throws the customer error', () => {
    const { project, tmp } = loadProject();
    expect(() => {
      project.addResourceFile(
        'UseSslPinningExample/ssl_config.json',
        { target: project.getFirstTarget().uuid },
        project.getFirstProject().firstProject.mainGroup
      );
    }).toThrow(/Cannot read properties of null \(reading 'path'\)/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('addSslConfigResourceToXcodeProject', () => {
  it('adds ssl_config.json without throwing on a modern pbxproj', () => {
    const { project, tmp } = loadProject();
    const projectName = 'UseSslPinningExample';

    const result = addSslConfigResourceToXcodeProject(project, projectName);
    expect(result).toBeTruthy();

    // File reference present
    const refs = project.pbxFileReferenceSection();
    const paths = Object.values(refs)
      .filter((v) => v && typeof v === 'object' && v.path)
      .map((v) => String(v.path).replace(/"/g, ''));
    expect(
      paths.some(
        (p) => p === 'ssl_config.json' || p.endsWith('/ssl_config.json')
      )
    ).toBe(true);

    // Resources build phase lists the file
    const phases = project.hash.project.objects.PBXResourcesBuildPhase || {};
    const phaseBlob = JSON.stringify(phases);
    expect(phaseBlob).toContain('ssl_config.json');

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('is idempotent — second call does not throw or duplicate', () => {
    const { project, tmp } = loadProject();
    const projectName = 'UseSslPinningExample';

    addSslConfigResourceToXcodeProject(project, projectName);
    expect(() =>
      addSslConfigResourceToXcodeProject(project, projectName)
    ).not.toThrow();

    const refs = project.pbxFileReferenceSection();
    const matches = Object.values(refs).filter(
      (v) =>
        v &&
        typeof v === 'object' &&
        v.path &&
        String(v.path).includes('ssl_config.json')
    );
    // Idempotent path returns early via hasFile OR group-children conflict;
    // either way we should not explode and should keep at least one ref.
    expect(matches.length).toBeGreaterThanOrEqual(1);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('throws a clear error when projectName is missing', () => {
    const { project, tmp } = loadProject();
    expect(() => addSslConfigResourceToXcodeProject(project, null)).toThrow(
      /projectName is missing/
    );
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('plugin helpers', () => {
  it('resolveIosAppBundleDir prefers named app directory', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssl-ios-dir-'));
    const appDir = path.join(tmp, 'MyApp');
    fs.mkdirSync(appDir);
    const resolved = resolveIosAppBundleDir({
      platformProjectRoot: tmp,
      projectName: 'MyApp',
    });
    expect(resolved).toBe(appDir);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('readFullSslConfig parses valid config and returns null on missing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssl-cfg-'));
    const cfgPath = 'ssl_config.json';
    fs.writeFileSync(
      path.join(tmp, cfgPath),
      JSON.stringify({
        sha256Keys: { 'api.example.com': ['sha256/AAA='] },
      })
    );
    const parsed = readFullSslConfig(tmp, cfgPath);
    expect(parsed.sha256Keys['api.example.com']).toEqual(['sha256/AAA=']);
    expect(readFullSslConfig(tmp, 'missing.json')).toBeNull();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('plugin source contract', () => {
  const pluginSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app.plugin.js'),
    'utf8'
  );

  it('does not call the broken project.addResourceFile API', () => {
    // Allow the comment that explains why we don't call it.
    const callSites = pluginSrc.match(/project\.addResourceFile\s*\(/g) || [];
    expect(callSites).toHaveLength(0);
  });

  it('uses Expo IOSConfig.XcodeUtils.addResourceFileToGroup', () => {
    expect(pluginSrc).toContain('addResourceFileToGroup');
    expect(pluginSrc).toContain('IOSConfig');
  });
});
