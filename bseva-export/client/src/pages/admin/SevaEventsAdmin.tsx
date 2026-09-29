import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import AdminPageHeader from "@/components/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { displayTokenLabel } from "@bseva/config";
import { api, coerceListResponse } from "@/lib/api";
import { formatDisplayDate } from "@/lib/formatDate";
import { toast } from "sonner";
import type { SevaEvent } from "@bseva/types";

type ServiceRow = { id: string; name: string; service_type?: string };
type TempleRow = { id: string; name: string };
type PujariRow = { id: string; name: string };

export default function SevaEventsAdmin() {
  const [events, setEvents] = useState<SevaEvent[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [temples, setTemples] = useState<TempleRow[]>([]);
  const [pujaris, setPujaris] = useState<PujariRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [manifest, setManifest] = useState<{ event: SevaEvent; participants: Record<string, unknown>[] } | null>(null);
  const [form, setForm] = useState({
    service_id: "",
    temple_id: "",
    assigned_pujari_id: "",
    title: "",
    description: "",
    start_at: "",
    end_at: "",
    booking_cutoff_at: "",
    capacity: "",
    participation_mode: "offline",
    puja_event_kind: "",
    is_free: false,
    price_paise: "",
    online_enabled: false,
    language_code: "",
    published: false,
  });

  async function load() {
    const [ev, svc, tmp, puj] = await Promise.all([
      api<unknown>("/admin/seva/events"),
      api<unknown>("/admin/services"),
      api<unknown>("/admin/temples"),
      api<unknown>("/admin/pujaris?status=approved&page_size=100"),
    ]);
    setEvents(coerceListResponse<SevaEvent>(ev));
    setServices(coerceListResponse<ServiceRow>(svc));
    setTemples(coerceListResponse<TempleRow>(tmp));
    setPujaris(coerceListResponse<PujariRow>(puj));
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.service_type === filter);
  }, [events, filter]);

  async function createEvent() {
    const payload = {
      service_id: form.service_id,
      temple_id: form.temple_id || null,
      assigned_pujari_id: form.assigned_pujari_id || null,
      title: form.title || null,
      description: form.description || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      booking_cutoff_at: form.booking_cutoff_at ? new Date(form.booking_cutoff_at).toISOString() : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      participation_mode: form.participation_mode,
      puja_event_kind: form.puja_event_kind || null,
      is_free: form.is_free,
      price_paise: form.is_free ? 0 : form.price_paise ? Math.round(Number(form.price_paise) * 100) : null,
      online_enabled: form.online_enabled,
      language_code: form.language_code || null,
      published: form.published,
      status: form.published ? "published" : "draft",
    };
    await api("/admin/seva/events", { method: "POST", body: JSON.stringify(payload) });
    toast.success("Event created");
    setOpen(false);
    await load();
  }

  async function togglePublish(ev: SevaEvent) {
    await api(`/admin/seva/events/${ev.id}`, {
      method: "PATCH",
      body: JSON.stringify({ published: !ev.published, status: ev.published ? "draft" : "published" }),
    });
    await load();
  }

  async function openManifest(ev: SevaEvent) {
    const data = await api<{ event: SevaEvent; participants: Record<string, unknown>[] }>(
      `/admin/seva/events/${ev.id}/sankalp-manifest`
    );
    setManifest(data);
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Seva Events"
        description="Group Puja, Chadhava, Pravachan scheduled events"
        showTitle
      />
      <div className="flex flex-wrap gap-2 mb-4">
        {["all", "puja", "chadhava", "pravachan"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {displayTokenLabel(f)}
          </Button>
        ))}
        <Button className="ml-auto" onClick={() => setOpen(true)}>
          Create event
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title / Service</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Regs</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((ev) => (
            <TableRow key={ev.id}>
              <TableCell>
                <div className="font-medium">{ev.title || ev.service_name}</div>
                <div className="text-xs text-muted-foreground">{ev.temple_name || "—"}</div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{displayTokenLabel(ev.service_type, "")}</Badge>
                {ev.puja_event_kind ? <Badge className="ml-1">{displayTokenLabel(ev.puja_event_kind)}</Badge> : null}
              </TableCell>
              <TableCell>{formatDisplayDate(ev.start_at)}</TableCell>
              <TableCell>{displayTokenLabel(ev.participation_mode, "")}</TableCell>
              <TableCell>
                {ev.registration_count}
                {ev.capacity ? ` / ${ev.capacity}` : ""}
              </TableCell>
              <TableCell>{ev.published ? "Published" : "Draft"}</TableCell>
              <TableCell className="space-x-2">
                <Button size="sm" variant="outline" onClick={() => togglePublish(ev)}>
                  {ev.published ? "Unpublish" : "Publish"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openManifest(ev)}>
                  Sankalp list
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Seva Event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label>Service</Label>
            <Select value={form.service_id} onValueChange={(v) => setForm((f) => ({ ...f, service_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({displayTokenLabel(s.service_type || "puja")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Temple</Label>
            <Select value={form.temple_id} onValueChange={(v) => setForm((f) => ({ ...f, temple_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {temples.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Assigned Pujari</Label>
            <Select value={form.assigned_pujari_id} onValueChange={(v) => setForm((f) => ({ ...f, assigned_pujari_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {pujaris.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label>Title override</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <Label>Start</Label>
            <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))} />
            <Label>End</Label>
            <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))} />
            <Label>Booking cutoff</Label>
            <Input
              type="datetime-local"
              value={form.booking_cutoff_at}
              onChange={(e) => setForm((f) => ({ ...f, booking_cutoff_at: e.target.value }))}
            />
            <Label>Capacity</Label>
            <Input value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
            <Label>Participation mode</Label>
            <Select value={form.participation_mode} onValueChange={(v) => setForm((f) => ({ ...f, participation_mode: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
            <Label>Puja event kind</Label>
            <Select value={form.puja_event_kind} onValueChange={(v) => setForm((f) => ({ ...f, puja_event_kind: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group_live">Group Live</SelectItem>
                <SelectItem value="proxy">Proxy / Temple</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_free} onCheckedChange={(v) => setForm((f) => ({ ...f, is_free: v }))} />
              <Label>Free event</Label>
            </div>
            {!form.is_free ? (
              <>
                <Label>Price (₹)</Label>
                <Input value={form.price_paise} onChange={(e) => setForm((f) => ({ ...f, price_paise: e.target.value }))} />
              </>
            ) : null}
            <div className="flex items-center gap-2">
              <Switch checked={form.online_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, online_enabled: v }))} />
              <Label>Online joining enabled</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} />
              <Label>Publish immediately</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createEvent().catch((e) => toast.error(e.message))}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manifest} onOpenChange={() => setManifest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sankalp manifest — {manifest?.event?.title || manifest?.event?.service_name}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Gotra</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Sankalp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(manifest?.participants || []).map((p, i) => (
                <TableRow key={String(p.registration_number || i)}>
                  <TableCell>{String(p.registration_number || "")}</TableCell>
                  <TableCell>{String(p.primary_name || p.customer_name || "")}</TableCell>
                  <TableCell>{p.gotra_unknown ? "Unknown" : String(p.gotra || "—")}</TableCell>
                  <TableCell>{String(p.package_name || "—")}</TableCell>
                  <TableCell className="max-w-xs truncate">{String(p.sankalp_text || "—")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
