import { useEffect } from "react";
import { useLocation } from "wouter";

export default function RedirectTo({ to, replace = false }: { to: string; replace?: boolean }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to, { replace });
  }, [setLocation, to, replace]);
  return null;
}
