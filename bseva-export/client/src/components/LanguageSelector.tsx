import { LANG_LABELS, type Lang } from "@bseva/locales";
import { useChangeLanguage } from "@/i18n/LanguageSync";
import { useI18n } from "@/i18n/I18nProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function LanguageSelector({
  className,
  triggerClassName,
}: {
  className?: string;
  triggerClassName?: string;
}) {
  const { t, lang, labels } = useI18n();
  const changeLanguage = useChangeLanguage();
  return (
    <Select value={lang} onValueChange={(v) => void changeLanguage(v as Lang)}>
      <SelectTrigger
        className={cn("w-[148px] h-8 text-xs whitespace-nowrap", triggerClassName)}
        aria-label={t("lang.choose")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={className}>
        {(Object.keys(labels) as Lang[]).map((code) => (
          <SelectItem key={code} value={code}>
            {LANG_LABELS[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
