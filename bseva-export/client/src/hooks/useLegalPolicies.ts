import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  PRIVACY_SECTIONS,
  PRIVACY_VERSION,
  TERMS_SECTIONS,
  TERMS_VERSION,
} from "@/lib/legal";

export type LegalPoint = { title?: string; body: string };

export type LegalPolicy = {
  slug: string;
  title: string;
  version: string;
  points: LegalPoint[];
};

const FALLBACK: LegalPolicy[] = [
  {
    slug: "platform_terms",
    title: "Platform Terms & Conditions",
    version: TERMS_VERSION,
    points: TERMS_SECTIONS.map((s) => ({
      title: s.title.replace(/^\d+\.\s*/, ""),
      body: s.body,
    })),
  },
  {
    slug: "booking_terms",
    title: "Booking Terms & Conditions",
    version: TERMS_VERSION,
    points: [
      {
        title: "Booking confirmation",
        body: "Confirming a booking means you accept the selected service, pujari, date, time, package and mode.",
      },
      {
        title: "Pricing",
        body: "The checkout total may include GST, service charges and peak-day fees.",
      },
    ],
  },
  {
    slug: "cancellation_policy",
    title: "Cancellation Policy",
    version: TERMS_VERSION,
    points: [
      { title: "More than 48 hours", body: "10% cancellation charge, 90% refund to Customer Wallet." },
      { title: "24–48 hours", body: "50% cancellation charge, 50% refund to Customer Wallet." },
      { title: "Less than 24 hours", body: "Cancellation is not permitted." },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    version: PRIVACY_VERSION,
    points: PRIVACY_SECTIONS.map((s) => ({
      title: s.title.replace(/^\d+\.\s*/, ""),
      body: s.body,
    })),
  },
];

export function useLegalPolicies(slugs?: string[]) {
  const slugKey = slugs?.join(",") || "";
  const [policies, setPolicies] = useState<LegalPolicy[]>(
    slugs ? FALLBACK.filter((p) => slugs.includes(p.slug)) : FALLBACK
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api<LegalPolicy[]>("/legal")
      .then((rows) => {
        if (cancelled || !rows?.length) return;
        const filtered = slugs ? rows.filter((p) => slugs.includes(p.slug)) : rows;
        if (filtered.length) setPolicies(filtered);
      })
      .catch(() => {
        /* keep fallback */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slugKey]);

  return { policies, loading };
}

export function policyBySlug(policies: LegalPolicy[], slug: string) {
  return policies.find((p) => p.slug === slug) || FALLBACK.find((p) => p.slug === slug);
}
