import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type PublicConfig = {
  virtual_puja_enabled: boolean;
  bseva_whatsapp_number: string;
  pujari_full_booking_details_before_hours: number;
  puja_start_otp_before_minutes: number;
  email_from_contact: string;
  email_from_support: string;
};

const DEFAULTS: PublicConfig = {
  virtual_puja_enabled: false,
  bseva_whatsapp_number: "919876543210",
  pujari_full_booking_details_before_hours: 24,
  puja_start_otp_before_minutes: 10,
  email_from_contact: "contact@b-seva.com",
  email_from_support: "support@b-seva.com",
};

/** Digits-only WhatsApp / phone number for wa.me and tel: links. */
export function whatsappDigits(raw?: string | null) {
  const d = String(raw || DEFAULTS.bseva_whatsapp_number).replace(/\D/g, "");
  return d || DEFAULTS.bseva_whatsapp_number;
}

export function whatsappDisplay(raw?: string | null) {
  const d = whatsappDigits(raw);
  if (d.length === 12 && d.startsWith("91")) {
    return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  }
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return d.startsWith("+") ? d : `+${d}`;
}

export function whatsappHref(raw?: string | null) {
  return `https://wa.me/${whatsappDigits(raw)}`;
}

export function telHref(raw?: string | null) {
  return `tel:+${whatsappDigits(raw)}`;
}

let cached: PublicConfig | null = null;
let inflight: Promise<PublicConfig> | null = null;

async function fetchPublicConfig(): Promise<PublicConfig> {
  if (cached) return cached;
  if (!inflight) {
    inflight = api<Partial<PublicConfig>>("/config/public")
      .then((data) => {
        cached = { ...DEFAULTS, ...data };
        return cached;
      })
      .catch(() => {
        cached = { ...DEFAULTS };
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig>(cached || DEFAULTS);
  const [loading, setLoading] = useState(!cached);

  const reload = useCallback(async () => {
    cached = null;
    setLoading(true);
    const next = await fetchPublicConfig();
    setConfig(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicConfig().then((next) => {
      if (!cancelled) {
        setConfig(next);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading, reload };
}
