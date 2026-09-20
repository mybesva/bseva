import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AdminPageHeaderProps = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Page names live in the sidebar; keep this off unless a screen truly needs a unique heading. */
  showTitle?: boolean;
};

export default function AdminPageHeader({
  title,
  description,
  actions,
  className,
  showTitle = false,
}: AdminPageHeaderProps) {
  const heading = showTitle ? title : null;
  if (!heading && !description && !actions) return null;
  return (
    <div
      className={cn(
        "sticky top-16 z-30 -mx-4 -mt-4 mb-4 flex min-h-0 flex-col justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center lg:-mx-6 lg:-mt-6 lg:px-6",
        className
      )}
    >
      {(heading || description) ? (
        <div className="min-w-0">
          {heading ? <h1 className="text-h1 text-foreground">{heading}</h1> : null}
          {description ? (
            <div className={cn("max-w-3xl text-sm text-muted-foreground", heading && "mt-1")}>{description}</div>
          ) : null}
        </div>
      ) : (
        <div className="min-w-0" />
      )}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
