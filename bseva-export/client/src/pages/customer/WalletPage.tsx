import { CustomerPortal } from "@/components/RolePortals";
import WalletPanel from "@/components/WalletPanel";

export default function CustomerWalletPage() {
  return (
    <CustomerPortal>
      <div className="max-w-xl">
        <h1 className="text-h1 mb-6">Wallet / Payments</h1>
        <WalletPanel variant="customer" />
      </div>
    </CustomerPortal>
  );
}
