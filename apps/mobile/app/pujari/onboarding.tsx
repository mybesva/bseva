import {
  PRIVACY_VERSION,
  PUJARI_LANGS,
  PUJARI_QUALS,
  SAMPRADAYA_OPTS,
  TERMS_VERSION,
  dakshinaLabel,
  rupees,
} from "@bseva/config";
import { parsePhoneParts, settlementPayload, validatePujariOnboardingStep, validateSettlement } from "@bseva/validation";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View, type ImageSourcePropType } from "react-native";
import { AddressForm, type AddressFormValue } from "@/components/AddressForm";
import { DobPickerField } from "@/components/DobPickerField";
import { MediaPicker } from "@/components/MediaPicker";
import { PhoneWithCountryCode } from "@/components/PhoneWithCountryCode";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SelectField } from "@/components/SelectField";
import { SignaturePad } from "@/components/SignaturePad";
import { AppText, Card, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

type Profile = Record<string, unknown>;
/** Same pages and order as the web onboarding. Steps 1, 2, 4, 5 (services → availability → bank), 6. */
type Page = "profile" | "address" | "documents" | "services" | "availability" | "bank" | "review";

const PAGE_STEP: Record<Page, number> = {
  profile: 1,
  address: 2,
  documents: 4,
  services: 5,
  availability: 5,
  bank: 5,
  review: 6,
};
const BACK: Partial<Record<Page, Page>> = {
  address: "profile",
  documents: "address",
  services: "documents",
  availability: "services",
  bank: "availability",
  review: "bank",
};
const QUAL_LABEL: Record<string, string> = { panchadasha: "pujari.q1", kriya_kovida: "pujari.q2", vidya_visharada: "pujari.q3" };

function pageForStep(step: number): Page {
  if (step === 2) return "address";
  if (step === 4) return "documents";
  if (step === 5) return "services";
  if (step === 6) return "review";
  return "profile";
}

/** Labels like "Upload Profile Photo *" already carry a star; the red one is added separately. */
function plain(label: string) {
  return label.replace(/\s*\*\s*$/, "");
}

function Label({ text, required, error }: { text: string; required?: boolean; error?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: error ? colors.destructive : colors.mutedForeground, fontWeight: "600", fontSize: 13 }}>
        {plain(text)}
        {required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
      </Text>
      {error ? <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

function CheckRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, opacity: disabled ? 0.5 : 1 }}
    >
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={checked ? colors.primary : colors.mutedForeground} />
      <AppText style={{ flex: 1 }}>{label}</AppText>
    </Pressable>
  );
}

function RadioRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={selected ? colors.primary : colors.mutedForeground} />
      <AppText>{label}</AppText>
    </Pressable>
  );
}

