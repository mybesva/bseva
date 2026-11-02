export type ProfilePortalTabId = "profile" | "address" | "password" | "terms" | "account";

export function profileTabFromSearch(search: string): ProfilePortalTabId {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const tab = new URLSearchParams(raw).get("tab");
  if (tab === "address" || tab === "password" || tab === "terms" || tab === "account") return tab;
  return "profile";
}

export function profilePathWithTab(basePath: string, tab: ProfilePortalTabId): string {
  if (tab === "profile") return basePath;
  return `${basePath}?tab=${tab}`;
}

export type SupportContactTabId = "support" | "contact" | "reports";

export function supportContactTabFromSearch(search: string): SupportContactTabId {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const tab = new URLSearchParams(raw).get("tab");
  return tab === "contact" || tab === "reports" ? tab : "support";
}

export function supportPathWithTab(basePath: string, tab: SupportContactTabId): string {
  if (tab === "support") return basePath;
  return `${basePath}?tab=${tab}`;
}
