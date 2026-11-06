const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

function resolvePackage(name) {
  return path.dirname(
    require.resolve(`${name}/package.json`, {
      paths: [projectRoot, path.join(workspaceRoot, 'node_modules', 'nativewind'), workspaceRoot],
    }),
  );
}

// Gradle export:embed can start Metro at the npm workspace root. Keep the app root here
// so `expo-router/entry` resolves from apps/mobile/node_modules.
if (process.cwd() !== projectRoot) {
  process.chdir(projectRoot);
}

const config = getDefaultConfig(projectRoot);
config.projectRoot = projectRoot;
config.watchFolders = [workspaceRoot];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  expo: resolvePackage('expo'),
  nativewind: resolvePackage('nativewind'),
  'react-native-css-interop': resolvePackage('react-native-css-interop'),
  'expo-router': path.resolve(projectRoot, 'node_modules/expo-router'),
};

module.exports = withNativeWind(config, { input: './global.css' });
