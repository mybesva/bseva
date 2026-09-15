import { cn } from "@/lib/utils";

const WORD_SIZE = {
  xs: "text-lg",
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-4xl",
} as const;

type BSevaLogoProps = {
  size?: keyof typeof WORD_SIZE;
  className?: string;
  /** Show “Book, Believe, Bless” under the wordmark (marketing hero/footer). */
  showTagline?: boolean;
  alt?: string;
};

/** One wordmark: B icon reads as “B” + “Seva” type → BSeva. */
export default function BSevaLogo({
  size = "md",
  className,
  showTagline = false,
  alt = "BSeva",
}: BSevaLogoProps) {
  return (
    <div className={cn("inline-flex flex-col min-w-0", className)} aria-label={alt}>
      <div
        className={cn(
          "inline-flex items-center leading-none",
          WORD_SIZE[size],
        )}
      >
        <img
          src="/bseva-mark.png"
          alt=""
          aria-hidden
          className="h-[1.2em] w-[1.2em] shrink-0 object-contain -mr-[0.16em] relative top-[0.01em]"
          decoding="async"
        />
        <span className="font-bold text-primary tracking-tight whitespace-nowrap">Seva</span>
      </div>
      {showTagline ? (
        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium tracking-wide mt-1 pl-[0.15em] hidden sm:block">
          Book, Believe, Bless
        </span>
      ) : null}
    </div>
  );
}
