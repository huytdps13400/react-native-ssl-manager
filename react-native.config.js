// React Native SSL Manager Auto-linking Configuration

module.exports = {
  dependencies: {
    'react-native-ssl-manager': {
      platforms: {
        android: {
          sourceDir: '../android',
          packageImportPath: 'import com.usesslpinning.UseSslPinningPackage;',
          packageInstance: 'new UseSslPinningPackage()',
          // Auto-setup SSL config copy script
          buildTypes: [],
          componentDescriptors: [],
          cmakeListsPath: null,
        },
        ios: {
          podspecPath: '../react-native-ssl-manager.podspec',
        },
      },
      hooks: {
        postlink: () => {
          console.log('🔗 React Native SSL Manager linked successfully');
          console.log('📋 SSL config auto-copy script is now available');
          console.log(
            '💡 Android: Run "cd android && ./gradlew checkSslConfig" to verify setup'
          );
          console.log(
            '💡 iOS: ssl_config.json will be auto-copied during build'
          );
        },
      },
    },
  },
};
