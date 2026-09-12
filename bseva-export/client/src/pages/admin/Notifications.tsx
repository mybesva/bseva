import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Notification = {
  id: string;
  title: string;
  body: string;
  category?: string;
  is_read?: boolean;
  link?: string | null;
  created_at?: string;
};

export default function AdminNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [unread, setUnread] = useState(0);
  const [category, setCategory] = useState("all");

  async function load(p = 1) {
    const qs = new URLSearchParams({ page: String(p), page_size: "30" });
    if (category !== "all") qs.set("category", category);
    const [list, count] = await Promise.all([
      api<{ items: Notification[]; pages: number; page: number }>(`/notifications?${qs}`),
      api<{ unread: number }>("/notifications/unread-count"),
    ]);
    setItems(list.items || []);
    setPages(list.pages || 1);
    setPage(list.page || p);
    setUnread(count.unread || 0);
  }

  useEffect(() => {
    void load(1).catch((e) => toast.error(e.message));
  }, [category]);

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: "POST" });
    await load(page);
  }

  async function markAll() {
    await api("/notifications/read-all", { method: "POST" });
    toast.success("All marked read");
    await load(page);
  }

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-h1">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unread} unread</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="h-9 border rounded-md px-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All</option>
            <option value="ops">Ops</option>
            <option value="booking">Booking</option>
            <option value="booking_reminder">Reminders</option>
            <option value="kyc">KYC</option>
            <option value="support">Support</option>
            <option value="system">System</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => void markAll()}>
            Mark all read
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
        {items.map((n) => (
          <div
            key={n.id}
            className={`rounded-lg border p-4 ${n.is_read ? "bg-background" : "bg-primary/5 border-primary/30"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{n.title}</h3>
                  <Badge variant="secondary">{n.category || "system"}</Badge>
                  {!n.is_read && <Badge>Unread</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  {n.link ? ` · ${n.link}` : ""}
                </p>
              </div>
              {!n.is_read && (
                <Button size="sm" variant="outline" onClick={() => void markRead(n.id)}>
                  Mark read
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => void load(page - 1)}>
          Prev
        </Button>
        <span className="text-sm text-muted-foreground self-center">
          Page {page}/{pages}
        </span>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => void load(page + 1)}>
          Next
        </Button>
      </div>
    </AdminLayout>
  );
}
