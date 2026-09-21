import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PersonNameParts } from "@/lib/personName";

type Props = {
  value: PersonNameParts;
  onChange: (next: PersonNameParts) => void;
  errors?: Partial<Record<keyof PersonNameParts, string>>;
  disabled?: boolean;
  /** When set (e.g. 3 for pujari), last name input enforces minimum length on save validation. */
  lastNameMinLength?: number;
};

export default function PersonNameFields({
  value,
  onChange,
  errors,
  disabled,
  lastNameMinLength,
}: Props) {
  const set = (key: keyof PersonNameParts, v: string) => onChange({ ...value, [key]: v });
  const inputErr = "border-destructive focus-visible:ring-destructive";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label className={errors?.first_name ? "text-destructive" : undefined}>
          First name <span className="text-destructive">*</span>
        </Label>
        <Input
          name="bseva_first_name"
          value={value.first_name}
          onChange={(e) => set("first_name", e.target.value)}
          minLength={3}
          required
          disabled={disabled}
          autoComplete="given-name"
          autoCorrect="off"
          className={errors?.first_name ? inputErr : undefined}
        />
        {errors?.first_name ? <p className="text-xs text-destructive">{errors.first_name}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>Middle name</Label>
        <Input
          name="bseva_middle_name"
          value={value.middle_name}
          onChange={(e) => set("middle_name", e.target.value)}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          data-1p-ignore
          data-lpignore="true"
          aria-label="Middle name (optional)"
        />
      </div>
      <div className="space-y-2">
        <Label className={errors?.last_name ? "text-destructive" : undefined}>
          Last name <span className="text-destructive">*</span>
        </Label>
        <Input
          name="bseva_last_name"
          value={value.last_name}
          onChange={(e) => set("last_name", e.target.value)}
          minLength={lastNameMinLength}
          required
          disabled={disabled}
          autoComplete="family-name"
          autoCorrect="off"
          className={errors?.last_name ? inputErr : undefined}
        />
        {errors?.last_name ? <p className="text-xs text-destructive">{errors.last_name}</p> : null}
      </div>
    </div>
  );
}
