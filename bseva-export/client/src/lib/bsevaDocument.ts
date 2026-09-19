/**
 * Official BSeva document chrome for print, HTML downloads, and popups.
 * Backend PDFs/HTML use backend/app/document_brand.py with the same visual rules.
 * Do not duplicate logo / watermark / header / footer markup in individual documents.
 */
export const BSEVA_BRAND = "BSeva";
export const BSEVA_MOTTO = "Book, Believe, Bless";
export const BSEVA_FOOTER_LOCKUP = "BSeva — Book, Believe, Bless";
export const BSEVA_NAVY = "#1A2B4A";
export const BSEVA_ORANGE = "#FF9933";
export const BSEVA_LOGO_SRC = "/bseva-logo-transparent.png";
export const BSEVA_EMAIL = "support@b-seva.com";
export const BSEVA_WEBSITE = "www.b-seva.com";
const WATERMARK_OPACITY = 0.07;

export type BSevaDocumentCompany = {
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoSrc?: string;
};

export type BSevaDocumentOptions = {
  documentTitle: string;
  pageTitle?: string;
  reference?: string | null;
  bodyHtml: string;
  extraCss?: string;
  company?: BSevaDocumentCompany;
};

export function escapeDocumentHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] || char));
}

export function contactLine(company?: BSevaDocumentCompany) {
  const parts = [
    company?.legalName || BSEVA_BRAND,
    company?.email || BSEVA_EMAIL,
    company?.phone,
    company?.website || BSEVA_WEBSITE,
  ].filter(Boolean);
  return parts.join("  ·  ");
}

function logoSrc(company?: BSevaDocumentCompany) {
  const src = company?.logoSrc || BSEVA_LOGO_SRC;
  const resolved = src.endsWith("bseva-mark.png") ? BSEVA_LOGO_SRC : src;
  if (typeof window !== "undefined" && resolved.startsWith("/")) {
    return new URL(resolved, window.location.origin).href;
  }
  return resolved;
}

export function documentChromeCss() {
  return `
@page { size: A4; margin: 0; }
@page {
  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font: 9px 'Segoe UI', Helvetica, Arial, sans-serif;
    color: ${BSEVA_NAVY};
  }
}
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: ${BSEVA_NAVY};
  font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
}
body { padding: 28mm 14mm 20mm 14mm; }
.bseva-doc-watermark {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.bseva-doc-watermark img { width: min(58%, 420px); opacity: ${WATERMARK_OPACITY}; }
.bseva-doc-header {
  position: fixed;
  top: 8mm;
  left: 14mm;
  right: 14mm;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding-bottom: 8px;
  border-bottom: 3px solid ${BSEVA_ORANGE};
  background: #fff;
}
.bseva-doc-logo { display: block; height: 58px; width: auto; max-width: 200px; object-fit: contain; }
.bseva-doc-title { text-align: right; }
.bseva-doc-title h1 {
  margin: 0;
  font-size: 16px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: ${BSEVA_NAVY};
}
.bseva-doc-ref {
  margin: 6px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #334155;
}
.bseva-doc-body { position: relative; z-index: 1; }
.bseva-doc-footer {
  position: fixed;
  left: 14mm;
  right: 14mm;
  bottom: 8mm;
  z-index: 2;
  padding-top: 8px;
  border-top: 2px solid ${BSEVA_ORANGE};
  background: #fff;
  font-size: 10px;
  color: ${BSEVA_NAVY};
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.bseva-doc-footer p { margin: 2px 0 0; color: #334155; }
.bseva-doc-fields { width: 100%; border-collapse: collapse; }
.bseva-doc-fields th, .bseva-doc-fields td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px 0;
  text-align: left;
  vertical-align: top;
}
.bseva-doc-fields th { width: 34%; color: #64748b; font-weight: 600; font-size: 12px; }
pre.bseva-doc-pre { font: 14px/1.65 'Segoe UI', Helvetica, Arial, sans-serif; white-space: pre-wrap; margin: 0; }
@media print { .noprint { display: none !important; } }
`.trim();
}

export function wrapBSevaDocumentHtml(options: BSevaDocumentOptions) {
  const company = options.company || {};
  const src = escapeDocumentHtml(logoSrc(company));
  const title = escapeDocumentHtml(options.pageTitle || options.documentTitle || BSEVA_BRAND);
  const documentTitle = escapeDocumentHtml(options.documentTitle || BSEVA_BRAND);
  const reference = options.reference ? escapeDocumentHtml(String(options.reference)) : "";
  const brand = escapeDocumentHtml(company.legalName || BSEVA_BRAND);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>${title}</title>
<style>
${documentChromeCss()}
${options.extraCss || ""}
</style></head><body>
<div class="bseva-doc-watermark" aria-hidden="true"><img src="${src}" alt=""/></div>
<header class="bseva-doc-header">
  <div>
    <img class="bseva-doc-logo" src="${src}" alt="${brand}"/>
  </div>
  <div class="bseva-doc-title">
    <h1>${documentTitle}</h1>
    ${reference ? `<p class="bseva-doc-ref">${reference}</p>` : ""}
  </div>
</header>
<div class="bseva-doc-body">${options.bodyHtml}</div>
<footer class="bseva-doc-footer">
  <div>
    <strong>${escapeDocumentHtml(BSEVA_FOOTER_LOCKUP)}</strong>
    <p>${escapeDocumentHtml(contactLine(company))}</p>
  </div>
</footer>
</body></html>`;
}

export function fieldsToDocumentBody(rows: Array<[string, string]>) {
  const cells = rows
    .filter(([, value]) => Boolean(value))
    .map(
      ([label, value]) =>
        `<tr><th>${escapeDocumentHtml(label)}</th><td>${escapeDocumentHtml(value)}</td></tr>`,
    )
    .join("");
  return `<table class="bseva-doc-fields">${cells}</table>`;
}

function triggerDownload(filename: string, html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadBSevaDocument(filename: string, options: BSevaDocumentOptions) {
  triggerDownload(filename, wrapBSevaDocumentHtml(options));
}

export function printBSevaDocument(options: BSevaDocumentOptions, popupBlockedMessage?: string) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error(popupBlockedMessage || "Please allow pop-ups to print this document.");
  popup.document.write(wrapBSevaDocumentHtml(options));
  popup.document.close();
  popup.addEventListener(
    "load",
    () => {
      popup.focus();
      popup.print();
    },
    { once: true },
  );
}
