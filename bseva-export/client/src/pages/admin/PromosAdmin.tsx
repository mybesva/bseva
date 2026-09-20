import { useEffect, useRef, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { PromoBannerCard } from "@/components/PromoBannerCarousel";
import { SeasonalPopupCard } from "@/components/SeasonalPopup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, mediaSrc, uploadPromoImage } from "@/lib/api";
import {
  dateInputToIsoEnd,
  dateInputToIsoStart,
} from "@/lib/formatDate";
import { toast } from "sonner";

type Banner = {
  id?: string;
  title: string;
  subtitle?: string;
  image_url?: string;
  target_url?: string;
  audience: string;
  placement: string;
  start_at?: string | null;
  end_at?: string | null;
  active: boolean;
  display_order: number;
  is_third_party: boolean;
  advertiser?: string;
};

type Popup = {
  id?: string;
  title: string;
  description?: string;
  image_url?: string;
  service_id?: string;
  cta_label?: string;
  cta_url?: string;
  languages: string;
  start_at?: string | null;
  end_at?: string | null;
  active: boolean;
  audience?: string;
};

const emptyBanner: Banner = {
  title: "",
  subtitle: "",
  image_url: "",
  target_url: "",
  audience: "customer",
  placement: "post_login",
  active: false,
  display_order: 100,
  is_third_party: false,
  advertiser: "",
};

const emptyPopup: Popup = {
  title: "",
  description: "",
  image_url: "",
  cta_label: "View",
  cta_url: "",
  languages: "en,hi,te",
  active: false,
  audience: "customer",
};

function previewRoles(audience?: string): Array<"customer" | "pujari"> {
  if (audience === "pujari") return ["pujari"];
  if (audience === "all") return ["customer", "pujari"];
  return ["customer"];
}

function roleLabel(role: "customer" | "pujari") {
  return role === "pujari" ? "Pujari home" : "Customer home";
}

function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className || "space-y-1"}>
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PromoImageField({
  value,
  onChange,
  hint,
}: {
  value?: string;
  onChange: (url: string) => void;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadPromoImage(file);
      onChange(data.image_url);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label="Image" required hint={hint || "The picture people will see. JPG, PNG, WebP, or GIF up to 8MB."}>
      {value ? (
        <div className="aspect-[16/7] w-full overflow-hidden rounded-md border bg-muted">
          <img src={mediaSrc(value)} alt="" className="h-full w-full object-contain" />
        </div>
      ) : (
        <div className="h-28 w-full rounded-md border border-dashed bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
          No image selected
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange("")}>
            Remove
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onFile(e)}
      />
    </Field>
  );
}

function AudienceSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="w-full h-10 border rounded-md px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="customer">Customer</option>
      <option value="pujari">Pujari</option>
      <option value="all">Customers & pujaris</option>
    </select>
  );
}

function BannerPreview({ banner }: { banner: Banner }) {
  const roles = previewRoles(banner.audience);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {roles.map((role) => (
        <div key={role} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{roleLabel(role)}</p>
          <div className="rounded-lg border bg-muted/20 p-3">
            <PromoBannerCard banner={banner} preview />
          </div>
        </div>
      ))}
    </div>
  );
}

