module.exports = {
  dependencies: {
    'react-native-ssl-manager': {
      platforms: {
        android: {
          packageImportPath: 'import com.usesslpinning.UseSslPinningPackage;',
          packageInstance: 'new UseSslPinningPackage()',
        },
      },
    },
  },
};
