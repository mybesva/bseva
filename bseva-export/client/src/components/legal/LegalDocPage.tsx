import { Link, useLocation } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { goBackOr } from "@/lib/browserActions";
// provided by legal content branch (bseva-export/client/src/content/legal)
import { legalDocs } from "@/content/legal";

/** Mirrors `LegalDoc` in packages/config/src/legal/types.ts (see docs/compliance/api-contract.md). */
export type LegalDoc = {
  slug: string;
  title: string;
  version: string;
  effectiveDate: string;
  intro?: string[];
  sections: { id: string; heading: string; paragraphs?: string[]; bullets?: string[]; table?: string[][] }[];
};

export type LegalSlug = "customer-terms" | "pujari-terms" | "app-terms" | "privacy-policy" | "refund-policy";

/** Public URL of each legal document. */
export const LEGAL_PATHS: Record<LegalSlug, string> = {
  "customer-terms": "/customer-terms",
  "pujari-terms": "/pujari-terms",
  "app-terms": "/app-terms",
  "privacy-policy": "/privacy-policy",
  "refund-policy": "/refund-policy",
};

/** Accepts either a slug-keyed record or an array of docs, whichever the content module exports. */
export function findLegalDoc(slug: string): LegalDoc | undefined {
  const source = legalDocs as unknown as Record<string, LegalDoc> | LegalDoc[] | undefined;
  if (!source) return undefined;
  if (Array.isArray(source)) return source.find((d) => d?.slug === slug);
  return source[slug] || Object.values(source).find((d) => d?.slug === slug);
}

function sectionAnchor(id: string) {
  return `legal-${id}`;
}

export function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <article className="legal-doc">
      <header className="mb-6">
        <h1 className="text-h1 mb-2">{doc.title}</h1>
        <p className="text-sm text-muted-foreground">
          Version {doc.version || "—"} · Effective {doc.effectiveDate || "—"}
        </p>
      </header>


      {doc.sections.length > 1 ? (
        <nav aria-label="Contents" className="mb-8 rounded-lg border border-border bg-card px-4 py-3 print:hidden">
          <p className="mb-2 text-sm font-semibold text-foreground">Contents</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${sectionAnchor(s.id)}`} className="text-primary hover:underline">
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {doc.intro?.length ? (
        <div className="mb-8 space-y-3 leading-relaxed text-muted-foreground print:text-black">
          {doc.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}

      <div className="space-y-8 leading-relaxed text-muted-foreground print:text-black">
        {doc.sections.map((s, idx) => (
          <section key={s.id} id={sectionAnchor(s.id)} className="scroll-mt-24 break-inside-avoid-page">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              {idx + 1}. {s.heading}
            </h2>
            {s.paragraphs?.map((p, i) => (
              <p key={i} className="mb-3">
                {p}
              </p>
            ))}
            {s.bullets?.length ? (
              <ul className="mb-3 list-disc space-y-1 pl-6">
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : null}
            {s.table?.length ? (
              <div className="mb-3 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {s.table[0].map((cell, i) => (
                        <th key={i} className="border border-border bg-muted/50 px-3 py-2 text-left font-semibold text-foreground">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.slice(1).map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c} className="border border-border px-3 py-2 align-top">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}

export default function LegalDocPage({ slug }: { slug: LegalSlug }) {
  const [, setLocation] = useLocation();
  const doc = findLegalDoc(slug);

  return (
    <Layout>
      <div className="container max-w-3xl py-12 print:max-w-none print:py-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => goBackOr("/", setLocation)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {doc ? (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          ) : null}
        </div>

        {doc ? (
          <LegalDocView doc={doc} />
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            This document is not available right now. Please try again later or{" "}
            <Link href="/contact" className="text-primary underline">
              contact us
            </Link>
            .
          </div>
        )}

        <nav aria-label="Legal documents" className="mt-12 border-t border-border pt-6 text-sm print:hidden">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li><Link href={LEGAL_PATHS["customer-terms"]} className="text-primary hover:underline">Customer Terms</Link></li>
            <li><Link href={LEGAL_PATHS["pujari-terms"]} className="text-primary hover:underline">Pujari Terms</Link></li>
            <li><Link href={LEGAL_PATHS["app-terms"]} className="text-primary hover:underline">App Terms of Use</Link></li>
            <li><Link href={LEGAL_PATHS["privacy-policy"]} className="text-primary hover:underline">Privacy Policy</Link></li>
            <li><Link href={LEGAL_PATHS["refund-policy"]} className="text-primary hover:underline">Cancellation &amp; Refund Policy</Link></li>
            <li><Link href="/delete-account" className="text-primary hover:underline">Delete Account</Link></li>
          </ul>
        </nav>
        <p className="mt-6 text-xs text-muted-foreground">© B-Seva Private Limited. All rights reserved.</p>
      </div>
    </Layout>
  );
}
