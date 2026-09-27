type PujariProfile = Record<string, unknown>;

function profileCompletionPercent(profile: PujariProfile): number {
  return Number(
    profile.profile_completion_percentage ??
      profile.profile_completeness_percent ??
      profile.completeness_percent ??
      0,
  );
}

/** Mirrors web pujari profile verified checks — approved/verified pujaris skip dashboard alert. */
export function isPujariVerified(profile: PujariProfile): boolean {
  const verificationStatus = String(profile.verification_status || "").toLowerCase();
  const profileStatus = String(profile.profile_status || "").toLowerCase();
  const pct = profileCompletionPercent(profile);

  if (profileStatus === "verified") return true;
  if (verificationStatus === "approved" && (Boolean(profile.profile_submitted_at) || pct >= 100)) {
    return true;
  }
  return false;
}

/** Hide onboarding / "Complete Profile" once submitted or verified (matches web PujariShell nav). */
export function shouldShowPujariOnboardingMenu(profile: PujariProfile): boolean {
  const profileDone = Boolean(profile.profile_submitted_at) || isPujariVerified(profile);
  return !profileDone;
}

export function shouldShowPujariVerificationAlert(profile: PujariProfile): boolean {
  if (isPujariVerified(profile)) return false;

  const verificationStatus = String(profile.verification_status || "").toLowerCase();
  if (verificationStatus === "under_review" && profile.profile_submitted_at) return false;

  const profileStatus = String(profile.profile_status || "").toLowerCase();
  if (profileStatus === "ready_for_submission" && profile.profile_submitted_at && verificationStatus === "pending") {
    return false;
  }

  return true;
}

export function pujariVerificationAlertTarget(profile: PujariProfile): string {
  if (!profile.profile_submitted_at) return "/pujari/onboarding";
  if (String(profile.verification_status || "").toLowerCase() === "correction_required") {
    return "/pujari/documents";
  }
  if (
    String(profile.profile_status || "").toLowerCase() === "profile_incomplete" ||
    profileCompletionPercent(profile) < 100
  ) {
    return "/pujari/profile";
  }
  return "/pujari/documents";
}
