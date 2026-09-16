export { dictionaries, LANG_LABELS, type Lang } from "./translations";
export { extras } from "./extras";
import { dictionaries, type Lang } from "./translations";
import { extras } from "./extras";

export function translate(lang: Lang, key: string): string {
  return extras[lang]?.[key] || dictionaries[lang]?.[key] || extras.en[key] || dictionaries.en[key] || key;
}
