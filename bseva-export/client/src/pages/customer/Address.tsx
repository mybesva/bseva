import { useEffect } from "react";
import { useLocation } from "wouter";

/** Legacy route — address lives under Profile; keep deep links working. */
export default function CustomerAddressPage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/customer/profile?tab=address");
  }, [setLocation]);
  return null;
}
