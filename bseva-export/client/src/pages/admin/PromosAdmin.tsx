import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import {
  dateInputToIsoEnd,
  dateInputToIsoStart,
  formatDisplayDate,
  toDateInputValue,
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
  active: true,
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
  active: true,
  audience: "customer",
};

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

  async function saveBanner(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/admin/promos/banners", {
        method: "POST",
        body: JSON.stringify({
          ...bannerForm,
          start_at: dateInputToIsoStart(bannerForm.start_at),
          end_at: dateInputToIsoEnd(bannerForm.end_at),
        }),
      });
      toast.success("Banner saved");
      setBannerForm(emptyBanner);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePopup(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/admin/promos/popups", {
        method: "POST",
        body: JSON.stringify({
          ...popupForm,
          start_at: dateInputToIsoStart(popupForm.start_at),
          end_at: dateInputToIsoEnd(popupForm.end_at),
        }),
      });
      toast.success("Popup saved");
      setPopupForm(emptyPopup);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBanner(b: Banner) {
    if (!b.id) return;
    if (!confirm(`Delete banner “${b.title}”? This cannot be undone.`)) return;
    try {
      await api(`/admin/promos/banners/${b.id}`, { method: "DELETE" });
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
      toast.success("Popup deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout>
      <h1 className="text-h1 mb-4">Promotions & ads</h1>
      <Tabs defaultValue="banners">
        <TabsList>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="popups">Seasonal popups</TabsTrigger>
        </TabsList>
        <TabsContent value="banners" className="space-y-6 mt-4">
          <form onSubmit={saveBanner} className="grid md:grid-cols-2 gap-3 rounded-lg border p-4">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Subtitle</Label>
              <Input value={bannerForm.subtitle || ""} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Image URL</Label>
              <Input value={bannerForm.image_url || ""} onChange={(e) => setBannerForm({ ...bannerForm, image_url: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Target URL / CTA</Label>
              <Input value={bannerForm.target_url || ""} onChange={(e) => setBannerForm({ ...bannerForm, target_url: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Audience</Label>
              <select
                className="w-full h-10 border rounded-md px-2 text-sm"
                value={bannerForm.audience}
                onChange={(e) => setBannerForm({ ...bannerForm, audience: e.target.value })}
              >
                <option value="customer">Customer</option>
                <option value="pujari">Pujari</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Display order</Label>
              <Input
                type="number"
                value={bannerForm.display_order}
                onChange={(e) => setBannerForm({ ...bannerForm, display_order: Number(e.target.value) || 100 })}
              />
            </div>
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input
                type="date"
                value={toDateInputValue(bannerForm.start_at)}
                onChange={(e) => setBannerForm({ ...bannerForm, start_at: e.target.value || null })}
              />
              {bannerForm.start_at ? (
                <p className="text-xs text-muted-foreground">{formatDisplayDate(bannerForm.start_at)}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>End date</Label>
              <Input
                type="date"
                value={toDateInputValue(bannerForm.end_at)}
                onChange={(e) => setBannerForm({ ...bannerForm, end_at: e.target.value || null })}
              />
              {bannerForm.end_at ? (
                <p className="text-xs text-muted-foreground">{formatDisplayDate(bannerForm.end_at)}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={bannerForm.active} onCheckedChange={(v) => setBannerForm({ ...bannerForm, active: !!v })} />
              <Label>Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={bannerForm.is_third_party}
                onCheckedChange={(v) => setBannerForm({ ...bannerForm, is_third_party: !!v })}
              />
              <Label>Third-party / Sponsored</Label>
            </div>
            {bannerForm.is_third_party && (
              <div className="space-y-1 md:col-span-2">
                <Label>Advertiser</Label>
                <Input value={bannerForm.advertiser || ""} onChange={(e) => setBannerForm({ ...bannerForm, advertiser: e.target.value })} />
              </div>
            )}
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving} className="bg-primary">
                {saving ? "Saving…" : "Create banner"}
              </Button>
            </div>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-sm text-muted-foreground">
                    No banners yet.
                  </TableCell>
                </TableRow>
              ) : (
                banners.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.title}</TableCell>
                    <TableCell>{b.audience}</TableCell>
                    <TableCell>{b.is_third_party ? "Sponsored" : "BSeva"}</TableCell>
                    <TableCell>{b.active ? "Yes" : "No"}</TableCell>
                    <TableCell>{formatDisplayDate(b.start_at)}</TableCell>
                    <TableCell>{formatDisplayDate(b.end_at)}</TableCell>
                    <TableCell>{b.display_order}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="destructive" onClick={() => void deleteBanner(b)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="popups" className="space-y-6 mt-4">
          <form onSubmit={savePopup} className="grid md:grid-cols-2 gap-3 rounded-lg border p-4">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={popupForm.title} onChange={(e) => setPopupForm({ ...popupForm, title: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Languages</Label>
              <Input value={popupForm.languages} onChange={(e) => setPopupForm({ ...popupForm, languages: e.target.value })} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Description</Label>
              <Input value={popupForm.description || ""} onChange={(e) => setPopupForm({ ...popupForm, description: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Image URL</Label>
              <Input value={popupForm.image_url || ""} onChange={(e) => setPopupForm({ ...popupForm, image_url: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>CTA label</Label>
              <Input value={popupForm.cta_label || ""} onChange={(e) => setPopupForm({ ...popupForm, cta_label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>CTA URL</Label>
              <Input value={popupForm.cta_url || ""} onChange={(e) => setPopupForm({ ...popupForm, cta_url: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Linked service ID (optional)</Label>
              <Input value={popupForm.service_id || ""} onChange={(e) => setPopupForm({ ...popupForm, service_id: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input
                type="date"
                value={toDateInputValue(popupForm.start_at)}
                onChange={(e) => setPopupForm({ ...popupForm, start_at: e.target.value || null })}
              />
              {popupForm.start_at ? (
                <p className="text-xs text-muted-foreground">{formatDisplayDate(popupForm.start_at)}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>End date</Label>
              <Input
                type="date"
                value={toDateInputValue(popupForm.end_at)}
                onChange={(e) => setPopupForm({ ...popupForm, end_at: e.target.value || null })}
              />
              {popupForm.end_at ? (
                <p className="text-xs text-muted-foreground">{formatDisplayDate(popupForm.end_at)}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={popupForm.active} onCheckedChange={(v) => setPopupForm({ ...popupForm, active: !!v })} />
              <Label>Active</Label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving} className="bg-primary">
                {saving ? "Saving…" : "Create popup"}
              </Button>
            </div>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Languages</TableHead>
                <TableHead>Active</TableHead>
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
                    <TableCell>{p.languages}</TableCell>
                    <TableCell>{p.active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="destructive" onClick={() => void deletePopup(p)}>
                        Delete
                      </Button>
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
