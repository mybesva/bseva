import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";

export default function PujariOverflowMenu() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    if (user?.role !== "pujari") return;
    api<any>("/pujari/profile")
      .then((p) => setPct(Number(p.profile_completion_percentage || 0)))
      .catch(() => setPct(null));
  }, [user?.role]);
  if (user?.role !== "pujari") return null;
  const incomplete = pct !== null && pct < 100;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Pujari menu">
          <MoreVertical size={20} />
          {incomplete && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/pujari/profile">
            <a className="flex w-full items-center justify-between">
              {t("pujari.menu.profile")}
              {incomplete && <span className="h-2 w-2 rounded-full bg-primary" />}
            </a>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/pujari/profile#level">
            <a className="w-full">{t("pujari.menu.level")}</a>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/pujari/documents">
            <a className="w-full">{t("pujari.menu.documents")}</a>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/pujari/angikara">
            <a className="w-full">{t("pujari.menu.angikara")}</a>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
