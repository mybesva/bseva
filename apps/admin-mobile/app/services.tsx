import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Svc = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  category?: string;
  required_level?: number;
  standard_price_paise?: number | null;
  premium_price_paise?: number | null;
  basic_price_paise?: number | null;
  samagri_price_paise?: number | null;
  alankaram_price_paise?: number | null;
  food_price_paise?: number | null;
  duration_minutes?: number;
  virtual_available?: boolean;
  available?: boolean;
  bookable?: boolean;
  active?: boolean;
  muhurta_consultation_enabled?: boolean;
  requires_muhurta?: boolean;
  muhurta_fee_paise?: number | null;
  booking_lead_hours?: number;
  pujaris_required?: number;
  [key: string]: unknown;
};

function rupeesField(paise?: number | null) {
  return paise != null ? String(Number(paise) / 100) : "";
}

function paiseFromRupees(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export default function AdminServices() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Svc | null>(null);
  const [std, setStd] = useState("");
  const [prm, setPrm] = useState("");
  const [basic, setBasic] = useState("");
  const [sam, setSam] = useState("");
  const [alan, setAlan] = useState("");
  const [food, setFood] = useState("");
  const [dur, setDur] = useState("");
  const [lead, setLead] = useState("48");
  const [muhFee, setMuhFee] = useState("");
  const [virt, setVirt] = useState(false);
  const [muh, setMuh] = useState(false);
  const [reqMuh, setReqMuh] = useState(false);
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: ["admin-services"],
    queryFn: () => apiClient.api<Svc[] | { items?: Svc[] }>("/admin/services"),
  });
  const rows = (Array.isArray(list.data) ? list.data : list.data?.items || []).filter((s) =>
    !q.trim() ? true : s.name.toLowerCase().includes(q.trim().toLowerCase())
  );

  function open(s: Svc) {
    setEditing(s);
    setStd(rupeesField(s.standard_price_paise));
    setPrm(rupeesField(s.premium_price_paise));
    setBasic(rupeesField(s.basic_price_paise));
    setSam(rupeesField(s.samagri_price_paise));
    setAlan(rupeesField(s.alankaram_price_paise));
    setFood(rupeesField(s.food_price_paise));
    setDur(String(s.duration_minutes ?? 90));
    setLead(String(s.booking_lead_hours ?? 48));
    setMuhFee(rupeesField(s.muhurta_fee_paise));
    setVirt(Boolean(s.virtual_available));
    setMuh(Boolean(s.muhurta_consultation_enabled));
    setReqMuh(Boolean(s.requires_muhurta));
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.api(`/admin/services/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...editing,
          name: editing.name,
          slug: editing.slug,
          required_level: Number(editing.required_level || 1),
          duration_minutes: Number(dur) || 90,
          booking_lead_hours: Number(lead) || 48,
          standard_price_paise: paiseFromRupees(std),
          premium_price_paise: paiseFromRupees(prm),
          basic_price_paise: paiseFromRupees(basic),
          samagri_price_paise: paiseFromRupees(sam) ?? 0,
          alankaram_price_paise: paiseFromRupees(alan) ?? 0,
          food_price_paise: paiseFromRupees(food) ?? 0,
          virtual_available: virt,
          muhurta_consultation_enabled: muh,
          requires_muhurta: reqMuh,
          muhurta_fee_paise: paiseFromRupees(muhFee) ?? 0,
          active: editing.active !== false,
        }),
      });
      setEditing(null);
      await list.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("admin.services")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {editing ? (
          <Card style={{ gap: 10 }}>
            <AppText variant="h3">{editing.name}</AppText>
            <Field label="Standard ₹" value={std} onChangeText={setStd} keyboardType="decimal-pad" />
            <Field label="Premium ₹" value={prm} onChangeText={setPrm} keyboardType="decimal-pad" />
            <Field label="Basic ₹" value={basic} onChangeText={setBasic} keyboardType="decimal-pad" />
            <Field label="Samagri ₹" value={sam} onChangeText={setSam} keyboardType="decimal-pad" />
            <Field label="Alankaram ₹" value={alan} onChangeText={setAlan} keyboardType="decimal-pad" />
            <Field label="Food ₹" value={food} onChangeText={setFood} keyboardType="decimal-pad" />
            <Field label="Duration (min)" value={dur} onChangeText={setDur} keyboardType="number-pad" />
            <Field label="Lead hours" value={lead} onChangeText={setLead} keyboardType="number-pad" />
            <Field label="Muhurtham fee ₹" value={muhFee} onChangeText={setMuhFee} keyboardType="decimal-pad" />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText>Virtual</AppText>
              <Switch value={virt} onValueChange={setVirt} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText>Muhurtham</AppText>
              <Switch value={muh} onValueChange={setMuh} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText>Requires Muhurtham</AppText>
              <Switch value={reqMuh} onValueChange={setReqMuh} />
            </View>
            <PrimaryButton title={busy ? t("admin.save") : t("admin.save")} loading={busy} onPress={() => void save()} />
            <PrimaryButton title="Back to list" variant="outline" onPress={() => setEditing(null)} />
          </Card>
        ) : (
          <>
            <Field label={t("admin.search")} value={q} onChangeText={setQ} />
            {list.isLoading ? <LoadingBlock /> : null}
            {rows.map((s) => (
              <Card key={s.id}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <AppText variant="h3" style={{ flex: 1 }}>{s.name}</AppText>
                  <Switch
                    value={s.available !== false && s.bookable !== false && s.active !== false}
                    onValueChange={async (v) => {
                      setError(null);
                      try {
                        await apiClient.api(`/admin/services/${s.id}/availability`, { method: "PATCH", body: JSON.stringify({ available: v }) });
                        await list.refetch();
                      } catch (e: unknown) {
                        setError(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  />
                </View>
                <AppText variant="small">{s.slug} · {rupees(s.standard_price_paise)}</AppText>
                <PrimaryButton title="Edit pricing" variant="outline" onPress={() => open(s)} />
              </Card>
            ))}
            <PrimaryButton title="Reload" variant="outline" onPress={() => void list.refetch()} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
