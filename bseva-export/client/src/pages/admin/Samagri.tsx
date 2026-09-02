import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type SamagriItem = {
  id: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  active?: boolean;
};

export default function AdminSamagri() {
  const [items, setItems] = useState<SamagriItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("pcs");
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

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/admin/samagri/items", {
        method: "POST",
        body: JSON.stringify({ name, description: description || null, unit, active: true }),
      });
      toast.success("Item added");
      setOpen(false);
      setName("");
      setDescription("");
      setUnit("pcs");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-heading font-bold">Recommended List</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Puja Recommended List (Samagri catalog)</CardTitle>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell>{it.unit || "pcs"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{it.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={it.active === false ? "secondary" : "default"}>
                        {it.active === false ? "Inactive" : "Active"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add samagri item</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={createItem}>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
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
