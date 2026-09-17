import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const LOGO_SIZE = {
  xs: {
    mark: "h-8 w-8",
    word: "text-base",
    motto: "text-[8px] leading-tight",
  },
  sm: {
    mark: "h-10 w-10",
    word: "text-xl",
    motto: "text-[9px] leading-tight",
  },
  md: {
    mark: "h-12 w-12",
    word: "text-2xl",
    motto: "text-[10px] leading-tight",
  },
  lg: {
    mark: "h-14 w-14",
    word: "text-3xl",
    motto: "text-xs leading-tight",
  },
  xl: {
    mark: "h-16 w-16",
    word: "text-4xl",
    motto: "text-sm leading-tight",
  },
} as const;

type BSevaLogoProps = {
  size?: keyof typeof LOGO_SIZE;
  className?: string;
  alt?: string;
  showMotto?: boolean;
  /** Full artwork on the public home chrome; lockup is for portals. */
  variant?: "lockup" | "full";
  /** Renders on the B-Seva line (e.g. “Customer portal”), not on the quotation line. */
  afterWordmark?: ReactNode;
};

const MOTTO = "Book, Believe, Bless";

const FULL_HEIGHT = {
  xs: "h-8",
  sm: "h-9",
  md: "h-14",
  lg: "h-16",
  xl: "h-20",
} as const;

/** Logo stands in for the letter B in “B-Seva”; quotation sits under that name only. */
export default function BSevaLogo({
  size = "md",
  className,
  alt = "B-Seva",
  showMotto = true,
  variant = "lockup",
  afterWordmark,
}: BSevaLogoProps) {
  if (variant === "full") {
    return (
      <img
        src="/bseva-logo-transparent.png"
        alt={alt}
        className={cn(
          "w-auto max-w-[min(100%,16rem)] object-contain object-left",
          FULL_HEIGHT[size],
          className,
        )}
        decoding="async"
      />
    );
  }

  const s = LOGO_SIZE[size];
  return (
    <span
      className={cn(
        "inline-grid grid-cols-[auto_auto] grid-rows-[auto_auto] items-center gap-x-2 gap-y-0.5 text-foreground",
        className,
      )}
      role="img"
      aria-label={showMotto ? `${alt}. ${MOTTO}` : alt}
    >
      <span className="col-start-1 row-start-1 inline-flex items-center">
        <img
          src="/bseva-mark.png"
          alt=""
          className={cn("shrink-0 object-contain", s.mark)}
          decoding="async"
        />
        <span className={cn("-ml-0.5 font-extrabold leading-none tracking-tight", s.word)}>
          <span className="text-foreground">-</span>
          <span className="text-primary">Seva</span>
        </span>
      </span>
      {afterWordmark ? (
        <span className="col-start-2 row-start-1 self-center">{afterWordmark}</span>
      ) : null}
      {showMotto ? (
        <span
          className={cn(
            "col-start-1 row-start-2 font-medium italic tracking-wide text-current/70",
            s.motto,
          )}
        >
          {MOTTO}
        </span>
      ) : null}
    </span>
  );
}
