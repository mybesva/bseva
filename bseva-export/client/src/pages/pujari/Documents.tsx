import { PujariPortal } from "@/components/RolePortals";
import PujariOnboardingWalkthrough from "@/components/PujariOnboardingWalkthrough";
import PriestOnboardingPanel from "@/components/PriestOnboardingPanel";
import { useState } from "react";

export default function PujariDocumentsPage() {
  const [walkthroughErrors, setWalkthroughErrors] = useState<Record<string, string>>({});

  return (
    <PujariPortal>
      <div className="max-w-3xl space-y-8">
        <PriestOnboardingPanel />
        <PujariOnboardingWalkthrough
          page="documents"
          fieldErrors={walkthroughErrors}
          onFieldErrors={setWalkthroughErrors}
        />
      </div>
    </PujariPortal>
  );
}
