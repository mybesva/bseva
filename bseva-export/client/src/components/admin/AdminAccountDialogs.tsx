import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = "At least 8 characters",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          {show ? <EyeOff size="1rem" /> : <Eye size="1rem" />}
        </button>
      </div>
    </div>
  );
}

export function AddAdminDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: "", email: "", phone: "", password: "" });
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      const res = await api<{ id: string }>("/admin/admins", { method: "POST", body: JSON.stringify(form) });
      toast.success("Admin account created. Choose their permissions next.");
      onOpenChange(false);
      onCreated(res.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const ready = form.name.trim().length >= 2 && form.email.trim() && form.phone.trim().length >= 10 && form.password.length >= 8;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add admin</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="admin-name">Full name</Label>
            <Input id="admin-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="admin-phone">Mobile number</Label>
            <Input
              id="admin-phone"
              inputMode="tel"
              maxLength={15}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <PasswordField
            id="admin-password"
            label="Password"
            value={form.password}
            onChange={(password) => setForm({ ...form, password })}
          />
          <p className="text-xs text-muted-foreground">New admins start with no permissions. Choose them after creating the account.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving || !ready} onClick={() => void save()}>
            {saving ? "Creating…" : "Create admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminPasswordDialog({
  admin,
  onClose,
}: {
  admin: { id: string; name: string | null; email: string | null } | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;

  useEffect(() => {
    setPassword("");
    setConfirm("");
  }, [admin?.id]);

  async function save() {
    if (!admin) return;
    setSaving(true);
    try {
      await api(`/admin/admins/${admin.id}/password`, { method: "PUT", body: JSON.stringify({ new_password: password }) });
      toast.success("Password changed");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!admin} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          For {admin?.name || admin?.email}. They will be signed out everywhere and must use the new password.
        </p>
        <PasswordField id="admin-new-password" label="New password" value={password} onChange={setPassword} />
        <div className="space-y-1">
          <PasswordField id="admin-confirm-password" label="Confirm new password" placeholder="Type it again" value={confirm} onChange={setConfirm} />
          {mismatch && (
            <p className="text-xs font-medium text-destructive" role="alert">
              Passwords do not match
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || password.length < 8 || confirm !== password} onClick={() => void save()}>
            {saving ? "Saving…" : "Change password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
