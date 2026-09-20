import { useEffect, useState } from "react";
import { CustomerPortal, PujariPortal } from "@/components/RolePortals";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { resolveNotificationPath } from "@/lib/fcm";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { notifyBadgesChanged } from "@/components/NotificationBell";
import { useI18n } from "@/i18n/I18nProvider";

type Note = {
  id: string;
  title: string;
  body: string;
  category?: string;
  is_read?: boolean;
  link?: string | null;
  created_at?: string;
};

function InboxList() {
  const [items, setItems] = useState<Note[]>([]);
  const [counts, setCounts] = useState({ total: 0, read: 0, unread: 0 });
  const [, setLocation] = useLocation();
  const { t } = useI18n();

  async function load() {
    const [list, count] = await Promise.all([
      api<{ items: Note[]; total?: number }>("/notifications?page=1&page_size=50"),
      api<{ unread: number; read?: number; total?: number }>("/notifications/unread-count"),
    ]);
    const next = list.items || [];
    setItems(next);
    const unread = count.unread || 0;
    const total = count.total ?? list.total ?? next.length;
    const read = count.read ?? Math.max(0, total - unread);
    setCounts({ total, read, unread });
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  async function open(n: Note) {
    if (!n.is_read) await api(`/notifications/${n.id}/read`, { method: "POST" });
    notifyBadgesChanged();
    setLocation(resolveNotificationPath(n.link || "/"));
  }

  async function markAll() {
    await api("/notifications/read-all", { method: "POST" });
    toast.success(t("notifications.markAllRead"));
    notifyBadgesChanged();
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-h1">{t("notifications.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.total} total · {counts.read} read · {counts.unread} unread
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void markAll()}>
          {t("notifications.markAllRead")}
        </Button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>}
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`w-full text-left rounded-lg border p-4 ${n.is_read ? "bg-background" : "bg-primary/5 border-primary/30"}`}
            onClick={() => void open(n)}
          >
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{n.title}</h3>
              <Badge variant="secondary">{n.category || "system"}</Badge>
              {!n.is_read && <Badge>{t("notifications.unread")}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {n.created_at ? formatDisplayDateTime(n.created_at) : ""}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CustomerNotificationsPage() {
  return (
    <CustomerPortal>
      <InboxList />
    </CustomerPortal>
  );
}

export function PujariNotificationsPage() {
  return (
    <PujariPortal>
      <InboxList />
    </PujariPortal>
  );
}
