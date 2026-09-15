/** Customer signup URL with referral code (opens register with field prefilled). */
export function customerReferralRegisterUrl(code: string, origin?: string): string {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  const qs = new URLSearchParams({ role: "customer", referral_code: code.trim() });
  return `${base}/register?${qs.toString()}`;
}

export function customerReferralShareText(code: string, origin?: string): string {
  const link = customerReferralRegisterUrl(code, origin);
  return [
    "Join BSeva to book trusted pujas at home.",
    "",
    link,
    "",
    `Referral code: ${code.trim()}`,
  ].join("\n");
}

export async function shareCustomerReferral(code: string): Promise<"shared" | "copied"> {
  const url = customerReferralRegisterUrl(code);
  const text = customerReferralShareText(code);
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
