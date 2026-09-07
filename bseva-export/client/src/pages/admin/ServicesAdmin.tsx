import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { adminPath } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api, rupees, apiBase, getToken } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { toast } from "sonner";
import { FolderTree, Pencil, Plus } from "lucide-react";
import { serviceImageUrl } from "@/lib/serviceImage";

const PROVIDERS = [
  { value: "included", label: "Included in price" },
  { value: "customer", label: "Customer provides" },
  { value: "pujari", label: "Pujari provides" },
  { value: "reimbursable", label: "Pujari provides, reimbursed" },
];

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  sort_order: number;
  active: boolean;
};

const emptyCategoryForm = {
  slug: "",
  name: "",
  description: "",
  sort_order: 0,
  active: true,
};

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  short_description: "",
  full_description: "",
  benefits: "",
  local_name: "",
  category: "puja",
  category_slugs: [] as string[],
  search_aliases_text: "",
  required_level: 2,
  standard_price_paise: null as number | null,
  premium_price_paise: null as number | null,
  main_puja_price_paise: null as number | null,
  samagri_price_paise: 0,
  alankaram_price_paise: 0,
  food_price_paise: 0,
  samagri_provider: "included",
  alankaram_provider: "included",
  food_provider: "included",
  muhurta_consultation_enabled: false,
  muhurta_fee_paise: 0,
  requires_muhurta: false,
  duration_minutes: 90,
  pujaris_required: 1,
  virtual_available: false,
  active: false,
  samagri_available: true,
  alankaram_available: false,
  food_available: false,
  image_path: "",
  image_url: "",
  is_popular: false,
  is_featured_home: false,
  is_seasonal: false,
  display_order: 1000,
  homepage_rank: null as number | null,
  pricing_status: "awaiting_pricing" as "priced" | "awaiting_pricing",
  samagri_review_status: "UNVERIFIED" as "UNVERIFIED" | "VERIFIED" | "NEEDS_REVIEW",
};

function parseAliases(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatPriceInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return String(paise / 100);
}

