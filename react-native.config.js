module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath:
          'import com.usesslpinning.UseSslPinningFactory;\nimport com.facebook.react.modules.network.OkHttpClientProvider;',
        packageInstance: 'new UseSslPinningPackage()',
      },
    },
  },
};
