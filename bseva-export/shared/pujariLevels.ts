export const PUJARI_LEVELS = [
  {
    level: 1 as const,
    title: "Vehicle / Basic Rituals",
    summary: "Simple rituals such as vehicle puja and other basic rites configured by Admin.",
    examples: ["Vehicle Puja", "Basic vehicle-related pujas", "Simple/basic rituals"],
  },
  {
    level: 2 as const,
    title: "Basic Pujas",
    summary: "Regular household and devotional pujas.",
    examples: ["Ganapathi Puja", "Lakshmi Puja", "Satyanarayana Puja", "Basic house pujas"],
  },
  {
    level: 3 as const,
    title: "Main / Major Pujas",
    summary: "Important or complex ceremonies.",
    examples: ["Marriage ceremonies", "Gruha Pravesham", "Major house/family ceremonies"],
  },
  {
    level: 4 as const,
    title: "All Services",
    summary: "All Level 1–3 services plus any additional advanced services configured by Admin.",
    examples: ["All Level 1, 2 and 3 services", "Additional advanced services"],
  },
];

export type PujariLevel = 1 | 2 | 3 | 4;

export function levelLabel(level?: number | null) {
  if (!level) return "Not set";
  const found = PUJARI_LEVELS.find((l) => l.level === level);
  return found ? `Level ${found.level} — ${found.title}` : `Level ${level}`;
}

export function priestCoversService(approvedLevel: number | null | undefined, requiredLevel: number) {
  const approved = Number(approvedLevel || 0);
  if (!approved) return false;
  if (approved >= 4) return true;
  return approved >= requiredLevel;
}

export function inferRequiredLevelFromName(name: string): PujariLevel {
  const n = name.toLowerCase();
  if (/(vehicle|vahana|car puja|bike)/.test(n)) return 1;
  if (/(marriage|wedding|gruha pravesh|griha pravesh|house warming)/.test(n)) return 3;
  if (/(rudra|homam|havan|navagraha|advanced)/.test(n)) return 4;
  return 2;
}

export function cancellationPolicy(hoursUntil: number) {
  if (hoursUntil > 48) {
    return {
      allowed: true,
      window: ">48h" as const,
      feePercent: 10,
      refundPercent: 90,
      title: "More than 48 hours before the booking",
      message: "You are cancelling more than 48 hours before the booking.",
    };
  }
  if (hoursUntil >= 24) {
    return {
      allowed: true,
      window: "24-48h" as const,
      feePercent: 50,
      refundPercent: 50,
      title: "Between 24 and 48 hours before the booking",
      message: "You are cancelling between 24 and 48 hours before the booking.",
    };
  }
  return {
    allowed: false,
    window: "<24h" as const,
    feePercent: 0,
    refundPercent: 0,
    title: "Less than 24 hours",
    message: "Cancellation is not available because the booking starts in less than 24 hours.",
  };
}

export const TERMS_TEXT = `BSeva Terms & Conditions and Cancellation Policy (Demo)

1. Booking confirmation
By confirming a booking you agree to the selected service, pujari (if any), date, time, package (Standard/Premium), and mode (In-person or Virtual).

2. Pricing
The final booking price may include applicable GST, service charges, and peak-day/surge fees where applicable. The amount shown at checkout is the demo total charged to your wallet.

3. Cancellation policy
Cancellation is calculated from the scheduled booking date and time versus the current date and time:
• More than 48 hours before booking: 10% cancellation charge, 90% refund to your Customer Wallet.
• Between 24 and 48 hours: 50% cancellation charge, 50% refund to your Customer Wallet.
• Less than 24 hours: cancellation is not permitted.

4. Pujari levels
Pujaris may only be assigned to services permitted by their Admin-approved service level. Requested levels remain pending until Admin verification.

5. Documents
Pujari certificates and identity documents are demo uploads only. No real KYC or verification service is used.

6. Demo notice
This is a demonstration application. Payments, OTP, maps, wallets, and document reviews are mocked.`;
