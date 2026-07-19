/**
 * Monorepo / pnpm helpers for consumers and tests.
 *
 * Goals:
 *  - Find the app package root vs workspace root
 *  - Resolve this library without hardcoded node_modules layouts
 *  - Emit a Gradle `apply from:` line that works under pnpm isolation
 *  - List ssl_config.json search candidates for monorepo depths
 */

const fs = require('fs');
const path = require('path');

const LIBRARY_NAME = 'react-native-ssl-manager';

/**
 * Walk up looking for pnpm-workspace.yaml or package.json#workspaces.
 */
function findWorkspaceRoot(startDir) {
  let dir = path.resolve(startDir);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces) {
          return dir;
        }
      } catch {
        // ignore
      }
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * App root = nearest package.json that depends on react-native and is not
 * this library. Prefer a directory that already has android/app or app.json.
 */
function findAppRoot(startDir, libraryName = LIBRARY_NAME) {
  let dir = path.resolve(startDir);
  let fallback = null;

  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === libraryName) {
          dir = path.dirname(dir);
          continue;
        }
        const deps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        };
        if (deps['react-native'] || deps['expo']) {
          const looksLikeApp =
            fs.existsSync(path.join(dir, 'app.json')) ||
            fs.existsSync(path.join(dir, 'app.config.js')) ||
            fs.existsSync(path.join(dir, 'app.config.ts')) ||
            fs.existsSync(path.join(dir, 'android', 'app', 'build.gradle')) ||
            fs.existsSync(path.join(dir, 'ios'));
          if (looksLikeApp) {
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

/**
 * Resolve absolute path to a package directory via Node module resolution
 * (works with pnpm symlinks / .pnpm store).
 */
function resolvePackageDir(packageName, fromDir = process.cwd()) {
  try {
    const pkgJson = require.resolve(`${packageName}/package.json`, {
      paths: [fromDir],
    });
    return path.dirname(pkgJson);
  } catch {
    return null;
  }
}

/**
 * Resolve react-native-ssl-manager package dir.
 * 1) require.resolve (installed / linked)
 * 2) package.json dependency `file:…` (fixtures / monorepo without install yet)
 * 3) walk up for a package.json named react-native-ssl-manager
 */
function resolveSslManagerDir(fromDir = process.cwd()) {
  const viaNode = resolvePackageDir(LIBRARY_NAME, fromDir);
  if (viaNode) {
    return viaNode;
  }

  const start = path.resolve(fromDir);
  const appRoot = findAppRoot(start) || start;
  const pkgPath = path.join(appRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };
      const spec = deps[LIBRARY_NAME];
      if (typeof spec === 'string' && spec.startsWith('file:')) {
        const target = path.resolve(appRoot, spec.slice('file:'.length));
        if (
          fs.existsSync(path.join(target, 'package.json')) ||
          fs.existsSync(path.join(target, 'android', 'ssl-pinning-setup.gradle'))
        ) {
          return target;
        }
      }
    } catch {
      // ignore
    }
  }

  let dir = start;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (pkg.name === LIBRARY_NAME) {
          return dir;
        }
      } catch {
        // ignore
      }
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Relative Gradle apply line from android/app → ssl-pinning-setup.gradle
 */
function getGradleApplySnippet(androidAppDir, fromDir = process.cwd()) {
  const libDir = resolveSslManagerDir(fromDir);
  if (!libDir) {
    return {
      ok: false,
      error: `Could not resolve ${LIBRARY_NAME} from ${fromDir}`,
      line: null,
      gradleScriptPath: null,
    };
  }
  const gradleScriptPath = path.join(
    libDir,
    'android',
    'ssl-pinning-setup.gradle'
  );
  if (!fs.existsSync(gradleScriptPath)) {
    return {
      ok: false,
      error: `ssl-pinning-setup.gradle missing at ${gradleScriptPath}`,
      line: null,
      gradleScriptPath,
    };
  }
  const rel = path
    .relative(path.resolve(androidAppDir), gradleScriptPath)
    .split(path.sep)
    .join('/');
  return {
    ok: true,
    error: null,
    line: `apply from: "${rel}"`,
    gradleScriptPath,
  };
}

/**
 * Node-based Gradle apply that does not depend on relative node_modules.
 * Useful when the consumer prefers providers.exec over a frozen relative path.
 */
function getGradleApplySnippetNodeResolve() {
  return [
    '// react-native-ssl-manager — monorepo / pnpm safe apply',
    'def __sslManagerGradle = providers.exec {',
    "  workingDir = rootDir",
    "  commandLine 'node', '--print', \"require('path').join(require('path').dirname(require.resolve('react-native-ssl-manager/package.json')), 'android/ssl-pinning-setup.gradle')\"",
    '}.standardOutput.asText.get().trim()',
    'apply from: file(__sslManagerGradle)',
  ].join('\n');
}

/**
 * Places to look for ssl_config.json from an app package root.
 */
function sslConfigSearchCandidates(appRoot) {
  const root = path.resolve(appRoot);
  const workspace = findWorkspaceRoot(root);
  const candidates = [
    path.join(root, 'ssl_config.json'),
    path.join(root, 'android', 'ssl_config.json'),
    path.join(root, 'config', 'ssl_config.json'),
  ];
  if (workspace && workspace !== root) {
    candidates.push(path.join(workspace, 'ssl_config.json'));
  }
  return candidates;
}

