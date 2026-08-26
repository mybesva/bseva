import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const ALLOWED = new Set([
  "/pujari/onboarding",
  "/pujari/profile",
  "/pujari/address",
  "/pujari/documents",
  "/pujari/change-password",
  "/terms",
  "/privacy",
]);

export default function PujariProfileGate({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const path = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    api<any>("/pujari/profile")
      .then((p) => {
        setProfile(p);
        const incomplete = !p.profile_submitted_at && (p.profile_completion_percentage ?? 0) < 100;
        const allowed = ALLOWED.has(path);
        setOpen(incomplete && !allowed);
      })
      .catch(() => undefined);
  }, [path]);

  return (
    <>
      {children}
      {profile && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Complete Your Profile</DialogTitle>
              <DialogDescription>
                Please complete your BSeva Pujari profile before continuing. Your profile information and required documents are needed for verification and to receive bookings.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Progress: {profile.profile_completion_percentage ?? 0}% complete</p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setOpen(false)}>Later</Button>
              <Link href="/pujari/onboarding"><Button>Complete Profile</Button></Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
