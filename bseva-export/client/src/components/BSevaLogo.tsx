import { cn } from "@/lib/utils";

const LOGO_SIZE = {
  xs: {
    mark: "h-8 w-8",
    word: "text-base",
  },
  sm: {
    mark: "h-10 w-10",
    word: "text-xl",
  },
  md: {
    mark: "h-12 w-12",
    word: "text-2xl",
  },
  lg: {
    mark: "h-14 w-14",
    word: "text-3xl",
  },
  xl: {
    mark: "h-16 w-16",
    word: "text-4xl",
  },
  header: {
    mark: "h-[4.5rem] w-[4.5rem]",
    word: "text-4xl",
  },
} as const;

type BSevaLogoProps = {
  size?: keyof typeof LOGO_SIZE | "portal";
  className?: string;
  alt?: string;
  /** Full artwork on public chrome and portal headers; lockup is compact mark + Seva. */
  variant?: "lockup" | "full";
};

const FULL_HEIGHT = {
  xs: "h-8",
  sm: "h-9",
  md: "h-14",
  lg: "h-16",
  xl: "h-20",
  header: "h-12 sm:h-14 lg:h-[3.75rem]",
  portal: "h-10 sm:h-11",
} as const;

/** Logo stands in for the letter B in “B-Seva”. Motto lives in the full artwork only. */
export default function BSevaLogo({
  size = "md",
  className,
  alt = "B-Seva",
  variant = "lockup",
}: BSevaLogoProps) {
  if (variant === "full") {
    return (
      <img
        src="/bseva-logo-transparent.png"
        alt={alt}
        className={cn(
          "w-auto object-contain object-left",
          size === "header"
            ? "max-w-[min(100%,11.5rem)]"
            : size === "portal"
              ? "max-w-[9.5rem]"
              : "max-w-[min(100%,16rem)]",
          FULL_HEIGHT[size],
          className,
        )}
        decoding="async"
      />
    );
  }

  const s = LOGO_SIZE[size === "portal" ? "sm" : size];
  return (
    <span
      className={cn("inline-flex items-center gap-x-2 text-foreground", className)}
      role="img"
      aria-label={alt}
    >
      <span className="inline-flex items-center">
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
    </span>
  );
}
