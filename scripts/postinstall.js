#!/usr/bin/env node

// React Native SSL Manager Post-Install Setup
//
// Bare React Native only. Expo apps should rely on the config plugin
// (app.plugin.js) — this script is a no-op when `expo` is present without a
// checked-in `android/` folder, and can always be disabled with:
//
//   SSL_MANAGER_SKIP_POSTINSTALL=1
//
// pnpm / monorepo note: isolated node_modules break the classic
// `../../node_modules/react-native-ssl-manager/...` path. We resolve the package
// via Node (works with pnpm symlinks) and skip host-file mutation when the
// layout is ambiguous rather than writing a broken apply-from line.

const fs = require('fs');
const path = require('path');
const {
  findProjectRoot,
  detectPackageManager,
  isMonorepo,
  isPnpmIsolated,
  buildApplyFromLine,
  shouldSkipMutatingHost,
} = require('./postinstall-lib');

console.log('🔧 React Native SSL Manager - Post-install setup');

const skipEnv =
  process.env.SSL_MANAGER_SKIP_POSTINSTALL === '1' ||
  process.env.SSL_MANAGER_SKIP_POSTINSTALL === 'true';

if (skipEnv) {
  console.log(
    'ℹ️ SSL_MANAGER_SKIP_POSTINSTALL is set — skipping host project mutation'
  );
  console.log(
    '💡 Expo: use the config plugin in app.json. Bare RN: see README monorepo section.'
  );
  process.exit(0);
}

/**
 * Resolve absolute path to this package's android/ssl-pinning-setup.gradle
 * using Node module resolution (works with pnpm, yarn, bun, npm).
 */
function resolveGradleScriptPath() {
  try {
    const pkgJson = require.resolve('react-native-ssl-manager/package.json', {
      paths: [process.cwd(), __dirname],
    });
    return path.join(path.dirname(pkgJson), 'android', 'ssl-pinning-setup.gradle');
  } catch {
    const local = path.join(
      __dirname,
      '..',
      'android',
      'ssl-pinning-setup.gradle'
    );
    if (fs.existsSync(local)) {
      return local;
    }
    return null;
  }
}

function printManualSetup(gradleScriptPath) {
  console.log('');
  console.log('📋 Manual Android setup (recommended for pnpm / monorepos):');
  console.log('   In android/app/build.gradle, add at the bottom:');
  if (gradleScriptPath) {
    console.log(
      '   apply from: "<path-to>/react-native-ssl-manager/android/ssl-pinning-setup.gradle"'
    );
    console.log(`   (resolved package script: ${gradleScriptPath})`);
  } else {
    console.log(
      "   // Prefer require.resolve so pnpm isolated installs keep working"
    );
    console.log(
      "   // apply from: <path relative to this file pointing at the package>"
    );
  }
  console.log('   Or rely on Expo config plugin + prebuild for Expo apps.');
  console.log(
    '   Set SSL_MANAGER_SKIP_POSTINSTALL=1 to silence this script permanently.'
  );
  console.log('');
}

// --- main -------------------------------------------------------------------

const projectRoot = findProjectRoot(process.cwd());

if (!projectRoot) {
  console.log(
    'ℹ️ No consumer React Native app root found; skipping host project setup'
  );
  process.exit(0);
}

const packageManager = detectPackageManager(projectRoot);
const monorepo = isMonorepo(projectRoot);
const pnpmIsolated =
  packageManager === 'pnpm' || isPnpmIsolated(projectRoot);
const force = process.env.SSL_MANAGER_FORCE_POSTINSTALL === '1';

console.log(`📂 Project root: ${projectRoot}`);
console.log(`📦 Package manager: ${packageManager}`);
if (monorepo) {
  console.log('📁 Monorepo layout detected');
}
if (pnpmIsolated) {
  console.log('🔗 pnpm-style isolated node_modules detected');
}

const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const deps = {
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {}),
};
const hasReactNative = Boolean(deps['react-native']);
const isExpoApp = Boolean(deps['expo']);

if (!hasReactNative) {
  console.log('ℹ️ Not a React Native project, skipping setup');
  process.exit(0);
}

if (isExpoApp && !fs.existsSync(path.join(projectRoot, 'android'))) {
  console.log(
    'ℹ️ Expo project without android/ — use the config plugin + `npx expo prebuild`'
  );
  process.exit(0);
}

const gradleScriptPath = resolveGradleScriptPath();
const androidBuildGradlePath = path.join(
  projectRoot,
  'android',
  'app',
  'build.gradle'
);

