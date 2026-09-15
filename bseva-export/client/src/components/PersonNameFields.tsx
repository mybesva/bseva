import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PersonNameParts } from "@/lib/personName";

type Props = {
  value: PersonNameParts;
  onChange: (next: PersonNameParts) => void;
  errors?: Partial<Record<keyof PersonNameParts, string>>;
  disabled?: boolean;
};

export default function PersonNameFields({ value, onChange, errors, disabled }: Props) {
  const set = (key: keyof PersonNameParts, v: string) => onChange({ ...value, [key]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label className={errors?.first_name ? "text-destructive" : undefined}>
          First name <span className="text-destructive">*</span>
        </Label>
        <Input
          value={value.first_name}
          onChange={(e) => set("first_name", e.target.value)}
          minLength={3}
          required
          disabled={disabled}
          autoComplete="given-name"
        />
        {errors?.first_name ? <p className="text-xs text-destructive">{errors.first_name}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>Middle name</Label>
        <Input
          value={value.middle_name}
          onChange={(e) => set("middle_name", e.target.value)}
          disabled={disabled}
          autoComplete="additional-name"
        />
      </div>
      <div className="space-y-2">
        <Label className={errors?.last_name ? "text-destructive" : undefined}>
          Last name <span className="text-destructive">*</span>
        </Label>
        <Input
          value={value.last_name}
          onChange={(e) => set("last_name", e.target.value)}
          required
          disabled={disabled}
          autoComplete="family-name"
        />
        {errors?.last_name ? <p className="text-xs text-destructive">{errors.last_name}</p> : null}
      </div>
    </div>
  );
}
