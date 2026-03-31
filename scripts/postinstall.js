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

// Generate Network Security Config XML for Android
const androidDir = path.join(projectRoot, 'android');
if (fs.existsSync(androidDir) && fs.existsSync(sslConfigPath)) {
  console.log('🔄 Generating Android Network Security Config XML...');

  try {
    const sslConfig = JSON.parse(fs.readFileSync(sslConfigPath, 'utf8'));
    const sha256Keys = sslConfig.sha256Keys;

    if (sha256Keys && Object.keys(sha256Keys).length > 0) {
      const xmlDir = path.join(
        androidDir,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      const xmlPath = path.join(xmlDir, 'network_security_config.xml');

      // Default expiration: 1 year from now
      const expDate = new Date();
      expDate.setFullYear(expDate.getFullYear() + 1);
      const expiration = expDate.toISOString().split('T')[0];

      if (fs.existsSync(xmlPath)) {
        // Merge with existing NSC
        let existingXml = fs.readFileSync(xmlPath, 'utf8');
        for (const [domain, pins] of Object.entries(sha256Keys)) {
          const pinSetXml = pins
            .map((pin) => {
              const cleanPin = pin.replace(/^sha256\//, '');
              return `            <pin digest="SHA-256">${cleanPin}</pin>`;
            })
            .join('\n');

          const domainConfigBlock =
            `    <domain-config cleartextTrafficPermitted="false">\n` +
            `        <domain includeSubdomains="true">${domain}</domain>\n` +
            `        <pin-set expiration="${expiration}">\n` +
            `${pinSetXml}\n` +
            `        </pin-set>\n` +
            `    </domain-config>`;

          const domainRegex = new RegExp(
            `<domain-config[^>]*>\\s*<domain[^>]*>${domain.replace(/\./g, '\\.')}</domain>[\\s\\S]*?</domain-config>`,
            'g'
          );

          if (domainRegex.test(existingXml)) {
            console.log(`⚠️ Replacing existing pin-set for domain: ${domain}`);
            existingXml = existingXml.replace(domainRegex, domainConfigBlock);
          } else {
            existingXml = existingXml.replace(
              '</network-security-config>',
              `${domainConfigBlock}\n</network-security-config>`
            );
          }
        }
        fs.writeFileSync(xmlPath, existingXml);
        console.log(
          '✅ Merged SSL pins into existing network_security_config.xml'
        );
      } else {
        // Generate new XML
        if (!fs.existsSync(xmlDir)) {
          fs.mkdirSync(xmlDir, { recursive: true });
        }

        let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
        xml += '<network-security-config>\n';
        for (const [domain, pins] of Object.entries(sha256Keys)) {
          xml += '    <domain-config cleartextTrafficPermitted="false">\n';
          xml += `        <domain includeSubdomains="true">${domain}</domain>\n`;
          xml += `        <pin-set expiration="${expiration}">\n`;
          for (const pin of pins) {
            const cleanPin = pin.replace(/^sha256\//, '');
            xml += `            <pin digest="SHA-256">${cleanPin}</pin>\n`;
          }
          xml += '        </pin-set>\n';
          xml += '    </domain-config>\n';
        }
        xml += '</network-security-config>\n';

        fs.writeFileSync(xmlPath, xml);
        console.log('✅ Generated network_security_config.xml');
      }

      // Patch AndroidManifest.xml
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
      console.log('⚠️ No sha256Keys in ssl_config.json, skipping XML generation');
    }
  } catch (error) {
    console.warn('⚠️ Failed to generate Network Security Config XML:', error.message);
  }
} else if (!fs.existsSync(androidDir)) {
  console.log('ℹ️ No android/ directory found, skipping NSC XML generation');
}

console.log('🎉 React Native SSL Manager setup complete!');
