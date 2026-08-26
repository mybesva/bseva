import { useEffect, useState } from "react";
import { CustomerPortal } from "@/components/RolePortals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, apiBase, getToken } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function CustomerProfilePage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadPhoto() {
    const token = getToken();
    if (!token) {
      setPhotoUrl(null);
      return;
    }
    const res = await fetch(`${apiBase()}/api/v1/customer/profile/photo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setPhotoUrl(null);
      return;
    }
    const blob = await res.blob();
    setPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  }

  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  useEffect(() => {
    void loadPhoto().catch(() => setPhotoUrl(null));
    return () => {
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/auth/me", { method: "PATCH", body: JSON.stringify({ name }) });
      await refresh();
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function onPhoto(file: File) {
    setUploading(true);
    try {
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${apiBase()}/api/v1/customer/profile/photo`, {
        method: "POST",
        headers,
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { detail?: string }).detail || "Upload failed");
      toast.success("Photo updated");
      await loadPhoto();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <CustomerPortal>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="font-heading">My Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={save}>
            <div className="space-y-2">
              <Label>Profile photo</Label>
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-28 w-28 rounded-md object-cover border" />
              ) : (
                <p className="text-sm text-muted-foreground">No photo uploaded yet.</p>
              )}
              <label className="inline-block">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void onPhoto(f);
                  }}
                />
                <Button type="button" size="sm" variant="outline" disabled={uploading} asChild>
                  <span>{uploading ? "Uploading…" : photoUrl ? "Replace photo" : "Upload photo"}</span>
                </Button>
              </label>
            </div>
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Email: {user?.email || "—"}</p>
              <p>Phone: {user?.phone || "—"}</p>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </CustomerPortal>
  );
}
