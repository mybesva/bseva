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
  /** Only list levels above the approved one (upgrade page). */
  upgradeOnly?: boolean;
  hideHeader?: boolean;
  /**
   * Profile view: show current role only; expand level picker after Upgrade click.
   */
  compact?: boolean;
};

export default function PujariLevelApply({
  approvedLevel,
  requestedLevel,
  onUpdated,
  upgradeOnly = false,
  hideHeader = false,
  compact = false,
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
  const [upgrading, setUpgrading] = useState(!compact);

  async function apply() {
    setSaving(true);
    try {
      const p = await api<any>("/pujari/apply-level", {
        method: "POST",
        body: JSON.stringify({ requested_level: pick }),
      });
      toast.success(t("pujari.level.apply"));
      onUpdated?.(p);
      if (compact) setUpgrading(false);
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
          <h2 className="text-xl">
            {compact && !upgrading ? t("pujari.level.current") : t("pujari.level.title")}
          </h2>
          {(!compact || upgrading) && (
            <p className="text-sm text-muted-foreground">{t("pujari.level.hint")}</p>
          )}
        </>
      ) : null}

      <div className="rounded-md border bg-secondary/20 px-3 py-3 space-y-1">
        <p className="text-sm">
          <span className="font-medium">{t("pujari.level.current")}: </span>
          {approved ? t(`pujari.level.l${approved}`) : t("pujari.level.pending")}
        </p>
        {pendingUpgrade ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{t("pujari.level.requested")}: </span>
            {t(`pujari.level.l${requested}`)}
            {` — ${t("pujari.level.waiting")}`}
          </p>
        ) : null}
      </div>

      {compact && !upgrading ? (
        <div className="flex flex-wrap gap-2">
          {levels.length === 0 ? (
            <p className="text-sm text-muted-foreground">You are already at the highest service level.</p>
          ) : (
            <Button type="button" variant="outline" onClick={() => setUpgrading(true)}>
              {t("pujari.menu.upgradeRole")}
            </Button>
          )}
        </div>
      ) : levels.length === 0 ? (
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
                  <span className="font-medium">
                    Level {lvl.level} — {lvl.title}
                  </span>
                  <span className="block text-muted-foreground">{lvl.summary}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void apply()} disabled={saving}>
              {upgradeOnly || compact ? t("pujari.menu.upgradeRole") : t("pujari.level.apply")}
            </Button>
            {compact && (
              <Button type="button" variant="ghost" onClick={() => setUpgrading(false)}>
                Cancel
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
