import { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Edit, Trash2, MoreHorizontal, MapPin, Building2, Download, Upload, Clock, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { parseCsv, rowsToObjects } from "@/lib/csv";

interface TempleFormData {
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  deity: string;
  timings: string;
  contact_phone: string;
  contact_email: string;
  pujari_name: string;
}

type TempleRow = {
  id: string;
  name: string;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  deity?: string | null;
  timings?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  pujari_name?: string | null;
  pujari_registered?: boolean;
  pujari_account_name?: string | null;
  pujari_verification_status?: string | null;
};

const emptyForm: TempleFormData = {
  name: "",
  description: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  deity: "",
  timings: "",
  contact_phone: "",
  contact_email: "",
  pujari_name: "",
};

const deityOptions = [
  "Lord Ganesha", "Lord Shiva", "Lord Vishnu", "Lord Krishna", "Lord Rama",
  "Goddess Durga", "Goddess Lakshmi", "Goddess Saraswati", "Goddess Kali",
  "Lord Hanuman", "Lord Murugan", "Lord Ayyappa", "Lord Venkateshwara",
  "Goddess Parvati", "Lord Brahma", "Multiple Deities",
];

const CSV_HEADERS = [
  "name",
  "pujari_name",
  "deity",
  "address",
  "city",
  "state",
  "pincode",
  "timings",
  "contact_phone",
  "contact_email",
  "description",
];

const SAMPLE_CSV = `${CSV_HEADERS.join(",")}
Shri Ganesh Temple,Pandit Sharma,Lord Ganesha,MG Road,Hyderabad,Telangana,500001,6:00 AM - 9:00 PM,9876543210,temple@email.com,Ancient temple dedicated to Lord Ganesha`;

export default function TemplesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemple, setEditingTemple] = useState<TempleRow | null>(null);
  const [formData, setFormData] = useState<TempleFormData>(emptyForm);
  const [temples, setTemples] = useState<TempleRow[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (searchTerm.trim()) qs.set("q", searchTerm.trim());
      if (cityFilter !== "all") qs.set("city", cityFilter);
      const data = await api<{ items: TempleRow[]; cities: string[]; registered_count: number }>(
        `/admin/temples${qs.toString() ? `?${qs}` : ""}`,
      );
      setTemples(data.items || []);
      setCities(data.cities || []);
      setRegisteredCount(data.registered_count || 0);
    } catch (e: any) {
      toast.error(e.message || "Could not load temples");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(t);
  }, [searchTerm, cityFilter]);

  const filtered = useMemo(() => temples, [temples]);
  const totalTemples = temples.length;
  const activeCount = temples.filter((t) => (t as { active?: boolean }).active !== false).length;

  function resetForm() {
    setFormData(emptyForm);
    setEditingTemple(null);
  }

  function handleOpenDialog(temple?: TempleRow) {
    if (temple) {
      setEditingTemple(temple);
      setFormData({
        name: temple.name || "",
        description: temple.description || "",
        address: (temple as { address?: string }).address || "",
        city: temple.city || "",
        state: temple.state || "",
        pincode: temple.pincode || "",
        deity: temple.deity || "",
        timings: temple.timings || "",
        contact_phone: temple.contact_phone || "",
        contact_email: temple.contact_email || "",
        pujari_name: temple.pujari_name || "",
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...formData };
      if (editingTemple) {
        await api(`/admin/temples/${editingTemple.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Temple updated");
      } else {
        await api("/admin/temples", { method: "POST", body: JSON.stringify(body) });
        toast.success("Temple created");
      }
      setIsDialogOpen(false);
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err.message || "Could not save temple");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this temple?")) return;
    try {
      await api(`/admin/temples/${id}`, { method: "DELETE" });
      toast.success("Temple deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Could not delete temple");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "temples_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const lines = [CSV_HEADERS.join(",")];
    for (const t of temples) {
      const vals = [
        t.name,
        t.pujari_name,
        t.deity,
        (t as { address?: string }).address,
        t.city,
        t.state,
        t.pincode,
        t.timings,
        t.contact_phone,
        t.contact_email,
        t.description,
      ].map((v) => {
        const s = String(v || "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      });
      lines.push(vals.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "temples.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const table = parseCsv(text);
      const items = rowsToObjects(table);
      if (!items.length) {
        toast.error("CSV has no data rows");
        return;
      }
      const result = await api<{ success: number; created: number; updated: number; failed: number; errors: { row: number; message: string }[] }>(
        "/admin/temples/bulk",
        { method: "POST", body: JSON.stringify({ items }) },
      );
      if (result.failed) {
        toast.warning(
          `Imported ${result.success} temples (${result.created} new, ${result.updated} updated). ${result.failed} failed.`,
        );
      } else {
        toast.success(`Imported ${result.success} temples (${result.created} new, ${result.updated} updated).`);
      }
      await load();
    } catch (err: any) {
      toast.error(err.message || "Bulk import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Temple Management</h2>
            <p className="text-muted-foreground">Manage temple listings, pujari names, and CSV import</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!temples.length}>
              <Download size={16} className="mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download size={16} className="mr-2" />
              CSV template
            </Button>
            <Button variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
              <Upload size={16} className="mr-2" />
              {importing ? "Importing…" : "Bulk Import"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleBulkFile(f);
              }}
            />
            <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90">
              <Plus size={16} className="mr-2" />
              Add Temple
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Temples</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{totalTemples}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cities Covered</CardTitle>
              <MapPin className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{cities.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
              <Clock className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pujaris on BSeva</CardTitle>
              <UserCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{registeredCount}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search by name, deity, city, or pujari..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Temple Name</TableHead>
                <TableHead>Deity</TableHead>
                <TableHead>Pujari</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Timings</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((temple) => (
                  <TableRow key={temple.id}>
                    <TableCell>
                      <div className="font-medium">{temple.name}</div>
                      {temple.description ? (
                        <div className="text-sm text-muted-foreground line-clamp-1">{temple.description}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{temple.deity || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{temple.pujari_name || temple.pujari_account_name || "—"}</div>
                      {temple.pujari_registered ? (
                        <Badge className="mt-1 bg-green-100 text-green-800 hover:bg-green-100">
                          On BSeva as pujari
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="mt-1">Not on BSeva</Badge>
                      )}
                      {temple.pujari_registered && temple.pujari_account_name && temple.pujari_name
                        && temple.pujari_account_name !== temple.pujari_name ? (
                        <div className="text-xs text-muted-foreground mt-1">Account: {temple.pujari_account_name}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{[temple.city, temple.state].filter(Boolean).join(", ") || "—"}</div>
                        {temple.pincode ? <div className="text-muted-foreground">{temple.pincode}</div> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{temple.timings || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{temple.contact_phone || "—"}</div>
                        <div className="text-muted-foreground">{temple.contact_email || ""}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(temple)}>
                            <Edit size={14} className="mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleDelete(temple.id)} className="text-destructive">
                            <Trash2 size={14} className="mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No temples found. Add one or import a CSV.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemple ? "Edit Temple" : "Add New Temple"}</DialogTitle>
            <DialogDescription>
              {editingTemple
                ? "Update temple information. Pujari registration is checked from the contact phone."
                : "Add a temple. If the contact phone matches a BSeva pujari, they are marked as registered."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Temple Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pujari_name">Pujari name</Label>
                <Input
                  id="pujari_name"
                  value={formData.pujari_name}
                  onChange={(e) => setFormData({ ...formData, pujari_name: e.target.value })}
                  placeholder="Temple pujari / priest"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact phone</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  placeholder="10-digit mobile"
                />
                {editingTemple ? (
                  <p className="text-xs text-muted-foreground">
                    {editingTemple.pujari_registered
                      ? `This number is registered on BSeva as a pujari${editingTemple.pujari_account_name ? ` (${editingTemple.pujari_account_name})` : ""}.`
                      : "This number is not registered as a BSeva pujari."}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Matched against pujari accounts on BSeva (phone / mobile / WhatsApp).
                  </p>
                )}
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deity">Primary Deity</Label>
                <Select
                  value={formData.deity || undefined}
                  onValueChange={(value) => setFormData({ ...formData, deity: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select deity" />
                  </SelectTrigger>
                  <SelectContent>
                    {deityOptions.map((deity) => (
                      <SelectItem key={deity} value={deity}>{deity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timings">Timings</Label>
                <Input
                  id="timings"
                  value={formData.timings}
                  onChange={(e) => setFormData({ ...formData, timings: e.target.value })}
                  placeholder="e.g., 6:00 AM - 9:00 PM"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
                {editingTemple ? "Update" : "Create"} Temple
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
