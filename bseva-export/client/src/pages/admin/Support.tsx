import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";

const CATEGORIES_CUSTOMER = ["Payments", "Wallet", "Bookings", "Others"];
const CATEGORIES_PUJARI = ["Settlement", "Route Map / Location", "Others"];

export default function AdminSupport() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Others");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setTickets(await api<any[]>("/support/tickets"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/support/tickets", {
        method: "POST",
        body: JSON.stringify({ category, subject, description }),
      });
      toast.success("Ticket created");
      setSubject("");
      setDescription("");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api(`/support/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success("Updated");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-heading font-bold mb-6">Support tickets</h1>

      <div className="grid lg:grid-cols-2 gap-6 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Create ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={createTicket}>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set([...CATEGORIES_CUSTOMER, ...CATEGORIES_PUJARI])].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required minLength={3} rows={4} />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create ticket"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">All tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && tickets.length === 0 && (
              <p className="text-sm text-muted-foreground">No tickets yet.</p>
            )}
            {tickets.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{t.ticket_number || t.id}</div>
                  <Badge variant="secondary">{t.status || "open"}</Badge>
                </div>
                <div className="text-sm font-medium">{t.subject}</div>
                <p className="text-xs text-muted-foreground line-clamp-3">{t.description}</p>
                <div className="text-xs text-muted-foreground">
                  {t.category} · {t.user_role || "—"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {["open", "in_progress", "waiting_for_user", "resolved", "closed"].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={t.status === s ? "default" : "outline"}
                      onClick={() => void updateStatus(String(t.id), s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
