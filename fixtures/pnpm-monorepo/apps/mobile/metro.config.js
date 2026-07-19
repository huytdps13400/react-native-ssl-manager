// Monorepo-safe Metro: single copies of react / RN / nitro from the app.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
// Library lives at repo root (three levels up from apps/mobile).
const libraryRoot = path.resolve(projectRoot, '../../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot, libraryRoot];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  'react-native-ssl-manager': libraryRoot,
  react: path.join(projectRoot, 'node_modules/react'),
  'react-native': path.join(projectRoot, 'node_modules/react-native'),
  'react-native-nitro-modules': path.join(
    projectRoot,
    'node_modules/react-native-nitro-modules'
  ),
};

module.exports = config;
