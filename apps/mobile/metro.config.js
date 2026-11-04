const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const packagesRoot = path.resolve(projectRoot, "../../packages");

const config = getDefaultConfig(projectRoot);

// Shared TS packages live outside apps/mobile. Watch only packages/, not the
// whole repo, so Metro does not pick up bseva-export / backend.
config.watchFolders = [packagesRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.unstable_enableSymlinks = true;

// npm `file:` copies can lag behind new files in packages/. Resolve @bseva/*
// straight to the workspace source so Metro always sees the latest modules.
const extraNodeModules = { ...config.resolver.extraNodeModules };
if (fs.existsSync(packagesRoot)) {
  for (const dir of fs.readdirSync(packagesRoot)) {
    const pkgPath = path.join(packagesRoot, dir);
    const pkgJsonPath = path.join(pkgPath, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;
    const { name } = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    if (name) extraNodeModules[name] = pkgPath;
  }
}
config.resolver.extraNodeModules = extraNodeModules;

// extraNodeModules is only a fallback, so an old copy in node_modules/@bseva/* would still win.
// Send every @bseva/* import (and subpath) to the workspace source first.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const match = /^(@bseva\/[^/]+)(\/.*)?$/.exec(moduleName);
  const target = match && extraNodeModules[match[1]];
  const request = target ? path.join(target, match[2] || "") : moduleName;
  return defaultResolve ? defaultResolve(context, request, platform) : context.resolveRequest(context, request, platform);
};

module.exports = config;
