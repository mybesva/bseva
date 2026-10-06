import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, Flame, Flower, Sparkles } from "lucide-react";
import { servicesPathForType, type SevaServiceType } from "@bseva/config";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const MENU_ITEMS: { type: SevaServiceType; labelKey: string; icon: typeof Flower }[] = [
  { type: "puja", labelKey: "seva.pujaServices", icon: Flower },
  { type: "chadhava", labelKey: "seva.chadhava", icon: Flame },
  { type: "pravachan", labelKey: "seva.pravachan", icon: Sparkles },
];

const HOVER_CLOSE_DELAY_MS = 120;

type ServicesNavMenuProps = {
  active: boolean;
  /** `desktop`: hover/click dropdown. `mobile`: always-expanded sub list for the sheet menu. */
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
};

/** "Services" header item with Puja / Chadhava / Pravachan sub-links. */
export default function ServicesNavMenu({ active, variant = "desktop", onNavigate }: ServicesNavMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const closeAll = () => {
    clearCloseTimer();
    setOpen(false);
    setPinned(false);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) closeAll();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  useEffect(() => clearCloseTimer, []);

  if (variant === "mobile") {
    return (
      <div className="flex shrink-0 flex-col gap-3">
        <span className={cn("text-lg font-bold", active ? "text-primary" : "text-foreground")}>
          {t("nav.services")}
        </span>
        <div className="flex flex-col gap-3 pl-4 border-l border-border">
          {MENU_ITEMS.map(({ type, labelKey, icon: Icon }) => (
            <Link key={type} href={servicesPathForType(type)}>
              <a
                className="flex items-center gap-2 text-base font-semibold text-foreground hover:text-primary"
                onClick={onNavigate}
              >
                <Icon size={16} aria-hidden />
                {t(labelKey)}
              </a>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseLeave={() => {
        if (pinned) return;
        clearCloseTimer();
        closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") closeAll();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeAll();
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="nav-services-trigger"
        onClick={() => {
          if (pinned) {
            closeAll();
          } else {
            setPinned(true);
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[15px] font-semibold leading-none transition-colors hover:text-primary",
          active || open ? "text-primary" : "text-foreground",
        )}
      >
        {t("nav.services")}
        <ChevronDown size={14} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={t("nav.services")}
          className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3"
        >
          <div className="min-w-[13rem] rounded-lg border border-border bg-background p-1.5 shadow-lg">
            {MENU_ITEMS.map(({ type, labelKey, icon: Icon }) => (
              <Link key={type} href={servicesPathForType(type)}>
                <a
                  role="menuitem"
                  data-testid={`nav-services-${type}`}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:outline-none"
                  onClick={() => {
                    closeAll();
                    onNavigate?.();
                  }}
                >
                  <Icon size={16} aria-hidden />
                  {t(labelKey)}
                </a>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
