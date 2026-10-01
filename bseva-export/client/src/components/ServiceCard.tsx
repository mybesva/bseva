import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PujaTitle } from "@/components/PujaTitle";
import { useI18n } from "@/i18n/I18nProvider";
import { formatPujaTitleText } from "@bseva/locales";

interface ServiceCardProps {
  title: string;
  description: string;
  image: string;
  icon?: ReactNode;
  /** e.g. "Starting from ₹3,740" — shown for every bookable puja when set */
  startingFrom?: string | null;
  comingSoon?: boolean;
  /** Area / location gate — service is listed but booking CTAs disabled */
  bookingDisabled?: boolean;
  bookingDisabledLabel?: string;
  /** Occasion-oriented line, shown above the description when present. */
  occasion?: string;
  onReadMore?: () => void;
  onBookNow?: () => void;
  /** `explore` — public Services catalogue styling; default keeps customer dashboard look. */
  variant?: "default" | "explore";
}

function stopCardClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function trimExcerpt(value: string): string {
  const trimmed = value.trimEnd().replace(/[.,;:]+$/, "").trimEnd();
  const space = trimmed.lastIndexOf(" ");
  if (space < 8) return trimmed;
  return trimmed.slice(0, space).trimEnd().replace(/[.,;:]+$/, "").trimEnd();
}

function DescriptionWithReadMore({
  text,
  readMoreLabel,
  onReadMore,
}: {
  text: string;
  readMoreLabel: string;
  onReadMore?: () => void;
}) {
  const hostRef = useRef<HTMLParagraphElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const source = text.trim();
  const [excerpt, setExcerpt] = useState(source);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const probe = probeRef.current;
    if (!host || !probe) return;

    const maxHeight = () => {
      const styles = getComputedStyle(host);
      const lineHeight = parseFloat(styles.lineHeight);
      const fontSize = parseFloat(styles.fontSize);
      const lh = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : fontSize * 1.375;
      return lh * 2 + 1;
    };

    const fits = (prefix: string) => {
      probe.replaceChildren();
      probe.append(document.createTextNode(prefix));
      const link = document.createElement("span");
      link.className = "font-semibold whitespace-nowrap";
      link.textContent = readMoreLabel;
      probe.append(link);
      return probe.scrollHeight <= maxHeight();
    };

    const measure = () => {
      if (!source) {
        setExcerpt("");
        setTruncated(false);
        return;
      }
      if (fits(`${source} `)) {
        setExcerpt(source);
        setTruncated(false);
        return;
      }

      let lo = 0;
      let hi = source.length;
      let best = 0;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (fits(`${source.slice(0, mid)}... `)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      setExcerpt(trimExcerpt(source.slice(0, best)));
      setTruncated(true);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [source, readMoreLabel]);

  return (
    <p
      ref={hostRef}
      className="relative text-muted-foreground text-sm leading-snug break-words [overflow-wrap:anywhere]"
    >
      <span
        ref={probeRef}
        aria-hidden
        className="invisible pointer-events-none absolute left-0 top-0 w-full whitespace-normal break-words [overflow-wrap:anywhere]"
      />
      {excerpt}
      {truncated ? "..." : ""}
      {excerpt || truncated ? " " : ""}
      <button
        type="button"
        className="inline m-0 p-0 border-0 bg-transparent font-semibold text-primary whitespace-nowrap hover:underline underline-offset-2 decoration-primary [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary transition-colors cursor-pointer"
        onClick={(e) => {
          stopCardClick(e);
          onReadMore?.();
        }}
      >
        {readMoreLabel}
      </button>
    </p>
  );
}

export default function ServiceCard({
  title,
  description,
  image,
  icon,
  startingFrom,
  comingSoon,
  bookingDisabled,
  bookingDisabledLabel,
  occasion,
  onReadMore,
  onBookNow,
  variant = "default",
}: ServiceCardProps) {
  const { t } = useI18n();
  const explore = variant === "explore";
  return (
    <Card
      className={`group gap-0 py-0 h-full flex flex-col relative overflow-visible min-w-0 w-full bg-card ${
        explore
          ? "rounded-xl border border-primary/15 shadow-sm transition-[box-shadow,transform] duration-300 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-lg dark:border-primary/20"
          : "border border-transparent shadow-md"
      }`}
    >
      {comingSoon && (
        <div className="absolute top-0 right-0 z-30 max-w-[calc(100%-0.5rem)]">
          <div className="bg-amber-500 text-white font-extrabold text-[11px] sm:text-xs uppercase tracking-wider shadow-lg px-3 py-1.5 rounded-bl-lg">
            {t("services.comingSoonLabel")}
          </div>
        </div>
      )}
      <div className="relative min-w-0">
        <div
          className={`relative overflow-hidden ${explore ? "h-44 sm:h-52 rounded-t-xl" : "h-40 sm:h-48 rounded-t-xl"}`}
        >
          <div
            className={`absolute inset-0 transition-colors z-10 ${
              comingSoon
                ? "bg-amber-950/35"
                : "bg-sidebar/20 [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-sidebar/0"
            }`}
          />
          <img
            src={image}
            alt={title}
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover transform transition-transform duration-700 ${
              comingSoon
                ? "grayscale-[40%] opacity-90"
                : "[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-110"
            }`}
          />
        </div>
        {icon && (
          <div
            className={`absolute -bottom-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-primary/25 bg-card text-primary shadow-md transition-transform [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 ${
              explore ? "left-4 sm:left-5" : "right-4 sm:right-5"
            }`}
          >
            {icon}
          </div>
        )}
      </div>

      <CardHeader className="pt-5 pb-1 px-4 min-w-0 overflow-hidden min-h-[3.5rem]">
        <h3
          className="text-base leading-snug break-words [overflow-wrap:anywhere] line-clamp-2 min-h-[2.5rem]"
          title={formatPujaTitleText(title)}
        >
          <PujaTitle name={title} />
        </h3>
      </CardHeader>

      <CardContent className="px-4 pt-0 pb-2 min-w-0 overflow-hidden space-y-1 flex-1">
        {occasion ? (
          <p className="text-xs font-semibold text-primary leading-snug line-clamp-1">
            {t("home.forLabel")}: {occasion}
          </p>
        ) : null}
        {startingFrom && !comingSoon ? (
          <p className="text-primary font-semibold text-sm leading-snug">{startingFrom}</p>
        ) : null}
        <DescriptionWithReadMore
          text={description}
          readMoreLabel={t("services.readMore")}
          onReadMore={onReadMore}
        />
      </CardContent>

      <CardFooter className="mt-auto pt-1 pb-4 px-4">
        {comingSoon ? (
          <span className="w-full inline-flex items-center justify-center h-9 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            {t("services.comingSoonLabel")}
          </span>
        ) : bookingDisabled ? (
          <span className="w-full inline-flex items-center justify-center h-9 text-xs font-semibold text-muted-foreground text-center leading-tight">
            {bookingDisabledLabel || t("services.bookingUnavailableArea")}
          </span>
        ) : (
          <Button
            type="button"
            size={explore ? "default" : "sm"}
            className={`w-full bg-primary font-bold text-primary-foreground hover:bg-primary/90 ${
              explore ? "h-11 text-sm shadow-md" : "h-9"
            }`}
            onClick={(e) => {
              stopCardClick(e);
              onBookNow?.();
            }}
          >
            {t("customer.bookNow")}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
