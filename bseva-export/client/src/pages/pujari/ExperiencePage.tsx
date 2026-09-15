import { Link } from "wouter";
import { PujariPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Experience, qualifications, and languages are edited in My Profile (single source of truth). */
export default function PujariExperiencePage() {
  return (
    <PujariPortal>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="">Experience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Years of experience, qualifications, sampradaya, and languages are part of{" "}
            <span className="font-medium text-foreground">My Profile</span>. Update them there — we do not maintain a
            separate copy on this page.
          </p>
          <Button asChild>
            <Link href="/pujari/profile">Open My Profile</Link>
          </Button>
        </CardContent>
      </Card>
    </PujariPortal>
  );
}
