import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { toIsoDateInput } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PANCHANG_CALENDAR,
  addDaysToIsoDate,
  formatPanchangDateSubtitle,
  formatPanchangSelectedDate,
  isTodayIsoDate,
  panchangApiCalendarParam,
  parseIsoDateLocal,
  todayIsoDate,
  type PanchangCalendarType,
} from "@bseva/config";
import type { PanchangData } from "@bseva/types";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";

function cleanLabel(text: string): string {
  return text.replace(/:\s*$/, "").trim();
}

function CalendarSegment({
  value,
  onChange,
  solarLabel,
  lunarLabel,
}: {
  value: PanchangCalendarType;
  onChange: (next: PanchangCalendarType) => void;
  solarLabel: string;
  lunarLabel: string;
}) {
  const options: { id: PanchangCalendarType; label: string }[] = [
    { id: "solar", label: solarLabel },
    { id: "lunar", label: lunarLabel },
  ];

  return (
    <div
      className="inline-flex w-full max-w-md rounded-lg border border-primary/30 bg-white p-0.5"
      role="group"
      aria-label="Calendar type"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex-1 min-h-10 px-3 py-2 text-sm font-semibold leading-snug text-center rounded-md transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-none"
                : "bg-transparent text-sidebar hover:bg-secondary/40",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PanchangInfoCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[5.5rem] flex-col justify-center rounded-xl border px-4 py-4",
        highlight
          ? "border-primary/60 bg-primary/10"
          : "border-primary/20 bg-white",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide",
          highlight ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p className="mt-1.5 text-base font-bold leading-snug text-sidebar break-words">{value}</p>
    </div>
  );
}

export default function PanchangCard({ className }: { className?: string }) {
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(() => todayIsoDate());
  const [calendarType, setCalendarType] = useState<PanchangCalendarType>(DEFAULT_PANCHANG_CALENDAR);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [discovery, setDiscovery] = useState<Array<{ id: string; title?: string; service_name?: string; link_type?: string; service_slug?: string; event_id?: string }>>([]);
  const [panchang, setPanchang] = useState<PanchangData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Array<{ id: string; title?: string; service_name?: string; link_type?: string; service_slug?: string; event_id?: string }>>(
      "/seva/discovery"
    )
      .then((rows) => setDiscovery(rows.slice(0, 4)))
      .catch(() => setDiscovery([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({
      date: selectedDate,
      calendar: panchangApiCalendarParam(calendarType),
    });
    api(`/panchang?${qs}`)
      .then((data) => {
        if (!cancelled) setPanchang(data as PanchangData);
      })
      .catch(() => {
        if (!cancelled) setPanchang(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, calendarType]);

  const selected = parseIsoDateLocal(selectedDate);
  const dateLabel = formatPanchangSelectedDate(calendarType, selectedDate, panchang);
  const dateSubtitle = formatPanchangDateSubtitle(calendarType, selectedDate, panchang);
  const onToday = isTodayIsoDate(selectedDate);
  const todayButtonClass = cn(
    "rounded-lg bg-[#FFFFFF] shadow-none transition-colors disabled:pointer-events-none disabled:opacity-100",
    onToday
      ? "border-[3px] border-[#FF8A2A] font-bold text-[#10203D] hover:bg-[#FFFFFF]"
      : "border border-primary/30 font-semibold text-brand-orange hover:bg-secondary/30",
  );

  const tithiValue = panchang
    ? `${panchang.tithi}${panchang.paksha ? ` (${panchang.paksha})` : ""}`
    : "—";
  const lunarMonthValue = panchang
    ? `${panchang.lunarMonth}${panchang.lunarDay != null ? ` · ${t("calendar.lunarDay", { day: panchang.lunarDay })}` : ""}`
    : "—";

  return (
    <Card
      className={cn(
        "border border-primary/30 bg-[#FFF8E7] shadow-sm",
        className,
      )}
    >
      <CardHeader className="space-y-4 pb-0">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-primary shrink-0" size={22} strokeWidth={2.25} />
          <h2 className="text-xl font-bold text-sidebar tracking-tight">{t("calendar.panchangam")}</h2>
        </div>

        <CalendarSegment
          value={calendarType}
          onChange={setCalendarType}
          solarLabel={t("calendar.solarCalendar")}
          lunarLabel={t("calendar.lunarCalendar")}
        />

        <div className="max-w-2xl space-y-2">
          <div className="flex flex-nowrap items-stretch gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-lg border-primary/30 bg-white text-sidebar hover:bg-white"
              aria-label={t("calendar.previousDay")}
              onClick={() => setSelectedDate((d) => addDaysToIsoDate(d, -1))}
            >
              <ChevronLeft size={18} />
            </Button>

            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg border border-primary/25 bg-white px-3 py-2 text-left transition-colors hover:bg-white/90"
                >
                  <span className="flex items-start gap-2">
                    <CalendarIcon size={15} className="mt-0.5 shrink-0 text-primary" />
                    <span className="min-w-0 text-sm font-semibold leading-snug text-sidebar line-clamp-2">
                      {dateLabel}
                    </span>
                  </span>
                  {dateSubtitle && !loading ? (
                    <span className="mt-1 pl-[23px] text-xs text-muted-foreground">{dateSubtitle}</span>
                  ) : null}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selected}
                  onSelect={(date) => {
                    if (!date) return;
                    setSelectedDate(toIsoDateInput(date));
                    setPickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-lg border-primary/30 bg-white text-sidebar hover:bg-white"
              aria-label={t("calendar.nextDay")}
              onClick={() => setSelectedDate((d) => addDaysToIsoDate(d, 1))}
            >
              <ChevronRight size={18} />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("hidden h-11 shrink-0 px-4 md:inline-flex", todayButtonClass)}
              disabled={onToday}
              onClick={() => setSelectedDate(todayIsoDate())}
            >
              {t("calendar.today")}
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("mx-auto h-10 w-full max-w-[10rem] md:hidden", todayButtonClass)}
            disabled={onToday}
            onClick={() => setSelectedDate(todayIsoDate())}
          >
            {t("calendar.today")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {loading ? (
          <Skeleton className="h-44 w-full rounded-xl" />
        ) : panchang ? (
          <div className="grid grid-cols-2 gap-3">
            <PanchangInfoCard label={cleanLabel(t("calendar.tithi"))} value={tithiValue} />
            <PanchangInfoCard label={cleanLabel(t("calendar.nakshatra"))} value={panchang.nakshatra} />
            <PanchangInfoCard label={cleanLabel(t("calendar.lunarMonth"))} value={lunarMonthValue} />
            <PanchangInfoCard label={cleanLabel(t("calendar.rahuKalam"))} value={panchang.rahukaalam} highlight />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("common.retry")}</p>
        )}
        {discovery.length > 0 ? (
          <div className="mt-4 border-t pt-4 space-y-2">
            <p className="text-sm font-semibold">{t("seva.discovery.title")}</p>
            <ul className="space-y-1">
              {discovery.map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.event_id ? `/seva/events/${d.event_id}` : d.service_slug ? `/services/${d.service_slug}` : "/services"}
                    className="text-sm text-primary hover:underline"
                  >
                    {d.title || d.service_name || d.link_type}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
