import { useEffect, useMemo, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, isSameDay, parseISO, startOfDay } from "date-fns";
import { toast } from "sonner";
import { Ban, CalendarDays, Clock, MapPin } from "lucide-react";

type BlockRow = {
  id: string;
  blocked_date: string;
  reason?: string | null;
  created_at?: string;
};

/** Calendar day cell — blocked dates use strike-through + cream tint (matches legend). */
function AvailabilityDayButton(props: React.ComponentProps<typeof CalendarDayButton>) {
  const { modifiers, className, ...rest } = props;
  const isBlocked = !!modifiers.blocked;
  const isToday = !!modifiers.today;

  return (
    <CalendarDayButton
      modifiers={modifiers}
      className={cn(
        className,
        "text-sm font-medium transition-colors",
        isToday && !isBlocked && "ring-1 ring-[#D4AF37]/80 bg-sidebar/[0.06] text-sidebar rounded-md",
        isBlocked &&
          "bg-[#F4E4C1]/80 text-sidebar/55 line-through decoration-sidebar/50 decoration-2 rounded-md hover:bg-[#F4E4C1]",
        isBlocked && isToday && "ring-1 ring-[#D4AF37]/60"
      )}
      {...rest}
    />
  );
}

function LegendSwatch({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      {children}
      <span>{label}</span>
    </span>
  );
}

