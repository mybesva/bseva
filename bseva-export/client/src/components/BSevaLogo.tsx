import { cn } from "@/lib/utils";

const LOGO_HEIGHT = {
  xs: "h-8",
  sm: "h-9",
  md: "h-11",
  lg: "h-14",
  xl: "h-[4.5rem]",
} as const;

type BSevaLogoProps = {
  size?: keyof typeof LOGO_HEIGHT;
  className?: string;
  alt?: string;
};

/** Full brand logo (tagline is part of the artwork). */
export default function BSevaLogo({
  size = "md",
  className,
  alt = "BSeva",
}: BSevaLogoProps) {
  return (
    <img
      src="/bseva-logo-transparent.png"
      alt={alt}
      className={cn(
        "w-auto max-w-[min(100%,14rem)] object-contain object-left",
        LOGO_HEIGHT[size],
        className,
      )}
      decoding="async"
    />
  );
}
