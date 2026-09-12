import { PujariPortal } from "@/components/RolePortals";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

/** Service level is Admin-only — pujaris do not see or choose levels here. */
export default function PujariServicesPage() {
  return (
    <PujariPortal>
      <Card className="max-w-2xl border-border shadow-sm">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">Service role</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Your service role is assigned and managed by BSeva Admin after document review. Contact support if you need a
            change.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground leading-relaxed">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <p>Level selection is not available in the Pujari portal.</p>
          </div>
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
