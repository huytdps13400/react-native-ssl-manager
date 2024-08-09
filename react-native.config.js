module.exports = {
  dependencies: {
    'react-native-use-ssl-pinning': {
      platforms: {
        android: {
          packageImportPath: 'import com.usesslpinning.UseSslPinningPackage;',
          packageInstance: 'new UseSslPinningPackage()',
        },
      },
    },
  },
};
