import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link, useLocation } from "wouter";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveNotificationPath } from "@/lib/fcm";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function notifyBadgesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("bseva-notifications-changed"));
  }
}

type Note = {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  is_read?: boolean;
  created_at?: string;
};

export default function NotificationBell({ inboxHref }: { inboxHref: string }) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const [, setLocation] = useLocation();

  const refresh = useCallback(async () => {
    try {
      const count = await api<{ unread: number }>("/notifications/unread-count");
      setUnread(count.unread || 0);
    } catch {
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30000);
    const onChange = () => void refresh();
    window.addEventListener("bseva-notifications-changed", onChange);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("bseva-notifications-changed", onChange);
    };
  }, [refresh]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    try {
      const list = await api<{ items: Note[] }>("/notifications?page=1&page_size=8&unread_only=true");
      setItems(list.items || []);
    } catch {
      setItems([]);
    }
  }

  async function openItem(n: Note) {
    try {
      if (!n.is_read) await api(`/notifications/${n.id}/read`, { method: "POST" });
    } catch {
      /* ignore */
    }
    setOpen(false);
    setUnread((u) => Math.max(0, u - 1));
    notifyBadgesChanged();
    setLocation(resolveNotificationPath(n.link || inboxHref));
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative shrink-0"
        aria-label="Notifications"
        onClick={() => void toggle()}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40" aria-label="Close notifications" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] z-50 rounded-lg border bg-background shadow-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <p className="text-sm font-semibold">Notifications</p>
              <Link href={inboxHref}>
                <a className="text-xs text-primary" onClick={() => setOpen(false)}>
                  View all
                </a>
              </Link>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No unread notifications.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={cn("w-full text-left px-3 py-2 border-b last:border-0 hover:bg-muted/60")}
                    onClick={() => void openItem(n)}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {n.created_at ? formatDisplayDateTime(n.created_at) : ""}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function CountBadge({ count, tooltip }: { count?: number; tooltip?: string }) {
  if (!count || count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  const badge = (
    <span
      className="ml-auto shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-white text-[10px] font-semibold flex items-center justify-center cursor-help"
      aria-label={tooltip || `${label} requiring action`}
      tabIndex={0}
    >
      {label}
    </span>
  );
  if (!tooltip) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs whitespace-pre-line text-left font-normal">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
