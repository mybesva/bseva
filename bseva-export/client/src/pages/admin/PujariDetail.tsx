import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, openAdminPujariDocument, uploadAdminPujariDocument } from "@/lib/api";
import { usePujariLevels } from "@/hooks/usePujariLevels";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const DOC_LABELS: Record<string, string> = {
  certificate: "Professional",
  identity: "Aadhaar",
  supporting: "Additional",
};

const QUAL_OPTS = [
  { id: "panchadasha", label: "Panchadasha Samskara" },
  { id: "kriya_kovida", label: "Kriya Kovida" },
  { id: "vidya_visharada", label: "Vidya Visharada" },
];

const LANG_OPTS = ["Sanskrit", "Hindi", "English", "Telugu", "Kannada", "Tamil", "Marathi"];
const SPEC_OPTS = ["Satyanarayan Puja", "Griha Pravesh", "Wedding", "Havan", "Vastu Shanti", "Namkaran"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="text-sm">{children || "—"}</div>
    </div>
  );
}

function listDisplay(v: unknown) {
  if (Array.isArray(v) && v.length) return v.join(", ");
  return "—";
}

function fmtDate(v: unknown) {
  if (!v) return "—";
  const s = String(v);
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export default function PujariDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id || "";
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { levels } = usePujariLevels();

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(() => new URLSearchParams(search).get("edit") === "1");
  const [profile, setProfile] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyLevel, setVerifyLevel] = useState(2);
  const [rejectionReason, setRejectionReason] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api<{
        profile: any;
        documents: any[];
        verification_history: any[];
        referral_code: string | null;
      }>(`/admin/pujaris/${id}`);
      setProfile(data.profile);
      setDraft({ ...data.profile });
      setDocuments(data.documents || []);
      setHistory(data.verification_history || []);
      setReferralCode(data.referral_code);
      setVerifyLevel(Number(data.profile?.approved_level || data.profile?.requested_level || 2));
      setRejectionReason(data.profile?.rejection_reason || "");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    if (new URLSearchParams(search).get("edit") === "1") setEditing(true);
  }, [search]);

  function setField(key: string, value: unknown) {
    setDraft((prev: any) => ({ ...prev, [key]: value }));
  }

  function toggleList(key: "languages" | "specializations" | "qualifications", item: string, on: boolean) {
    const cur: string[] = draft?.[key] || [];
    setField(key, on ? Array.from(new Set([...cur, item])) : cur.filter((x) => x !== x || x !== item));
  }

  function cancelEdit() {
    setDraft({ ...profile });
    setEditing(false);
    if (new URLSearchParams(search).get("edit") === "1") {
      setLocation(`/admin/pujaris/${id}`);
    }
  }

  async function saveProfile() {
    if (!draft) return;
    setSaving(true);
    try {
      const body = {
        full_name: draft.full_name || null,
        father_name: draft.father_name || null,
        gotra: draft.gotra || null,
        date_of_birth: draft.date_of_birth ? String(draft.date_of_birth).slice(0, 10) : null,
        native_place: draft.native_place || null,
        permanent_address: draft.permanent_address || null,
        present_address: draft.present_address || null,
        mobile_number: draft.mobile_number || null,
        whatsapp_number: draft.whatsapp_number || null,
        qualifications: draft.qualifications || [],
        qualification_year: draft.qualification_year ? Number(draft.qualification_year) : null,
        sampradaya: draft.sampradaya || null,
        website_publication_consent: !!draft.website_publication_consent,
        address_line1: draft.address_line1 || null,
        address_line2: draft.address_line2 || null,
        city: draft.city || null,
        district: draft.district || null,
        state: draft.state || null,
        pincode: draft.pincode || null,
        country: draft.country || null,
        location_label: draft.location_label || null,
        latitude: draft.latitude != null && draft.latitude !== "" ? Number(draft.latitude) : null,
        longitude: draft.longitude != null && draft.longitude !== "" ? Number(draft.longitude) : null,
        languages: draft.languages || [],
        specializations: draft.specializations || [],
        experience_years: draft.experience_years != null && draft.experience_years !== "" ? Number(draft.experience_years) : null,
        available: !!draft.available,
        service_radius_km: draft.service_radius_km != null && draft.service_radius_km !== "" ? Number(draft.service_radius_km) : null,
        bank_account_last4: draft.bank_account_last4 || null,
        bank_ifsc: draft.bank_ifsc || null,
        bank_holder_name: draft.bank_holder_name || null,
      };
      await api(`/admin/pujaris/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success("Profile saved");
      setEditing(false);
      await load();
      if (new URLSearchParams(search).get("edit") === "1") {
        setLocation(`/admin/pujaris/${id}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function verify(status: string) {
    setVerifying(true);
    try {
      await api(`/admin/pujaris/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({
          verification_status: status,
          approved_level: verifyLevel,
          rejection_reason: rejectionReason || null,
        }),
      });
      toast.success(`Marked ${status.replace(/_/g, " ")}`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setVerifying(false);
    }
  }

  async function uploadDoc(documentType: string, file: File | undefined) {
    if (!file) return;
    setUploading(documentType);
    try {
      await uploadAdminPujariDocument(id, file, documentType);
      toast.success("Document uploaded");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(null);
    }
  }

  if (loading || !profile) {
    return (
      <AdminLayout>
        <p className="text-muted-foreground">Loading…</p>
      </AdminLayout>
    );
  }

  const p = editing ? draft : profile;
  const incomplete = !!(profile.profile_incomplete || !profile.profile_complete);
  const avg =
    profile.avg_stars ?? profile.average_rating ?? profile.rating_avg ?? null;
  const ratingCount = profile.rating_count ?? profile.ratings_count ?? null;

  return (
    <AdminLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link href="/admin/pujaris" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} />
            Back to pujaris
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-heading font-bold">{profile.full_name || profile.name}</h1>
            {incomplete && <Badge variant="destructive">Profile Incomplete</Badge>}
            <Badge>{profile.verification_status}</Badge>
            <Badge variant={profile.blocked ? "destructive" : "secondary"}>
              {profile.blocked ? "Blocked" : "Active"}
            </Badge>
            {(profile.is_head_pujari || profile.role === "head_pujari") && (
              <Badge variant="outline">Head Pujari</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Completion {profile.profile_completion_percentage ?? 0}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          ) : (
            <>
              <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void saveProfile()} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
          {profile.is_head_pujari || profile.role === "head_pujari" ? (
            <Button
              variant="outline"
              onClick={async () => {
                await api(`/admin/pujaris/${id}/head`, {
                  method: "POST",
                  body: JSON.stringify({ is_head_pujari: false, scope_cities: [] }),
                });
                toast.success("Removed Head Pujari");
                await load();
              }}
            >
              Unhead
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={async () => {
                await api(`/admin/pujaris/${id}/head`, {
                  method: "POST",
                  body: JSON.stringify({ is_head_pujari: true, scope_cities: [] }),
                });
                toast.success("Marked Head Pujari");
                await load();
              }}
            >
              Make Head
            </Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              await api(`/admin/users/${id}/block`, {
                method: "POST",
                body: JSON.stringify({ blocked: !profile.blocked, reason: "Admin action" }),
              });
              toast.success(profile.blocked ? "Unblocked" : "Blocked");
              await load();
            }}
          >
            {profile.blocked ? "Unblock" : "Block"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Basic</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {editing ? (
              <>
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={p.full_name || ""} onChange={(e) => setField("full_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Father name</Label>
                  <Input value={p.father_name || ""} onChange={(e) => setField("father_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Gotra</Label>
                  <Input value={p.gotra || ""} onChange={(e) => setField("gotra", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date of birth</Label>
                  <Input
                    type="date"
                    value={(p.date_of_birth || "").toString().slice(0, 10)}
                    onChange={(e) => setField("date_of_birth", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Native place</Label>
                  <Input value={p.native_place || ""} onChange={(e) => setField("native_place", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Sampradaya</Label>
                  <Select value={p.sampradaya || ""} onValueChange={(v) => setField("sampradaya", v || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smartha">Smartha</SelectItem>
                      <SelectItem value="madhwa">Madhwa</SelectItem>
                      <SelectItem value="vaishnava">Vaishnava</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <Checkbox
                    checked={!!p.website_publication_consent}
                    onCheckedChange={(v) => setField("website_publication_consent", !!v)}
                  />
                  <Label>Website publication consent</Label>
                </div>
              </>
            ) : (
              <>
                <Field label="Full name">{p.full_name || p.name}</Field>
                <Field label="Father name">{p.father_name}</Field>
                <Field label="Gotra">{p.gotra}</Field>
                <Field label="Date of birth">{p.date_of_birth ? String(p.date_of_birth).slice(0, 10) : null}</Field>
                <Field label="Gender">{p.gender}</Field>
                <Field label="Native place">{p.native_place}</Field>
                <Field label="Sampradaya">{p.sampradaya}</Field>
                <Field label="Website consent">{p.website_publication_consent ? "Yes" : "No"}</Field>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {editing ? (
              <>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input value={p.mobile_number || ""} onChange={(e) => setField("mobile_number", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={p.whatsapp_number || ""} onChange={(e) => setField("whatsapp_number", e.target.value)} />
                </div>
                <Field label="Email">{profile.email}</Field>
                <Field label="Account phone">{profile.phone}</Field>
              </>
            ) : (
              <>
                <Field label="Mobile">{p.mobile_number}</Field>
                <Field label="WhatsApp">{p.whatsapp_number}</Field>
                <Field label="Email">{profile.email}</Field>
                <Field label="Account phone">{profile.phone}</Field>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Address / District / Location</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {editing ? (
              <>
                <div className="md:col-span-2 space-y-2">
                  <Label>Permanent address</Label>
                  <Textarea value={p.permanent_address || ""} onChange={(e) => setField("permanent_address", e.target.value)} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Present address</Label>
                  <Textarea value={p.present_address || ""} onChange={(e) => setField("present_address", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Address line 1</Label>
                  <Input value={p.address_line1 || ""} onChange={(e) => setField("address_line1", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Address line 2</Label>
                  <Input value={p.address_line2 || ""} onChange={(e) => setField("address_line2", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={p.city || ""} onChange={(e) => setField("city", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>District</Label>
                  <Input value={p.district || ""} onChange={(e) => setField("district", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={p.state || ""} onChange={(e) => setField("state", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Pincode</Label>
                  <Input value={p.pincode || ""} onChange={(e) => setField("pincode", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={p.country || ""} onChange={(e) => setField("country", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Location label</Label>
                  <Input value={p.location_label || ""} onChange={(e) => setField("location_label", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input value={p.latitude ?? ""} onChange={(e) => setField("latitude", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input value={p.longitude ?? ""} onChange={(e) => setField("longitude", e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <Field label="Permanent address">{p.permanent_address}</Field>
                <Field label="Present address">{p.present_address}</Field>
                <Field label="Address line 1">{p.address_line1}</Field>
                <Field label="Address line 2">{p.address_line2}</Field>
                <Field label="City">{p.city}</Field>
                <Field label="District">{p.district}</Field>
                <Field label="State">{p.state}</Field>
                <Field label="Pincode">{p.pincode}</Field>
                <Field label="Country">{p.country}</Field>
                <Field label="Location label">{p.location_label}</Field>
                <Field label="Coordinates">
                  {p.latitude != null && p.longitude != null ? `${p.latitude}, ${p.longitude}` : null}
                </Field>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Languages / Experience / Qualifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <div className="max-w-xs space-y-2">
                  <Label>Years of experience</Label>
                  <Input
                    type="number"
                    min={0}
                    max={80}
                    value={p.experience_years ?? ""}
                    onChange={(e) => setField("experience_years", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Qualifications</Label>
                  <div className="flex flex-wrap gap-3">
                    {QUAL_OPTS.map((q) => (
                      <label key={q.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(p.qualifications || []).includes(q.id)}
                          onCheckedChange={(v) => toggleList("qualifications", q.id, !!v)}
                        />
                        {q.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="max-w-xs space-y-2">
                  <Label>Qualification year</Label>
                  <Input
                    type="number"
                    value={p.qualification_year ?? ""}
                    onChange={(e) => setField("qualification_year", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Languages</Label>
                  <div className="flex flex-wrap gap-3">
                    {LANG_OPTS.map((l) => (
                      <label key={l} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(p.languages || []).includes(l)}
                          onCheckedChange={(v) => toggleList("languages", l, !!v)}
                        />
                        {l}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Specializations</Label>
                  <div className="flex flex-wrap gap-3">
                    {SPEC_OPTS.map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(p.specializations || []).includes(s)}
                          onCheckedChange={(v) => toggleList("specializations", s, !!v)}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Experience (years)">{p.experience_years}</Field>
                <Field label="Qualification year">{p.qualification_year}</Field>
                <Field label="Qualifications">{listDisplay(p.qualifications)}</Field>
                <Field label="Languages">{listDisplay(p.languages)}</Field>
                <Field label="Specializations">{listDisplay(p.specializations)}</Field>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Availability</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {editing ? (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox checked={!!p.available} onCheckedChange={(v) => setField("available", !!v)} />
                  <Label>Available for bookings</Label>
                </div>
                <div className="space-y-2">
                  <Label>Service radius (km)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={p.service_radius_km ?? ""}
                    onChange={(e) => setField("service_radius_km", e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <Field label="Available">{p.available ? "Yes" : "No"}</Field>
                <Field label="Service radius (km)">{p.service_radius_km}</Field>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Account status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Role">{profile.role}</Field>
            <Field label="Blocked">{profile.blocked ? "Yes" : "No"}</Field>
            <Field label="Requested level">{profile.requested_level}</Field>
            <Field label="Approved level">{profile.approved_level}</Field>
            <Field label="Verification">{profile.verification_status}</Field>
            <Field label="Onboarding step">{profile.onboarding_step}</Field>
            {(p.bank_holder_name || p.bank_ifsc || p.bank_account_last4) && (
              <>
                <Field label="Bank holder">{p.bank_holder_name}</Field>
                <Field label="IFSC">{p.bank_ifsc}</Field>
                <Field label="Account last4">{p.bank_account_last4}</Field>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Referral</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Referral code">{referralCode}</Field>
          </CardContent>
        </Card>

        {(avg != null || ratingCount != null) && (
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Ratings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Average">{avg != null ? Number(avg).toFixed(1) : null}</Field>
              <Field label="Count">{ratingCount}</Field>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}
            <ul className="space-y-3">
              {documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3">
                  <div>
                    <div className="font-medium text-sm">{DOC_LABELS[d.document_type] || d.document_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.uploaded_by_name || "—"} · {fmtDate(d.uploaded_at)}
                      {d.status ? ` · ${d.status}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void openAdminPujariDocument(id, d.id).catch((e: any) => toast.error(e.message))
                    }
                  >
                    View
                  </Button>
                </li>
              ))}
            </ul>
            <div className="grid gap-4 md:grid-cols-3 pt-2 border-t">
              {(["certificate", "identity", "supporting"] as const).map((typ) => (
                <div key={typ} className="space-y-2">
                  <Label>Upload {DOC_LABELS[typ]}</Label>
                  <Input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    disabled={!!uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      void uploadDoc(typ, f);
                    }}
                  />
                  {uploading === typ && <p className="text-xs text-muted-foreground">Uploading…</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Final Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge>{profile.verification_status}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Approved level</Label>
                <Select value={String(verifyLevel)} onValueChange={(v) => setVerifyLevel(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.level} value={String(l.level)}>
                        Level {l.level} — {l.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Rejection / correction reason</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Required when rejecting or requesting correction"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={verifying} onClick={() => void verify("approved")}>
                Approve
              </Button>
              <Button disabled={verifying} variant="destructive" onClick={() => void verify("rejected")}>
                Reject
              </Button>
              <Button disabled={verifying} variant="secondary" onClick={() => void verify("correction_required")}>
                Request Correction
              </Button>
              <Button disabled={verifying} variant="outline" onClick={() => void verify("under_review")}>
                Mark Under Review
              </Button>
            </div>
            <div className="pt-4 border-t space-y-2">
              <h3 className="font-heading text-sm font-semibold">Verification history</h3>
              {history.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
              <ul className="space-y-2">
                {history.map((h, i) => (
                  <li key={`${h.created_at}-${i}`} className="text-sm border rounded-md p-2">
                    <div className="font-medium">{h.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.actor_name || "System"} · {fmtDate(h.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
