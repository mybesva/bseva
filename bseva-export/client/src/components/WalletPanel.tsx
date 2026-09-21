import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, rupees } from "@/lib/api";
import { publicWalletDescription } from "@/lib/walletCopy";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";

type WalletResp = {
  wallet: { balance_paise: number };
  transactions: { id: string; amount_paise: number; type: string; description: string; created_at: string }[];
};

export default function WalletPanel({ variant = "customer" }: { variant?: "customer" | "priest" }) {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<WalletResp | null>(null);
  const [amount, setAmount] = useState("1000");

  async function load() {
    if (!isAuthenticated) return;
    const res = await api<WalletResp>("/wallet");
    setData(res);
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, [isAuthenticated]);

  if (!data) return null;
  const balance = data.wallet.balance_paise || 0;
  const credits = data.transactions.filter((x) => x.type === "credit").reduce((s, x) => s + Number(x.amount_paise), 0);
  const debits = data.transactions.filter((x) => x.type === "debit").reduce((s, x) => s + Number(x.amount_paise), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet size={20} className="text-primary" />
          {variant === "priest" ? t("web.wallet.pujari") : t("web.wallet.customer")}
        </CardTitle>
        <CardDescription>{t("web.wallet.liveBalance")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-orange-50">
            <p className="text-xs text-muted-foreground">{t("wallet.balance")}</p>
            <p className="text-price text-primary">{rupees(balance)}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50">
            <p className="text-xs text-muted-foreground">{t("web.wallet.credits")}</p>
            <p className="text-xl font-semibold text-green-700">{rupees(credits)}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50">
            <p className="text-xs text-muted-foreground">{t("web.wallet.debits")}</p>
            <p className="text-xl font-semibold text-blue-700">{rupees(debits)}</p>
          </div>
        </div>
        {variant === "customer" && (
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <Label>{t("wallet.amount")}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40 pl-7" />
              </div>
            </div>
            <Button
              onClick={async () => {
                try {
                  await api("/wallet/load", {
                    method: "POST",
                    body: JSON.stringify({ amount_paise: Math.round(Number(amount) * 100) }),
                  });
                  toast.success(t("wallet.loaded"));
                  await load();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              {t("wallet.load")}
            </Button>
          </div>
        )}
        <div className="space-y-2 max-h-48 overflow-auto text-sm">
          {data.transactions.slice(0, 8).map((tx) => (
            <div key={tx.id} className="flex justify-between border-b py-1">
              <span>{publicWalletDescription(tx.description)}</span>
              <span className={tx.type ==="credit" ?"text-green-700" :"text-red-700"}>
                {tx.type === "credit" ? "+" : "-"}
                {rupees(tx.amount_paise)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
