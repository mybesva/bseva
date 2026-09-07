import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function PujariReferralPage() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ referral_code: string }>("/pujari/referral-code")
      .then((r) => setCode(r.referral_code))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PujariPortal>
      <h1 className="text-h1 mb-2">Referral</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Share your referral code with new customers or pujaris. When they join using your code, you get
        credit as per B-Seva referral rewards.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="max-w-2xl border-primary/40">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Your referral code</p>
              <p className="font-semibold text-lg tracking-wide text-foreground">
                {code || "—"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!code}
              onClick={() => {
                if (!code) return;
                void navigator.clipboard.writeText(code);
                toast.success("Referral code copied");
              }}
            >
              Copy
            </Button>
          </CardContent>
        </Card>
      )}
    </PujariPortal>
  );
}
