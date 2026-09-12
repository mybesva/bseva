import { useEffect, useState } from "react";
import { PujariPortal } from "@/components/RolePortals";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

type PujariOption = { id: string; name: string; email?: string };

function RatingsForm() {
  const [pujaris, setPujaris] = useState<PujariOption[]>([]);
  const [pujariId, setPujariId] = useState("");
  const [manualId, setManualId] = useState("");
  const [stars, setStars] = useState(5);
  const [comments, setComments] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setRows(await api<any[]>("/head/ratings"));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    void load();
    api<PujariOption[]>("/head/pujaris")
      .then((items) => setPujaris(items.map((u: any) => ({ id: u.id, name: u.name, email: u.email }))))
      .catch(() => undefined);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (comments.trim().length < 5) {
      toast.error("Comments are mandatory (min 5 characters)");
      return;
    }
    const target = (pujariId || manualId).trim();
    if (!target) {
      toast.error("Select a pujari or enter their UUID / email / phone");
      return;
    }
    setSaving(true);
    try {
      await api("/head/ratings", {
        method: "POST",
        body: JSON.stringify({ pujari_id: target, stars, comments: comments.trim() }),
      });
      toast.success("Assessment saved");
      setComments("");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rate a Pujari</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            {pujaris.length > 0 && (
              <div className="space-y-1">
                <Label>Select pujari</Label>
                <Select
                  value={pujariId || undefined}
                  onValueChange={(v) => {
                    setPujariId(v);
                    setManualId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a pujari" />
                  </SelectTrigger>
                  <SelectContent>
                    {pujaris.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.email ? ` (${p.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Or enter UUID / email / phone</Label>
              <Input
                value={manualId}
                onChange={(e) => {
                  setManualId(e.target.value);
                  setPujariId("");
                }}
                placeholder="Do not use numeric IDs like 2"
              />
              <p className="text-xs text-muted-foreground">
                Assessments require the pujari account UUID, email, or phone — not a display number.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Stars (1–5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={stars}
                onChange={(e) => setStars(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Comments (mandatory)</Label>
              <Textarea value={comments} onChange={(e) => setComments(e.target.value)} required minLength={5} rows={4} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Submit assessment"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessment history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">No assessments yet.</p>}
          {rows.map((r) => (
            <div key={r.id} className="border rounded-md p-3 text-sm">
              <div className="font-medium">
                {"★".repeat(Number(r.stars || 0))} · {String(r.pujari_id).slice(0, 8)}…
              </div>
              <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{r.comments}</p>
              <div className="text-xs text-muted-foreground mt-1">{r.created_at}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function HeadRatingsPage() {
  const { user } = useAuth();
  if (user?.role === "admin" || user?.role === "super_admin") {
    return (
      <AdminLayout>
        <h1 className="text-h1 mb-6">Head Pujari assessments</h1>
        <RatingsForm />
      </AdminLayout>
    );
  }
  return (
    <PujariPortal>
      <h1 className="text-h1 mb-6">Assess Pujaris</h1>
      <RatingsForm />
    </PujariPortal>
  );
}
