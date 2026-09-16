import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";

const ALLOWED = new Set([
  "/pujari/onboarding",
  "/pujari/profile",
  "/pujari/address",
  "/pujari/documents",
  "/pujari/services",
  "/pujari/availability",
  "/pujari/bank",
  "/pujari/change-password",
  "/terms",
  "/privacy",
]);

export default function PujariProfileGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const path = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    api<any>("/pujari/profile")
      .then((p) => {
        setProfile(p);
        const incomplete = !p.profile_submitted_at && (p.profile_completion_percentage ?? 0) < 100;
        const allowed = ALLOWED.has(path);
        setOpen(incomplete && !allowed);
      })
      .catch(() => undefined);
  }, [path]);

  return (
    <>
      {children}
      {profile && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="">{t("web.profile.completeTitle")}</DialogTitle>
              <DialogDescription>
                {t("web.profile.completeDescription")}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t("web.profile.progress", { percent: profile.profile_completion_percentage ?? 0 })}</p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setOpen(false)}>{t("web.profile.later")}</Button>
              <Link href="/pujari/onboarding"><Button>{t("web.profile.completeAction")}</Button></Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
