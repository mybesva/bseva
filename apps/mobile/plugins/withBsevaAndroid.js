/**
 * Re-applies B-Seva's Android build setup, because android/ is generated and not in git.
 *
 * Both apps get release signing from ~/bseva-keys/<keyName>.properties.
 * With `variants: true` this project also builds two apps from one codebase:
 *   (no flag)         -> com.bseva.app     customer app, no background location
 *   -PbsevaApp=pujari -> com.bseva.pujari  name and icon from android-variants/pujari/res
 */
const fs = require("fs");
const path = require("path");
const {
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
  withMainActivity,
} = require("expo/config-plugins");

function replaceOrThrow(source, from, to) {
  if (!source.includes(from)) {
    throw new Error(`withBsevaAndroid: expected to find in build.gradle: ${from}`);
  }
  return source.replace(from, to);
}

const SIGNING_DEBUG = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;

const SIGNING_RELEASE = `        if (bsevaKeyProps.exists()) {
            def keys = new Properties()
            bsevaKeyProps.withInputStream { keys.load(it) }
            release {
                storeFile file(keys['storeFile'])
                storePassword keys['storePassword']
                keyAlias keys['keyAlias']
                keyPassword keys['keyPassword']
            }
        }
`;

const RELEASE_DEBUG_KEY = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
`;

const RELEASE_UPLOAD_KEY = `            // Upload key from ~/bseva-keys; Play rejects bundles that fall back to the debug key.
            signingConfig bsevaKeyProps.exists() ? signingConfigs.release : signingConfigs.debug
`;

const VARIANT_SETUP = `/**
 * B-Seva app variant, chosen at build time. Same JS code for both apps:
 *   (no flag)         -> com.bseva.app    B-Seva customer app
 *   -PbsevaApp=pujari -> com.bseva.pujari B-Seva Pujari (name + icon from src/variants/pujari/res)
 */
def bsevaApp = (findProperty('bsevaApp') ?: '').toString().trim()
def bsevaAppIds = [pujari: 'com.bseva.pujari']
if (bsevaApp && !bsevaAppIds.containsKey(bsevaApp)) {
    throw new GradleException("Unknown -PbsevaApp=\${bsevaApp}; use pujari, or no flag for the customer app")
}
def bsevaApplicationId = bsevaAppIds[bsevaApp] ?: 'com.bseva.app'
def bsevaKeyProps = new File(System.getProperty('user.home'), "bseva-keys/\${bsevaApp ?: 'customer'}.properties")

`;

const VARIANT_SOURCES = `    if (bsevaApp) {
        sourceSets {
            debug.res.srcDirs += "src/variants/\${bsevaApp}/res"
            release.res.srcDirs += "src/variants/\${bsevaApp}/res"
        }
    } else {
        sourceSets {
            release.manifest.srcFile "src/variants/customer/AndroidManifest.xml"
        }
    }
    defaultConfig {
`;

const FIREBASE_GUARD = `// Firebase config must list this package id. Until an app is added in the Firebase console
// (and google-services.json re-downloaded), build it without Firebase: push notifications are off.
if (file('google-services.json').text.contains("\\"\${bsevaApplicationId}\\"")) {
    apply plugin: 'com.google.gms.google-services'
} else {
    logger.warn("B-Seva: \${bsevaApplicationId} is not in google-services.json, building without Firebase (no push).")
}`;

const IME_IMPORTS = `import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
`;

// Android 15+ draws edge to edge, so adjustResize no longer shrinks the app for the keyboard.
const IME_PADDING = `
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
      ViewCompat.setOnApplyWindowInsetsListener(findViewById<View>(android.R.id.content)) { view, insets ->
        view.setPadding(0, 0, 0, insets.getInsets(WindowInsetsCompat.Type.ime()).bottom)
        insets
      }
    }
`;

function editMainActivity(source) {
  if (source.includes("WindowInsetsCompat")) return source;
  const onCreate = /(super\.onCreate\([^)]*\)\n)/;
  if (!onCreate.test(source)) throw new Error("withBsevaAndroid: expected super.onCreate in MainActivity");
  return source
    .replace("import android.os.Build\n", `import android.os.Build\n${IME_IMPORTS}`)
    .replace(onCreate, `$1${IME_PADDING}`);
}

function editBuildGradle(source, { keyName, variants }) {
  if (source.includes("bsevaKeyProps")) return source;
  let out = replaceOrThrow(source, SIGNING_DEBUG, SIGNING_DEBUG + SIGNING_RELEASE);
  out = replaceOrThrow(out, RELEASE_DEBUG_KEY, RELEASE_UPLOAD_KEY);
  if (!variants) {
    return replaceOrThrow(
      out,
      "android {\n",
      `def bsevaKeyProps = new File(System.getProperty('user.home'), 'bseva-keys/${keyName}.properties')\n\nandroid {\n`,
    );
  }
  out = replaceOrThrow(out, "android {\n", `${VARIANT_SETUP}android {\n`);
  out = replaceOrThrow(out, "    defaultConfig {\n", VARIANT_SOURCES);
  out = replaceOrThrow(out, "applicationId 'com.bseva.app'", "applicationId bsevaApplicationId");
  return replaceOrThrow(out, "apply plugin: 'com.google.gms.google-services'", FIREBASE_GUARD);
}

module.exports = function withBsevaAndroid(config, { keyName, variants = false }) {
  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = editBuildGradle(cfg.modResults.contents, { keyName, variants });
    return cfg;
  });

  config = withMainActivity(config, (cfg) => {
    cfg.modResults.contents = editMainActivity(cfg.modResults.contents);
    return cfg;
  });

  // The default 2 GB heap runs out while building all four architectures.
  config = withGradleProperties(config, (cfg) => {
    const jvmArgs = cfg.modResults.find((item) => item.type === "property" && item.key === "org.gradle.jvmargs");
    if (jvmArgs) jvmArgs.value = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";
    return cfg;
  });

  if (variants) {
    config = withDangerousMod(config, [
      "android",
      (cfg) => {
        const from = path.join(cfg.modRequest.projectRoot, "android-variants");
        const to = path.join(cfg.modRequest.platformProjectRoot, "app/src/variants");
        fs.cpSync(from, to, { recursive: true });
        return cfg;
      },
    ]);
  }
  return config;
};
