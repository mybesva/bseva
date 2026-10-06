import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared temple-arch silhouette (0–1 box). Soft three-foil crown,
 * tall sides, gentle base — the same shape on Services, Customer, and Pujari.
 */
const ARCH =
  "M0.50 0.025 C0.58 0.025 0.64 0.07 0.675 0.145 C0.71 0.08 0.78 0.045 0.845 0.11 C0.91 0.05 0.975 0.08 0.978 0.20 C0.985 0.32 0.978 0.50 0.972 0.68 C0.968 0.82 0.82 0.93 0.50 0.985 C0.18 0.93 0.032 0.82 0.028 0.68 C0.022 0.50 0.015 0.32 0.022 0.20 C0.025 0.08 0.09 0.05 0.155 0.11 C0.22 0.045 0.29 0.08 0.325 0.145 C0.36 0.07 0.42 0.025 0.50 0.025 Z";

type DevotionalImageFrameProps = {
  src: string;
  alt: string;
  /** Focal point inside the frame. Percentages, e.g. "center 56%" or "36% 50%". */
  objectPosition: string;
  /** Extra zoom inside the frame so a tall source can drop its baked edge. */
  zoom?: number;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
};

/** Ornamental frame. The box sets the size; the photograph fills that silhouette. */
export default function DevotionalImageFrame({
  src,
  alt,
  objectPosition,
  zoom = 1,
  width,
  height,
  className,
  priority = false,
}: DevotionalImageFrameProps) {
  const clipId = `devotional-arch-${useId().replace(/:/g, "")}`;

  return (
    <div className={cn("relative", className)}>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path d={ARCH} />
          </clipPath>
        </defs>
      </svg>
      <div
        className="relative h-full w-full bg-[#F6E7D2] dark:bg-[#1A140E]"
        style={{ clipPath: `url(#${clipId})` }}
      >
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          decoding="async"
          fetchPriority={priority ? "high" : undefined}
          loading={priority ? "eager" : "lazy"}
          className="h-full w-full object-cover"
          style={{
            objectPosition,
            transform: zoom === 1 ? undefined : `scale(${zoom})`,
            transformOrigin: objectPosition,
          }}
        />
      </div>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full text-[#E8A04A]/80"
        aria-hidden
      >
        <path
          d="M50 2.5 C58 2.5 64 7 67.5 14.5 C71 8 78 4.5 84.5 11 C91 5 97.5 8 97.8 20 C98.5 32 97.8 50 97.2 68 C96.8 82 82 93 50 98.5 C18 93 3.2 82 2.8 68 C2.2 50 1.5 32 2.2 20 C2.5 8 9 5 15.5 11 C22 4.5 29 8 32.5 14.5 C36 7 42 2.5 50 2.5 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.15"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
