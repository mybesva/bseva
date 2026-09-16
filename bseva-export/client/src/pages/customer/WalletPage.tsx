import { CustomerPortal } from "@/components/RolePortals";
import WalletPanel from "@/components/WalletPanel";
import { useI18n } from "@/i18n/I18nProvider";

export default function CustomerWalletPage() {
  const { t } = useI18n();
  return (
    <CustomerPortal>
      <div className="max-w-xl">
        <h1 className="text-h1 mb-6">{t("customer.walletPayments")}</h1>
        <WalletPanel variant="customer" />
      </div>
    </CustomerPortal>
  );
}