export default function ServicesAdmin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isSuper = user?.role === "super_admin";
  const { config: publicConfig } = usePublicConfig();
  const virtualFlagOn = Boolean(publicConfig.virtual_puja_enabled);

  const [rows, setRows] = useState<any[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CategoryRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [samagriItems, setSamagriItems] = useState<any[]>([]);
  const [linked, setLinked] = useState<any[]>([]);
  const [linkItemId, setLinkItemId] = useState("");
  const [linkQty, setLinkQty] = useState("");
  const [linkUnit, setLinkUnit] = useState("");
  const [linkCategory, setLinkCategory] = useState("PUJA_SAMAGRI");
  const [linkProvidedBy, setLinkProvidedBy] = useState("CUSTOMER");
  const [imageUploading, setImageUploading] = useState(false);
  const [linkOptional, setLinkOptional] = useState(false);

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryEditId, setCategoryEditId] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);

  async function loadCategories() {
    setCatalogCategories(await api<CategoryRow[]>("/admin/service-categories"));
  }

  async function load() {
    setRows(await api<any[]>("/admin/services"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
    void loadCategories().catch((e) => toast.error(e.message));
    api<any[]>("/samagri/items")
      .then(setSamagriItems)
      .catch(() => setSamagriItems([]));
  }, []);

  async function loadLinked(serviceId: string) {
    try {
      setLinked(await api<any[]>(`/services/${serviceId}/samagri`));
    } catch {
      setLinked([]);
    }
  }

  function toggleCategorySlug(slug: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      category_slugs: checked
        ? [...prev.category_slugs, slug]
        : prev.category_slugs.filter((s) => s !== slug),
    }));
  }

  function openAdd() {
    setEditId(null);
    setForm({ ...emptyForm, virtual_available: virtualFlagOn });
    setLinked([]);
    setOpen(true);
  }

  function openEdit(s: any) {
    setEditId(s.id);
    const categorySlugs =
      Array.isArray(s.categories) && s.categories.length
        ? s.categories.map((c: { slug: string }) => c.slug)
        : [];
    setForm({
      name: s.name || "",
      slug: s.slug || "",
      description: s.description || "",
      short_description: s.short_description || "",
      full_description: s.full_description || "",
      benefits: s.benefits || "",
      local_name: s.local_name || "",
      category: s.category || "puja",
      category_slugs: categorySlugs,
      search_aliases_text: Array.isArray(s.search_aliases) ? s.search_aliases.join(", ") : "",
      required_level: s.required_level || 2,
      standard_price_paise: s.standard_price_paise != null ? Number(s.standard_price_paise) : null,
      premium_price_paise: s.premium_price_paise != null ? Number(s.premium_price_paise) : null,
      main_puja_price_paise:
        s.main_puja_price_paise != null
          ? Number(s.main_puja_price_paise)
          : s.standard_price_paise != null
            ? Number(s.standard_price_paise)
            : null,
      samagri_price_paise: Number(s.samagri_price_paise) || 0,
      alankaram_price_paise: Number(s.alankaram_price_paise) || 0,
      food_price_paise: Number(s.food_price_paise) || 0,
      samagri_provider: s.samagri_provider || "included",
      alankaram_provider: s.alankaram_provider || "included",
      food_provider: s.food_provider || "included",
      muhurta_consultation_enabled: Boolean(s.muhurta_consultation_enabled),
      muhurta_fee_paise: Number(s.muhurta_fee_paise) || 0,
      requires_muhurta: Boolean(s.requires_muhurta),
      duration_minutes: s.duration_minutes || 90,
      pujaris_required: s.pujaris_required || 1,
      virtual_available: s.virtual_available !== false,
      active: s.active !== false,
      samagri_available: s.samagri_available !== false,
      alankaram_available: Boolean(s.alankaram_available),
      food_available: Boolean(s.food_available),
      image_path: s.image_path || "",
      image_url: s.image_url || "",
      is_popular: Boolean(s.is_popular),
      is_featured_home: Boolean(s.is_featured_home),
      is_seasonal: Boolean(s.is_seasonal),
      display_order: s.display_order ?? 1000,
      homepage_rank: s.homepage_rank != null ? Number(s.homepage_rank) : null,
      pricing_status: s.pricing_status === "priced" ? "priced" : "awaiting_pricing",
      samagri_review_status: (s.samagri_review_status || "UNVERIFIED") as
        | "UNVERIFIED"
        | "VERIFIED"
        | "NEEDS_REVIEW",
    });
    setLinkItemId("");
    setLinkQty("");
    setLinkUnit("");
    setLinkCategory("PUJA_SAMAGRI");
    setLinkProvidedBy("CUSTOMER");
    setLinkOptional(false);
    void loadLinked(s.id);
    setOpen(true);
  }

  function openCategoryAdd() {
    setCategoryEditId(null);
    setCategoryForm(emptyCategoryForm);
  }

  function openCategoryEdit(c: CategoryRow) {
    setCategoryEditId(c.id);
    setCategoryForm({
      slug: c.slug,
      name: c.name,
      description: c.description || "",
      sort_order: c.sort_order ?? 0,
      active: c.active !== false,
    });
  }

  async function handleCategorySave(e: React.FormEvent) {
    e.preventDefault();
    setCategorySaving(true);
    try {
      const slug =
        categoryForm.slug ||
        categoryForm.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      const payload = {
        ...categoryForm,
        slug,
        sort_order: Math.round(Number(categoryForm.sort_order) || 0),
      };
      if (categoryEditId) {
        await api(`/admin/service-categories/${categoryEditId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Category updated");
      } else {
        await api("/admin/service-categories", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Category added");
      }
      setCategoryForm(emptyCategoryForm);
      setCategoryEditId(null);
      await loadCategories();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (
      form.active &&
      (form.standard_price_paise == null ||
        form.premium_price_paise == null ||
        form.pricing_status === "awaiting_pricing")
    ) {
      toast.error("Set Standard and Premium prices (priced status) before activating");
      return;
    }
    setSaving(true);
    try {
      const slug =
        form.slug ||
        form.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      const muhurtaFee = Math.max(0, Math.round(Number(form.muhurta_fee_paise) || 0));
      const pricingStatus =
        form.standard_price_paise != null && form.premium_price_paise != null
          ? form.pricing_status
          : "awaiting_pricing";
      const payload = {
        ...form,
        slug,
        search_aliases: parseAliases(form.search_aliases_text),
        category_slugs: form.category_slugs,
        standard_price_paise: form.standard_price_paise,
        premium_price_paise: form.premium_price_paise,
        main_puja_price_paise: form.main_puja_price_paise ?? form.standard_price_paise,
        samagri_price_paise: Math.max(0, Math.round(Number(form.samagri_price_paise) || 0)),
        alankaram_price_paise: Math.max(0, Math.round(Number(form.alankaram_price_paise) || 0)),
        food_price_paise: Math.max(0, Math.round(Number(form.food_price_paise) || 0)),
        muhurta_fee_paise: muhurtaFee > 0 ? muhurtaFee : null,
        duration_minutes: Math.max(15, Math.round(Number(form.duration_minutes) || 90)),
        required_level: Math.min(4, Math.max(1, Number(form.required_level) || 2)),
        pujaris_required: Math.min(20, Math.max(1, Math.round(Number(form.pujaris_required) || 1))),
        display_order: Math.round(Number(form.display_order) || 1000),
        homepage_rank:
          form.homepage_rank != null && form.homepage_rank !== ("" as unknown as number)
            ? Math.round(Number(form.homepage_rank))
            : null,
        pricing_status: pricingStatus,
        image_path: form.image_path.trim() || null,
        image_url: form.image_url.trim() || null,
        virtual_available: virtualFlagOn ? form.virtual_available : false,
      };
      delete (payload as any).search_aliases_text;
      if (editId) {
        await api(`/admin/services/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
        toast.success("Service & pricing updated");
      } else {
        await api("/admin/services", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Service added");
      }
      setForm(emptyForm);
      setEditId(null);
      setOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-h1">Puja Services</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit each puja’s name, catalog details, categories, and Standard / Premium pricing.
            {isSuper ? " As Super Admin you can change all services and costs." : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setCategoriesOpen(true)}>
            <FolderTree size={16} />
            Categories
          </Button>
          <Button variant="outline" onClick={() => setLocation(adminPath("/pricing"))}>
            Location & surge pricing
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus size={16} />
            Add service
          </Button>
        </div>
      </div>

      {!virtualFlagOn && isSuper && (
        <p className="text-sm text-muted-foreground mb-4 rounded-md border border-dashed px-3 py-2">
          Virtual Puja is currently off. Enable it under{" "}
          <Link href={adminPath("/settings")} className="text-primary underline-offset-2 hover:underline">
            Settings → Virtual Puja
          </Link>
          .
        </p>
      )}

      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="">Service categories</DialogTitle>
          </DialogHeader>
          <form id="category-form" onSubmit={handleCategorySave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Name</Label>
                <Input
                  id="cat-name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-slug">Slug</Label>
                <Input
                  id="cat-slug"
                  placeholder="Auto from name if blank"
                  value={categoryForm.slug}
                  onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-sort">Sort order</Label>
                <Input
                  id="cat-sort"
                  type="number"
                  value={categoryForm.sort_order}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, sort_order: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm pt-8">
                <Checkbox
                  checked={categoryForm.active}
                  onCheckedChange={(v) => setCategoryForm({ ...categoryForm, active: !!v })}
                />
                Active
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description (optional)</Label>
              <Textarea
                id="cat-desc"
                rows={2}
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={categorySaving}>
                {categorySaving ? "Saving…" : categoryEditId ? "Update category" : "Add category"}
              </Button>
              {categoryEditId && (
                <Button type="button" variant="outline" onClick={openCategoryAdd}>
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogCategories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.slug}</TableCell>
                  <TableCell>{c.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={c.active ? "default" : "secondary"}>
                      {c.active ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openCategoryEdit(c)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {catalogCategories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No categories yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="">{editId ?"Edit puja service" :"Add puja service"}</DialogTitle>
          </DialogHeader>
          <form id="add-service-form" onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-name">Puja / service name</Label>
                <Input
                  id="service-name"
                  placeholder="e.g. Satyanarayan Puja"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-local">Local name (optional)</Label>
                <Input
                  id="service-local"
                  value={form.local_name}
                  onChange={(e) => setForm({ ...form, local_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-slug">Slug (URL)</Label>
              <Input
                id="service-slug"
                placeholder="Optional — auto-generated from name"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-short">Short description</Label>
              <Textarea
                id="service-short"
                placeholder="One-line summary for listings"
                value={form.short_description}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-full">Full description</Label>
              <Textarea
                id="service-full"
                placeholder="Detailed description for the service page"
                value={form.full_description}
                onChange={(e) => setForm({ ...form, full_description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-benefits">Benefits / purpose</Label>
              <Textarea
                id="service-benefits"
                value={form.benefits}
                onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-description">Legacy description (optional)</Label>
              <Textarea
                id="service-description"
                placeholder="Fallback if short description is empty"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Catalog categories</Label>
              <div className="rounded-lg border p-3 max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                {catalogCategories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.category_slugs.includes(c.slug)}
                      onCheckedChange={(v) => toggleCategorySlug(c.slug, !!v)}
                      disabled={!c.active && !form.category_slugs.includes(c.slug)}
                    />
                    {c.name}
                  </label>
                ))}
                {catalogCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">
                    No categories yet. Use the Categories button to add some.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-aliases">Search aliases</Label>
              <Input
                id="service-aliases"
                placeholder="Comma-separated, e.g. Satyanarayana, Satya Narayan"
                value={form.search_aliases_text}
                onChange={(e) => setForm({ ...form, search_aliases_text: e.target.value })}
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium">Catalog visibility & ordering</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.is_popular}
                    onCheckedChange={(v) => setForm({ ...form, is_popular: !!v })}
                  />
                  Popular
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.is_featured_home}
                    onCheckedChange={(v) => setForm({ ...form, is_featured_home: !!v })}
                  />
                  Featured on home
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.is_seasonal}
                    onCheckedChange={(v) => setForm({ ...form, is_seasonal: !!v })}
                  />
                  Seasonal
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service-display-order">Display order</Label>
                  <Input
                    id="service-display-order"
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-home-rank">Homepage rank</Label>
                  <Input
                    id="service-home-rank"
                    type="number"
                    placeholder="Optional"
                    value={form.homepage_rank ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        homepage_rank: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-pricing-status">Pricing status</Label>
                  <Select
                    value={form.pricing_status}
                    onValueChange={(v: "priced" | "awaiting_pricing") =>
                      setForm({ ...form, pricing_status: v })
                    }
                  >
                    <SelectTrigger id="service-pricing-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="awaiting_pricing">Awaiting pricing</SelectItem>
                      <SelectItem value="priced">Priced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium">Cost & pricing</p>
              <p className="text-xs text-muted-foreground">
                Leave prices blank for drafts. Both Standard and Premium are required before activating.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service-standard">Standard price (₹)</Label>
                  <Input
                    id="service-standard"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Draft — leave blank"
                    value={formatPriceInput(form.standard_price_paise)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        standard_price_paise:
                          e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-premium">Premium price (₹)</Label>
                  <Input
                    id="service-premium"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Draft — leave blank"
                    value={formatPriceInput(form.premium_price_paise)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        premium_price_paise:
                          e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium">Cost components</p>
              <p className="text-xs text-muted-foreground">
                Break the price down and say who supplies each part. “Reimbursed” means the pujari buys it and
                gets the amount back on top of their earnings.
              </p>
              <div className="space-y-2">
                <Label htmlFor="service-main">Main puja charge (₹)</Label>
                <Input
                  id="service-main"
                  type="number"
                  min={0}
                  step={1}
                  value={formatPriceInput(form.main_puja_price_paise)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      main_puja_price_paise:
                        e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
              </div>
              {(
                [
                  { label: "Food / prasadam", priceKey: "food_price_paise", providerKey: "food_provider" },
                ] as const
              ).map((row) => (
                <div key={row.priceKey} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`service-${row.priceKey}`}>{row.label} charge (₹)</Label>
                    <Input
                      id={`service-${row.priceKey}`}
                      type="number"
                      min={0}
                      step={1}
                      value={Number(form[row.priceKey]) / 100}
                      onChange={(e) =>
                        setForm({ ...form, [row.priceKey]: Math.round(Number(e.target.value || 0) * 100) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`service-${row.providerKey}`}>{row.label} provided by</Label>
                    <Select
                      value={String(form[row.providerKey])}
                      onValueChange={(v) => setForm({ ...form, [row.providerKey]: v })}
                    >
                      <SelectTrigger id={`service-${row.providerKey}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm pt-1">
                <Checkbox
                  checked={form.food_available}
                  onCheckedChange={(v) => setForm({ ...form, food_available: !!v })}
                />
                Food / prasadam available
              </label>
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-3 space-y-4">
              <div>
                <p className="text-sm font-medium">Optional booking add-ons (customer checkboxes)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  For this puja only: turn on Samagri and/or Alankaram and set the reimbursement price.
                  Customers see these as optional ticks on Review / Payment. Leave off (or price ₹0) to hide.
                </p>
              </div>

              <div className="rounded-md border bg-white p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={form.samagri_available}
                    onCheckedChange={(v) => {
                      const on = !!v;
                      setForm({
                        ...form,
                        samagri_available: on,
                        samagri_provider: on ? "reimbursable" : form.samagri_provider,
                      });
                    }}
                  />
                  Offer Samagri kit on booking
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="addon-samagri-price">Samagri price (₹)</Label>
                    <Input
                      id="addon-samagri-price"
                      type="number"
                      min={0}
                      step={1}
                      disabled={!form.samagri_available}
                      value={Number(form.samagri_price_paise) / 100}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          samagri_price_paise: Math.round(Number(e.target.value || 0) * 100),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>How it works</Label>
                    <p className="text-xs text-muted-foreground pt-2">
                      Pujari brings materials; customer reimburses from booking payment.
                    </p>
                  </div>
                </div>
                {form.samagri_available && Number(form.samagri_price_paise) <= 0 && (
                  <p className="text-xs text-amber-700 pl-6">Set a price above ₹0 so it appears on booking.</p>
                )}
              </div>

              <div className="rounded-md border bg-white p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={form.alankaram_available}
                    onCheckedChange={(v) => {
                      const on = !!v;
                      setForm({
                        ...form,
                        alankaram_available: on,
                        alankaram_provider: on ? "reimbursable" : form.alankaram_provider,
                      });
                    }}
                  />
                  Offer Alankaram on booking
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="addon-alankaram-price">Alankaram price (₹)</Label>
                    <Input
                      id="addon-alankaram-price"
                      type="number"
                      min={0}
                      step={1}
                      disabled={!form.alankaram_available}
                      value={Number(form.alankaram_price_paise) / 100}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          alankaram_price_paise: Math.round(Number(e.target.value || 0) * 100),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>How it works</Label>
                    <p className="text-xs text-muted-foreground pt-2">
                      Pujari brings flowers / decoration; customer reimburses from booking payment.
                    </p>
                  </div>
                </div>
                {form.alankaram_available && Number(form.alankaram_price_paise) <= 0 && (
                  <p className="text-xs text-amber-700 pl-6">Set a price above ₹0 so it appears on booking.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium">Muhurta consultation</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.muhurta_consultation_enabled}
                  onChange={(e) => setForm({ ...form, muhurta_consultation_enabled: e.target.checked })}
                />
                Offer a muhurta consultation for this service
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.requires_muhurta}
                  onChange={(e) => setForm({ ...form, requires_muhurta: e.target.checked })}
                />
                Muhurta is required before booking
              </label>
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="service-muhurta-fee">Consultation fee (₹)</Label>
                <Input
                  id="service-muhurta-fee"
                  type="number"
                  min={0}
                  step={1}
                  value={form.muhurta_fee_paise / 100}
                  onChange={(e) =>
                    setForm({ ...form, muhurta_fee_paise: Math.round(Number(e.target.value || 0) * 100) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave at 0 to use the platform-wide muhurta fee from Settings.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-level">Required pujari level</Label>
                <Select
                  value={String(form.required_level)}
                  onValueChange={(v) => setForm({ ...form, required_level: Number(v) })}
                >
                  <SelectTrigger id="service-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                    <SelectItem value="4">Level 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-duration">Duration (minutes)</Label>
                <Input
                  id="service-duration"
                  type="number"
                  min={15}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-pujaris">Pujaris required</Label>
                <Input
                  id="service-pujaris"
                  type="number"
                  min={1}
                  max={20}
                  value={form.pujaris_required}
                  onChange={(e) => setForm({ ...form, pujaris_required: Number(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <Label>Service image</Label>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-full sm:w-48 h-32 rounded-md overflow-hidden bg-muted border shrink-0">
                  <img
                    src={serviceImageUrl(form)}
                    alt="Service preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2 w-full">
                  <p className="text-xs text-muted-foreground">
                    Upload a cover image, or set a path/URL below. Empty uses the BSeva default placeholder.
                  </p>
                  {editId && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={imageUploading}
                        onClick={() => document.getElementById("service-image-file")?.click()}
                      >
                        {imageUploading ? "Uploading…" : "Upload image"}
                      </Button>
                      <input
                        id="service-image-file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file || !editId) return;
                          setImageUploading(true);
                          try {
                            const headers = new Headers();
                            const token = getToken();
                            if (token) headers.set("Authorization", `Bearer ${token}`);
                            const body = new FormData();
                            body.append("file", file);
                            const res = await fetch(
                              `${apiBase()}/api/v1/admin/services/${editId}/image`,
                              { method: "POST", headers, body }
                            );
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) throw new Error((data as { detail?: string }).detail || "Upload failed");
                            setForm((f) => ({
                              ...f,
                              image_path: (data as { image_path?: string }).image_path || f.image_path,
                              image_url: (data as { image_url?: string }).image_url || f.image_url,
                            }));
                            toast.success("Image uploaded");
                            load();
                          } catch (err: any) {
                            toast.error(err.message || "Upload failed");
                          } finally {
                            setImageUploading(false);
                          }
                        }}
                      />
                      {(form.image_url || form.image_path) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={imageUploading}
                          onClick={async () => {
                            if (!editId) return;
                            setImageUploading(true);
                            try {
                              await api(`/admin/services/${editId}/image`, { method: "DELETE" });
                              setForm((f) => ({ ...f, image_path: "", image_url: "" }));
                              toast.success("Image removed");
                              load();
                            } catch (err: any) {
                              toast.error(err.message || "Remove failed");
                            } finally {
                              setImageUploading(false);
                            }
                          }}
                        >
                          Remove image
                        </Button>
                      )}
                    </div>
                  )}
                  {!editId && (
                    <p className="text-xs text-muted-foreground">Save the service first to enable upload.</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service-image-path">Image path (optional)</Label>
                  <Input
                    id="service-image-path"
                    value={form.image_path}
                    onChange={(e) => setForm({ ...form, image_path: e.target.value })}
                    placeholder="/images/services/example.jpg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-image-url">Image URL (optional)</Label>
                  <Input
                    id="service-image-url"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="/images/services/example.jpg"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {virtualFlagOn && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.virtual_available}
                    onChange={(e) => setForm({ ...form, virtual_available: e.target.checked })}
                  />
                  Virtual available for this puja
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: !!v })}
                />
                Active (shown to customers)
              </label>
            </div>
            {editId && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Preparation / Samagri for this service</Label>
                  <Select
                    value={form.samagri_review_status}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        samagri_review_status: v as "UNVERIFIED" | "VERIFIED" | "NEEDS_REVIEW",
                      })
                    }
                  >
                    <SelectTrigger className="w-[11rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNVERIFIED">UNVERIFIED</SelectItem>
                      <SelectItem value="VERIFIED">VERIFIED</SelectItem>
                      <SelectItem value="NEEDS_REVIEW">NEEDS_REVIEW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only VERIFIED lists are shown to customers after booking.
                </p>
                <ul className="text-sm space-y-1 max-h-36 overflow-y-auto">
                  {linked.map((it) => (
                    <li key={it.samagri_item_id || it.id}>
                      {it.name}
                      {it.quantity != null ? ` — ${it.quantity}${it.unit ? ` ${it.unit}` : ""}` : ""}
                      {it.provided_by ? ` · ${it.provided_by}` : ""}
                      {it.optional ? " (optional)" : it.required ? " (required)" : ""}
                    </li>
                  ))}
                  {linked.length === 0 && <li className="text-muted-foreground">None linked yet</li>}
                </ul>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={linkItemId} onValueChange={setLinkItemId}>
                    <SelectTrigger className="col-span-2">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {samagriItems.map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Qty"
                    value={linkQty}
                    onChange={(e) => setLinkQty(e.target.value)}
                  />
                  <Input
                    placeholder="Unit"
                    value={linkUnit}
                    onChange={(e) => setLinkUnit(e.target.value)}
                  />
                  <Select value={linkCategory} onValueChange={setLinkCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUJA_SAMAGRI">Puja Samagri</SelectItem>
                      <SelectItem value="PRASADAM">Prasadam</SelectItem>
                      <SelectItem value="HOME_VENUE">Home / venue</SelectItem>
                      <SelectItem value="OPTIONAL">Optional</SelectItem>
                      <SelectItem value="PUJARI_OR_BSEVA">Pujari / BSeva</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={linkProvidedBy} onValueChange={setLinkProvidedBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Provided by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUSTOMER">Customer</SelectItem>
                      <SelectItem value="INCLUDED_IN_SAMAGRI_PACKAGE">Included in kit</SelectItem>
                      <SelectItem value="BSEVA">BSeva</SelectItem>
                      <SelectItem value="PUJARI">Pujari</SelectItem>
                      <SelectItem value="OPTIONAL">Optional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={linkOptional} onCheckedChange={(v) => setLinkOptional(!!v)} />
                  Optional item
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    if (!editId || !linkItemId) return;
                    try {
                      await api(`/admin/services/${editId}/samagri`, {
                        method: "POST",
                        body: JSON.stringify({
                          samagri_item_id: linkItemId,
                          required: !linkOptional,
                          optional: linkOptional,
                          customer_provided: linkProvidedBy === "CUSTOMER",
                          sort_order: linked.length,
                          quantity: linkQty ? Number(linkQty) : null,
                          unit: linkUnit || null,
                          category: linkCategory,
                          provided_by: linkProvidedBy,
                        }),
                      });
                      toast.success("Item linked");
                      await loadLinked(editId);
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  Link item
                </Button>
              </div>
            )}
          </form>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="add-service-form" disabled={saving}>
              {saving ? "Saving…" : editId ? "Save changes" : "Add service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Standard</TableHead>
              <TableHead>Pricing</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Popular</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-muted-foreground text-xs">{s.slug}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[12rem]">
                    {(s.categories || []).map((c: { slug: string; name: string }) => (
                      <Badge key={c.slug} variant="outline" className="text-xs">
                        {c.name}
                      </Badge>
                    ))}
                    {(!s.categories || s.categories.length === 0) && (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {s.standard_price_paise != null ? rupees(s.standard_price_paise) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={s.pricing_status === "priced" ? "default" : "secondary"}>
                    {s.pricing_status === "priced" ? "priced" : "awaiting"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={s.active ? "default" : "secondary"}>{s.active ? "yes" : "no"}</Badge>
                </TableCell>
                <TableCell>{s.is_popular ? "yes" : "—"}</TableCell>
                <TableCell>
                  {s.is_featured_home ? (s.homepage_rank != null ? `#${s.homepage_rank}` : "yes") : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openEdit(s)}>
                      <Pencil size={14} />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm(`Remove ${s.name}?`)) return;
                        try {
                          const out = await api<{ deactivated?: boolean }>(`/admin/services/${s.id}`, {
                            method: "DELETE",
                          });
                          toast.success(out.deactivated ? "Hidden (has bookings)" : "Deleted");
                          await load();
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No services yet. Add your first puja service.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}
