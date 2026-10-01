import type { ReactNode } from "react";
import { Flame, Flower, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { SevaServiceType } from "@bseva/config";

const TAB_ICONS = { puja: Flower, chadhava: Flame, pravachan: Sparkles } as const;

const TAB_LABEL_KEYS: Record<SevaServiceType, string> = {
  puja: "seva.puja",
  chadhava: "seva.chadhava",
  pravachan: "seva.pravachan",
};

type SevaTypeTabsProps = {
  value: SevaServiceType;
  types: readonly SevaServiceType[];
  onChange: (type: SevaServiceType) => void;
  children: ReactNode;
};

/** Top-level Explore Services tabs: Puja Seva | Chadhava Seva | Pravachan Seva. */
export default function SevaTypeTabs({ value, types, onChange, children }: SevaTypeTabsProps) {
  const { t } = useI18n();
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as SevaServiceType)} className="gap-8">
      <TabsList
        className={cn(
          "grid h-auto w-full gap-1 rounded-xl border border-primary/15 bg-[#FFF3E0] p-1.5 shadow-md",
          "dark:border-primary/25 dark:bg-muted/60",
          types.length === 3 && "grid-cols-1 sm:grid-cols-3",
          types.length === 2 && "grid-cols-1 sm:grid-cols-2",
          types.length === 1 && "grid-cols-1",
        )}
        aria-label={t("nav.exploreServices")}
      >
        {types.map((type) => {
          const Icon = TAB_ICONS[type];
          return (
            <TabsTrigger
              key={type}
              value={type}
              className={cn(
                "min-h-12 gap-2 rounded-lg px-4 py-3 text-sm font-bold text-[#0A1630] transition-all",
                "data-[state=inactive]:bg-transparent data-[state=inactive]:shadow-none",
                "data-[state=inactive]:hover:bg-white/60 dark:data-[state=inactive]:text-foreground dark:data-[state=inactive]:hover:bg-card/80",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg",
              )}
            >
              <Icon size={18} aria-hidden />
              {t(TAB_LABEL_KEYS[type])}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value={value} className="mt-0 space-y-8 outline-none">
        {children}
      </TabsContent>
    </Tabs>
  );
}
