// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
module.exports = (() => {
  const projectRoot = __dirname;
  const workspaceRoot = path.resolve(projectRoot, '..');
  const config = getDefaultConfig(projectRoot);

  // Watch the library source so local edits hot-reload (file:.. package).
  config.watchFolders = [workspaceRoot];

  // Prefer the app's node_modules so we never load a second copy of
  // react / react-native / nitro from the monorepo root (that breaks
  // TurboModuleRegistry — PlatformConstants / NitroModules go missing).
  config.resolver.nodeModulesPaths = [
    path.join(projectRoot, 'node_modules'),
    path.join(workspaceRoot, 'node_modules'),
  ];

  config.resolver.disableHierarchicalLookup = true;

  config.resolver.extraNodeModules = {
    'react-native-ssl-manager': workspaceRoot,
    // Force singletons for native-sensitive packages
    'react': path.join(projectRoot, 'node_modules/react'),
    'react-native': path.join(projectRoot, 'node_modules/react-native'),
    'react-native-nitro-modules': path.join(
      projectRoot,
      'node_modules/react-native-nitro-modules'
    ),
  };

  // Resolve the library from source (package.json "main" is ./src/index.ts).
  // Do NOT alias to lib/index.js — that file is not produced by default.
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'react-native-ssl-manager') {
      return {
        filePath: path.join(workspaceRoot, 'src/index.ts'),
        type: 'sourceFile',
      };
    }
    // Default resolution
    return context.resolveRequest(context, moduleName, platform);
  };

  return config;
})();
