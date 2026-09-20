import { LANGS, collectKeys, dictionaries, localeOverrides } from "./src/index.ts";

const IDENTICAL_OK = new Set([
  "app.name",
  "booking.gst",
  "booking.id",
  "payment.transactionId",
  "invoice.type",
  "pujari.gotra",
  "pujari.pravara",
  "pujari.q1",
  "pujari.q2",
  "pujari.q3",
  "pujari.smartha",
  "pujari.madhwa",
  "pujari.vaishnava",
  "pujari.public.gotra",
  "pujari.angikara.address",
  "footer.rights",
  "home.brandClose",
  "booking.basic",
  "booking.standard",
  "booking.premium",
  "mobile.basic",
  "mobile.standard",
  "mobile.premium",
  "mobile.themeDark",
  "mobile.themeLight",
]);

const enKeys = collectKeys(dictionaries.en);
const publicKeys = enKeys.filter((k) => !k.startsWith("admin."));
for (const lang of ["hi", "te", "mr", "kn", "ta"] as const) {
  const missing = publicKeys.filter((key) => {
    if (IDENTICAL_OK.has(key)) return false;
    const value = localeOverrides[lang][key];
    return !value || value === dictionaries.en[key];
  });
  console.log(lang, missing.length);
  if (lang === "hi") console.log(missing.join("\n"));
}
