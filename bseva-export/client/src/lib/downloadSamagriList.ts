import { api } from "@/lib/api";
import type { PreparationView } from "@/components/PreparationChecklist";
import { normalizePreparationSections, PREPARATION_SECTION_KEYS } from "@bseva/types";
import { shareSafely } from "@/lib/browserActions";
import {
  downloadBSevaDocument,
  escapeDocumentHtml,
  printBSevaDocument,
} from "@/lib/bsevaDocument";

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
  options?: { branded?: boolean },
): string {
  const lines: string[] = [];
  if (options?.branded !== false) {
    lines.push(labels.brandedTitle);
  }
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

async function loadSamagriText(bookingId: string, labels: SamagriExportLabels, branded = true) {
  const [prep, detail] = await Promise.all([
    api<PreparationView>(`/bookings/${bookingId}/preparation`),
    api<{ service_name?: string; booking_number?: string }>(`/bookings/${bookingId}`),
  ]);
  const text = formatSamagriListText(prep, {
    serviceName: detail.service_name,
    bookingNumber: detail.booking_number,
  }, labels, { branded });
  return { detail, text };
}

export async function downloadSamagriListForBooking(bookingId: string, labels: SamagriExportLabels) {
  const { detail, text } = await loadSamagriText(bookingId, labels, false);
  downloadBSevaDocument(`BSeva-Samagri-${detail.booking_number || bookingId}.html`, {
    documentTitle: labels.documentTitle,
    pageTitle: labels.brandedTitle,
    reference: detail.booking_number,
    bodyHtml: `<pre class="bseva-doc-pre">${escapeDocumentHtml(text)}</pre>`,
  });
}

export async function printSamagriListForBooking(bookingId: string, labels: SamagriExportLabels) {
  const { detail, text } = await loadSamagriText(bookingId, labels, false);
  printBSevaDocument(
    {
      documentTitle: labels.documentTitle,
      pageTitle: labels.brandedTitle,
      reference: detail.booking_number,
      bodyHtml: `<pre class="bseva-doc-pre">${escapeDocumentHtml(text)}</pre>`,
    },
    labels.popupBlocked,
  );
}

export async function shareSamagriListForBooking(bookingId: string, labels: SamagriExportLabels) {
  const { detail, text } = await loadSamagriText(bookingId, labels);
  return shareSafely({
    title: labels.documentTitle,
    text,
    url: `${window.location.origin}/booking/${encodeURIComponent(detail.booking_number || bookingId)}`,
  });
}
