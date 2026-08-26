import { CustomerPortal } from "@/components/RolePortals";
import ChangePasswordForm from "@/pages/ChangePassword";

export default function CustomerChangePasswordPage() {
  return (
    <CustomerPortal>
      <ChangePasswordForm />
    </CustomerPortal>
  );
}
