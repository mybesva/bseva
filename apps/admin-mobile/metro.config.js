const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const packagesRoot = path.resolve(projectRoot, "../../packages");

const config = getDefaultConfig(projectRoot);

// Shared TS packages live outside apps/mobile. Watch only packages/, not the
// whole repo, so Metro does not pick up bseva-export / backend.
config.watchFolders = [packagesRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
