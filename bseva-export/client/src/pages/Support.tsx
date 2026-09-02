import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { CustomerPortal, PujariPortal } from "@/components/RolePortals";
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
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

const CUSTOMER_CATS = ["Payments", "Wallet", "Bookings", "Others"];
const PUJARI_CATS = ["Settlement", "Route Map / Location", "Others"];

function SupportForm({ categories }: { categories: string[] }) {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<any[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setTickets(await api<any[]>("/support/tickets"));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/support/tickets", {
        method: "POST",
        body: JSON.stringify({ category, subject, description }),
      });
      toast.success(t("support.submitted"));
      setSubject("");
      setDescription("");
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Raise a ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
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
              {saving ? "Sending…" : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Your tickets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t.subject}</span>
                  <Badge variant="secondary">{t.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.ticket_number} · {t.category}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CustomerSupportPage() {
  const { t } = useI18n();
  return (
    <CustomerPortal>
      <h1 className="text-2xl font-heading font-bold mb-6">{t("support.title")}</h1>
      <SupportForm categories={CUSTOMER_CATS} />
    </CustomerPortal>
  );
}

export function PujariSupportPage() {
  const { t } = useI18n();
  return (
    <PujariPortal>
      <h1 className="text-2xl font-heading font-bold mb-6">{t("support.title")}</h1>
      <SupportForm categories={PUJARI_CATS} />
    </PujariPortal>
  );
}

/** Public contact-adjacent page for logged-out users (uses Layout). */
export default function SupportPage() {
  const { user } = useAuth();
  if (user?.role === "customer") return <CustomerSupportPage />;
  if (user?.role === "pujari") return <PujariSupportPage />;
  return (
    <Layout>
      <div className="container py-10 max-w-lg">
        <h1 className="text-2xl font-heading font-bold mb-2">Support</h1>
        <p className="text-muted-foreground mb-4">Please sign in to raise a support ticket.</p>
        <Button asChild>
          <a href="/login">Sign in</a>
        </Button>
      </div>
    </Layout>
  );
}
