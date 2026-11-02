/**
 * B-Seva mobile config. app.json holds the base (Customer) config; this file applies the iOS variant.
 *
 *   BSEVA_APP unset / "customer" -> B-Seva         com.bseva.app     When-In-Use location only
 *   BSEVA_APP=pujari             -> B-Seva Pujari  com.bseva.pujari  Always location + "location" background mode
 *
 * BSEVA_IOS_BUNDLE_ID overrides the iOS bundle id (set by the eas.json profiles).
 *
 * Android is NOT selected here: android.package stays com.bseva.app and the Pujari Android app is the
 * Gradle flag -PbsevaApp=pujari (plugins/withBsevaAndroid.js + android-variants/). Use BSEVA_APP for iOS
 * builds only.
 */
import fs from "fs";
import path from "path";
import type { ConfigContext, ExpoConfig } from "expo/config";
import { withInfoPlist, type ConfigPlugin } from "expo/config-plugins";

type Variant = "customer" | "pujari";

const PUJARI_LOCATION_ALWAYS =
  "B-Seva Pujari uses your location during the pre-Puja travel period, including when the app is in the background, so the customer can track your arrival.";
const PUJARI_LOCATION_WHEN_IN_USE =
  "B-Seva Pujari uses your location during the pre-Puja travel period so the customer can track your arrival.";

const IOS_BACKGROUND_MODES: Record<Variant, string[]> = {
  customer: ["remote-notification"],
  pujari: ["remote-notification", "location"],
};

function readVariant(): Variant {
  const raw = (process.env.BSEVA_APP || "").trim().toLowerCase();
  if (!raw || raw === "customer") return "customer";
  if (raw === "pujari") return "pujari";
  throw new Error(`Unknown BSEVA_APP=${raw}; use "pujari", or leave it unset for the customer app`);
}

/**
 * Pins UIBackgroundModes to what the variant uses. expo-task-manager's plugin always adds "fetch"
 * (unused), and expo-location adds "location" when background is enabled. Registered first in the
 * plugin list so its mod runs last.
 */
const withIosBackgroundModes: ConfigPlugin<string[]> = (config, modes) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.UIBackgroundModes = [...modes];
    return cfg;
  });

function pluginName(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (Array.isArray(entry) && typeof entry[0] === "string") return entry[0];
  return undefined;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = readVariant();
  const base = config as ExpoConfig;
  const ios = { ...(base.ios || {}) };
  const infoPlist: Record<string, unknown> = { ...(ios.infoPlist || {}) };
  let plugins = [...(base.plugins || [])];
  let name = base.name;

  if (variant === "pujari") {
    name = "B-Seva Pujari";
    ios.bundleIdentifier = process.env.BSEVA_IOS_BUNDLE_ID?.trim() || "com.bseva.pujari";
    // 1024x1024 Pujari icon (same artwork as android-variants/pujari).
    ios.icon = "./assets/icon-pujari.png";
    infoPlist.CFBundleDisplayName = "B-Seva Pujari";
    infoPlist.NSLocationWhenInUseUsageDescription = PUJARI_LOCATION_WHEN_IN_USE;
    infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription = PUJARI_LOCATION_ALWAYS;
    infoPlist.NSLocationAlwaysUsageDescription = PUJARI_LOCATION_ALWAYS;

    // The bundled GoogleService-Info.plist is registered for com.bseva.app only.
    const pujariPlist = "./GoogleService-Info.pujari.plist";
    if (fs.existsSync(path.join(__dirname, pujariPlist))) ios.googleServicesFile = pujariPlist;
    else delete ios.googleServicesFile;

    plugins = plugins.map((entry) =>
      pluginName(entry) === "expo-location"
        ? [
            "expo-location",
            {
              isAndroidBackgroundLocationEnabled: true,
              isIosBackgroundLocationEnabled: true,
              locationWhenInUsePermission: PUJARI_LOCATION_WHEN_IN_USE,
              locationAlwaysAndWhenInUsePermission: PUJARI_LOCATION_ALWAYS,
              locationAlwaysPermission: PUJARI_LOCATION_ALWAYS,
            },
          ]
        : entry,
    );
  } else {
    ios.bundleIdentifier = process.env.BSEVA_IOS_BUNDLE_ID?.trim() || ios.bundleIdentifier || "com.bseva.app";
    delete infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription;
    delete infoPlist.NSLocationAlwaysUsageDescription;
  }

  infoPlist.UIBackgroundModes = IOS_BACKGROUND_MODES[variant];
  ios.infoPlist = infoPlist;

  return {
    ...base,
    name,
    ios,
    plugins: [[withIosBackgroundModes, IOS_BACKGROUND_MODES[variant]], ...plugins] as ExpoConfig["plugins"],
    extra: { ...(base.extra || {}), bsevaApp: variant },
  };
};
