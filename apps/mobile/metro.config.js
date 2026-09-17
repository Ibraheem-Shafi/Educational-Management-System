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

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  expo: resolvePackage('expo'),
  nativewind: resolvePackage('nativewind'),
  'react-native-css-interop': resolvePackage('react-native-css-interop'),
};

module.exports = withNativeWind(config, { input: './global.css' });
