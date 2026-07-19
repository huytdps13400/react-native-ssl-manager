/**
 * Pure helpers for postinstall path resolution.
 * Kept separate so unit tests can import without executing the installer.
 */

const fs = require('fs');
const path = require('path');

function findProjectRoot(startDir, libraryName = 'react-native-ssl-manager') {
  let dir = startDir;
  let fallback = null;

  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        };
        const hasRn = Boolean(deps['react-native']);
        const isThisLibrary = pkg.name === libraryName;
        const hasAndroidApp = fs.existsSync(
          path.join(dir, 'android', 'app', 'build.gradle')
        );

        if (hasRn && !isThisLibrary) {
          if (hasAndroidApp) {
            return dir;
          }
          if (!fallback) {
            fallback = dir;
          }
        }
      } catch {
        // ignore
      }
    }
    dir = path.dirname(dir);
  }

  return fallback;
}

function detectPackageManager(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectRoot, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(projectRoot, 'bun.lock'))) return 'bun';
  if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectRoot, 'package-lock.json'))) return 'npm';
  return 'unknown';
}

function isMonorepo(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, 'pnpm-workspace.yaml'))) return true;
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
    );
    if (pkg.workspaces) return true;
  } catch {
    // ignore
  }
  const parent = path.dirname(projectRoot);
  if (fs.existsSync(path.join(parent, 'pnpm-workspace.yaml'))) return true;
  try {
    const parentPkg = JSON.parse(
      fs.readFileSync(path.join(parent, 'package.json'), 'utf8')
    );
    if (parentPkg.workspaces) return true;
  } catch {
    // ignore
  }
  return false;
}

function isPnpmIsolated(projectRoot) {
  return (
    fs.existsSync(path.join(projectRoot, 'node_modules', '.pnpm')) ||
    fs.existsSync(path.join(path.dirname(projectRoot), 'node_modules', '.pnpm'))
  );
}

function buildApplyFromLine(androidAppDir, gradleScriptPath) {
  const rel = path
    .relative(androidAppDir, gradleScriptPath)
    .split(path.sep)
    .join('/');
  return `apply from: "${rel}"`;
}

function shouldSkipMutatingHost({
  monorepo,
  pnpmIsolated,
  force = false,
  skipEnv = false,
}) {
  if (skipEnv) return true;
  if (force) return false;
  return Boolean(monorepo || pnpmIsolated);
}

module.exports = {
  findProjectRoot,
  detectPackageManager,
  isMonorepo,
  isPnpmIsolated,
  buildApplyFromLine,
  shouldSkipMutatingHost,
};
