const {
  withInfoPlist,
  withDangerousMod,
  withXcodeProject,
  withAndroidManifest,
  withMainApplication,
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
 * Configure Android MainApplication to register SSL pinning package
 */
function withAndroidMainApplication(config) {
  return withMainApplication(config, (config) => {
    const { modResults } = config;

    // Add import for UseSslPinningPackage
    const importStatement = 'import com.usesslpinning.UseSslPinningPackage';
    if (!modResults.contents.includes(importStatement)) {
      // Find the last import statement and add after it
      const lastImportIndex = modResults.contents.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfLine = modResults.contents.indexOf('\n', lastImportIndex);
        modResults.contents =
          modResults.contents.slice(0, endOfLine + 1) +
          importStatement +
          '\n' +
          modResults.contents.slice(endOfLine + 1);
      }
    }

    // Add package to getPackages() method
    const packageAddition = 'packages.add(UseSslPinningPackage())';
    if (!modResults.contents.includes(packageAddition)) {
      // Find the comment line and replace it (works for both Java and Kotlin)
      const commentRegex = /\/\/\s*packages\.add\(MyReactNativePackage\(\)\)/;

      if (commentRegex.test(modResults.contents)) {
        // Replace the comment with our package
        modResults.contents = modResults.contents.replace(
          commentRegex,
          `${packageAddition}\n            // packages.add(MyReactNativePackage())`
        );
      } else {
        // Fallback: Add before return packages
        const returnRegex = /(return packages)/;
        if (returnRegex.test(modResults.contents)) {
          modResults.contents = modResults.contents.replace(
            returnRegex,
            `${packageAddition}\n            $1`
          );
        }
      }
    }

    return config;
  });
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

  // Add to Xcode project programmatically - run in same withDangerousMod as file copy
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      // First ensure file is copied to app bundle directory
      const projectName = config.modRequest.projectName || 'exampleexpo';
      const projectRoot = config.modRequest.projectRoot;
      const sourceConfigPath = path.resolve(projectRoot, 'ssl_config.json');
      const appBundleDir = path.join(
        config.modRequest.platformProjectRoot,
        projectName
      );
      const appBundleConfigPath = path.join(appBundleDir, 'ssl_config.json');

      // Ensure SSL config is copied to app bundle directory
      if (fs.existsSync(sourceConfigPath) && fs.existsSync(appBundleDir)) {
        fs.copyFileSync(sourceConfigPath, appBundleConfigPath);
      }

      try {
        const projectPath = path.join(
          config.modRequest.platformProjectRoot,
          `${projectName}.xcodeproj/project.pbxproj`
        );
        const sslConfigPath = appBundleConfigPath;

        if (!fs.existsSync(projectPath) || !fs.existsSync(sslConfigPath)) {
          console.warn(
            '⚠️  Xcode project or SSL config not found, skipping automatic addition'
          );
          return config;
        }

        let projectContent = fs.readFileSync(projectPath, 'utf8');

        // Check if already added
        if (projectContent.includes('ssl_config.json')) {
          return config;
        }

        // Generate unique IDs for the file
        const fileRefId =
          'SSL' + Math.random().toString(36).substr(2, 24).toUpperCase();
        const buildFileId =
          'SSL' + Math.random().toString(36).substr(2, 24).toUpperCase();

        // Add file reference
        const fileRefEntry = `\t\t${fileRefId} /* ssl_config.json */ = {isa = PBXFileReference; lastKnownFileType = text.json; path = ssl_config.json; sourceTree = "<group>"; };`;
        projectContent = projectContent.replace(
          '/* End PBXFileReference section */',
          fileRefEntry + '\n\t\t/* End PBXFileReference section */'
        );

        // Add build file
        const buildFileEntry = `\t\t${buildFileId} /* ssl_config.json in Resources */ = {isa = PBXBuildFile; fileRef = ${fileRefId} /* ssl_config.json */; };`;
        projectContent = projectContent.replace(
          '/* End PBXBuildFile section */',
          buildFileEntry + '\n\t\t/* End PBXBuildFile section */'
        );

        // Add to resources build phase
        const resourcesPhaseMatch = projectContent.match(
          /(\w+) \/\* Resources \*\/ = \{[^}]*files = \(([^)]*)\)/
        );
        if (resourcesPhaseMatch) {
          const filesSection = resourcesPhaseMatch[2];
          const newFilesSection =
            filesSection +
            `\t\t\t\t${buildFileId} /* ssl_config.json in Resources */,\n`;
          projectContent = projectContent.replace(
            `files = (${filesSection})`,
            `files = (\n${newFilesSection}\t\t\t)`
          );
        }

        // Add to main group
        const mainGroupMatch = projectContent.match(
          new RegExp(
            `(\\w+) /\\* ${projectName} \\*/ = \\{[^}]*children = \\(([^)]*)\\)`
          )
        );
        if (mainGroupMatch) {
          const childrenSection = mainGroupMatch[2];
          const newChildrenSection =
            childrenSection + `\t\t\t\t${fileRefId} /* ssl_config.json */,\n`;
          projectContent = projectContent.replace(
            `children = (${childrenSection})`,
            `children = (\n${newChildrenSection}\t\t\t)`
          );
        }

        // Write back to file
        fs.writeFileSync(projectPath, projectContent);
      } catch (error) {
        console.warn(
          '⚠️  Failed to add SSL config to Xcode project:',
          error.message
        );
        console.warn(
          '💡 File copied to ios/ directory, manual Xcode setup may be needed'
        );
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withSslManager;
