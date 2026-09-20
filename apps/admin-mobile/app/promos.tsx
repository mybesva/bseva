import {
  EMPTY_PROMO_BANNER,
  EMPTY_PROMO_POPUP,
  PROMO_AUDIENCES,
  PROMO_PLACEMENTS,
  promoBannerBody,
  promoPopupBody,
  validatePromoBanner,
  validatePromoPopup,
  type PromoBannerForm,
  type PromoPopupForm,
} from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, ScrollView, Switch, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

function asList<T>(data: T[] | { items?: T[] } | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items || [];
}

export default function AdminPromos() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"banners" | "popups">("banners");
  const [bannerForm, setBannerForm] = useState<PromoBannerForm>(EMPTY_PROMO_BANNER);
  const [popupForm, setPopupForm] = useState<PromoPopupForm>(EMPTY_PROMO_POPUP);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const banners = useQuery({
    queryKey: ["admin-banners"],
    queryFn: () => apiClient.api<PromoBannerForm[] | { items?: PromoBannerForm[] }>("/admin/promos/banners"),
  });
  const popups = useQuery({
    queryKey: ["admin-popups"],
    queryFn: () => apiClient.api<PromoPopupForm[] | { items?: PromoPopupForm[] }>("/admin/promos/popups"),
  });
  const bannerRows = asList(banners.data);
  const popupRows = asList(popups.data);

  async function pickImage(kind: "banner" | "popup") {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const name = asset.fileName || "promo.jpg";
    const type = asset.mimeType || "image/jpeg";
    const uploaded = await apiClient.uploadPromoImage({ uri: asset.uri, name, type });
    if (kind === "banner") setBannerForm((f) => ({ ...f, image_url: uploaded.image_url }));
    else setPopupForm((f) => ({ ...f, image_url: uploaded.image_url }));
  }

  async function saveBanner(nextActive: boolean) {
    const msg = validatePromoBanner(bannerForm);
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = promoBannerBody(bannerForm, nextActive);
      if (bannerForm.id) {
        await apiClient.api(`/admin/promos/banners/${bannerForm.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        const created = await apiClient.api<{ id: string }>("/admin/promos/banners", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setBannerForm((f) => ({ ...f, id: created.id, active: nextActive }));
      }
      await banners.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function savePopup(nextActive: boolean) {
    const msg = validatePromoPopup(popupForm);
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = promoPopupBody(popupForm, nextActive);
      if (popupForm.id) {
        await apiClient.api(`/admin/promos/popups/${popupForm.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        const created = await apiClient.api<{ id: string }>("/admin/promos/popups", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setPopupForm((f) => ({ ...f, id: created.id, active: nextActive }));
      }
      await popups.refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title={t("admin.promos")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <ChoiceChips
          options={[
            { id: "banners", label: "Banners" },
            { id: "popups", label: "Popups" },
          ]}
          value={tab}
          onChange={(v) => setTab(String(v) as "banners" | "popups")}
        />
        {tab === "banners" ? (
          <>
            {banners.isLoading ? <LoadingBlock /> : null}
            {bannerRows.map((b) => (
              <Card key={b.id}>
                <AppText variant="h3">{b.title}</AppText>
                <AppText variant="small">{b.subtitle} · {b.active ? "active" : "draft"}</AppText>
                <PrimaryButton title="Edit" variant="outline" onPress={() => setBannerForm({ ...EMPTY_PROMO_BANNER, ...b })} />
                <PrimaryButton
                  title={b.active ? "Unpublish" : "Publish"}
                  variant="outline"
                  onPress={() =>
                    void apiClient
                      .api(`/admin/promos/banners/${b.id}`, {
                        method: "PATCH",
                        body: JSON.stringify(promoBannerBody({ ...EMPTY_PROMO_BANNER, ...b }, !b.active)),
                      })
                      .then(() => banners.refetch())
                  }
                />
                <PrimaryButton
                  title="Delete"
                  variant="ghost"
                  onPress={() =>
                    Alert.alert("Delete banner?", b.title || b.id || "", [
                      { text: "Cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          void apiClient.api(`/admin/promos/banners/${b.id}`, { method: "DELETE" }).then(() => banners.refetch()),
                      },
                    ])
                  }
                />
              </Card>
            ))}
            <Card style={{ gap: 8 }}>
              <AppText variant="h3">{bannerForm.id ? "Edit banner" : "New banner"}</AppText>
              <Field label="Title *" value={bannerForm.title} onChangeText={(title) => setBannerForm({ ...bannerForm, title })} />
              <Field label="Subtitle" value={bannerForm.subtitle || ""} onChangeText={(subtitle) => setBannerForm({ ...bannerForm, subtitle })} />
              <Field label="Target URL" value={bannerForm.target_url || ""} onChangeText={(target_url) => setBannerForm({ ...bannerForm, target_url })} />
              <Field label="Advertiser" value={bannerForm.advertiser || ""} onChangeText={(advertiser) => setBannerForm({ ...bannerForm, advertiser })} />
              <Field
                label="Display order"
                value={String(bannerForm.display_order)}
                onChangeText={(v) => setBannerForm({ ...bannerForm, display_order: Number(v) || 0 })}
                keyboardType="number-pad"
              />
              <Field label="Start (YYYY-MM-DD)" value={(bannerForm.start_at || "").slice(0, 10)} onChangeText={(start_at) => setBannerForm({ ...bannerForm, start_at })} />
              <Field label="End (YYYY-MM-DD)" value={(bannerForm.end_at || "").slice(0, 10)} onChangeText={(end_at) => setBannerForm({ ...bannerForm, end_at })} />
              <AppText variant="small">Audience</AppText>
              <ChoiceChips
                options={PROMO_AUDIENCES.map((a) => ({ id: a.id, label: a.label }))}
                value={bannerForm.audience}
                onChange={(v) => setBannerForm({ ...bannerForm, audience: String(v) })}
              />
              <AppText variant="small">Placement</AppText>
              <ChoiceChips
                options={PROMO_PLACEMENTS.map((a) => ({ id: a.id, label: a.label }))}
                value={bannerForm.placement}
                onChange={(v) => setBannerForm({ ...bannerForm, placement: String(v) })}
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText>Third party</AppText>
                <Switch value={bannerForm.is_third_party} onValueChange={(is_third_party) => setBannerForm({ ...bannerForm, is_third_party })} />
              </View>
              <AppText variant="small">{bannerForm.image_url ? "Image uploaded" : "No image"}</AppText>
              <PrimaryButton title="Upload image" variant="outline" onPress={() => void pickImage("banner")} />
              <PrimaryButton title={saving ? "Saving" : "Save draft"} loading={saving} onPress={() => void saveBanner(false)} />
              <PrimaryButton title="Publish" onPress={() => void saveBanner(true)} />
              <PrimaryButton title="Reset form" variant="ghost" onPress={() => setBannerForm(EMPTY_PROMO_BANNER)} />
            </Card>
          </>
        ) : (
          <>
            {popupRows.map((p) => (
              <Card key={p.id}>
                <AppText variant="h3">{p.title}</AppText>
                <AppText variant="small">{p.active ? "active" : "draft"}</AppText>
                <PrimaryButton title="Edit" variant="outline" onPress={() => setPopupForm({ ...EMPTY_PROMO_POPUP, ...p })} />
                <PrimaryButton
                  title={p.active ? "Unpublish" : "Publish"}
                  variant="outline"
                  onPress={() =>
                    void apiClient
                      .api(`/admin/promos/popups/${p.id}`, {
                        method: "PATCH",
                        body: JSON.stringify(promoPopupBody({ ...EMPTY_PROMO_POPUP, ...p }, !p.active)),
                      })
                      .then(() => popups.refetch())
                  }
                />
                <PrimaryButton
                  title="Delete"
                  variant="ghost"
                  onPress={() =>
                    Alert.alert("Delete popup?", p.title || p.id || "", [
                      { text: "Cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          void apiClient.api(`/admin/promos/popups/${p.id}`, { method: "DELETE" }).then(() => popups.refetch()),
                      },
                    ])
                  }
                />
              </Card>
            ))}
            <Card style={{ gap: 8 }}>
              <AppText variant="h3">{popupForm.id ? "Edit popup" : "New popup"}</AppText>
              <Field label="Title *" value={popupForm.title} onChangeText={(title) => setPopupForm({ ...popupForm, title })} />
              <Field label="Message *" value={popupForm.description || ""} onChangeText={(description) => setPopupForm({ ...popupForm, description })} />
              <Field label="CTA label" value={popupForm.cta_label || ""} onChangeText={(cta_label) => setPopupForm({ ...popupForm, cta_label })} />
              <Field label="CTA URL" value={popupForm.cta_url || ""} onChangeText={(cta_url) => setPopupForm({ ...popupForm, cta_url })} />
              <Field label="Service ID" value={popupForm.service_id || ""} onChangeText={(service_id) => setPopupForm({ ...popupForm, service_id })} />
              <Field label="Languages" value={popupForm.languages} onChangeText={(languages) => setPopupForm({ ...popupForm, languages })} />
              <Field label="Start (YYYY-MM-DD)" value={(popupForm.start_at || "").slice(0, 10)} onChangeText={(start_at) => setPopupForm({ ...popupForm, start_at })} />
              <Field label="End (YYYY-MM-DD)" value={(popupForm.end_at || "").slice(0, 10)} onChangeText={(end_at) => setPopupForm({ ...popupForm, end_at })} />
              <ChoiceChips
                options={PROMO_AUDIENCES.map((a) => ({ id: a.id, label: a.label }))}
                value={popupForm.audience || "customer"}
                onChange={(v) => setPopupForm({ ...popupForm, audience: String(v) })}
              />
              <AppText variant="small">{popupForm.image_url ? "Image uploaded" : "No image"}</AppText>
              <PrimaryButton title="Upload image" variant="outline" onPress={() => void pickImage("popup")} />
              <PrimaryButton title={saving ? "Saving" : "Save draft"} loading={saving} onPress={() => void savePopup(false)} />
              <PrimaryButton title="Publish" onPress={() => void savePopup(true)} />
              <PrimaryButton title="Reset form" variant="ghost" onPress={() => setPopupForm(EMPTY_PROMO_POPUP)} />
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
