import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { openCashfreeCheckout } from "@/lib/cashfreeCheckout";

export const APP_RETURN_KEY = "bseva.payment.appReturn";

/**
 * Hosted checkout for the mobile app: the app opens /payment/checkout#booking_id=…&sid=…&env=…&app=1 in the
 * phone's browser. Nothing here confirms anything; the app asks the server for the verified result afterwards.
 */
export default function PaymentCheckout() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "");
  const bookingId = params.get("booking_id") || "";
  const sid = params.get("sid") || "";
  const env = params.get("env") === "production" ? "production" : "sandbox";

  const start = () => {
    setError(null);
    try {
      if (params.get("app") === "1") sessionStorage.setItem(APP_RETURN_KEY, bookingId);
    } catch {
      /* storage blocked: the app still re-checks when it comes back to the foreground */
    }
    openCashfreeCheckout({
      provider: "cashfree",
      environment: env,
      order_id: "",
      payment_session_id: sid,
      amount_paise: 0,
      currency: "INR",
    }).catch((e: Error) => setError(e.message || t("pay.unavailable")));
  };

  useEffect(() => {
    if (bookingId && sid) start();
    else setError(t("pay.unavailable"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            {bookingId && sid && <Button onClick={start}>{t("pay.retry")}</Button>}
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p>{t("pay.redirecting")}</p>
          </>
        )}
      </div>
    </Layout>
  );
}
