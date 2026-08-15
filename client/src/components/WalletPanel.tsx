import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { format } from "date-fns";

export default function WalletPanel({ variant = "customer" }: { variant?: "customer" | "priest" }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: wallet, isLoading } = trpc.wallet.get.useQuery();
  const [amount, setAmount] = useState("1000");
  const load = trpc.wallet.load.useMutation({
    onSuccess: async () => {
      await utils.wallet.get.invalidate();
      toast.success("Wallet loaded successfully (demo payment)");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return null;

  const balance = wallet?.balance || 0;
  const credits = (wallet?.transactions || []).filter((x) => x.type === "credit").reduce((s, x) => s + x.amount, 0);
  const debits = (wallet?.transactions || []).filter((x) => x.type === "debit").reduce((s, x) => s + x.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Wallet size={20} className="text-primary" />
          {variant === "priest" ? t("priest.wallet") : t("customer.wallet")}
        </CardTitle>
        <CardDescription>{t("common.demo")} — mock balance & transactions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
            <p className="text-xs text-muted-foreground">{t("customer.balance")}</p>
            <p className="text-2xl font-bold text-[#F7931E]">₹{(balance / 100).toLocaleString("en-IN")}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 border border-green-100">
            <p className="text-xs text-muted-foreground">
              {variant === "priest" ? t("priest.earnings") : "Added money"}
            </p>
            <p className="text-xl font-semibold text-green-700">₹{(credits / 100).toLocaleString("en-IN")}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <p className="text-xs text-muted-foreground">
              {variant === "priest" ? "Withdrawable (demo)" : "Booking deductions"}
            </p>
            <p className="text-xl font-semibold text-blue-700">
              ₹{((variant === "priest" ? balance : debits) / 100).toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {variant === "customer" && (
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label>{t("customer.loadWallet")} (₹)</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              className="bg-primary"
              disabled={load.isPending}
              onClick={() => load.mutate({ amountRupees: Number(amount) || 0 })}
            >
              {t("customer.loadWallet")}
            </Button>
          </div>
        )}

        <div>
          <h4 className="font-medium mb-2">{t("customer.transactions")}</h4>
          <div className="space-y-2 max-h-64 overflow-auto">
            {(wallet?.transactions || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            )}
            {(wallet?.transactions || []).map((tx) => (
              <div key={tx.id} className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
                <div>
                  <p className="font-medium">{tx.description || tx.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {tx.createdAt ? format(new Date(tx.createdAt), "PPp") : ""}
                  </p>
                </div>
                <Badge className={tx.type === "credit" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {tx.type === "credit" ? "+" : "-"}₹{(tx.amount / 100).toLocaleString("en-IN")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
