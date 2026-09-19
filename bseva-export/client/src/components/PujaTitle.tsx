import { cn } from "@/lib/utils";
import { formatPujaTitleText, stripPujaTitleMarks } from "@bseva/locales";

type PujaTitleProps = {
  name?: string | null;
  className?: string;
  nameClassName?: string;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  /** Cream name on navy/hero backgrounds. */
  onDark?: boolean;
};

export function PujaTitle({
  name,
  className,
  nameClassName,
  as: Comp = "span",
  onDark = false,
}: PujaTitleProps) {
  const clean = stripPujaTitleMarks(name);
  if (!clean) return null;
  return (
    <Comp className={cn("leading-snug", className)} aria-label={formatPujaTitleText(clean)}>
      <span
        className="text-primary font-semibold align-middle text-[0.82em] mr-1.5"
        aria-hidden
      >
        ॐ
      </span>
      <span
        className={cn(
          "font-bold align-middle",
          onDark ? "text-[#FFF8E7]" : "text-[#1A2B4A] dark:text-[#E8EEF6]",
          nameClassName,
        )}
      >
        {clean}
      </span>
      <span
        className="text-primary font-semibold align-middle text-[0.82em] ml-1.5"
        aria-hidden
      >
        卐
      </span>
    </Comp>
  );
}
