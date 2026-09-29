import type { ReactNode } from "react";
import { Flame, Flower, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/I18nProvider";
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
    <Tabs value={value} onValueChange={(next) => onChange(next as SevaServiceType)} className="gap-6">
      <TabsList
        className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1"
        aria-label={t("nav.exploreServices")}
      >
        {types.map((type) => {
          const Icon = TAB_ICONS[type];
          return (
            <TabsTrigger key={type} value={type} className="flex-1 min-w-[7rem] gap-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-md">
              <Icon size={16} />
              {t(TAB_LABEL_KEYS[type])}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value={value} className="space-y-8">
        {children}
      </TabsContent>
    </Tabs>
  );
}