/** Web walkthrough header: "Onboarding progress", six numbered steps and a bar. */
function Progress({ step }: { step: number }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="small" style={{ fontWeight: "700" }}>
        {t("web.onboarding.progress")}
      </AppText>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <View
            key={n}
            style={{
              flex: 1,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: n === step ? colors.primary : n < step ? colors.success : colors.secondary,
            }}
          >
            <Text style={{ color: n <= step ? "#fff" : colors.mutedForeground, fontWeight: "700" }}>{n}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.secondary }}>
        <View style={{ width: `${(step / 6) * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
      </View>
    </View>
  );
}

function ErrorList({ title, items }: { title: string | null; items: string[] }) {
  const { colors } = useAppTheme();
  if (!title && !items.length) return null;
  return (
    <View style={{ backgroundColor: colors.destructive + "18", borderRadius: 10, padding: 12, gap: 4 }}>
      {title ? <Text style={{ color: colors.destructive, fontWeight: "700" }}>{title}</Text> : null}
      {items.map((m, i) => (
        <Text key={`${m}-${i}`} style={{ color: colors.destructive }}>
          • {m}
        </Text>
      ))}
    </View>
  );
}

export default function PujariOnboarding() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const scroll = useRef<ScrollView>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [page, setPage] = useState<Page>("profile");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<ImageSourcePropType | null>(null);
  const [signature, setSignature] = useState<ImageSourcePropType | null>(null);
  const [cc, setCc] = useState("+91");
  const [national, setNational] = useState("");
  const [samePermanent, setSamePermanent] = useState(false);
  const [sameMobile, setSameMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [signBusy, setSignBusy] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const docs = useQuery({ queryKey: ["pujari-docs"], queryFn: () => apiClient.pujariDocuments() });
  const offers = useQuery({
    queryKey: ["pujari-offers"],
    queryFn: () =>
      apiClient.pujariServiceOffers() as Promise<{
        services?: {
          id: string;
          name: string;
          applied?: boolean;
          dakshina_paise?: number;
          premium_dakshina_paise?: number | null;
          section_slugs?: string[];
        }[];
        sections?: { slug: string; name: string }[];
      }>,
  });

  async function load() {
    const p = (await apiClient.getPujariProfile()) as Profile;
    // Older profiles only have full_name: split it like the web form does.
    if (p.first_name == null && p.last_name == null && p.full_name) {
      const words = String(p.full_name).trim().split(/\s+/);
      p.first_name = words[0] || "";
      p.last_name = words.length > 1 ? words[words.length - 1] : "";
      p.middle_name = words.slice(1, -1).join(" ");
    }
    setProfile(p);
    const phone = parsePhoneParts(String(p.mobile_number || ""));
    setCc(phone.countryCode);
    setNational(phone.national);
    setSamePermanent(Boolean(p.permanent_address) && p.permanent_address === p.present_address);
    setSameMobile(Boolean(p.whatsapp_number) && p.whatsapp_number === p.mobile_number);
    setPage(p.profile_submitted_at ? "profile" : pageForStep(Number(p.onboarding_step || 1)));
    setConsent(!!p.final_submission_consent);
    if (p.profile_photo_path) setPhoto(await apiClient.pujariMediaUri("photo"));
    if (p.signature_path) setSignature(await apiClient.pujariMediaUri("signature"));
  }

  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);

  function set(key: string, value: unknown) {
    setProfile((p) => ({ ...(p || {}), [key]: value }));
    // Editing a highlighted field clears its message straight away.
    setFieldErrors((errs) => {
      if (!(key in errs)) return errs;
      const { [key]: _cleared, ...rest } = errs;
      if (!Object.keys(rest).length) setError((msg) => (msg === t("web.validation.fixFollowing") ? null : msg));
      return rest;
    });
  }

  function go(next: Page) {
    setError(null);
    setFieldErrors({});
    setPage(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  /** Highlights every missing field (web rules); false when the page can't be saved yet. */
  function check(errs: Record<string, string>): boolean {
    const translated: Record<string, string> = {};
    for (const [key, msg] of Object.entries(errs)) translated[key] = t(msg);
    setFieldErrors(translated);
    if (Object.keys(translated).length) {
      setError(t("web.validation.fixFollowing"));
      scroll.current?.scrollTo({ y: 0, animated: true });
      return false;
    }
    setError(null);
    return true;
  }

  async function save(body: Record<string, unknown>, next: Page) {
    setBusy(true);
    setError(null);
    try {
      const updated = (await apiClient.patchPujariProfile(body)) as Profile;
      setProfile((p) => ({ ...(p || {}), ...updated }));
      go(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("web.onboarding.continueFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!profile) {
    return (
      <Screen>
        <ScreenHeader title={t("mobile.onboarding")} back />
        <LoadingBlock />
      </Screen>
    );
  }

  const step = PAGE_STEP[page];
  const quals = Array.isArray(profile.qualifications) ? (profile.qualifications as string[]) : [];
  const langs = Array.isArray(profile.languages) ? (profile.languages as string[]) : [];
  const mobileE164 = national ? `${cc}${national}` : "";
  const docRows = (docs.data || []) as { id: string; document_type: string; status?: string }[];
  const hasLicence = ["driving_licence", "cab_commercial"].includes(String(profile.licence_type || "").toLowerCase());
  const addr: AddressFormValue = {
    address_line1: String(profile.address_line1 || ""),
    address_line2: String(profile.address_line2 || ""),
    city: String(profile.city || ""),
    district: String(profile.district || ""),
    state: String(profile.state || ""),
    pincode: String(profile.pincode || ""),
    country: String(profile.country || "India"),
    location_label: String(profile.location_label || ""),
    latitude: profile.latitude != null ? Number(profile.latitude) : undefined,
    longitude: profile.longitude != null ? Number(profile.longitude) : undefined,
  };

  /** Back + Save and Continue, as on every web onboarding page. */
  function Nav({ onNext, nextLabel, disabled }: { onNext: () => void; nextLabel?: string; disabled?: boolean }) {
    const back = BACK[page];
    return (
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title={t("common.back")} variant="outline" disabled={!back} onPress={() => back && go(back)} />
        </View>
        <View style={{ flex: 2 }}>
          <PrimaryButton
            title={busy ? t("web.common.saving") : nextLabel || t("web.onboarding.saveNext")}
            loading={busy}
            disabled={busy || disabled}
            onPress={onNext}
          />
        </View>
      </View>
    );
  }

  function DocSlot({ type, label, required }: { type: string; label: string; required?: boolean }) {
    const row = docRows.find((d) => d.document_type === type);
    return (
      <Card>
        <Label text={label} required={required} />
        {row?.status ? <StatusBadge status={String(row.status)} /> : null}
        {required && !row ? (
          <AppText variant="small" color={colors.mutedForeground}>
            Upload required before you can submit for verification.
          </AppText>
        ) : null}
        <MediaPicker
          allowFile
          onPicked={async (file) => {
            try {
              await apiClient.uploadPujariDocument(file, type);
              await docs.refetch();
              set(type, true);
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : t("mobile.saveFailed"));
            }
          }}
        />
      </Card>
    );
  }

  // Same category filter as the web services page ("All" first), shown as a dropdown on mobile.
  const sections = offers.data?.sections?.length ? offers.data.sections : [{ slug: "all", name: "All" }];
  const services = (offers.data?.services || []).filter(
    (s) =>
      (section === "all" || (s.section_slugs || []).includes(section)) &&
      (!search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return (
    <Screen>
      <ScreenHeader title={t("mobile.onboardingStep", { step })} back />
      <ScrollView ref={scroll} scrollEnabled={!drawing} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Progress step={step} />
        <ErrorList title={error} items={Object.values(fieldErrors)} />

        {page === "profile" ? (
          <>
            <AppText variant="h3">{t("pujari.personal")}</AppText>
            <Label text={t("pujari.photo")} required error={fieldErrors.profile_photo_path} />
            {photo ? (
              <Image source={photo} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.secondary }} />
            ) : (
              <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person" size={48} color={colors.primary} />
              </View>
            )}
            <MediaPicker
              onPicked={async (file) => {
                try {
                  await apiClient.uploadPujariAsset("photo", file);
                  setPhoto(await apiClient.pujariMediaUri("photo"));
                  set("profile_photo_path", "uploaded");
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : t("mobile.saveFailed"));
                }
              }}
            />
            <Field required label={t("auth.firstName")} value={String(profile.first_name || "")} onChangeText={(v) => set("first_name", v)} error={fieldErrors.first_name} />
            <Field label={t("auth.middleName")} value={String(profile.middle_name || "")} onChangeText={(v) => set("middle_name", v)} error={fieldErrors.middle_name} />
            <Field required label={t("auth.lastName")} value={String(profile.last_name || "")} onChangeText={(v) => set("last_name", v)} error={fieldErrors.last_name} />
            <Field label={t("pujari.fatherName")} value={String(profile.father_name || "")} onChangeText={(v) => set("father_name", v)} />
            <DobPickerField required label={plain(t("pujari.dob"))} value={String(profile.date_of_birth || "")} onChange={(v) => set("date_of_birth", v)} error={fieldErrors.date_of_birth} />
            <PhoneWithCountryCode
              required
              label={plain(t("pujari.mobile"))}
              countryCode={cc}
              national={national}
              onCountryCodeChange={(v) => {
                setCc(v);
                set("mobile_number", v + national);
              }}
              onNationalChange={(v) => {
                setNational(v);
                set("mobile_number", cc + v);
              }}
              error={fieldErrors.mobile_number}
            />
            <Card>
              <Label text="Gotra & Pravara" required />
              <AppText variant="small" color={colors.mutedForeground}>
                Enter your family Gotra and Pravara (rishi lineage). Both are required for verification.
              </AppText>
              <Field required label={plain(t("pujari.gotra"))} placeholder="e.g. Bharadwaja" value={String(profile.gotra || "")} onChangeText={(v) => set("gotra", v)} error={fieldErrors.gotra} />
              <Field
                required
                label={plain(t("pujari.pravara"))}
                placeholder="e.g. Angirasa, Barhaspatya, Bharadwaja"
                value={String(profile.pravara || "")}
                onChangeText={(v) => set("pravara", v)}
                error={fieldErrors.pravara}
              />
            </Card>
            <Field label={t("pujari.native")} value={String(profile.native_place || "")} onChangeText={(v) => set("native_place", v)} />
            <Field label={t("pujari.permanent")} multiline value={String(profile.permanent_address || "")} onChangeText={(v) => set("permanent_address", v)} />
            <CheckRow label={t("pujari.samePermanent")} checked={samePermanent} onChange={setSamePermanent} />
            <Field
              label={t("pujari.present")}
              multiline
              editable={!samePermanent}
              value={samePermanent ? String(profile.permanent_address || "") : String(profile.present_address || "")}
              onChangeText={(v) => set("present_address", v)}
            />
            <CheckRow label={t("pujari.sameMobile")} checked={sameMobile} onChange={setSameMobile} />
            <Field
              label={t("pujari.whatsapp")}
              keyboardType="phone-pad"
              editable={!sameMobile}
              value={sameMobile ? mobileE164 : String(profile.whatsapp_number || "")}
              onChangeText={(v) => set("whatsapp_number", v)}
            />

            <AppText variant="h3">{t("pujari.qualification")}</AppText>
            {PUJARI_QUALS.map((q) => (
              <CheckRow
                key={q.id}
                label={t(QUAL_LABEL[q.id] || q.label)}
                checked={quals.includes(q.id)}
                onChange={(on) => set("qualifications", on ? [...quals, q.id] : quals.filter((x) => x !== q.id))}
              />
            ))}
            <Field
              required={quals.length > 0}
              label={plain(t("pujari.year"))}
              placeholder="YYYY"
              keyboardType="number-pad"
              value={profile.qualification_year ? String(profile.qualification_year) : ""}
              onChangeText={(v) => set("qualification_year", v.trim() ? Number(v) : null)}
              error={fieldErrors.qualification_year}
            />
            <AppText variant="small" color={colors.mutedForeground}>
              Enter a year from 1950 to {new Date().getFullYear()}
            </AppText>

            <Label text={t("pujari.sampradaya")} required error={fieldErrors.sampradaya} />
            {SAMPRADAYA_OPTS.map((s) => (
              <RadioRow key={s} label={t(`pujari.${s}`)} selected={profile.sampradaya === s} onPress={() => set("sampradaya", s)} />
            ))}

            <AppText variant="h3">Experience & languages</AppText>
            <Field
              required
              label="Years of experience"
              placeholder="e.g. 5"
              keyboardType="number-pad"
              value={profile.experience_years == null ? "" : String(profile.experience_years)}
              onChangeText={(v) => set("experience_years", v.trim() === "" ? null : Number(v))}
              error={fieldErrors.experience_years}
            />
            <Label text="Languages" required error={fieldErrors.languages} />
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {PUJARI_LANGS.map((l) => (
                <View key={l} style={{ width: "33.33%" }}>
                  <CheckRow label={l} checked={langs.includes(l)} onChange={(on) => set("languages", on ? [...langs, l] : langs.filter((x) => x !== l))} />
                </View>
              ))}
            </View>

            <CheckRow
              label={t("pujari.consent")}
              checked={Boolean(profile.website_publication_consent)}
              onChange={(v) => set("website_publication_consent", v)}
            />
            <Label text={t("pujari.signature")} />
            {/* Draw with a finger, same as the web signature pad. */}
            <SignaturePad
              existingUri={signature}
              busy={signBusy}
              onDrawingChange={setDrawing}
              onSave={async (file) => {
                setSignBusy(true);
                try {
                  await apiClient.uploadPujariAsset("signature", file);
                  setSignature(await apiClient.pujariMediaUri("signature"));
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : t("mobile.saveFailed"));
                  throw e;
                } finally {
                  setSignBusy(false);
                }
              }}
            />

            <Nav
              onNext={() => {
                const draft = { ...profile, mobile_number: mobileE164 };
                if (!check(validatePujariOnboardingStep(1, draft, { hasPhoto: Boolean(photo) }))) return;
                const permanent = String(profile.permanent_address || "").trim();
                void save(
                  {
                    first_name: String(profile.first_name || "").trim(),
                    middle_name: String(profile.middle_name || "").trim() || null,
                    last_name: String(profile.last_name || "").trim(),
                    father_name: String(profile.father_name || "").trim() || null,
                    gotra: String(profile.gotra || "").trim(),
                    pravara: String(profile.pravara || "").trim(),
                    date_of_birth: String(profile.date_of_birth || "").slice(0, 10),
                    native_place: String(profile.native_place || "").trim() || null,
                    permanent_address: permanent || null,
                    present_address: samePermanent ? permanent || null : String(profile.present_address || "").trim() || null,
                    mobile_number: mobileE164,
                    whatsapp_number: sameMobile ? mobileE164 : String(profile.whatsapp_number || "").trim() || null,
                    experience_years: profile.experience_years == null ? null : Number(profile.experience_years),
                    qualifications: quals,
                    qualification_year: profile.qualification_year ? Number(profile.qualification_year) : null,
                    sampradaya: profile.sampradaya,
                    languages: langs,
                    website_publication_consent: Boolean(profile.website_publication_consent),
                    onboarding_step: 2,
                  },
                  "address",
                );
              }}
            />
          </>
        ) : null}

        {page === "address" ? (
          <>
            <AppText variant="h3">{t("address.title")}</AppText>
            <AddressForm
              value={addr}
              onChange={(next) => setProfile((p) => ({ ...(p || {}), ...next }))}
              busy={busy}
              saveLabel={t("web.onboarding.saveNext")}
              onBack={() => go("profile")}
              onSave={async (parsed) => {
                await save(
                  {
                    ...parsed,
                    present_address: [parsed.address_line1, parsed.address_line2, parsed.city, parsed.district, parsed.state, parsed.pincode]
                      .filter(Boolean)
                      .join(", "),
                    onboarding_step: 4,
                  },
                  "documents",
                );
              }}
            />
          </>
        ) : null}

        {page === "documents" ? (
          <>
            <AppText variant="h3">Certificates & Aadhaar</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              Aadhaar is required. If you have a driving licence, tick the box below and upload the document.
            </AppText>
            <DocSlot type="identity" label="Aadhaar" required />
            <CheckRow
              label="I have a driving licence"
              checked={hasLicence}
              onChange={(on) => {
                set("licence_type", on ? "driving_licence" : "none");
                void apiClient.patchPujariProfile({ licence_type: on ? "driving_licence" : "none", ...(on ? {} : { licence_number: null }) });
              }}
            />
            {hasLicence ? <DocSlot type="driving_licence" label="Driving Licence" required /> : null}
            <DocSlot type="certificate" label="Professional Certificate" />
            <DocSlot type="supporting" label="Additional Documents" />
            <Nav
              onNext={() => {
                const documentTypes = docRows.map((d) => String(d.document_type));
                if (!check(validatePujariOnboardingStep(4, profile, { documentTypes }))) return;
                void save({ licence_type: profile.licence_type || "none", onboarding_step: 5 }, "services");
              }}
            />
          </>
        ) : null}

        {page === "services" ? (
          <>
            <Label text={t("web.services.title")} required error={fieldErrors.services} />
            <SelectField
              label={t("support.category")}
              placeholder={t("common.all")}
              value={section}
              options={sections.map((sec) => ({ id: sec.slug, label: sec.slug === "all" ? t("common.all") : sec.name }))}
              onChange={setSection}
            />
            <Field label={t("web.services.search")} value={search} onChangeText={setSearch} />
            {services.map((s) => (
              <Card key={s.id}>
                <AppText>{s.name}</AppText>
                {s.dakshina_paise ? (
                  <AppText variant="small">{t("web.services.dakshina", { amount: dakshinaLabel(s.dakshina_paise, s.premium_dakshina_paise, t) })}</AppText>
                ) : null}
                {s.applied ? (
                  <AppText variant="small" color={colors.success}>
                    {t("web.services.applied")}
                  </AppText>
                ) : (
                  <PrimaryButton
                    title={t("web.services.apply")}
                    variant="outline"
                    onPress={async () => {
                      setError(null);
                      try {
                        await apiClient.applyPujariServiceOffer(s.id);
                        await offers.refetch();
                        set("services", true);
                      } catch (e: unknown) {
                        setError(e instanceof Error ? e.message : t("mobile.couldNotApplyService"));
                      }
                    }}
                  />
                )}
              </Card>
            ))}
            <Nav
              onNext={() => {
                const appliedServices = (offers.data?.services || []).filter((s) => s.applied).length;
                if (!check(validatePujariOnboardingStep(5, { ...profile, service_radius_km: 1 }, { appliedServices }))) return;
                go("availability");
              }}
            />
          </>
        ) : null}

        {page === "availability" ? (
          <>
            <AppText variant="h3">{t("pujari.availabilityTitle")}</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {t("web.pujariAvailability.description")}
            </AppText>
            <Card>
              <AppText style={{ fontWeight: "700" }}>{t("web.pujariAvailability.settings")}</AppText>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <AppText style={{ flex: 1 }}>{t("web.pujariAvailability.availableNew")}</AppText>
                <Switch value={!!profile.available} onValueChange={(v) => set("available", v)} />
              </View>
              <Field
                required
                label={t("web.pujariAvailability.radius")}
                keyboardType="decimal-pad"
                value={profile.service_radius_km ? String(profile.service_radius_km) : ""}
                onChangeText={(v) => set("service_radius_km", v.trim() ? Number(v) : null)}
                error={fieldErrors.service_radius_km}
              />
              <AppText variant="small" color={colors.mutedForeground}>
                {t("web.pujariAvailability.radiusDescription")}
              </AppText>
            </Card>
            <Nav
              onNext={() => {
                if (!check(validatePujariOnboardingStep(5, profile, { appliedServices: 1 }))) return;
                void save({ available: !!profile.available, service_radius_km: Number(profile.service_radius_km) }, "bank");
              }}
            />
          </>
        ) : null}

        {page === "bank" ? (
          <>
            <AppText variant="h3">{t("web.bank.title")}</AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {t("web.bank.description")}
            </AppText>
            <Field
              label={t("web.bank.upi")}
              placeholder="yourname@oksbi"
              autoCapitalize="none"
              value={String(profile.upi_id || "")}
              onChangeText={(v) => set("upi_id", v.toLowerCase())}
              error={fieldErrors.upiId}
            />
            <AppText variant="small" style={{ textAlign: "center" }} color={colors.mutedForeground}>
              {t("web.bank.orAccount")}
            </AppText>
            <Field label={t("web.bank.holder")} value={String(profile.bank_holder_name || "")} onChangeText={(v) => set("bank_holder_name", v)} error={fieldErrors.holder} />
            <Field label={t("web.bank.name")} value={String(profile.bank_name || "")} onChangeText={(v) => set("bank_name", v)} error={fieldErrors.bankName} />
            <Field
              label="IFSC"
              autoCapitalize="characters"
              maxLength={11}
              value={String(profile.bank_ifsc || "")}
              onChangeText={(v) => set("bank_ifsc", v.toUpperCase())}
              error={fieldErrors.ifsc}
            />
            <Field
              label={t("web.bank.account")}
              keyboardType="number-pad"
              value={String(profile.bank_account_number || "")}
              onChangeText={(v) => set("bank_account_number", v.replace(/\D/g, ""))}
              error={fieldErrors.accountNumber}
            />
            <Field
              label={t("web.bank.confirmAccount")}
              keyboardType="number-pad"
              value={String(profile.bank_account_confirm || "")}
              onChangeText={(v) => set("bank_account_confirm", v.replace(/\D/g, ""))}
              error={fieldErrors.accountConfirm}
            />
            <Nav
              onNext={() => {
                const draft = {
                  upiId: String(profile.upi_id || ""),
                  holder: String(profile.bank_holder_name || ""),
                  bankName: String(profile.bank_name || ""),
                  ifsc: String(profile.bank_ifsc || ""),
                  accountNumber: String(profile.bank_account_number || ""),
                  accountConfirm: String(profile.bank_account_confirm || ""),
                };
                if (!check(validateSettlement(draft) as Record<string, string>)) return;
                void save({ ...settlementPayload(draft), onboarding_step: 6 }, "review");
              }}
            />
          </>
        ) : null}

        {page === "review" ? (
          <>
            {String(profile.joining_fee_status || "not_required") !== "not_required" ? (
              <Card>
                <AppText style={{ fontWeight: "700" }}>{t("web.onboarding.joiningFee")}</AppText>
                <StatusBadge status={String(profile.joining_fee_status)} />
                {profile.joining_fee_paise ? <AppText>{rupees(Number(profile.joining_fee_paise))}</AppText> : null}
                {String(profile.joining_fee_status) === "pending" ? (
                  <>
                    <AppText variant="small">{t("web.onboarding.feeDescription")}</AppText>
                    <PrimaryButton
                      title={payingFee ? t("mobile.processing") : t("web.onboarding.payFee")}
                      loading={payingFee}
                      disabled={payingFee}
                      onPress={async () => {
                        setPayingFee(true);
                        setError(null);
                        try {
                          await apiClient.payJoiningFee();
                          await load();
                        } catch (e: unknown) {
                          setError(e instanceof Error ? e.message : t("mobile.failed"));
                        } finally {
                          setPayingFee(false);
                        }
                      }}
                    />
                  </>
                ) : null}
              </Card>
            ) : null}
            <AppText variant="h3">{t("web.onboarding.reviewSubmit")}</AppText>
            <Card>
              {[
                [t("auth.name"), [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || String(profile.full_name || "")],
                [t("auth.phone"), String(profile.mobile_number || "")],
                [t("auth.city"), String(profile.city || "")],
                [t("pujari.public.experience"), profile.experience_years != null ? `${profile.experience_years} ${t("pujari.public.years")}` : "—"],
                [t("pujari.public.sampradaya"), profile.sampradaya ? t(`pujari.${profile.sampradaya}`) : "—"],
                [t("pujari.profile.completion"), `${Number(profile.profile_completion_percentage || 0)}%`],
              ].map(([k, v]) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <AppText variant="small" color={colors.mutedForeground}>
                    {k}
                  </AppText>
                  <AppText variant="small" style={{ flex: 1, textAlign: "right" }}>
                    {v || "—"}
                  </AppText>
                </View>
              ))}
            </Card>
            <CheckRow label={`${t("web.onboarding.consent")} *`} checked={consent} onChange={setConsent} />
            <Nav
              nextLabel={busy ? t("mobile.submitting") : t("web.onboarding.finalSubmit")}
              disabled={!consent}
              onNext={async () => {
                if (!check(validatePujariOnboardingStep(6, profile, { consent }))) return;
                setBusy(true);
                setError(null);
                try {
                  await apiClient.submitPujariProfile({
                    final_submission_consent: true,
                    terms_version: TERMS_VERSION,
                    privacy_version: PRIVACY_VERSION,
                  });
                  router.replace("/pujari");
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : t("mobile.submitFailed"));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
