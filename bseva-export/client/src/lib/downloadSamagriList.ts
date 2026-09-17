import { api } from "@/lib/api";
import type { PreparationView } from "@/components/PreparationChecklist";
import { normalizePreparationSections, PREPARATION_SECTION_KEYS } from "@bseva/types";
import { shareSafely } from "@/lib/browserActions";

export type SamagriExportLabels = {
  brandedTitle: string;
  service: string;
  booking: string;
  pending: string;
  notes: string;
  item: string;
  tagline: string;
  documentTitle: string;
  popupBlocked: string;
  sections: Record<(typeof PREPARATION_SECTION_KEYS)[number], string>;
};

export function samagriExportLabels(t: (key: string) => string): SamagriExportLabels {
  return {
    brandedTitle: `${t("app.name")} — ${t("mobile.samagriList")}`,
    service: t("booking.service"),
    booking: t("mobile.bookingTitle"),
    pending: t("web.preparation.pending"),
    notes: t("booking.special"),
    item: t("mobile.samagri"),
    tagline: t("app.tagline"),
    documentTitle: t("web.preparation.title"),
    popupBlocked: t("web.preparation.popupBlocked"),
    sections: {
      included_bseva: t("web.preparation.section.included_bseva"),
      customer_arrange: t("web.preparation.section.customer_arrange"),
      prasadam: t("web.preparation.section.prasadam"),
      home_venue: t("web.preparation.section.home_venue"),
      optional: t("web.preparation.section.optional"),
    },
  };
}

function lineForItem(
  it: { name?: string; label?: string; quantity?: number | null; unit?: string | null; notes?: string | null },
  itemFallback: string,
) {
  const label =
    it.label ||
    (it.name && it.quantity != null
      ? `${it.name} — ${it.quantity}${it.unit ? ` ${it.unit}` : ""}`
      : it.name || itemFallback);
  return it.notes ? `${label} (${it.notes})` : label;
}

export function formatSamagriListText(
  preparation: PreparationView | null | undefined,
  meta: { serviceName?: string; bookingNumber?: string },
  labels: SamagriExportLabels,
): string {
  const lines: string[] = [];
  lines.push(labels.brandedTitle);
  if (meta.serviceName) lines.push(`${labels.service}: ${meta.serviceName}`);
  if (meta.bookingNumber) lines.push(`${labels.booking}: ${meta.bookingNumber}`);
  lines.push("");
  if (!preparation?.verified) {
    lines.push(preparation?.pending_message || labels.pending);
    return lines.join("\n");
  }
  const sections = normalizePreparationSections(preparation);
  for (const key of PREPARATION_SECTION_KEYS) {
    const items = sections[key];
    if (!items.length) continue;
    const title = labels.sections[key];
    lines.push(title);
    lines.push("-".repeat(title.length));
    for (const it of items) {
      lines.push(`• ${lineForItem(it, labels.item)}`);
    }
    lines.push("");
  }
  if (preparation.preparation_notes) {
    lines.push(labels.notes);
    lines.push(preparation.preparation_notes);
    lines.push("");
  }
  if (preparation.disclaimer) {
    lines.push(preparation.disclaimer);
  }
  return lines.join("\n").trim() + "\n";
}

async function loadSamagriText(bookingId: string, labels: SamagriExportLabels) {
  const [prep, detail] = await Promise.all([
    api<PreparationView>(`/bookings/${bookingId}/preparation`),
    api<{ service_name?: string; booking_number?: string }>(`/bookings/${bookingId}`),
  ]);
  const text = formatSamagriListText(prep, {
    serviceName: detail.service_name,
    bookingNumber: detail.booking_number,
  }, labels);
  return { detail, text };
}

export async function downloadSamagriListForBooking(bookingId: string, labels: SamagriExportLabels) {
  const { detail, text } = await loadSamagriText(bookingId, labels);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BSeva-Samagri-${detail.booking_number || bookingId}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] || char);
}

export async function printSamagriListForBooking(bookingId: string, labels: SamagriExportLabels) {
  const { detail, text } = await loadSamagriText(bookingId, labels);
  const popup = window.open("", "_blank");
  if (!popup) throw new Error(labels.popupBlocked);
  const mark = new URL("/bseva-mark.png", window.location.origin).href;
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(labels.documentTitle)}</title>
    <style>body{font-family:Arial,sans-serif;color:#1A2B4A;max-width:760px;margin:32px auto;padding:0 24px}
    header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #FF9933;padding-bottom:16px;margin-bottom:24px}
    .lockup{{display:flex;flex-direction:column;align-items:flex-start}}
    .name{{display:flex;align-items:center}}
    .name img{{width:48px;height:48px;object-fit:contain}}
    .word{{font-size:26px;font-weight:800;color:#FF9933;line-height:1}}
    .hyphen{{color:#1A2B4A}}
    .motto{{font-size:11px;font-style:italic;margin-top:4px;color:#1A2B4A}}
    h1{font-size:22px;margin:0;color:#1A2B4A}pre{font:14px/1.65 Arial,sans-serif;white-space:pre-wrap}
    @media print{body{margin:0;max-width:none}}</style></head><body>
    <header><div class="lockup"><div class="name"><img src="${escapeHtml(mark)}" alt=""><span class="word"><span class="hyphen">-</span>Seva</span></div><div class="motto">Book, Believe, Bless</div></div>
    <div><h1>${escapeHtml(labels.documentTitle)}</h1><div>${escapeHtml(detail.booking_number || "")}</div></div></header>
    <pre>${escapeHtml(text)}</pre></body></html>`);
  popup.document.close();
  popup.addEventListener("load", () => {
    popup.focus();
    popup.print();
  }, { once: true });
}

export async function shareSamagriListForBooking(bookingId: string, labels: SamagriExportLabels) {
  const { detail, text } = await loadSamagriText(bookingId, labels);
  return shareSafely({
    title: labels.documentTitle,
    text,
    url: `${window.location.origin}/booking/${encodeURIComponent(detail.booking_number || bookingId)}`,
  });
}
