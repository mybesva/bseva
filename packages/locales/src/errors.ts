/** Stable API error codes mapped to translation keys. English messages remain for fallback. */
export const ERROR_CODE_KEYS: Record<string, string> = {
  INVALID_OTP: "errors.invalidOtp",
  OTP_EXPIRED: "errors.otpExpired",
  LOGIN_FAILED: "errors.loginFailed",
  ACCOUNT_BLOCKED: "errors.accountBlocked",
  BOOKING_NOT_AVAILABLE: "errors.bookingNotAvailable",
  BOOKING_CONFLICT: "errors.bookingConflict",
  LOCATION_NOT_SUPPORTED: "errors.locationNotSupported",
  PAYMENT_FAILED: "errors.paymentFailed",
  WALLET_INSUFFICIENT: "errors.walletInsufficient",
  ADDRESS_REQUIRED: "errors.addressRequired",
  SERVICE_NOT_FOUND: "errors.serviceNotFound",
  UNAUTHORIZED: "errors.unauthorized",
  FORBIDDEN: "errors.forbidden",
  NETWORK: "errors.network",
  VPN_BLOCKED: "errors.vpnBlocked",
  VALIDATION: "errors.validation",
};

export function errorKeyForCode(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return ERROR_CODE_KEYS[code.toUpperCase()];
}

export function parseApiErrorDetail(detail: unknown, fallback = "Request failed"): { message: string; code?: string } {
  if (typeof detail === "string" && detail.trim()) return { message: detail };
  if (Array.isArray(detail)) {
    const msgs = detail.map((d: { msg?: string; message?: string }) => d?.msg || d?.message).filter(Boolean) as string[];
    return { message: msgs.join(", ") || fallback, code: "VALIDATION" };
  }
  if (detail && typeof detail === "object") {
    const d = detail as { code?: string; message?: string; msg?: string };
    return {
      message: (d.message || d.msg || fallback).trim() || fallback,
      code: d.code,
    };
  }
  return { message: fallback };
}
