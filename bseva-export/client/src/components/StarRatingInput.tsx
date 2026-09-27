import { clampHeadRatingStars } from "@bseva/config";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StarRatingInputProps = {
  value: number;
  onChange: (stars: number) => void;
  disabled?: boolean;
  id?: string;
};

export function StarRatingInput({ value, onChange, disabled, id }: StarRatingInputProps) {
  const stars = clampHeadRatingStars(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {Array.from({ length: 5 }, (_, i) => {
          const n = i + 1;
          const filled = n <= stars;
          return (
            <button
              key={n}
              type="button"
              id={id && n === 1 ? id : undefined}
              role="radio"
              aria-checked={filled}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              disabled={disabled}
              onClick={() => onChange(n)}
              className={cn(
                "rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50",
                filled ? "text-primary" : "text-muted-foreground/45 hover:text-primary/70",
              )}
            >
              <Star className={cn("size-8", filled && "fill-current")} strokeWidth={1.5} />
            </button>
          );
        })}
      </div>
      <p className="text-sm font-medium text-foreground">
        {stars} / 5
      </p>
    </div>
  );
}
