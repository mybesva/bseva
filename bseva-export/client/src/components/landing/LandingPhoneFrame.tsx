import { cn } from "@/lib/utils";

/** Decorative device frame for landing hero / app showcase. */
export default function LandingPhoneFrame({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-[9/19] w-[11.5rem] shrink-0 overflow-hidden rounded-[2.25rem] border-[8px] border-[#05080F] bg-[#FFF8E7] shadow-2xl shadow-black/45 ring-1 ring-white/20 sm:w-[12.75rem] lg:w-[14rem]",
        className,
      )}
    >
      <span className="absolute left-1/2 top-2 z-10 h-3.5 w-[4.5rem] -translate-x-1/2 rounded-full bg-[#05080F]" />
      {children}
    </div>
  );
}
