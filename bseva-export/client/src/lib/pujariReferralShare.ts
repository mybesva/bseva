/** Signup URL with referral code (customer or pujari can use the same link). */
export function pujariReferralRegisterUrl(code: string, origin?: string): string {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  const qs = new URLSearchParams({ referral_code: code.trim() });
  return `${base}/register?${qs.toString()}`;
}

export function pujariReferralShareText(code: string, origin?: string): string {
  const link = pujariReferralRegisterUrl(code, origin);
  return [
    "Join BSeva — book trusted pujas or register as a pujari.",
    "",
    link,
    "",
    `Referral code: ${code.trim()}`,
  ].join("\n");
}

export async function sharePujariReferral(code: string): Promise<"shared" | "copied"> {
  const url = pujariReferralRegisterUrl(code);
  const text = pujariReferralShareText(code);
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    await navigator.share({
      title: "Join BSeva",
      text,
      url,
    });
    return "shared";
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
