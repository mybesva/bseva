import { Linking } from "react-native";

const PRODUCTION_SITE = "https://www.b-seva.com";

/**
 * Website the apps open for legal pages. Follows the API build target, so a QA build
 * (EXPO_PUBLIC_API_URL=https://qa.b-seva.com) opens qa.b-seva.com and a production build opens
 * www.b-seva.com. EXPO_PUBLIC_WEB_URL overrides it. Local and other hosts fall back to production,
 * because the dev API host does not serve the website.
 */
export function resolveWebBase(): string {
  const explicit = (process.env.EXPO_PUBLIC_WEB_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const api = (process.env.EXPO_PUBLIC_API_URL || "").trim();
  const match = /^(https?):\/\/([^/:?#]+)(:\d+)?/i.exec(api);
  if (!match) return PRODUCTION_SITE;
  const host = match[2].toLowerCase();
  if (host === "b-seva.com" || host === "www.b-seva.com") return PRODUCTION_SITE;
  if (host.endsWith(".b-seva.com")) return `https://${host}`;
  return PRODUCTION_SITE;
}

export const LEGAL_PATHS = {
  privacy: "/privacy-policy",
  customerTerms: "/customer-terms",
  pujariTerms: "/pujari-terms",
  appTerms: "/app-terms",
  refundPolicy: "/refund-policy",
  deleteAccount: "/delete-account",
} as const;

export type LegalPathKey = keyof typeof LEGAL_PATHS;

export function legalUrl(key: LegalPathKey): string {
  return `${resolveWebBase()}${LEGAL_PATHS[key]}`;
}

/** expo-web-browser is not installed in this app, so pages open in the system browser. */
export async function openWebPage(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    /* no browser available; nothing else to do */
  }
}

export function openLegal(key: LegalPathKey): Promise<void> {
  return openWebPage(legalUrl(key));
}
