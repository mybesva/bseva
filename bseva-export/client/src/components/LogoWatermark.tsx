/**
 * Fixed, non-interactive logo-only watermark for every page.
 * Uses the mark (icon) only — no wordmark text.
 */
export default function LogoWatermark() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[5] overflow-hidden"
      aria-hidden="true"
    >
      <img
        src="/bseva-mark.png"
        alt=""
        draggable={false}
        className="absolute left-1/2 top-1/2 w-[min(55vw,28rem)] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.07] mix-blend-multiply"
      />
    </div>
  );
}
