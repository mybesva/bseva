import { useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { ACCOUNT_DELETION_PENDING_EVENT } from "@/lib/api";

const FALLBACK = "This account is scheduled for deletion.";

/**
 * A signed-in request came back ACCOUNT_DELETION_PENDING (lib/api.ts already dropped the token):
 * sign out locally and offer the cancel flow.
 */
export default function AccountDeletionPendingListener() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    let shown = false;
    const onPending = (e: Event) => {
      void logout();
      if (shown) return;
      shown = true;
      window.setTimeout(() => {
        shown = false;
      }, 5000);
      const message = (e as CustomEvent<{ message?: string }>).detail?.message || FALLBACK;
      toast.error(message, {
        id: "account-deletion-pending",
        duration: 15000,
        action: { label: "Cancel Deletion", onClick: () => setLocation("/delete-account?cancel=1") },
      });
    };
    window.addEventListener(ACCOUNT_DELETION_PENDING_EVENT, onPending);
    return () => window.removeEventListener(ACCOUNT_DELETION_PENDING_EVENT, onPending);
  }, [logout, setLocation]);

  return null;
}
