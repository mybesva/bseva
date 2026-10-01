import { cn } from "@/lib/utils";

/**
 * Decorative devotional line art (all `aria-hidden`, stroke = currentColor).
 * Used at very low opacity to tie the landing sections together.
 */

type SvgProps = { className?: string };

/** Concentric lotus / mandala outline. */
export function MandalaOutline({ className }: SvgProps) {
  const petals = Array.from({ length: 16 }, (_, i) => i * 22.5);
  const smallPetals = Array.from({ length: 16 }, (_, i) => i * 22.5 + 11.25);
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden
      focusable="false"
      className={cn("pointer-events-none select-none", className)}
    >
      <circle cx="200" cy="200" r="196" />
      <circle cx="200" cy="200" r="168" strokeDasharray="2 6" />
      <circle cx="200" cy="200" r="120" />
      <circle cx="200" cy="200" r="72" />
      <circle cx="200" cy="200" r="28" />
      {petals.map((deg) => (
        <path
          key={deg}
          transform={`rotate(${deg} 200 200)`}
          d="M200 22 C 216 70 216 112 200 150 C 184 112 184 70 200 22 Z"
        />
      ))}
      {smallPetals.map((deg) => (
        <path
          key={deg}
          transform={`rotate(${deg} 200 200)`}
          d="M200 92 C 208 112 208 130 200 148 C 192 130 192 112 200 92 Z"
        />
      ))}
    </svg>
  );
}

/** Stepped South-Indian gopuram outline. */
export function TempleOutline({ className }: SvgProps) {
  const tiers = 7;
  return (
    <svg
      viewBox="0 0 600 420"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={cn("pointer-events-none select-none", className)}
    >
      <path d="M20 400 H580" />
      <rect x="110" y="330" width="380" height="70" />
      <path d="M270 400 V355 a30 30 0 0 1 60 0 V400" />
      {Array.from({ length: tiers }, (_, i) => {
        const w = 340 - i * 40;
        const h = 30;
        const y = 330 - (i + 1) * h;
        const x = 300 - w / 2;
        const windows = Math.max(2, Math.floor(w / 46));
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} />
            <path d={`M${x - 8} ${y} H${x + w + 8}`} />
            {Array.from({ length: windows }, (_, k) => {
              const cx = x + ((k + 0.5) * w) / windows;
              return <path key={k} d={`M${cx - 6} ${y + h} v-14 a6 6 0 0 1 12 0 v14`} />;
            })}
          </g>
        );
      })}
      <path d="M300 120 V84" />
      <ellipse cx="300" cy="74" rx="12" ry="10" />
      <path d="M300 64 V40" />
      <path d="M292 40 H308" />
      {/* side shrines */}
      <rect x="40" y="350" width="70" height="50" />
      <path d="M40 350 L75 310 L110 350" />
      <rect x="490" y="350" width="70" height="50" />
      <path d="M490 350 L525 310 L560 350" />
    </svg>
  );
}

/** Small lotus mark used as a section ornament. */
export function LotusMark({ className }: SvgProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={cn("pointer-events-none select-none", className)}
    >
      <path d="M32 10 C 40 22 40 36 32 48 C 24 36 24 22 32 10 Z" />
      <path d="M32 48 C 18 46 10 38 8 26 C 20 26 28 34 32 48 Z" />
      <path d="M32 48 C 46 46 54 38 56 26 C 44 26 36 34 32 48 Z" />
      <path d="M14 52 H50" />
    </svg>
  );
}
