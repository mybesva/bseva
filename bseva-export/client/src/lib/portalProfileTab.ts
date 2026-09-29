export type ProfilePortalTabId = "profile" | "password" | "terms";

export function profileTabFromSearch(search: string): ProfilePortalTabId {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const tab = new URLSearchParams(raw).get("tab");
  if (tab === "password" || tab === "terms") return tab;
  return "profile";
}

export function profilePathWithTab(basePath: string, tab: ProfilePortalTabId): string {
  if (tab === "profile") return basePath;
  return `${basePath}?tab=${tab}`;
}

export type SupportContactTabId = "support" | "contact";

export function supportContactTabFromSearch(search: string): SupportContactTabId {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const tab = new URLSearchParams(raw).get("tab");
  return tab === "contact" ? "contact" : "support";
}

export function supportPathWithTab(basePath: string, tab: SupportContactTabId): string {
  if (tab === "support") return basePath;
  return `${basePath}?tab=${tab}`;
}