if (
  shouldSkipMutatingHost({ monorepo, pnpmIsolated, force, skipEnv: false })
) {
  console.log(
    'ℹ️ Skipping automatic build.gradle mutation on monorepo/pnpm isolated installs'
  );
  printManualSetup(gradleScriptPath);
  const sslConfigPath = path.join(projectRoot, 'ssl_config.json');
  if (fs.existsSync(sslConfigPath)) {
    console.log('✅ ssl_config.json found at project root');
  } else {
    console.log('⚠️ ssl_config.json not found at project root');
    console.log(
      '💡 Create ssl_config.json at project root for SSL pinning to work'
    );
  }
  console.log('🎉 React Native SSL Manager setup complete (non-mutating)!');
  process.exit(0);
}

if (fs.existsSync(androidBuildGradlePath) && gradleScriptPath) {
  console.log('📱 Android project detected');

  let buildGradleContent = fs.readFileSync(androidBuildGradlePath, 'utf8');

  if (!buildGradleContent.includes('ssl-pinning-setup.gradle')) {
    console.log('🔄 Adding SSL config auto-copy script to build.gradle');
    const applyLine = buildApplyFromLine(
      path.dirname(androidBuildGradlePath),
      gradleScriptPath
    );
    buildGradleContent += `\n\n// React Native SSL Manager - Auto-copy SSL config\n${applyLine}\n`;
    fs.writeFileSync(androidBuildGradlePath, buildGradleContent);
    console.log('✅ SSL config auto-copy script added successfully');
    console.log('💡 SSL config will now be automatically copied on build');
  } else {
    console.log('✅ SSL config auto-copy script already present');
  }

  console.log(
    '📋 Run "cd android && ./gradlew checkSslConfig" to verify setup'
  );
} else if (!fs.existsSync(androidBuildGradlePath)) {
  console.log('ℹ️ Android build.gradle not found, skipping Android setup');
} else {
  console.log(
    '⚠️ Could not resolve ssl-pinning-setup.gradle; skipping Android setup'
  );
  printManualSetup(null);
}

const sslConfigPath = path.join(projectRoot, 'ssl_config.json');
if (fs.existsSync(sslConfigPath)) {
  console.log('✅ ssl_config.json found at project root');
} else {
  console.log('⚠️ ssl_config.json not found at project root');
  console.log(
    '💡 Create ssl_config.json at project root for SSL pinning to work'
  );
}

const { generateNscXml, mergeNscXml } = require('./nsc-utils');
const androidDir = path.join(projectRoot, 'android');
if (fs.existsSync(androidDir) && fs.existsSync(sslConfigPath)) {
  console.log('🔄 Generating Android Network Security Config XML...');

  try {
    const sslConfig = JSON.parse(fs.readFileSync(sslConfigPath, 'utf8'));
    const sha256Keys = sslConfig.sha256Keys;
    const domains = sslConfig.domains;

    if (sha256Keys && Object.keys(sha256Keys).length > 0) {
      const xmlDir = path.join(androidDir, 'app', 'src', 'main', 'res', 'xml');
      const xmlPath = path.join(xmlDir, 'network_security_config.xml');

      if (fs.existsSync(xmlPath)) {
        const existingXml = fs.readFileSync(xmlPath, 'utf8');
        const mergedXml = mergeNscXml(existingXml, sha256Keys, domains);
        fs.writeFileSync(xmlPath, mergedXml);
        console.log(
          '✅ Merged SSL pins into existing network_security_config.xml'
        );
      } else {
        if (!fs.existsSync(xmlDir)) {
          fs.mkdirSync(xmlDir, { recursive: true });
        }
        const xml = generateNscXml(sha256Keys, domains);
        fs.writeFileSync(xmlPath, xml);
        console.log('✅ Generated network_security_config.xml');
      }

      const manifestPath = path.join(
        androidDir,
        'app',
        'src',
        'main',
        'AndroidManifest.xml'
      );
      if (fs.existsSync(manifestPath)) {
        let manifestContent = fs.readFileSync(manifestPath, 'utf8');
        if (!manifestContent.includes('android:networkSecurityConfig')) {
          manifestContent = manifestContent.replace(
            /(<application\b[^>]*)(>)/,
            '$1 android:networkSecurityConfig="@xml/network_security_config"$2'
          );
          fs.writeFileSync(manifestPath, manifestContent);
          console.log('✅ Added networkSecurityConfig to AndroidManifest.xml');
        } else {
          console.log(
            'ℹ️ AndroidManifest already has networkSecurityConfig reference'
          );
        }
      }
    } else {
      console.log(
        '⚠️ No sha256Keys in ssl_config.json, skipping XML generation'
      );
    }
  } catch (error) {
    console.warn(
      '⚠️ Failed to generate Network Security Config XML:',
      error.message
    );
  }
} else if (!fs.existsSync(androidDir)) {
  console.log('ℹ️ No android/ directory found, skipping NSC XML generation');
}

console.log('🎉 React Native SSL Manager setup complete!');