export default function PujariAvailabilityPage() {
  const [available, setAvailable] = useState(true);
  const [radius, setRadius] = useState("");
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [blockBusy, setBlockBusy] = useState(false);

  async function loadBlocks() {
    try {
      const rows = await api<BlockRow[]>("/pujari/availability/blocks");
      setBlocks(rows);
    } catch (err: any) {
      if (!String(err.message || "").includes("404")) {
        toast.error(err.message || "Could not load blocked dates");
      }
      setBlocks([]);
    }
  }

  useEffect(() => {
    Promise.all([api<any>("/pujari/profile"), loadBlocks()])
      .then(([p]) => {
        setAvailable(!!p.available);
        setRadius(p.service_radius_km != null ? String(p.service_radius_km) : "");
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const blockedDates = useMemo(
    () => blocks.map((b) => startOfDay(parseISO(b.blocked_date))),
    [blocks]
  );

  const selectedBlock = useMemo(() => {
    if (!selectedDate) return null;
    return blocks.find((b) => isSameDay(parseISO(b.blocked_date), selectedDate)) || null;
  }, [blocks, selectedDate]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({
          available,
          service_radius_km: radius ? Number(radius) : null,
        }),
      });
      toast.success("Availability settings saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelectedDate(undefined);
    setReason("");
  }

  function openDateDialog(day: Date | undefined) {
    if (!day) return;
    if (day < startOfDay(new Date())) {
      toast.error("You can only block today or future dates");
      return;
    }
    setSelectedDate(day);
    const existing = blocks.find((b) => isSameDay(parseISO(b.blocked_date), day));
    setReason(existing?.reason || "");
    setDialogOpen(true);
  }

  async function blockSelectedDate() {
    if (!selectedDate) return;
    setBlockBusy(true);
    try {
      await api("/pujari/availability/blocks", {
        method: "POST",
        body: JSON.stringify({
          blocked_date: format(selectedDate, "yyyy-MM-dd"),
          reason: reason.trim() || null,
        }),
      });
      await loadBlocks();
      toast.success("Date blocked");
      closeDialog();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBlockBusy(false);
    }
  }

  async function unblockSelectedDate() {
    if (!selectedBlock) return;
    setBlockBusy(true);
    try {
      await api(`/pujari/availability/blocks/${selectedBlock.id}`, { method: "DELETE" });
      await loadBlocks();
      toast.success("Date unblocked — available for bookings again");
      closeDialog();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBlockBusy(false);
    }
  }

  async function quickUnblock(blockId: string) {
    setBlockBusy(true);
    try {
      await api(`/pujari/availability/blocks/${blockId}`, { method: "DELETE" });
      await loadBlocks();
      toast.success("Date unblocked");
      if (selectedBlock?.id === blockId) closeDialog();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBlockBusy(false);
    }
  }

  const upcomingBlocks = blocks.filter((b) => parseISO(b.blocked_date) >= startOfDay(new Date()));

  return (
    <PujariPortal>
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        <section className="bg-sidebar text-sidebar-foreground rounded-xl px-5 py-7 md:px-8 md:py-9 border border-[#D4AF37]/20 shadow-sm">
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">Availability</h1>
          <p className="mt-2 text-sm md:text-base text-sidebar-foreground/75 max-w-2xl">
            Manage when customers can book you, your service area, and dates you want blocked on your calendar.
          </p>
        </section>

        <div className="grid gap-6 lg:gap-8 lg:grid-cols-2">
          {/* Booking settings */}
          <Card className="border-border/80 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary via-[#D4AF37] to-primary/40" />
            <CardHeader className="pb-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Clock size={20} strokeWidth={2} />
                </span>
                <div>
                  <CardTitle className="font-heading text-sidebar text-lg md:text-xl">Booking settings</CardTitle>
                  <CardDescription className="mt-1 text-sm leading-relaxed">
                    Control whether customers can discover and book you for new pujas.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-6 md:pb-8">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-28" />
                </div>
              ) : (
                <form className="space-y-6" onSubmit={saveSettings}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-4 transition-colors",
                      available
                        ? "border-primary/35 bg-primary/[0.07]"
                        : "border-border bg-secondary/25"
                    )}
                  >
                    <Checkbox
                      checked={available}
                      onCheckedChange={(v) => setAvailable(!!v)}
                      className="border-[#D4AF37]/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-sidebar">Available for new bookings</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {available ? "Customers can request bookings with you" : "You are hidden from new booking requests"}
                      </span>
                    </span>
                  </label>

                  <div className="space-y-2">
                    <Label htmlFor="service-radius" className="text-sidebar text-sm font-medium flex items-center gap-1.5">
                      <MapPin size={14} className="text-primary shrink-0" />
                      Service radius (km)
                    </Label>
                    <Input
                      id="service-radius"
                      type="number"
                      min={1}
                      step="0.1"
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                      className="max-w-[160px] border-border bg-background focus-visible:ring-primary/30"
                      placeholder="e.g. 10"
                    />
                    <p className="text-xs text-muted-foreground">Maximum distance you are willing to travel for bookings.</p>
                  </div>

                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm"
                  >
                    {saving ? "Saving…" : "Save settings"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Block calendar */}
          <Card className="border-border/80 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-sidebar via-[#D4AF37]/80 to-sidebar/60" />
            <CardHeader className="pb-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar/10 text-sidebar">
                  <CalendarDays size={20} strokeWidth={2} />
                </span>
                <div>
                  <CardTitle className="font-heading text-sidebar text-lg md:text-xl">Block calendar dates</CardTitle>
                  <CardDescription className="mt-1 text-sm leading-relaxed">
                    Tap a date to block it with an optional note. Tap a blocked date again to unblock.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-6 md:pb-8 space-y-5">
              <div className="rounded-xl border border-[#D4AF37]/25 bg-[#FFF8E7]/80 p-3 sm:p-5">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={openDateDialog}
                  modifiers={{ blocked: blockedDates }}
                  components={{ DayButton: AvailabilityDayButton }}
                  disabled={{ before: startOfDay(new Date()) }}
                  className="mx-auto w-full max-w-[340px] bg-transparent p-0 [--cell-size:2.5rem] sm:[--cell-size:2.75rem]"
                  classNames={{
                    months: "w-full",
                    month: "w-full gap-4",
                    month_caption: "font-heading font-semibold text-sidebar capitalize text-base mb-1",
                    nav: "absolute inset-x-0 top-0 flex justify-between",
                    button_previous:
                      "h-8 w-8 rounded-md text-sidebar hover:bg-primary/10 hover:text-primary border border-transparent hover:border-[#D4AF37]/30",
                    button_next:
                      "h-8 w-8 rounded-md text-sidebar hover:bg-primary/10 hover:text-primary border border-transparent hover:border-[#D4AF37]/30",
                    weekdays: "border-b border-border/60 pb-2 mb-1",
                    weekday: "text-sidebar/65 text-[0.7rem] sm:text-xs font-semibold uppercase tracking-wide flex-1",
                    week: "mt-1",
                    day: "p-0.5",
                    outside: "text-muted-foreground/35",
                    disabled: "text-muted-foreground/30 opacity-60",
                  }}
                />

                <div className="mt-5 pt-4 border-t border-[#D4AF37]/20 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                  <LegendSwatch label="Available">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-[11px] font-medium text-sidebar">
                      12
                    </span>
                  </LegendSwatch>
                  <LegendSwatch label="Blocked">
                    <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-[#F4E4C1]/80 text-[11px] font-medium text-sidebar/55 line-through decoration-sidebar/50">
                      15
                      <Ban className="absolute -top-1 -right-1 size-3 text-primary stroke-[2.5]" aria-hidden />
                    </span>
                  </LegendSwatch>
                  <LegendSwatch label="Selected">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
                      18
                    </span>
                  </LegendSwatch>
                  <LegendSwatch label="Today">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-[#D4AF37]/80 bg-sidebar/[0.06] text-[11px] font-medium text-sidebar">
                      26
                    </span>
                  </LegendSwatch>
                </div>
              </div>

              {upcomingBlocks.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-heading font-semibold text-sidebar flex items-center gap-2">
                    <Ban size={14} className="text-primary" />
                    Upcoming blocked dates
                    <span className="text-xs font-normal text-muted-foreground">({upcomingBlocks.length})</span>
                  </p>
                  <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {upcomingBlocks.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border/80 bg-white/70 px-4 py-3 text-sm shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sidebar">
                            {format(parseISO(b.blocked_date), "EEE, dd MMM yyyy")}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-0.5 line-clamp-2",
                              b.reason ? "text-muted-foreground" : "text-muted-foreground/70 italic"
                            )}
                          >
                            {b.reason || "No reason provided"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2 self-end sm:self-auto">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 border-[#D4AF37]/40 text-sidebar hover:bg-secondary/40"
                            disabled={blockBusy}
                            onClick={() => {
                              setSelectedDate(parseISO(b.blocked_date));
                              setReason(b.reason || "");
                              setDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-muted-foreground hover:text-sidebar hover:bg-secondary/30"
                            disabled={blockBusy}
                            onClick={() => void quickUnblock(b.id)}
                          >
                            Unblock
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2 rounded-lg bg-secondary/20 border border-dashed border-border">
                  No blocked dates yet. Select a date on the calendar above to block it.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-md border-[#D4AF37]/25 shadow-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedBlock) void blockSelectedDate();
              else void blockSelectedDate();
            }}
          >
            <DialogHeader className="space-y-2">
              <DialogTitle className="font-heading text-sidebar text-xl">
                {selectedBlock ? "Blocked date" : "Block this date?"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {selectedDate ? (
                  <span className="font-medium text-sidebar">{format(selectedDate, "EEEE, dd MMMM yyyy")}</span>
                ) : null}
                {selectedBlock
                  ? " Update the note below or unblock to make this date available again."
                  : " Add an optional note, then confirm to block this date."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-3">
              <Label htmlFor="block-reason" className="text-sidebar text-sm font-medium">
                Reason <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="block-reason"
                placeholder="e.g. Personal leave, temple duty, travel…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="resize-none border-border focus-visible:ring-primary/30"
                autoFocus
              />
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="border-border">
                Cancel
              </Button>
              {selectedBlock ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-sidebar/20 text-sidebar hover:bg-secondary/40"
                    disabled={blockBusy}
                    onClick={() => void unblockSelectedDate()}
                  >
                    {blockBusy ? "Unblocking…" : "Unblock date"}
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={blockBusy}
                  >
                    {blockBusy ? "Saving…" : "Save"}
                  </Button>
                </>
              ) : (
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={blockBusy}
                >
                  {blockBusy ? "Blocking…" : "Block date"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PujariPortal>
  );
}
