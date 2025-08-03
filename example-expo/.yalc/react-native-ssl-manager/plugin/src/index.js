import {
  withAndroidManifest,
  withInfoPlist,
  withXcodeProject,
} from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';
const withUseSslPinning = (config, options = {}) => {
  const { enableAndroid = true, enableIOS = true } = options;
  if (enableAndroid) {
    config = withAndroidManifest(config, (config) => {
      const { manifest } = config.modResults;
      // Add required permissions
      if (!manifest['uses-permission']) {
        manifest['uses-permission'] = [];
      }
      const permissions = Array.isArray(manifest['uses-permission'])
        ? manifest['uses-permission']
        : [manifest['uses-permission']];
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
      // Add ACCESS_NETWORK_STATE permission if not exists
      if (
        !permissions.find(
          (p) =>
            p.$['android:name'] === 'android.permission.ACCESS_NETWORK_STATE'
        )
      ) {
        permissions.push({
          $: {
            'android:name': 'android.permission.ACCESS_NETWORK_STATE',
          },
        });
      }
      manifest['uses-permission'] = permissions;
      return config;
    });
  }
  if (enableIOS) {
    config = withInfoPlist(config, (config) => {
      // Add any iOS-specific configurations if needed
      return config;
    });
    // Auto-switch podspec for Expo projects
    config = withXcodeProject(config, (config) => {
      // const xcodeProject = config.modResults; // Not used for now
      // Switch podspec to Expo module version
      const libraryPath = path.join(
        process.cwd(),
        'node_modules/react-native-ssl-manager'
      );
      const packageJsonPath = path.join(libraryPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, 'utf8')
          );
          if (packageJson['react-native'] && packageJson['react-native'].ios) {
            packageJson['react-native'].ios.podspec =
              'ios/react-native-ssl-manager.podspec';
            fs.writeFileSync(
              packageJsonPath,
              JSON.stringify(packageJson, null, 2)
            );
            console.log('✅ Auto-switched to Expo module podspec for iOS');
          }
        } catch (error) {
          console.warn('⚠️ Failed to auto-switch podspec:', error);
        }
      }
      return config;
    });
  }
  return config;
};
export default withUseSslPinning;
