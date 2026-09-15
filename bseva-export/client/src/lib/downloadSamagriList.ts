import { api } from "@/lib/api";
import type { PreparationView } from "@/components/PreparationChecklist";

function lineForItem(it: { name?: string; label?: string; quantity?: number | null; unit?: string | null; notes?: string | null }) {
  const label =
    it.label ||
    (it.name && it.quantity != null
      ? `${it.name} — ${it.quantity}${it.unit ? ` ${it.unit}` : ""}`
      : it.name || "Item");
  return it.notes ? `${label} (${it.notes})` : label;
}

export function formatSamagriListText(
  preparation: PreparationView | null | undefined,
  meta: { serviceName?: string; bookingNumber?: string }
): string {
  const lines: string[] = [];
  lines.push("BSeva — Samagri list");
  if (meta.serviceName) lines.push(`Service: ${meta.serviceName}`);
  if (meta.bookingNumber) lines.push(`Booking: ${meta.bookingNumber}`);
  lines.push("");
  if (!preparation?.verified) {
    lines.push(preparation?.pending_message || "Samagri list is being finalized.");
    return lines.join("\n");
  }
  const sections = preparation.sections || {};
  const order: { key: string; title: string }[] = [
    { key: "included_bseva", title: "Included with Samagri package" },
    { key: "customer_arrange", title: "Customer to arrange" },
    { key: "prasadam", title: "Prasadam / Naivedyam" },
    { key: "home_venue", title: "Home / venue setup" },
    { key: "optional", title: "Optional" },
  ];
  for (const sec of order) {
    const items = sections[sec.key] || [];
    if (!items.length) continue;
    lines.push(sec.title);
    lines.push("-".repeat(sec.title.length));
    for (const it of items) {
      lines.push(`• ${lineForItem(it)}`);
    }
    lines.push("");
  }
  if (preparation.preparation_notes) {
    lines.push("Notes");
    lines.push(preparation.preparation_notes);
    lines.push("");
  }
  if (preparation.disclaimer) {
    lines.push(preparation.disclaimer);
  }
  return lines.join("\n").trim() + "\n";
}

export async function downloadSamagriListForBooking(bookingId: string) {
  const [prep, detail] = await Promise.all([
    api<PreparationView>(`/bookings/${bookingId}/preparation`),
    api<{ service_name?: string; booking_number?: string }>(`/bookings/${bookingId}`),
  ]);
  const text = formatSamagriListText(prep, {
    serviceName: detail.service_name,
    bookingNumber: detail.booking_number,
  });
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
