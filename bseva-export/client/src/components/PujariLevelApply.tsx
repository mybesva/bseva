import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { usePujariLevels } from "@/hooks/usePujariLevels";
import { toast } from "sonner";

type Props = {
  approvedLevel?: number | null;
  requestedLevel?: number | null;
  onUpdated?: (profile: any) => void;
  upgradeOnly?: boolean;
  hideHeader?: boolean;
};

export default function PujariLevelApply({
  approvedLevel,
  requestedLevel,
  onUpdated,
  upgradeOnly = false,
  hideHeader = false,
}: Props) {
  const { t } = useI18n();
  const { levels: allLevels } = usePujariLevels();
  const approved = Number(approvedLevel || 0);
  const requested = Number(requestedLevel || 0);
  const pendingUpgrade = requested > approved;
  const levels =
    upgradeOnly && approved > 0 ? allLevels.filter((l) => l.level > approved) : allLevels;
  const defaultPick =
    upgradeOnly && approved > 0
      ? Math.max(requested, approved + 1, levels[0]?.level || approved + 1)
      : Number(requestedLevel || approvedLevel || 2);
  const [pick, setPick] = useState<number>(defaultPick);
  const [saving, setSaving] = useState(false);

  async function apply() {
    setSaving(true);
    try {
      const p = await api<any>("/pujari/apply-level", {
        method: "POST",
        body: JSON.stringify({ requested_level: pick }),
      });
      toast.success(t("pujari.level.apply"));
      onUpdated?.(p);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="level" className="space-y-3 scroll-mt-24">
      {!hideHeader ? (
        <>
          <h2 className="font-heading text-xl">{t("pujari.level.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("pujari.level.hint")}</p>
        </>
      ) : null}
      <p className="text-sm">
        <span className="font-medium">{t("pujari.level.current")}: </span>
        {approved ? t(`pujari.level.l${approved}`) : t("pujari.level.pending")}
      </p>
      {pendingUpgrade ? (
        <p className="text-sm">
          <span className="font-medium">{t("pujari.level.requested")}: </span>
          {t(`pujari.level.l${requested}`)}
          {` — ${t("pujari.level.waiting")}`}
        </p>
      ) : null}
      {levels.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-md p-3 bg-secondary/20">
          You are already at the highest service level.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {levels.map((lvl) => (
              <label key={lvl.level} className="flex items-start gap-2 text-sm border rounded-md p-3 cursor-pointer">
                <input
                  type="radio"
                  name="pujari-level"
                  className="mt-1"
                  checked={pick === lvl.level}
                  onChange={() => setPick(lvl.level)}
                />
                <span>
                  <span className="font-medium">Level {lvl.level} — {lvl.title}</span>
                  <span className="block text-muted-foreground">{lvl.summary}</span>
                </span>
              </label>
            ))}
          </div>
          <Button type="button" onClick={() => void apply()} disabled={saving}>
            {upgradeOnly ? t("pujari.menu.upgradeRole") : t("pujari.level.apply")}
          </Button>
        </>
      )}
    </section>
  );
}
