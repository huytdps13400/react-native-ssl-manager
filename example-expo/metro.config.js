// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  const root = path.resolve(__dirname, '..');

  // Add watchFolders like React Native CLI
  config.watchFolders = [root];

  // Add resolver for local packages
  config.resolver = {
    ...config.resolver,
    // Add parent directory to node_modules paths
    nodeModulesPaths: [
      ...config.resolver.nodeModulesPaths,
      path.join(__dirname, 'node_modules'),
      path.join(root, 'node_modules'),
    ],
    // Add alias for react-native-ssl-manager
    alias: {
      ...config.resolver.alias,
      'react-native-ssl-manager': path.join(root, 'lib/index.js'),
    },
  };

  return config;
})();
