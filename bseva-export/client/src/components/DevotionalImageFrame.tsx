import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Temple gopuram arch (0–1 box): pointed ogee crown that eases into straight sides,
 * softly rounded base corners. Shared by Services, Customer and Pujari.
 */
const ARCH =
  "M0.5 0 C0.6 0.0765 0.856 0.1294 0.952 0.3059 C0.984 0.3647 1 0.4118 1 0.4706 L1 0.9588 Q1 1 0.944 1 L0.056 1 Q0 1 0 0.9588 L0 0.4706 C0 0.4118 0.016 0.3647 0.048 0.3059 C0.144 0.1294 0.4 0.0765 0.5 0 Z";

/** Same outline in a 100-unit box for the drawn gold rules. */
const ARCH_100 =
  "M50 0 C60 7.65 85.6 12.94 95.2 30.59 C98.4 36.47 100 41.18 100 47.06 L100 95.88 Q100 100 94.4 100 L5.6 100 Q0 100 0 95.88 L0 47.06 C0 41.18 1.6 36.47 4.8 30.59 C14.4 12.94 40 7.65 50 0 Z";

type DevotionalImageFrameProps = {
  src: string;
  alt: string;
  /** Focal point inside the arch, e.g. "center 56%" or "30% 0%". */
  objectPosition: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  /**
   * Fraction of the arch height left above the photo (0–0.3). Use when the subject sits at
   * the very top of the source, so the narrowing crown never clips it; a soft blurred copy
   * of the same photo fills that headroom.
   */
  headroom?: number;
};

/**
 * Ornamental frame. The box sets the size (leave ~10% headroom for the finial);
 * the photograph fills the inner arch, wrapped by a double gold rule and a kalash finial.
 */
export default function DevotionalImageFrame({
  src,
  alt,
  objectPosition,
  width,
  height,
  className,
  priority = false,
  headroom = 0,
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

      {/* Outer gold rule */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[6%] h-[94%] w-full overflow-visible text-[#E8A04A] dark:text-[#E8A04A]/80"
        aria-hidden
      >
        <path d={ARCH_100} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* Photograph inside the arch */}
      <div
        className="absolute bottom-[2.4%] left-[3.4%] right-[3.4%] top-[8.6%] bg-[#F6E7D2] shadow-[0_22px_40px_-26px_rgba(120,60,10,0.6)] dark:bg-[#1A140E]"
        style={{ clipPath: `url(#${clipId})` }}
      >
        {headroom > 0 && (
          <img
            src={src}
            alt=""
            aria-hidden
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-90 blur-xl"
            style={{ objectPosition }}
          />
        )}
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          decoding="async"
          fetchPriority={priority ? "high" : undefined}
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-x-0 bottom-0 w-full object-cover"
          style={{
            objectPosition,
            height: `${(1 - headroom) * 100}%`,
            maskImage: headroom > 0 ? "linear-gradient(to bottom, transparent, #000 12%)" : undefined,
            WebkitMaskImage: headroom > 0 ? "linear-gradient(to bottom, transparent, #000 12%)" : undefined,
          }}
        />
      </div>

      {/* Inner gold rule on the photo edge */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute bottom-[2.4%] left-[3.4%] right-[3.4%] top-[8.6%] h-[89%] w-[93.2%] overflow-visible text-[#C9761A]"
        aria-hidden
      >
        <path d={ARCH_100} fill="none" stroke="currentColor" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* Kalash finial on the crown */}
      <svg
        viewBox="0 0 24 30"
        className="pointer-events-none absolute left-1/2 top-0 h-[7.5%] w-auto -translate-x-1/2"
        aria-hidden
      >
        <path d="M12 0.5 q4.2 5.2 0 9.2 q-4.2 -4 0 -9.2" fill="#FF7A00" />
        <circle cx="12" cy="14.2" r="4.4" fill="#FF7A00" />
        <path d="M3.5 19 h17 l-2.6 7 h-11.8 Z" fill="#D98A1C" />
        <path d="M6 27.6 h12" stroke="#C9761A" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
