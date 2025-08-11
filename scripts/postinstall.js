#!/usr/bin/env node

// React Native SSL Manager Post-Install Setup
// Automatically applies Gradle script for SSL config auto-copy
// Supports both npm/yarn and bun package managers

const fs = require('fs');
const path = require('path');

console.log('🔧 React Native SSL Manager - Post-install setup');

// Find project root (where node_modules is)
let projectRoot = process.cwd();
while (
  projectRoot !== '/' &&
  !fs.existsSync(path.join(projectRoot, 'node_modules')) &&
  !fs.existsSync(path.join(projectRoot, 'bun.lockb'))
) {
  projectRoot = path.dirname(projectRoot);
}

if (projectRoot === '/') {
  console.log('❌ Could not find project root');
  process.exit(1);
}

// Detect package manager
const isBun = fs.existsSync(path.join(projectRoot, 'bun.lockb'));
const packageManager = isBun ? 'Bun' : 'npm/yarn';

console.log(`📂 Project root: ${projectRoot}`);
console.log(`📦 Package manager: ${packageManager}`);

// Check if this is a React Native project
const packageJsonPath = path.join(projectRoot, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.log('❌ package.json not found');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const hasReactNative =
  packageJson.dependencies &&
  (packageJson.dependencies['react-native'] ||
    packageJson.devDependencies?.['react-native']);

if (!hasReactNative) {
  console.log('ℹ️ Not a React Native project, skipping setup');
  process.exit(0);
}

// Setup Android Gradle script
const androidBuildGradlePath = path.join(
  projectRoot,
  'android',
  'app',
  'build.gradle'
);
const sslGradleScriptPath = path.join(
  __dirname,
  '..',
  'android',
  'ssl-pinning-setup.gradle'
);

if (fs.existsSync(androidBuildGradlePath)) {
  console.log('📱 Android project detected');

  // Read current build.gradle
  let buildGradleContent = fs.readFileSync(androidBuildGradlePath, 'utf8');

  // Check if our script is already applied
  const scriptApplyLine =
    "apply from: '../../node_modules/react-native-ssl-manager/android/ssl-pinning-setup.gradle'";

  if (!buildGradleContent.includes('ssl-pinning-setup.gradle')) {
    console.log('🔄 Adding SSL config auto-copy script to build.gradle');

    // Add script at the end
    buildGradleContent += `\n\n// React Native SSL Manager - Auto-copy SSL config\n${scriptApplyLine}\n`;

    // Write back to file
    fs.writeFileSync(androidBuildGradlePath, buildGradleContent);
    console.log('✅ SSL config auto-copy script added successfully');
    console.log('💡 SSL config will now be automatically copied on build');
  } else {
    console.log('✅ SSL config auto-copy script already present');
  }

  console.log(
    '📋 Run "cd android && ./gradlew checkSslConfig" to verify setup'
  );
} else {
  console.log('ℹ️ Android build.gradle not found, skipping Android setup');
}

// Check for ssl_config.json in project root
const sslConfigPath = path.join(projectRoot, 'ssl_config.json');
if (fs.existsSync(sslConfigPath)) {
  console.log('✅ ssl_config.json found at project root');
} else {
  console.log('⚠️ ssl_config.json not found at project root');
  console.log(
    '💡 Create ssl_config.json at project root for SSL pinning to work'
  );
}

console.log('🎉 React Native SSL Manager setup complete!');
