import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  align?: "left" | "center" | "right";
  className?: string;
  light?: boolean;
}

export default function SectionHeader({ 
  title, 
  subtitle, 
  description, 
  align = "center", 
  className,
  light = false
}: SectionHeaderProps) {
  return (
    <div className={cn(
      "flex flex-col gap-3 mb-12", 
      align === "center" && "items-center text-center",
      align === "right" && "items-end text-right",
      className
    )}>
      {subtitle && (
        <span className={cn(
          "text-sm font-bold tracking-[0.2em] uppercase",
          light ? "text-primary/90" : "text-primary"
        )}>
          {subtitle}
        </span>
      )}
      
      <h2 className={cn(
        "font-heading font-bold text-3xl md:text-4xl lg:text-5xl leading-tight",
        light ? "text-white" : "text-sidebar"
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
          "max-w-2xl text-lg leading-relaxed",
          light ? "text-white/80" : "text-muted-foreground"
        )}>
          {description}
        </p>
      )}
    </div>
  );
}
