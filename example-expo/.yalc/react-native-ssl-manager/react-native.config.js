module.exports = {
  dependencies: {
    'react-native-ssl-manager': {
      platforms: {
        android: {
          packageImportPath:
            'import com.usesslpinning.cli.UseSslPinningPackage;',
          packageInstance: 'new UseSslPinningPackage()',
        },
        ios: {
          podspecPath: 'react-native-ssl-manager.podspec',
        },
      },
    },
  },
};
