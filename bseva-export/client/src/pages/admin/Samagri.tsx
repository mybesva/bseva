import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAdminCan } from "@/hooks/useAdminPermissions";

type SamagriItem = {
  id: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  item_key?: string | null;
  active?: boolean;
  service_count?: number;
  translations?: Record<string, string>;
};

export default function AdminSamagri() {
  const { can } = useAdminCan();
  const canManage = can("manage_samagri");
  const [items, setItems] = useState<SamagriItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [itemKey, setItemKey] = useState("");
  const [nameHi, setNameHi] = useState("");
  const [nameTe, setNameTe] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await api<SamagriItem[]>("/samagri/items"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openForm(item?: SamagriItem) {
    setEditingId(item?.id ?? null);
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setUnit(item?.unit ?? "pcs");
    setItemKey(item?.item_key ?? "");
    setNameHi(item?.translations?.hi ?? "");
    setNameTe(item?.translations?.te ?? "");
    setOpen(true);
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(editingId ? `/admin/samagri/items/${editingId}` : "/admin/samagri/items", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          name,
          description: description || null,
          unit,
          item_key: itemKey.trim() || null,
          active: true,
          translations: { en: name, hi: nameHi.trim(), te: nameTe.trim() },
        }),
      });
      toast.success(editingId ? "Item updated" : "Item added");
      setOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item: SamagriItem) {
    const used = item.service_count ?? 0;
    const impact = used ? ` It will be removed from ${used} puja${used === 1 ? "" : "s"}.` : "";
    if (!confirm(`Delete "${item.name}"?${impact}`)) return;
    try {
      await api(`/admin/samagri/items/${item.id}`, { method: "DELETE" });
      toast.success("Item deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Master items with en / hi / te names. Link them per service in Services admin.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => openForm()}>
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Puja Preparation Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground">No samagri items yet. Add the first item.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name (EN)</TableHead>
                  <TableHead>HI / TE</TableHead>
                  <TableHead>Used In</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {(it.translations?.hi || "—") + " / " + (it.translations?.te || "—")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {it.service_count ?? 0} puja{it.service_count === 1 ? "" : "s"}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openForm(it)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => void deleteItem(it)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open && canManage} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Samagri Item" : "Add Samagri Item"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveItem}>
            <div className="space-y-1">
              <Label>Name (English)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Name (Hindi)</Label>
                <Input value={nameHi} onChange={(e) => setNameHi(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Name (Telugu)</Label>
                <Input value={nameTe} onChange={(e) => setNameTe(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Item Key</Label>
                <Input
                  value={itemKey}
                  onChange={(e) => setItemKey(e.target.value)}
                  placeholder="e.g. turmeric"
                />
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
