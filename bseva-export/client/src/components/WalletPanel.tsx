import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, rupees } from "@/lib/api";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type WalletResp = {
  wallet: { balance_paise: number };
  transactions: { id: string; amount_paise: number; type: string; description: string; created_at: string }[];
};

export default function WalletPanel({ variant = "customer" }: { variant?: "customer" | "priest" }) {
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
        <CardTitle className="flex items-center gap-2 font-heading">
          <Wallet size={20} className="text-primary" />
          {variant === "priest" ? "Pujari wallet" : "Customer wallet"}
        </CardTitle>
        <CardDescription>Live Supabase balance — same as mobile</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-orange-50">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-2xl font-bold text-[#F7931E]">{rupees(balance)}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50">
            <p className="text-xs text-muted-foreground">Credits</p>
            <p className="text-xl font-semibold text-green-700">{rupees(credits)}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50">
            <p className="text-xs text-muted-foreground">Debits</p>
            <p className="text-xl font-semibold text-blue-700">{rupees(debits)}</p>
          </div>
        </div>
        {variant === "customer" && (
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <Label>Load wallet (₹)</Label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40" />
            </div>
            <Button
              onClick={async () => {
                try {
                  await api("/wallet/load", {
                    method: "POST",
                    body: JSON.stringify({ amount_paise: Math.round(Number(amount) * 100) }),
                  });
                  toast.success("Wallet loaded");
                  await load();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              Load
            </Button>
          </div>
        )}
        <div className="space-y-2 max-h-48 overflow-auto text-sm">
          {data.transactions.slice(0, 8).map((tx) => (
            <div key={tx.id} className="flex justify-between border-b py-1">
              <span>{tx.description}</span>
              <span className={tx.type === "credit" ? "text-green-700" : "text-red-700"}>
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
