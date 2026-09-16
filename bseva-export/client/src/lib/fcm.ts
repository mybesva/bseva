import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from "firebase/messaging";
import { api } from "@/lib/api";
import { adminPath } from "@/const";

const FCM_TOKEN_KEY = "bseva_fcm_token";

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

export function firebaseWebConfig(): FirebaseWebConfig {
  return {
    apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || ""),
    authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || ""),
    projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || ""),
    storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || ""),
    messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ""),
    appId: String(import.meta.env.VITE_FIREBASE_APP_ID || ""),
  };
}

export function vapidKey(): string {
  return String(import.meta.env.VITE_FIREBASE_VAPID_KEY || "");
}

export function fcmConfigured(): boolean {
  const c = firebaseWebConfig();
  return Boolean(c.apiKey && c.projectId && c.appId && c.messagingSenderId && vapidKey());
}

export function resolveNotificationPath(link?: string | null): string {
  const raw = (link || "/").trim() || "/";
  const path = raw.startsWith("http://") || raw.startsWith("https://")
    ? new URL(raw).pathname + new URL(raw).search
    : raw.startsWith("/")
      ? raw
      : `/${raw}`;
  if (path === "/admin" || path.startsWith("/admin/")) {
    const rest = path.slice("/admin".length) || "/";
    return adminPath(rest === "/" ? "" : rest);
  }
  return path;
}

async function messagingOrNull(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (!fcmConfigured()) return null;
  if (!(await isSupported())) return null;
  const cfg = firebaseWebConfig();
  const app = getApps()[0] || initializeApp(cfg);
  return getMessaging(app);
}

export async function registerFcmToken(): Promise<string | null> {
  try {
    if (!fcmConfigured() || !("Notification" in window) || !("serviceWorker" in navigator)) {
      return null;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const messaging = await messagingOrNull();
    if (!messaging) return null;
    const token = await getToken(messaging, {
      vapidKey: vapidKey(),
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;
    localStorage.setItem(FCM_TOKEN_KEY, token);
    await api("/notifications/fcm/token", {
      method: "POST",
      body: JSON.stringify({ token, platform: "web" }),
    });
    return token;
  } catch (err) {
    console.warn("FCM token registration skipped", err);
    return null;
  }
}

export async function unregisterFcmToken(): Promise<void> {
  const token = localStorage.getItem(FCM_TOKEN_KEY);
  if (!token) return;
  try {
    await api("/notifications/fcm/token/remove", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  } catch {
    /* logout must still proceed */
  }
  localStorage.removeItem(FCM_TOKEN_KEY);
}

export function listenForegroundNotifications(onOpen: (path: string) => void): () => void {
  let unsub: (() => void) | undefined;
  let cancelled = false;
  void (async () => {
    const messaging = await messagingOrNull();
    if (!messaging || cancelled) return;
    const { toast } = await import("sonner");
    unsub = onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || "BSeva";
      const body = payload.notification?.body || payload.data?.body || "";
      const path = resolveNotificationPath(payload.data?.link);
      toast(title, {
        description: body,
        action: {
          label: "Open",
          onClick: () => onOpen(path),
        },
      });
    });
  })();
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export function listenServiceWorkerClicks(onOpen: (path: string) => void): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => undefined;
  }
  const handler = (event: MessageEvent) => {
    const data = event.data;
    if (data?.type === "BSEVA_NOTIFICATION_CLICK" && data.link) {
      onOpen(resolveNotificationPath(String(data.link)));
    }
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}

export async function sendTestPush() {
  return api<{ ok: boolean; success: number; failure: number; link: string }>("/notifications/fcm/test", {
    method: "POST",
  });
}
