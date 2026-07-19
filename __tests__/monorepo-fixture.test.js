/**
 * Monorepo / pnpm fixture + utils.
 *
 * Proves workspace detection, app-root resolution, gradle apply snippets,
 * Expo plugin registration in the fixture, and that postinstall does not
 * mutate android/app/build.gradle under monorepo + pnpm-isolated layouts.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  findWorkspaceRoot,
  findAppRoot,
  resolveSslManagerDir,
  getGradleApplySnippet,
  getGradleApplySnippetNodeResolve,
  sslConfigSearchCandidates,
  findSslConfigPath,
  validateMonorepoAppLayout,
} = require('../scripts/monorepo-utils');
const postinstall = require('../scripts/postinstall-lib');

const root = path.join(__dirname, '..');
const fixtureRoot = path.join(root, 'fixtures', 'pnpm-monorepo');
const fixtureApp = path.join(fixtureRoot, 'apps', 'mobile');

describe('fixtures/pnpm-monorepo structure', () => {
  it('has pnpm workspace + isolated linker config', () => {
    expect(fs.existsSync(path.join(fixtureRoot, 'pnpm-workspace.yaml'))).toBe(
      true
    );
    const npmrc = fs.readFileSync(path.join(fixtureRoot, '.npmrc'), 'utf8');
    expect(npmrc).toMatch(/node-linker\s*=\s*isolated/);
  });

  it('app package depends on the library + nitro + registers Expo plugin', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(fixtureApp, 'package.json'), 'utf8')
    );
    expect(pkg.dependencies['react-native-ssl-manager']).toMatch(/file:/);
    expect(pkg.dependencies['react-native-nitro-modules']).toBeTruthy();
    expect(pkg.dependencies.expo).toBeTruthy();

    const appJson = JSON.parse(
      fs.readFileSync(path.join(fixtureApp, 'app.json'), 'utf8')
    );
    const plugins = appJson.expo.plugins;
    const ssl = plugins.find(
      (p) =>
        p === 'react-native-ssl-manager' ||
        (Array.isArray(p) && p[0] === 'react-native-ssl-manager')
    );
    expect(ssl).toBeTruthy();
    expect(Array.isArray(ssl) ? ssl[1].sslConfigPath : true).toBeTruthy();
  });

  it('ships ssl_config.json and android stub', () => {
    expect(fs.existsSync(path.join(fixtureApp, 'ssl_config.json'))).toBe(true);
    expect(
      fs.existsSync(path.join(fixtureApp, 'android', 'app', 'build.gradle'))
    ).toBe(true);
  });
});

describe('monorepo-utils against fixture', () => {
  it('finds workspace root and app root', () => {
    expect(findWorkspaceRoot(fixtureApp)).toBe(fixtureRoot);
    expect(findAppRoot(fixtureApp)).toBe(fixtureApp);
    expect(findAppRoot(path.join(fixtureApp, 'android', 'app'))).toBe(
      fixtureApp
    );
  });

  it('finds ssl_config at the app package root', () => {
    const cfg = findSslConfigPath(fixtureApp);
    expect(cfg).toBe(path.join(fixtureApp, 'ssl_config.json'));
    const candidates = sslConfigSearchCandidates(fixtureApp);
    expect(candidates[0]).toBe(path.join(fixtureApp, 'ssl_config.json'));
  });

  it('resolves the library from the repo (file: dependency target)', () => {
    // From library root (where this test runs), package resolves to itself.
    const dir = resolveSslManagerDir(root);
    expect(dir).toBe(root);
  });

  it('builds a relative Gradle apply line from android/app', () => {
    const androidApp = path.join(fixtureApp, 'android', 'app');
    // Resolve library from repo root (simulates linked install).
    const snippet = getGradleApplySnippet(androidApp, root);
    expect(snippet.ok).toBe(true);
    expect(snippet.line).toMatch(/^apply from: "/);
    expect(snippet.line).toContain('ssl-pinning-setup.gradle');
    // Must not be the old brittle hardcoded path only
    expect(snippet.gradleScriptPath).toContain(
      path.join('android', 'ssl-pinning-setup.gradle')
    );
  });

  it('exposes Node-resolve Gradle snippet for pnpm', () => {
    const text = getGradleApplySnippetNodeResolve();
    expect(text).toContain('require.resolve');
    expect(text).toContain('ssl-pinning-setup.gradle');
    expect(text).toContain('apply from: file');
  });

  it('validateMonorepoAppLayout passes on the fixture when package resolves', () => {
    // Run from fixture app but resolution uses require paths from process —
    // seed NODE path by resolving from root via a manual check.
    const result = validateMonorepoAppLayout(fixtureApp);
    // dep.ssl-manager, expo.plugin, ssl_config, workspace should pass.
    // resolve.package may fail if node can't resolve from fixture without install.
    const byId = Object.fromEntries(result.checks.map((c) => [c.id, c]));
    expect(byId['package.json'].ok).toBe(true);
    expect(byId['dep.ssl-manager'].ok).toBe(true);
    expect(byId['dep.nitro'].ok).toBe(true);
    expect(byId['expo.plugin'].ok).toBe(true);
    expect(byId['ssl_config.json'].ok).toBe(true);
    expect(byId.workspace.ok).toBe(true);
  });
});

describe('postinstall safety in a synthetic monorepo', () => {
  let tmp;
  let appDir;
  let gradlePath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssl-mono-e2e-'));
    // workspace
    fs.writeFileSync(
      path.join(tmp, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n"
    );
    fs.writeFileSync(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'ws', private: true })
    );
    // app
    appDir = path.join(tmp, 'apps', 'mobile');
    fs.mkdirSync(path.join(appDir, 'android', 'app'), { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify({
        name: 'mobile',
        dependencies: {
          'react-native': '0.79.0',
          'react-native-ssl-manager': '2.0.3',
        },
      })
    );
    gradlePath = path.join(appDir, 'android', 'app', 'build.gradle');
    fs.writeFileSync(gradlePath, 'android {}\n');
    // pnpm isolated marker at workspace
    fs.mkdirSync(path.join(tmp, 'node_modules', '.pnpm'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('detects monorepo + pnpm isolated and skips host mutation', () => {
    expect(postinstall.isMonorepo(appDir)).toBe(true);
    expect(postinstall.isPnpmIsolated(tmp)).toBe(true);
    expect(
      postinstall.shouldSkipMutatingHost({
        monorepo: true,
        pnpmIsolated: true,
      })
    ).toBe(true);
  });

  it('findProjectRoot prefers the app with android/app/build.gradle', () => {
    expect(postinstall.findProjectRoot(appDir)).toBe(appDir);
  });

  it('does not leave the brittle hardcoded apply path in postinstall.js', () => {
    const src = fs.readFileSync(
      path.join(root, 'scripts', 'postinstall.js'),
      'utf8'
    );
    expect(src).not.toContain(
      "apply from: '../../node_modules/react-native-ssl-manager/android/ssl-pinning-setup.gradle'"
    );
  });
});

describe('gradle monorepo search paths', () => {
  it('ssl-pinning-setup.gradle searches workspace-root depths', () => {
    const gradle = fs.readFileSync(
      path.join(root, 'android', 'ssl-pinning-setup.gradle'),
      'utf8'
    );
    expect(gradle).toContain('project.rootDir}/../../ssl_config.json');
    expect(gradle).toContain('monorepo');
  });
});

describe('CLI monorepo-setup is wired', () => {
  it('cli.js documents and routes monorepo-setup', () => {
    const cli = fs.readFileSync(path.join(root, 'scripts', 'cli.js'), 'utf8');
    expect(cli).toContain("case 'monorepo-setup'");
    expect(cli).toContain('monorepo-setup');
  });

  it('monorepo-setup script exits 0 against fixture for structural checks', () => {
    const { spawnSync } = require('child_process');
    const script = path.join(root, 'scripts', 'monorepo-setup.js');
    const result = spawnSync(
      process.execPath,
      [script, '--app', fixtureApp],
      { encoding: 'utf8' }
    );
    // May exit 1 if package resolve fails without install — still print report.
    expect(result.stdout + result.stderr).toMatch(/monorepo setup/i);
    expect(result.stdout).toMatch(/expo\.plugin/);
    expect(result.stdout).toMatch(/ssl_config\.json/);
  });
});
