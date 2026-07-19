#!/usr/bin/env node
/**
 * Print monorepo / pnpm setup status and the exact Gradle snippet to paste.
 *
 * Usage (from the app package):
 *   npx react-native-ssl-manager monorepo-setup
 *   node path/to/scripts/monorepo-setup.js
 *   node scripts/monorepo-setup.js --app apps/mobile
 */

const path = require('path');
const {
  findAppRoot,
  findWorkspaceRoot,
  getGradleApplySnippet,
  getGradleApplySnippetNodeResolve,
  validateMonorepoAppLayout,
  formatValidationReport,
  resolveSslManagerDir,
} = require('./monorepo-utils');

function parseArgs(argv) {
  const args = { app: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--app' && argv[i + 1]) {
      args.app = path.resolve(argv[++i]);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const start = args.app || process.cwd();
  const appRoot = findAppRoot(start) || start;
  const workspace = findWorkspaceRoot(appRoot);

  console.log('🔧 react-native-ssl-manager — monorepo setup\n');
  console.log(`cwd:       ${process.cwd()}`);
  console.log(`app:       ${appRoot}`);
  console.log(`workspace: ${workspace || '(none detected)'}`);
  console.log('');

  const result = validateMonorepoAppLayout(appRoot);
  console.log(formatValidationReport(result));
  console.log('');

  const libDir = resolveSslManagerDir(appRoot);
  if (libDir) {
    console.log(`📦 Package resolved: ${libDir}`);
  }

  const androidApp = path.join(appRoot, 'android', 'app');
  console.log('\n── Android (bare RN or after prebuild) ──');
  console.log('Option A — relative apply (frozen after install):\n');
  const snippet = getGradleApplySnippet(androidApp, appRoot);
  if (snippet.ok) {
    console.log(snippet.line);
  } else {
    console.log(`// ${snippet.error}`);
    console.log('// Install the package in this app first, then re-run.');
  }

  console.log('\nOption B — Node resolve (pnpm-proof, recommended):\n');
  console.log(getGradleApplySnippetNodeResolve());

  console.log('\n── Expo ──');
  console.log('Prefer the config plugin; no postinstall required:');
  console.log(`
{
  "expo": {
    "plugins": [
      ["react-native-ssl-manager", { "sslConfigPath": "./ssl_config.json" }]
    ]
  }
}
`.trim());
  console.log('\nThen from the app package: npx expo prebuild --clean');

  console.log('\n── Env ──');
  console.log('SSL_MANAGER_SKIP_POSTINSTALL=1  # recommended in monorepos');

  process.exit(result.ok ? 0 : 1);
}

main();
