import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, rupees } from "@/lib/api";
import { cn } from "@/lib/utils";
import { adminPath } from "@/const";
import { toast } from "sonner";

type AvailablePujari = {
  id: string;
  name: string;
  phone?: string;
  approved_level?: number;
  experience_years?: number | null;
  specializations?: unknown;
  location_label?: string | null;
  city?: string | null;
  distance_km?: number | null;
};

type AvailableResponse = {
  booking_number?: string;
  required_level?: number;
  current_pujari_id?: string | null;
  distance_rings_km?: number[];
  primary_ring_km?: number;
  matched_ring_km?: number | null;
  booking_has_coordinates?: boolean;
  default_pujari_available?: boolean;
  nearby_pujaris?: AvailablePujari[];
  other_pujaris?: AvailablePujari[];
  pujaris: AvailablePujari[];
};

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return v ? [v] : [];
    }
  }
  return [];
}

function statusVariant(status: string) {
  if (status === "rejected") return "destructive" as const;
  return "default" as const;
}

export default function Bookings() {
  const [rows, setRows] = useState<any[]>([]);
  const [reassignFor, setReassignFor] = useState<any | null>(null);
  const [available, setAvailable] = useState<AvailableResponse | null>(null);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [penaltyFor, setPenaltyFor] = useState<string | null>(null);
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const statusFilter = params.get("status") || "all";

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    if (statusFilter === "needs_reassignment") {
      return rows.filter((b) => b.needs_reassignment || b.status === "rejected");
    }
    return rows.filter((b) => b.status === statusFilter);
  }, [rows, statusFilter]);

  async function load() {
    setRows(await api<any[]>("/bookings"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  function setStatus(status: string) {
    const qs = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
    setLocation(adminPath(`/bookings${qs}`));
  }

  async function openReassign(booking: any) {
    setReassignFor(booking);
    setAvailable(null);
    setLoadingAvailable(true);
    try {
      setAvailable(await api<AvailableResponse>(`/admin/bookings/${booking.id}/available-pujaris`));
    } catch (e: any) {
      toast.error(e.message || "Could not load available pujaris");
    } finally {
      setLoadingAvailable(false);
    }
  }

  async function assign(pujariId: string) {
    if (!reassignFor) return;
    setAssigningId(pujariId);
    try {
      await api(`/admin/bookings/${reassignFor.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ pujari_id: pujariId }),
      });
      toast.success("Pujari assigned — waiting for them to accept");
      setReassignFor(null);
      setAvailable(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not assign pujari");
    } finally {
      setAssigningId(null);
    }
  }

  async function applyNoShowPenalty(booking: any) {
    const reason = window.prompt(
      `Mark the pujari as a no-show for ${booking.booking_number}? Add a note (optional).`
    );
    if (reason === null) return;
    setPenaltyFor(booking.id);
    try {
      const out = await api<{ waived: boolean; penalty_paise: number }>(
        `/bookings/${booking.id}/no-show-penalty`,
        { method: "POST", body: JSON.stringify({ waive: false, reason: reason.trim() || null }) }
      );
      toast.success(
        out.waived
          ? "Marked as no-show, no penalty applied"
          : `No-show penalty of ${rupees(out.penalty_paise)} deducted`
      );
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not apply penalty");
    } finally {
      setPenaltyFor(null);
    }
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-heading font-bold mb-4">Bookings</h1>
      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Status filter</Label>
          <Select value={statusFilter} onValueChange={setStatus}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="pending_acceptance">Pending acceptance</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="needs_reassignment">Needs reassignment</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {statusFilter !== "all" && (
          <Badge variant="secondary" className="mb-1">
            Showing: {statusFilter.replace(/_/g, " ")} ({filtered.length})
          </Badge>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Pujari</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((b) => {
            const needsAttention = Boolean(b.needs_reassignment) || b.status === "rejected";
            const canPenalise = ["confirmed", "in_progress", "completed", "cancelled"].includes(b.status);
            return (
              <TableRow key={b.id} className={cn(needsAttention && "bg-red-50 hover:bg-red-100/70")}>
                <TableCell>{b.booking_number}</TableCell>
                <TableCell>{b.service_name}</TableCell>
                <TableCell>{b.customer_name}</TableCell>
                <TableCell>{b.pujari_name || "—"}</TableCell>
                <TableCell>
                  {b.booking_date} {b.start_time}
                </TableCell>
                <TableCell>{rupees(b.total_paise)}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={statusVariant(b.status)}>{b.status.replace(/_/g, " ")}</Badge>
                    {b.needs_reassignment && (
                      <span className="text-xs font-medium text-red-700">Needs reassignment</span>
                    )}
                    {b.rejection_reason && (
                      <span className="text-xs text-muted-foreground">{b.rejection_reason}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant={needsAttention ? "default" : "outline"}
                      onClick={() => void openReassign(b)}
                    >
                      Reassign
                    </Button>
                    {canPenalise && b.pujari_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={penaltyFor === b.id || Boolean(b.no_show_marked_at)}
                        onClick={() => void applyNoShowPenalty(b)}
                      >
                        {b.no_show_marked_at ? "No-show marked" : "No-show"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No bookings yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog
        open={Boolean(reassignFor)}
        onOpenChange={(open) => {
          if (!open) {
            setReassignFor(null);
            setAvailable(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Reassign {reassignFor?.booking_number || "booking"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingAvailable && <p className="text-sm text-muted-foreground">Finding available pujaris…</p>}
            {!loadingAvailable && available && (
              <>
                <p className="text-sm text-muted-foreground">
                  Level {available.required_level} or above, free at this time (availability filtered).
                  {available.booking_has_coordinates
                    ? ` Default option: within ${available.primary_ring_km ?? 10} km. Farther available pujaris are listed below as fallback.`
                    : " This booking has no coordinates — distances unavailable; showing all eligible pujaris."}
                </p>

                {(() => {
                  const nearby = available.nearby_pujaris ?? [];
                  const other = available.other_pujaris ?? available.pujaris ?? [];
                  const ring = available.primary_ring_km ?? 10;

                  const renderPujari = (p: AvailablePujari) => {
                    const specializations = parseList(p.specializations);
                    const isCurrent = p.id === available.current_pujari_id;
                    return (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            <Badge variant="outline">Level {p.approved_level ?? "—"}</Badge>
                            {isCurrent && <Badge variant="secondary">Currently assigned</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {p.distance_km != null
                              ? `${p.distance_km} km away · `
                              : "Distance unknown · "}
                            {p.experience_years != null
                              ? `${p.experience_years} yrs experience`
                              : "Experience —"}
                            {p.city ? ` · ${p.city}` : p.location_label ? ` · ${p.location_label}` : ""}
                          </div>
                          {specializations.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {specializations.slice(0, 4).map((s) => (
                                <Badge key={s} variant="secondary" className="font-normal">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          disabled={isCurrent || assigningId === p.id}
                          onClick={() => void assign(p.id)}
                        >
                          {assigningId === p.id ? "Assigning…" : "Assign"}
                        </Button>
                      </div>
                    );
                  };

                  if (nearby.length === 0 && other.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No eligible pujari is free for this slot.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-sidebar">
                          Default — within {ring} km
                        </p>
                        {nearby.length === 0 ? (
                          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                            No default pujari available within {ring} km.
                          </p>
                        ) : (
                          nearby.map(renderPujari)
                        )}
                      </div>

                      {other.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-sidebar">
                            Other available pujaris
                            {available.booking_has_coordinates
                              ? ` (beyond ${ring} km or distance unknown)`
                              : ""}
                          </p>
                          {other.map(renderPujari)}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReassignFor(null);
                setAvailable(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
