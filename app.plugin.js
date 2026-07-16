const {
  withDangerousMod,
  withAndroidManifest,
  withXcodeProject,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin for react-native-ssl-manager
 * Automatically configures SSL pinning for Expo projects
 */
function withSslManager(config, options = {}) {
  const {
    enableAndroid = true,
    enableIOS = true,
    sslConfigPath = 'ssl_config.json',
  } = options;

  // Add Android configuration
  if (enableAndroid) {
    config = withAndroidSslPinning(config);
    config = withAndroidMainApplication(config);
    config = withAndroidAssets(config, { sslConfigPath });
    config = withAndroidNetworkSecurityConfig(config, { sslConfigPath });
    config = withAndroidNscManifest(config);
  }

  // Add iOS configuration
  if (enableIOS) {
    config = withIOSSslPinning(config);
    config = withIosAssets(config, { sslConfigPath });
  }

  return config;
}

/**
 * Configure Android SSL pinning
 */
function withAndroidSslPinning(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // Add required permissions
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }

    const permissions = Array.isArray(manifest.manifest['uses-permission'])
      ? manifest.manifest['uses-permission']
      : [manifest.manifest['uses-permission']];

    // Add INTERNET permission if not exists
    if (
      !permissions.find(
        (p) => p.$['android:name'] === 'android.permission.INTERNET'
      )
    ) {
      permissions.push({
        $: {
          'android:name': 'android.permission.INTERNET',
        },
      });
    }

    manifest.manifest['uses-permission'] = permissions;
    return config;
  });
}

/**
 * Configure Android MainApplication - No longer needed as autolinking handles package registration
 * Keeping function for backward compatibility but removing auto-registration to avoid duplicates
 */
function withAndroidMainApplication(config) {
  // No longer auto-register package - let autolinking handle it
  // This prevents duplicate module registration errors
  return config;
}

/**
 * Auto-copy SSL config to Android assets
 */
function withAndroidAssets(config, options) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const { sslConfigPath = 'ssl_config.json' } = options;

      try {
        const projectRoot = config.modRequest.projectRoot;
        const sourceConfigPath = path.resolve(projectRoot, sslConfigPath);

        if (fs.existsSync(sourceConfigPath)) {
          const assetsDir = path.join(
            config.modRequest.platformProjectRoot,
            'app/src/main/assets'
          );

          // Create assets directory if it doesn't exist
          if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
          }

          // Copy SSL config to assets
          const targetPath = path.join(assetsDir, 'ssl_config.json');
          fs.copyFileSync(sourceConfigPath, targetPath);
        } else {
          console.warn(`⚠️  SSL config file not found at: ${sourceConfigPath}`);
          console.warn(
            '💡 Place ssl_config.json in your project root for auto-setup'
          );
        }
      } catch (error) {
        console.warn('⚠️  Failed to auto-copy SSL config to assets:', error);
      }

      return config;
    },
  ]);
}

/**
 * Configure iOS SSL pinning - No Info.plist modification needed
 * SSL pinning is handled by SharedLogic.swift at runtime
 */
function withIOSSslPinning(config) {
  // No Info.plist modifications needed
  // SSL pinning is initialized at runtime by SharedLogic.swift

  return config;
}

/**
 * Auto-copy SSL config to iOS bundle resources and add to Xcode project
 */
