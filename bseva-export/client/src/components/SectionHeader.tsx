import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  align?: "left" | "center" | "right";
  className?: string;
  light?: boolean;
  variant?: "default" | "landingDoc";
}

export default function SectionHeader({ 
  title, 
  subtitle, 
  description, 
  align = "center", 
  className,
  light = false,
  variant = "default",
}: SectionHeaderProps) {
  const isLandingDoc = variant === "landingDoc";

  return (
    <div className={cn(
      isLandingDoc ? "flex flex-col gap-2 mb-5 md:mb-6" : "flex flex-col gap-3 mb-12",
      align === "center" && "items-center text-center",
      align === "right" && "items-end text-right",
      className
    )}>
      {subtitle && (
        <span className={cn(
          "text-eyebrow font-bold",
          light ? "text-primary" : "text-primary"
        )}>
          {subtitle}
        </span>
      )}
      
      <h2 className={cn(
        isLandingDoc
          ? "landing-doc-heading"
          : "text-h2 text-3xl md:text-4xl leading-tight font-bold text-primary"
      )}>
        {title}
      </h2>
      
      {description && (
        <div className={cn(
          "w-24 h-1 mt-2 mb-4 rounded-full bg-gradient-to-r from-primary to-accent",
          align === "center" && "mx-auto"
        )} />
      )}
      
      {description && (
        <p className={cn(
          "max-w-2xl text-base md:text-lg leading-relaxed font-medium",
          light ? "text-[#FFFFFF]" : "text-foreground"
        )}>
          {description}
        </p>
      )}
    </div>
  );
}
