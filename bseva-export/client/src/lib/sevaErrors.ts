export function sevaErrorMessage(t: (key: string) => string, code?: string, fallback?: string): string {
  switch (code) {
    case "DUPLICATE_REGISTRATION":
      return t("seva.error.duplicate");
    case "CUTOFF_PASSED":
    case "REGISTRATION_CLOSED":
      return t("seva.error.cutoff");
    case "EVENT_SOLD_OUT":
      return t("seva.error.soldOut");
    case "INSUFFICIENT_WALLET":
      return t("seva.error.insufficientWallet");
    default:
      return fallback || t("errors.generic");
  }
}
