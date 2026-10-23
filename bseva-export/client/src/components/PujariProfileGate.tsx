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
import { api, pujariMediaUrl } from "@/lib/api";
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

const PHOTO_PROMPT_KEY = "bseva.pujariPhotoPrompted";
const sessionGet = (k: string) => {
  try {
    return window.sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const sessionSet = (k: string) => {
  try {
    window.sessionStorage.setItem(k, "1");
  } catch {
    /* storage unavailable: prompt may repeat, which is acceptable */
  }
};

export default function PujariProfileGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [photoPrompt, setPhotoPrompt] = useState(false);
  const path = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    api<any>("/pujari/profile")
      .then((p) => {
        setProfile(p);
        const incomplete = !p.profile_submitted_at && (p.profile_completion_percentage ?? 0) < 100;
        const allowed = ALLOWED.has(path);
        setOpen(incomplete && !allowed);
        // Profile photo is mandatory (BUG-11): prompt existing pujaris without a usable photo,
        // once per session, never on the profile pages they need to upload it.
        if (!incomplete && !allowed && !sessionGet(PHOTO_PROMPT_KEY)) {
          const check = p.profile_photo_path ? pujariMediaUrl("photo").then((u) => !u) : Promise.resolve(true);
          void check.then((missing) => {
            if (!missing) return;
            sessionSet(PHOTO_PROMPT_KEY);
            setPhotoPrompt(true);
          });
        }
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
      <Dialog open={photoPrompt} onOpenChange={setPhotoPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pujari.photo.requiredTitle")}</DialogTitle>
            <DialogDescription>{t("web.validation.profilePhoto")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPhotoPrompt(false)}>{t("web.profile.later")}</Button>
            <Link href="/pujari/profile">
              <Button onClick={() => setPhotoPrompt(false)}>{t("pujari.photo.uploadNow")}</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
