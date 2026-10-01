import { useLocation } from "wouter";
import { useI18n } from "@/i18n/I18nProvider";

/** Footer copyright line. The app version is appended on the About page only. */
export default function FooterRights() {
  const { t } = useI18n();
  const [location] = useLocation();
  const showVersion = location === "/about" || location.startsWith("/about/");

  return (
    <>
      {t("footer.rights")}
      {showVersion ? (
        <span data-testid="app-version">
          {" · "}
          {t("about.version", { version: __APP_VERSION__ })}
        </span>
      ) : null}
    </>
  );
}
