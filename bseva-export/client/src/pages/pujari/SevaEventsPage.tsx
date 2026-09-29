import { useEffect, useState } from "react";
import { translatedTokenLabel } from "@bseva/config";
import { PujariPortal } from "@/components/RolePortals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { useI18n } from "@/i18n/I18nProvider";
import type { SevaEvent } from "@bseva/types";

function sevaTypeLabel(t: (key: string) => string, type?: string | null) {
  if (!type) return "";
  const key = `seva.filter.${type}`;
  return translatedTokenLabel(t(key), key, type, "");
}

function sevaModeLabel(t: (key: string) => string, mode?: string | null) {
  if (!mode) return "";
  const key = `seva.${mode}`;
  return translatedTokenLabel(t(key), key, mode, "");
}

export default function PujariSevaEventsPage() {
  const { t } = useI18n();
  const [events, setEvents] = useState<SevaEvent[]>([]);
  const [selected, setSelected] = useState<SevaEvent | null>(null);

  useEffect(() => {
    api<SevaEvent[]>("/pujari/seva-events").then(setEvents).catch(() => setEvents([]));
  }, []);

  async function openDetail(id: string) {
    const detail = await api<SevaEvent>(`/pujari/seva-events/${id}`);
    setSelected(detail);
  }

  return (
    <PujariPortal>
      <h1 className="text-2xl font-bold mb-4">Assigned Seva Events</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {events.map((ev) => (
          <Card key={ev.id} className="cursor-pointer" onClick={() => openDetail(ev.id)}>
            <CardHeader>
              <CardTitle className="text-lg">{ev.title || ev.service_name}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Badge>{sevaTypeLabel(t, ev.service_type)}</Badge>
                <Badge variant="outline">{sevaModeLabel(t, ev.participation_mode)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{formatDisplayDate(ev.start_at)}</p>
              <p className="text-sm">{ev.temple_name || "—"}</p>
              <p className="text-sm">{ev.registration_count} participants</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {selected ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{selected.title || selected.service_name} — Participants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {((selected as SevaEvent & { participants?: Record<string, unknown>[] }).participants || []).map((p, i) => (
              <div key={i} className="border-b pb-2 text-sm">
                <strong>{String(p.primary_name || "—")}</strong> · Gotra: {p.gotra_unknown ? "Unknown" : String(p.gotra || "—")}
                <div className="text-muted-foreground">{String(p.sankalp_text || "")}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </PujariPortal>
  );
}
