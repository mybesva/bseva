import BSevaLogo from "@/components/BSevaLogo";
import { BSEVA_FOOTER_LOCKUP, BSEVA_WEBSITE, contactLine } from "@/lib/bsevaDocument";
import { usePublicConfig, whatsappDisplay } from "@/hooks/usePublicConfig";

/**
 * Official BSeva print chrome (header, watermark, footer).
 * Hidden on screen; repeats on every printed page via CSS.
 */
export default function BSevaDocument({
  documentTitle,
  reference,
}: {
  documentTitle: string;
  reference?: string | null;
}) {
  const { config } = usePublicConfig();
  const company = {
    legalName: "BSeva",
    email: config.email_from_support,
    phone: whatsappDisplay(config.bseva_whatsapp_number),
    website: BSEVA_WEBSITE,
  };

  return (
    <>
      <div className="bseva-doc-watermark" aria-hidden="true">
        <img src="/bseva-logo-transparent.png" alt="" />
      </div>
      <header className="bseva-doc-header bseva-print-header">
        <div>
          <BSevaLogo variant="full" size="lg" />
        </div>
        <div className="bseva-doc-title">
          <h1>{documentTitle}</h1>
          {reference ? <p className="bseva-doc-ref">{reference}</p> : null}
        </div>
      </header>
      <footer className="bseva-doc-footer">
        <div>
          <strong>{BSEVA_FOOTER_LOCKUP}</strong>
          <p>{contactLine(company)}</p>
        </div>
      </footer>
    </>
  );
}
