import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

/** Read-only service level display — self-upgrade removed (req #113). */
export default function PujariServicesPage() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api<any>("/pujari/profile")
      .then(setProfile)
      .catch((e) => toast.error(e.message));
  }, []);

  return (
    <PujariPortal>
      <Card className="max-w-2xl border-border shadow-sm">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl">Service level</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Your approved service level is managed by BSeva Admin. Contact support if you need a change.
          </CardDescription>
          <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground leading-relaxed">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <p>Self-service role upgrades are not available from the Pujari portal.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!profile ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <>
              <p>
                Approved level: <strong>{profile.approved_level ?? "—"}</strong>
              </p>
              <p className="text-muted-foreground">
                Requested level (Admin review): {profile.requested_level ?? "—"}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
