import { useState } from "react";
import { useLocation } from "wouter";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DeleteAccountFlow from "@/components/account/DeleteAccountFlow";
import { useAuth } from "@/_core/hooks/useAuth";
import { setToken } from "@/lib/api";

/** Profile → Account tab (customer and pujari portals): Delete Account. */
export default function AccountSettingsPanel() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [deactivated, setDeactivated] = useState(false);

  return (
    <div className="max-w-2xl space-y-5">
      {!open ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delete Account</CardTitle>
            <CardDescription>
              Permanently delete your B-Seva account. We will show you what happens to your bookings and payments
              before you confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <DeleteAccountFlow
            mode="signed_in"
            // The server has already ended every session; stop using the old token at once.
            onDeactivated={() => {
              setToken(null);
              setDeactivated(true);
            }}
            onFinish={() => {
              void logout().finally(() => setLocation("/"));
            }}
          />
          {deactivated ? null : (
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
          )}
        </>
      )}
    </div>
  );
}
