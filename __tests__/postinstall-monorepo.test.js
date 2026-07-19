/**
 * Monorepo / pnpm isolation contract for postinstall helpers.
 * Customers with pnpm isolated node_modules must not get a broken
 * `apply from: '../../node_modules/...'` line written into build.gradle.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  findProjectRoot,
  detectPackageManager,
  isMonorepo,
  isPnpmIsolated,
  buildApplyFromLine,
  shouldSkipMutatingHost,
} = require('../scripts/postinstall-lib');

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

describe('postinstall monorepo / pnpm helpers', () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssl-postinstall-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('detects pnpm via lockfile', () => {
    fs.writeFileSync(path.join(tmp, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
    expect(detectPackageManager(tmp)).toBe('pnpm');
  });

  it('detects monorepo via pnpm-workspace.yaml', () => {
    fs.writeFileSync(path.join(tmp, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
    expect(isMonorepo(tmp)).toBe(true);
  });

  it('detects monorepo via package.json workspaces', () => {
    writeJson(path.join(tmp, 'package.json'), {
      name: 'root',
      workspaces: ['packages/*'],
    });
    expect(isMonorepo(tmp)).toBe(true);
  });

  it('detects pnpm isolated node_modules layout', () => {
    fs.mkdirSync(path.join(tmp, 'node_modules', '.pnpm'), { recursive: true });
    expect(isPnpmIsolated(tmp)).toBe(true);
  });

  it('prefers the app package that owns android/app/build.gradle', () => {
    const app = path.join(tmp, 'apps', 'mobile');
    writeJson(path.join(tmp, 'package.json'), {
      name: 'monorepo',
      workspaces: ['apps/*'],
      // no react-native at root
    });
    writeJson(path.join(app, 'package.json'), {
      name: 'mobile',
      dependencies: { 'react-native': '0.79.0' },
    });
    fs.mkdirSync(path.join(app, 'android', 'app'), { recursive: true });
    fs.writeFileSync(
      path.join(app, 'android', 'app', 'build.gradle'),
      'android {}\n'
    );

    const root = findProjectRoot(path.join(app, 'node_modules', 'react-native-ssl-manager'));
    // findProjectRoot walks up from startDir; simulate install cwd inside package
    const fromCwd = findProjectRoot(app);
    expect(fromCwd).toBe(app);
    expect(root).toBe(app);
  });

  it('skips host mutation for monorepo and pnpm isolated by default', () => {
    expect(
      shouldSkipMutatingHost({ monorepo: true, pnpmIsolated: false })
    ).toBe(true);
    expect(
      shouldSkipMutatingHost({ monorepo: false, pnpmIsolated: true })
    ).toBe(true);
    expect(
      shouldSkipMutatingHost({ monorepo: false, pnpmIsolated: false })
    ).toBe(false);
  });

  it('honors force / skip env flags', () => {
    expect(
      shouldSkipMutatingHost({
        monorepo: true,
        pnpmIsolated: true,
        force: true,
      })
    ).toBe(false);
    expect(
      shouldSkipMutatingHost({
        monorepo: false,
        pnpmIsolated: false,
        skipEnv: true,
      })
    ).toBe(true);
  });

  it('buildApplyFromLine uses a relative path, not hardcoded node_modules', () => {
    const androidApp = path.join(tmp, 'android', 'app');
    const script = path.join(
      tmp,
      'node_modules',
      'react-native-ssl-manager',
      'android',
      'ssl-pinning-setup.gradle'
    );
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.writeFileSync(script, '// gradle\n');

    const line = buildApplyFromLine(androidApp, script);
    expect(line).toContain('apply from:');
    expect(line).toContain('ssl-pinning-setup.gradle');
    // Relative from android/app → ../../node_modules/...
    expect(line).not.toMatch(/apply from: '\.\.\/\.\.\/node_modules\//);
    expect(line).toMatch(/apply from: "/);
  });

  it('legacy hardcoded path is gone from postinstall.js', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'postinstall.js'),
      'utf8'
    );
    expect(src).not.toContain(
      "apply from: '../../node_modules/react-native-ssl-manager/android/ssl-pinning-setup.gradle'"
    );
    expect(src).toContain('SSL_MANAGER_SKIP_POSTINSTALL');
    expect(src).toContain('shouldSkipMutatingHost');
  });
});
