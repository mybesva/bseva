import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthContext } from "@/lib/AuthContext";
import {
  listenForegroundNotifications,
  listenServiceWorkerClicks,
  registerFcmToken,
  resolveNotificationPath,
} from "@/lib/fcm";

export default function FcmBootstrap() {
  const { isAuthenticated, user } = useAuthContext();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    void registerFcmToken();
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const open = (path: string) => setLocation(resolveNotificationPath(path));
    const stopFg = listenForegroundNotifications(open);
    const stopSw = listenServiceWorkerClicks(open);
    return () => {
      stopFg();
      stopSw();
    };
  }, [isAuthenticated, setLocation]);

  return null;
}
