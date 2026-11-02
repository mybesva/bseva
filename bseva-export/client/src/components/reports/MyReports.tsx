import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineError } from "@/components/account/OtpParts";
import { apiErrorInfo } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import {
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
  listMyReports,
  reportReasonLabel,
  reportStatusClass,
  type MyReport,
} from "@/lib/compliance";

/** Reports the signed-in user has filed (GET /reports/mine). */
export default function MyReports() {
  const [rows, setRows] = useState<MyReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const out = await listMyReports();
      setRows(Array.isArray(out) ? out : []);
    } catch (err) {
      setError(apiErrorInfo(err, "Could not load your reports.").message);
      setRows([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">My Reports</CardTitle>
        <CardDescription>
          To report a booking, a pujari or a customer, open the booking and choose Report.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </p>
        ) : null}
        {error ? (
          <div className="space-y-2">
            <InlineError message={error} />
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : null}
        {rows && rows.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground">You have not reported anything.</p>
        ) : null}
        {rows && rows.length > 0 ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {rows.map((r) => (
              <li key={r.id} className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {REPORT_TARGET_LABELS[r.target_type] || r.target_type} · {reportReasonLabel(r.reason)}
                  </span>
                  <Badge variant="outline" className={cn("font-normal", reportStatusClass(r.status))}>
                    {REPORT_STATUS_LABELS[r.status] || r.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Reported {formatDisplayDateTime(r.created_at)}</p>
                {r.resolution ? <p className="text-foreground">Outcome: {r.resolution}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