function PopupPreview({ popup }: { popup: Popup }) {
  const roles = previewRoles(popup.audience);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {roles.map((role) => (
        <div key={role} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{roleLabel(role)}</p>
          <div className="rounded-lg bg-black/40 p-4 flex justify-center">
            <SeasonalPopupCard popup={popup} preview onClose={() => undefined} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DraftPanel({
  saved,
  published,
  children,
}: {
  saved: boolean;
  published: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="md:col-span-2 rounded-lg border border-dashed p-4 space-y-3 bg-muted/10">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">How it will look</p>
        {published ? (
          <Badge>Published</Badge>
        ) : saved ? (
          <Badge variant="secondary">Draft</Badge>
        ) : (
          <Badge variant="outline">Not saved</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {published
          ? "This is live for the selected audience. Unpublish to hide it, or save changes to update it."
          : "Drafts are hidden from customers and pujaris until you publish."}
      </p>
      {children}
    </div>
  );
}

export default function PromosAdmin() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [bannerForm, setBannerForm] = useState<Banner>(emptyBanner);
  const [popupForm, setPopupForm] = useState<Popup>(emptyPopup);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [b, p] = await Promise.all([
      api<Banner[]>("/admin/promos/banners"),
      api<Popup[]>("/admin/promos/popups"),
    ]);
    setBanners(b || []);
    setPopups(p || []);
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  function bannerBody(active: boolean) {
    return {
      ...bannerForm,
      active,
      start_at: dateInputToIsoStart(bannerForm.start_at),
      end_at: dateInputToIsoEnd(bannerForm.end_at),
      image_url: bannerForm.image_url || null,
      subtitle: bannerForm.subtitle || null,
      target_url: bannerForm.target_url || null,
      advertiser: bannerForm.advertiser || null,
    };
  }

  function popupBody(active: boolean) {
    return {
      ...popupForm,
      active,
      start_at: dateInputToIsoStart(popupForm.start_at),
      end_at: dateInputToIsoEnd(popupForm.end_at),
      image_url: popupForm.image_url || null,
      description: popupForm.description || null,
      cta_label: popupForm.cta_label || null,
      cta_url: popupForm.cta_url || null,
      service_id: popupForm.service_id || null,
      audience: popupForm.audience || "customer",
    };
  }

  async function saveBanner(nextActive: boolean) {
    if (!bannerForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!bannerForm.image_url) {
      toast.error("Please upload an image");
      return;
    }
    setSaving(true);
    try {
      let id = bannerForm.id;
      const body = bannerBody(nextActive);
      if (id) {
        await api(`/admin/promos/banners/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        const created = await api<{ id: string }>("/admin/promos/banners", {
          method: "POST",
          body: JSON.stringify(body),
        });
        id = created.id;
      }
      setBannerForm((f) => ({ ...f, id, active: nextActive }));
      toast.success(nextActive ? (bannerForm.active ? "Banner updated" : "Banner published") : "Banner saved as draft");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePopup(nextActive: boolean) {
    if (!popupForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!popupForm.image_url) {
      toast.error("Please upload an image");
      return;
    }
    if (!popupForm.description?.trim()) {
      toast.error("Message is required");
      return;
    }
    setSaving(true);
    try {
      let id = popupForm.id;
      const body = popupBody(nextActive);
      if (id) {
        await api(`/admin/promos/popups/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        const created = await api<{ id: string }>("/admin/promos/popups", {
          method: "POST",
          body: JSON.stringify(body),
        });
        id = created.id;
      }
      setPopupForm((f) => ({ ...f, id, active: nextActive }));
      toast.success(nextActive ? (popupForm.active ? "Popup updated" : "Popup published") : "Popup saved as draft");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function setBannerPublished(b: Banner, active: boolean) {
    try {
      await api(`/admin/promos/banners/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...b,
          active,
          start_at: dateInputToIsoStart(b.start_at),
          end_at: dateInputToIsoEnd(b.end_at),
        }),
      });
      if (bannerForm.id === b.id) setBannerForm({ ...b, active });
      toast.success(active ? "Banner published" : "Banner unpublished");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function setPopupPublished(p: Popup, active: boolean) {
    try {
      await api(`/admin/promos/popups/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...p,
          active,
          start_at: dateInputToIsoStart(p.start_at),
          end_at: dateInputToIsoEnd(p.end_at),
          service_id: p.service_id || null,
        }),
      });
      if (popupForm.id === p.id) setPopupForm({ ...p, active });
      toast.success(active ? "Popup published" : "Popup unpublished");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function deleteBanner(b: Banner) {
    if (!b.id) return;
    if (!confirm(`Delete banner “${b.title}”? This cannot be undone.`)) return;
    try {
      await api(`/admin/promos/banners/${b.id}`, { method: "DELETE" });
      if (bannerForm.id === b.id) setBannerForm(emptyBanner);
      toast.success("Banner deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function deletePopup(p: Popup) {
    if (!p.id) return;
    if (!confirm(`Delete popup “${p.title}”? This cannot be undone.`)) return;
    try {
      await api(`/admin/promos/popups/${p.id}`, { method: "DELETE" });
      if (popupForm.id === p.id) setPopupForm(emptyPopup);
      toast.success("Popup deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const bannerHasPreview = Boolean(bannerForm.title.trim() || bannerForm.image_url);
  const popupHasPreview = Boolean(popupForm.title.trim() || popupForm.image_url);
  const bannerPublished = Boolean(bannerForm.id && bannerForm.active);
  const popupPublished = Boolean(popupForm.id && popupForm.active);

  return (
    <AdminLayout>
      <Tabs defaultValue="banners">
        <TabsList>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="popups">Seasonal popups</TabsTrigger>
        </TabsList>
        <TabsContent value="banners" className="space-y-6 mt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveBanner(bannerPublished);
            }}
            className="grid md:grid-cols-2 gap-3 rounded-lg border p-4"
          >
            {bannerForm.id ? (
              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Editing {bannerPublished ? "published banner" : "draft"}: <span className="font-medium text-foreground">{bannerForm.title || "Untitled"}</span>
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setBannerForm(emptyBanner)}>
                  New banner
                </Button>
              </div>
            ) : null}
            <Field
              label="Title"
              required
              hint="Headline on the banner. Example: Ugadi special puja"
            >
              <Input
                value={bannerForm.title}
                onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                required
                placeholder="Ugadi special puja"
              />
            </Field>
            <Field
              label="Who should see this"
              required
              hint="Customer home, pujari home, or both"
            >
              <AudienceSelect value={bannerForm.audience} onChange={(audience) => setBannerForm({ ...bannerForm, audience })} />
            </Field>
            <Field
              label="Subtitle"
              hint="Optional supporting text shown below the title."
            >
              <Input
                value={bannerForm.subtitle || ""}
                onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                placeholder="Limited-time offer"
              />
            </Field>
            <Field
              label="Display order"
              hint="Lower numbers appear first when multiple banners are active."
            >
              <Input
                type="number"
                min={0}
                step={1}
                value={bannerForm.display_order}
                onChange={(e) => setBannerForm({ ...bannerForm, display_order: Number(e.target.value || 0) })}
              />
            </Field>
            <PromoImageField
              value={bannerForm.image_url || ""}
              onChange={(image_url) => setBannerForm({ ...bannerForm, image_url })}
              hint="The picture on the home-page banner. JPG, PNG, WebP, or GIF up to 8MB."
            />
            <Field
              label="Tap link"
              hint="Optional. Page that opens when someone taps the banner. Example: /services"
            >
              <Input
                value={bannerForm.target_url || ""}
                onChange={(e) => setBannerForm({ ...bannerForm, target_url: e.target.value })}
                placeholder="/services"
              />
            </Field>
            {bannerHasPreview ? (
              <DraftPanel saved={Boolean(bannerForm.id)} published={bannerPublished}>
                <BannerPreview banner={bannerForm} />
              </DraftPanel>
            ) : null}
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" disabled={saving} variant={bannerPublished ? "default" : "outline"} className={bannerPublished ? "bg-primary" : ""}>
                {saving ? "Saving…" : bannerPublished ? "Save changes" : bannerForm.id ? "Save draft" : "Save as draft"}
              </Button>
              {!bannerPublished ? (
                <Button type="button" disabled={saving} className="bg-primary" onClick={() => void saveBanner(true)}>
                  Publish
                </Button>
              ) : (
                <Button type="button" variant="ghost" disabled={saving} onClick={() => void setBannerPublished(bannerForm, false)}>
                  Unpublish
                </Button>
              )}
            </div>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Who sees it</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    No banners yet.
                  </TableCell>
                </TableRow>
              ) : (
                banners.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.title}</TableCell>
                    <TableCell className="capitalize">{b.audience === "all" ? "All" : b.audience}</TableCell>
                    <TableCell>{b.display_order}</TableCell>
                    <TableCell>
                      {b.active ? <Badge>Published</Badge> : <Badge variant="secondary">Draft</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setBannerForm({ ...emptyBanner, ...b })}>
                          {b.active ? "Edit" : "Review"}
                        </Button>
                        {b.active ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => void setBannerPublished(b, false)}>
                            Unpublish
                          </Button>
                        ) : (
                          <Button type="button" size="sm" className="bg-primary" onClick={() => void setBannerPublished(b, true)}>
                            Publish
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="destructive" onClick={() => void deleteBanner(b)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="popups" className="space-y-6 mt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void savePopup(popupPublished);
            }}
            className="grid md:grid-cols-2 gap-3 rounded-lg border p-4"
          >
            {popupForm.id ? (
              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Editing {popupPublished ? "published popup" : "draft"}: <span className="font-medium text-foreground">{popupForm.title || "Untitled"}</span>
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPopupForm(emptyPopup)}>
                  New popup
                </Button>
              </div>
            ) : null}
            <Field
              label="Title"
              required
              hint="Headline on the popup. Example: Ganesh Chaturthi offers"
            >
              <Input
                value={popupForm.title}
                onChange={(e) => setPopupForm({ ...popupForm, title: e.target.value })}
                required
                placeholder="Ganesh Chaturthi offers"
              />
            </Field>
            <Field
              label="Who should see this"
              required
              hint="Customer home, pujari home, or both"
            >
              <AudienceSelect
                value={popupForm.audience || "customer"}
                onChange={(audience) => setPopupForm({ ...popupForm, audience })}
              />
            </Field>
            <Field
              label="Message"
              required
              className="space-y-1 md:col-span-2"
              hint="Short text under the title. Example: Book your puja this week and get 10% off."
            >
              <Input
                value={popupForm.description || ""}
                onChange={(e) => setPopupForm({ ...popupForm, description: e.target.value })}
                required
                placeholder="Book your puja this week and get 10% off."
              />
            </Field>
            <PromoImageField
              value={popupForm.image_url || ""}
              onChange={(image_url) => setPopupForm({ ...popupForm, image_url })}
              hint="The picture at the top of the popup. JPG, PNG, WebP, or GIF up to 8MB."
            />
            <Field
              label="Button"
              hint="Optional. Button label and page it opens. Example: Book now → /services"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={popupForm.cta_label || ""}
                  onChange={(e) => setPopupForm({ ...popupForm, cta_label: e.target.value })}
                  placeholder="Book now"
                />
                <Input
                  value={popupForm.cta_url || ""}
                  onChange={(e) => setPopupForm({ ...popupForm, cta_url: e.target.value })}
                  placeholder="/services"
                />
              </div>
            </Field>
            {popupHasPreview ? (
              <DraftPanel saved={Boolean(popupForm.id)} published={popupPublished}>
                <PopupPreview popup={popupForm} />
              </DraftPanel>
            ) : null}
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" disabled={saving} variant={popupPublished ? "default" : "outline"} className={popupPublished ? "bg-primary" : ""}>
                {saving ? "Saving…" : popupPublished ? "Save changes" : popupForm.id ? "Save draft" : "Save as draft"}
              </Button>
              {!popupPublished ? (
                <Button type="button" disabled={saving} className="bg-primary" onClick={() => void savePopup(true)}>
                  Publish
                </Button>
              ) : (
                <Button type="button" variant="ghost" disabled={saving} onClick={() => void setPopupPublished(popupForm, false)}>
                  Unpublish
                </Button>
              )}
            </div>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Who sees it</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {popups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No popups yet.
                  </TableCell>
                </TableRow>
              ) : (
                popups.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.title}</TableCell>
                    <TableCell className="capitalize">{(p.audience || "customer") === "all" ? "All" : p.audience || "customer"}</TableCell>
                    <TableCell>
                      {p.active ? <Badge>Published</Badge> : <Badge variant="secondary">Draft</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setPopupForm({ ...emptyPopup, ...p })}>
                          {p.active ? "Edit" : "Review"}
                        </Button>
                        {p.active ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => void setPopupPublished(p, false)}>
                            Unpublish
                          </Button>
                        ) : (
                          <Button type="button" size="sm" className="bg-primary" onClick={() => void setPopupPublished(p, true)}>
                            Publish
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="destructive" onClick={() => void deletePopup(p)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