function withIosAssets(config, options) {
  // First copy the file
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const { sslConfigPath = 'ssl_config.json' } = options;

      try {
        const projectRoot = config.modRequest.projectRoot;
        const sourceConfigPath = path.resolve(projectRoot, sslConfigPath);

        if (fs.existsSync(sourceConfigPath)) {
          // Create ios directory if it doesn't exist
          const iosDir = path.join(projectRoot, 'ios');
          if (!fs.existsSync(iosDir)) {
            fs.mkdirSync(iosDir, { recursive: true });
          }

          // Copy ssl_config.json to ios directory
          const targetConfigPath = path.join(iosDir, 'ssl_config.json');
          fs.copyFileSync(sourceConfigPath, targetConfigPath);

          // Also copy to app bundle directory for Xcode project
          const appBundleDir = path.join(iosDir, config.modRequest.projectName);
          const appBundleConfigPath = path.join(
            appBundleDir,
            'ssl_config.json'
          );
          if (fs.existsSync(appBundleDir)) {
            fs.copyFileSync(sourceConfigPath, appBundleConfigPath);
          }
        } else {
          console.warn(`⚠️  SSL config file not found at: ${sourceConfigPath}`);
          console.warn(
            '💡 Place ssl_config.json in your project root for auto-setup'
          );
        }
      } catch (error) {
        console.warn('⚠️  Failed to copy SSL config:', error);
      }

      return config;
    },
  ]);

  // Add ssl_config.json to the Xcode project using the Xcode project API
  // (robust) instead of regex string manipulation of project.pbxproj.
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;
    const fileName = 'ssl_config.json';
    const groupRelativePath = projectName
      ? `${projectName}/${fileName}`
      : fileName;

    // Skip if the resource is already referenced (idempotent prebuild).
    if (project.hasFile(groupRelativePath) || project.hasFile(fileName)) {
      return config;
    }

    try {
      const target = project.getFirstTarget().uuid;
      const mainGroup = project.getFirstProject().firstProject.mainGroup;

      // Add as a resource so it is copied into the app bundle at build time.
      project.addResourceFile(groupRelativePath, { target }, mainGroup);
    } catch (error) {
      console.warn(
        '⚠️  Failed to add ssl_config.json to Xcode project:',
        error.message
      );
      console.warn(
        '💡 File copied to ios/ directory, manual Xcode setup may be needed'
      );
    }

    return config;
  });

  return config;
}

const { generateNscXml, mergeNscXml } = require('./scripts/nsc-utils');

/**
 * Read and parse the full ssl_config.json, or null if not found/invalid.
 */
function readFullSslConfig(projectRoot, sslConfigPath) {
  const sourceConfigPath = path.resolve(projectRoot, sslConfigPath);
  if (!fs.existsSync(sourceConfigPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(sourceConfigPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Generate network_security_config.xml during Expo prebuild
 */
function withAndroidNetworkSecurityConfig(config, options) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const { sslConfigPath = 'ssl_config.json' } = options;
      const projectRoot = config.modRequest.projectRoot;
      const fullConfig = readFullSslConfig(projectRoot, sslConfigPath);
      const sha256Keys = (fullConfig && fullConfig.sha256Keys) || null;
      const domains = (fullConfig && fullConfig.domains) || undefined;

      if (!sha256Keys || Object.keys(sha256Keys).length === 0) {
        console.warn(
          '⚠️  No SSL pins found, skipping network_security_config.xml generation'
        );
        return config;
      }

      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/xml'
      );
      const xmlPath = path.join(xmlDir, 'network_security_config.xml');

      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }

      if (fs.existsSync(xmlPath)) {
        // Merge with existing
        const existingXml = fs.readFileSync(xmlPath, 'utf8');
        const mergedXml = mergeNscXml(existingXml, sha256Keys, domains);
        fs.writeFileSync(xmlPath, mergedXml);
        console.log(
          '✅ Merged SSL pins into existing network_security_config.xml'
        );
      } else {
        // Generate new
        const xml = generateNscXml(sha256Keys, domains);
        fs.writeFileSync(xmlPath, xml);
        console.log('✅ Generated network_security_config.xml');
      }

      return config;
    },
  ]);
}

/**
 * Patch AndroidManifest to reference network_security_config.xml
 */
function withAndroidNscManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];

    if (!application) {
      return config;
    }

    if (!application.$) {
      application.$ = {};
    }

    if (application.$['android:networkSecurityConfig']) {
      console.log(
        'ℹ️  AndroidManifest already has networkSecurityConfig, preserving existing'
      );
      return config;
    }

    application.$['android:networkSecurityConfig'] =
      '@xml/network_security_config';
    console.log('✅ Added networkSecurityConfig to AndroidManifest.xml');

    return config;
  });
}

module.exports = withSslManager;
