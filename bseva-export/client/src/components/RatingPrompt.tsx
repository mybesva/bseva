import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type PendingRating = {
  booking_id: string;
  booking_number?: string | null;
  booking_date?: string | null;
  service_name?: string | null;
  counterpart_name?: string | null;
  counterpart_role: "pujari" | "customer";
};

/** Asked at most once per browser session; a new login (new session) asks again until rated or skipped. */
const sessionKey = (uid: string) => `bseva.ratingPrompted.${uid}`;
const sessionHas = (k: string) => {
  try {
    return window.sessionStorage.getItem(k) === "1";
  } catch {
    return false;
  }
};
const sessionMark = (k: string) => {
  try {
    window.sessionStorage.setItem(k, "1");
  } catch {
    /* storage blocked: the prompt may show again, acceptable */
  }
};

/**
 * Post-puja rating prompt for customers (rate the Pujari) and pujaris (rate the customer).
 * Optional: "Not now" closes it for this session, "Skip" records that the person chose not to rate.
 */
export default function RatingPrompt() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [item, setItem] = useState<PendingRating | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = user?.id != null ? String(user.id) : "";
  const role = user?.role;
  const eligible = role === "customer" || role === "pujari" || role === "head_pujari";

  useEffect(() => {
    if (!eligible || !uid || sessionHas(sessionKey(uid))) return;
    let cancelled = false;
    api<PendingRating[]>("/ratings/pending")
      .then((rows) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        sessionMark(sessionKey(uid));
        setItem(rows[0]);
      })
      .catch(() => undefined); // never interrupt the user because the prompt failed to load
    return () => {
      cancelled = true;
    };
  }, [eligible, uid]);

  async function send(skip: boolean) {
    if (!item || busy) return;
    if (!skip && !stars) {
      toast.error(t("rating.chooseStars"));
      return;
    }
    setBusy(true);
    try {
      await api(`/bookings/${item.booking_id}/ratings`, {
        method: "POST",
        body: JSON.stringify(skip ? { skip: true } : { stars, comment: comment.trim() || null, skip: false }),
      });
      if (!skip) toast.success(t("rating.thanks"));
      setItem(null);
    } catch (e: any) {
      // Shown as a failure, and the prompt stays open so nothing is falsely reported as saved.
      toast.error(e?.message || t("rating.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (!item) return null;
  const who = item.counterpart_name || (item.counterpart_role === "pujari" ? t("auth.pujari") : t("auth.customer"));
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && !busy && setItem(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {item.counterpart_role === "pujari" ? t("rating.titleRatePujari") : t("rating.titleRateCustomer")}
          </DialogTitle>
          <DialogDescription>
            {t("rating.subtitle", { name: who, puja: item.service_name || "", number: item.booking_number || "" })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1.5 py-1" role="radiogroup" aria-label={t("rating.starsLabel")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n}`}
              onClick={() => setStars(n)}
              className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A00]"
            >
              <Star
                size={30}
                className={cn(n <= stars ? "fill-[#FF7A00] text-[#FF7A00]" : "text-muted-foreground/40")}
              />
            </button>
          ))}
        </div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("rating.commentPlaceholder")}
          rows={3}
          maxLength={1000}
        />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void send(true)}>
            {t("rating.skip")}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setItem(null)}>
            {t("rating.notNow")}
          </Button>
          <Button type="button" disabled={busy || !stars} onClick={() => void send(false)}>
            {busy ? t("common.loading") : t("rating.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
