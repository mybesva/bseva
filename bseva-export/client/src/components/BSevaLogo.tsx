import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  xs: "h-7 max-w-[5.5rem]",
  sm: "h-9 max-w-[7.5rem]",
  md: "h-12 max-w-[9.5rem]",
  lg: "h-20 max-w-[11rem]",
  xl: "h-24 max-w-[14rem]",
} as const;

type BSevaLogoProps = {
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  alt?: string;
};

/** Full BSeva wordmark (replaces text / stylized “B” branding). */
export default function BSevaLogo({ size = "md", className, alt = "BSeva" }: BSevaLogoProps) {
  return (
    <img
      src="/bseva-logo-transparent.png"
      alt={alt}
      className={cn("w-auto object-contain object-left", SIZE_CLASS[size], className)}
      decoding="async"
    />
  );
}
