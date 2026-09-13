import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PHONE_COUNTRY_CODES,
  nationalMaxLen,
  type PhoneCountryCode,
} from "@/lib/phone";

type Props = {
  id?: string;
  label: string;
  required?: boolean;
  countryCode: string;
  national: string;
  onCountryCodeChange: (code: string) => void;
  onNationalChange: (digits: string) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
};

export default function PhoneWithCountryCode({
  id = "phone",
  label,
  required,
  countryCode,
  national,
  onCountryCodeChange,
  onNationalChange,
  error,
  disabled,
  className,
}: Props) {
  const max = nationalMaxLen(countryCode);
  return (
    <div className={className || "space-y-2"}>
      <Label htmlFor={id} className={error ? "text-red-600" : undefined}>
        {label}
        {required ? " *" : ""}
      </Label>
      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2 w-full">
        <select
          aria-label="Country code"
          value={countryCode}
          disabled={disabled}
          onChange={(e) => onCountryCodeChange(e.target.value as PhoneCountryCode)}
          className={`h-10 w-full max-w-[4.75rem] rounded-md border bg-background px-1.5 text-sm font-bold text-center ${
            error ? "border-red-500" : "border-input"
          }`}
        >
          {PHONE_COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          disabled={disabled}
          value={national}
          onChange={(e) => onNationalChange(e.target.value.replace(/\D/g, "").slice(0, max))}
          placeholder={countryCode === "+91" ? "10-digit mobile" : "Phone number"}
          className={`min-w-0 ${error ? "border-red-500 focus-visible:ring-red-500" : ""}`}
          aria-invalid={!!error}
          autoComplete="tel-national"
        />
      </div>
      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
    </div>
  );
}
