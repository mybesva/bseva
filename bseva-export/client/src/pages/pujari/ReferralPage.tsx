import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function PujariReferralPage() {
  const [code, setCode] = useState<string | null>(null);
  const [myReferrals, setMyReferrals] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ referral_code: string; my_referrals?: { name: string }[] }>("/pujari/referral-code")
      .then((r) => {
        setCode(r.referral_code);
        setMyReferrals(r.my_referrals || []);
      })
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
        <div className="space-y-4 max-w-2xl">
          <Card className="border-primary/40">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Your referral code</p>
                <p className="font-semibold text-lg tracking-wide text-foreground">{code || "—"}</p>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">My referrals</CardTitle>
            </CardHeader>
            <CardContent>
              {myReferrals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one has joined with your code yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myReferrals.map((r, i) => (
                      <TableRow key={`${r.name}-${i}`}>
                        <TableCell>{r.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PujariPortal>
  );
}
