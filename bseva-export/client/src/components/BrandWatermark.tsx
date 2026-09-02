/**
 * Fixed, non-interactive watermark using the B-Seva symbol only (no wordmark).
 */
export default function BrandWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <img
        src="/bseva-mark.png"
        alt=""
        className="absolute left-1/2 top-1/2 h-[min(70vmin,520px)] w-auto -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.06]"
        draggable={false}
      />
    </div>
  );
}