function findSslConfigPath(appRoot) {
  for (const candidate of sslConfigSearchCandidates(appRoot)) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Validate a monorepo app layout for SSL manager integration.
 * Returns { ok, checks: [{ id, ok, detail }] }.
 */
function validateMonorepoAppLayout(appRoot) {
  const checks = [];
  const root = path.resolve(appRoot);

  const pkgPath = path.join(root, 'package.json');
  const hasPkg = fs.existsSync(pkgPath);
  checks.push({
    id: 'package.json',
    ok: hasPkg,
    detail: hasPkg ? pkgPath : 'missing package.json',
  });

  let deps = {};
  if (hasPkg) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    } catch (error) {
      checks.push({
        id: 'package.json.parse',
        ok: false,
        detail: String(error.message || error),
      });
    }
  }

  const hasSsl = Boolean(deps[LIBRARY_NAME]);
  checks.push({
    id: 'dep.ssl-manager',
    ok: hasSsl,
    detail: hasSsl
      ? `${LIBRARY_NAME} in dependencies`
      : `add ${LIBRARY_NAME} to the app package (not only workspace root)`,
  });

  const hasNitro = Boolean(deps['react-native-nitro-modules']);
  checks.push({
    id: 'dep.nitro',
    ok: hasNitro,
    detail: hasNitro
      ? 'react-native-nitro-modules present'
      : 'peer react-native-nitro-modules required',
  });

  const isExpo = Boolean(deps.expo);
  const appJsonPath = path.join(root, 'app.json');
  const appConfigJs = path.join(root, 'app.config.js');
  const hasExpoConfig =
    fs.existsSync(appJsonPath) || fs.existsSync(appConfigJs);

  if (isExpo || hasExpoConfig) {
    let pluginOk = false;
    let pluginDetail = 'plugin not registered in app.json/app.config';
    if (fs.existsSync(appJsonPath)) {
      try {
        const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
        const plugins = (appJson.expo && appJson.expo.plugins) || [];
        pluginOk = plugins.some(
          (p) =>
            p === LIBRARY_NAME ||
            (Array.isArray(p) && p[0] === LIBRARY_NAME)
        );
        pluginDetail = pluginOk
          ? 'Expo config plugin registered'
          : `add ["${LIBRARY_NAME}", { "sslConfigPath": "./ssl_config.json" }] to expo.plugins`;
      } catch (error) {
        pluginDetail = `app.json parse error: ${error.message}`;
      }
    }
    checks.push({ id: 'expo.plugin', ok: pluginOk, detail: pluginDetail });
  }

  const sslConfig = findSslConfigPath(root);
  checks.push({
    id: 'ssl_config.json',
    ok: Boolean(sslConfig),
    detail: sslConfig || 'create ssl_config.json in the app package root',
  });

  const workspaceRoot = findWorkspaceRoot(root);
  checks.push({
    id: 'workspace',
    ok: Boolean(workspaceRoot),
    detail: workspaceRoot
      ? `workspace root: ${workspaceRoot}`
      : 'no pnpm-workspace.yaml / workspaces field above app (standalone ok)',
  });

  const libDir = resolveSslManagerDir(root);
  checks.push({
    id: 'resolve.package',
    ok: Boolean(libDir),
    detail: libDir
      ? `resolved ${LIBRARY_NAME} → ${libDir}`
      : `cannot require.resolve('${LIBRARY_NAME}') from app — check install filter`,
  });

  const androidApp = path.join(root, 'android', 'app');
  if (fs.existsSync(path.join(androidApp, 'build.gradle'))) {
    const snippet = getGradleApplySnippet(androidApp, root);
    checks.push({
      id: 'android.gradle-apply',
      ok: snippet.ok,
      detail: snippet.ok
        ? `suggested: ${snippet.line}`
        : snippet.error || 'could not build apply line',
    });
  } else {
    checks.push({
      id: 'android.gradle-apply',
      ok: true,
      detail: 'no android/app yet (Expo prebuild will generate it)',
    });
  }

  const ok = checks.every((c) => c.ok);
  return { ok, appRoot: root, workspaceRoot, checks };
}

/**
 * Build a printable setup report for CI / CLI.
 */
function formatValidationReport(result) {
  const lines = [];
  lines.push(`App root: ${result.appRoot}`);
  if (result.workspaceRoot) {
    lines.push(`Workspace: ${result.workspaceRoot}`);
  }
  lines.push('');
  for (const check of result.checks) {
    lines.push(`${check.ok ? '✅' : '❌'} ${check.id}: ${check.detail}`);
  }
  lines.push('');
  lines.push(result.ok ? 'Monorepo app layout: OK' : 'Monorepo app layout: NEEDS FIXES');
  return lines.join('\n');
}

module.exports = {
  LIBRARY_NAME,
  findWorkspaceRoot,
  findAppRoot,
  resolvePackageDir,
  resolveSslManagerDir,
  getGradleApplySnippet,
  getGradleApplySnippetNodeResolve,
  sslConfigSearchCandidates,
  findSslConfigPath,
  validateMonorepoAppLayout,
  formatValidationReport,
};
