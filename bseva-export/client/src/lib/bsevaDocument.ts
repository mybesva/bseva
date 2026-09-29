/**
 * Official BSeva document chrome for print, HTML downloads, and popups.
 * Backend PDFs/HTML use backend/app/document_brand.py with the same visual rules.
 */
export const BSEVA_BRAND = "BSeva";
export const BSEVA_MOTTO = "Book, Believe, Bless";
export const BSEVA_FOOTER_LOCKUP = "BSeva — Book, Believe, Bless";
export const BSEVA_NAVY = "#1A2B4A";
export const BSEVA_ORANGE = "#FF7A00";
export const BSEVA_LOGO_SRC = "/bseva-logo-transparent.png";
export const BSEVA_EMAIL = "support@b-seva.com";
export const BSEVA_WEBSITE = "www.b-seva.com";
const WATERMARK_OPACITY = 0.07;
const DOC_PAGE_WIDTH_MM = 210;

export type BSevaDocumentCompany = {
  legalName?: string;
  brandName?: string;
  address?: string;
  state?: string;
  pincode?: string;
  email?: string;
  phone?: string;
  website?: string;
  gstin?: string;
  logoSrc?: string;
};

export type BSevaDocumentOptions = {
  documentTitle: string;
  pageTitle?: string;
  reference?: string | null;
  bodyHtml: string;
  toolbarHtml?: string;
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

export function documentBodyCss() {
  return `
.bseva-doc-page {
  width: ${DOC_PAGE_WIDTH_MM}mm;
  min-width: ${DOC_PAGE_WIDTH_MM}mm;
  max-width: ${DOC_PAGE_WIDTH_MM}mm;
  margin: 0 auto;
  padding: 20px 24px;
  background: #fff;
  box-sizing: border-box;
}
@media screen {
  .bseva-doc-page { box-shadow: 0 2px 16px rgba(26, 43, 74, .08); }
}
.bseva-doc-header-block {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding-bottom: 12px;
  border-bottom: 3px solid ${BSEVA_ORANGE};
  margin-bottom: 16px;
}
.bseva-doc-header-left { flex: 1 1 58%; min-width: 0; }
.bseva-doc-header-right { flex: 0 0 auto; text-align: right; min-width: 170px; max-width: 42%; }
.bseva-doc-brand-row { display: flex; align-items: flex-start; gap: 10px; }
.bseva-doc-logo { display: block; height: 50px; width: auto; max-width: 150px; object-fit: contain; flex-shrink: 0; }
.bseva-doc-brand-name { font-size: 18px; font-weight: 700; color: ${BSEVA_NAVY}; letter-spacing: .05em; line-height: 1.2; }
.bseva-doc-motto { font-size: 9px; color: ${BSEVA_ORANGE}; letter-spacing: .08em; margin-top: 2px; text-transform: uppercase; }
.bseva-doc-company { margin-top: 8px; font-size: 9.5px; line-height: 1.55; color: #334155; word-wrap: break-word; overflow-wrap: anywhere; }
.bseva-doc-doc-title { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${BSEVA_NAVY}; }
.bseva-doc-meta { margin-top: 8px; font-size: 9.5px; line-height: 1.65; color: #334155; }
.bseva-doc-meta div { margin: 1px 0; }
.bseva-doc-meta strong { color: ${BSEVA_NAVY}; font-weight: 600; }
.bseva-doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0; }
.bseva-doc-box { border: 1px solid #d7dde8; border-radius: 4px; padding: 10px 12px; min-width: 0; background: #f8fafc; }
.bseva-doc-toolbar { max-width: ${DOC_PAGE_WIDTH_MM}mm; margin: 0 auto 10px; padding: 0 4px; }
.bseva-doc-toolbar button { background: ${BSEVA_NAVY}; color: #fff; border: none; border-radius: 6px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
.bseva-doc-box h3 { margin: 0 0 8px; font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; color: ${BSEVA_ORANGE}; font-weight: 700; }
.bseva-doc-box p { margin: 0; font-size: 9.5px; line-height: 1.55; color: #334155; word-wrap: break-word; overflow-wrap: anywhere; }
.bseva-doc-fields { width: 100%; border-collapse: collapse; }
.bseva-doc-fields th, .bseva-doc-fields td { border-bottom: 1px solid #e2e8f0; padding: 8px 0; text-align: left; vertical-align: top; font-size: 9.5px; }
.bseva-doc-fields th { width: 34%; color: #64748b; font-weight: 600; }
.bseva-doc-footer-block { margin-top: 20px; padding-top: 10px; border-top: 2px solid ${BSEVA_ORANGE}; font-size: 9.5px; color: #334155; line-height: 1.55; }
.bseva-doc-footer-block strong { color: ${BSEVA_NAVY}; }
.bseva-doc-footer-block p { margin: 3px 0; }
pre.bseva-doc-pre { font: 14px/1.65 'Segoe UI', Helvetica, Arial, sans-serif; white-space: pre-wrap; margin: 0; }
@media print {
  .noprint { display: none !important; }
  html, body { background: #fff !important; }
  .bseva-doc-viewport { padding: 0 !important; background: #fff !important; overflow: visible !important; }
  .bseva-doc-page { width: auto !important; min-width: 0 !important; max-width: none !important; box-shadow: none !important; margin: 0 !important; }
}
`.trim();
}

export function documentChromeCss() {
  return `
@page { size: A4; margin: 14mm; }
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
  background: #eef2f7;
  color: ${BSEVA_NAVY};
  font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
}
.bseva-doc-viewport {
  min-height: 100vh;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px;
}
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
.bseva-doc-body { position: relative; z-index: 1; }
${documentBodyCss()}
`.trim();
}

export function renderMetaRowsHtml(rows: Array<[string, string]>) {
  return rows
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `<div><strong>${escapeDocumentHtml(label)}:</strong> ${escapeDocumentHtml(value)}</div>`)
    .join("");
}

export function renderDocumentHeader(
  documentTitle: string,
  metaRows: Array<[string, string]>,
  company?: BSevaDocumentCompany,
) {
  const src = escapeDocumentHtml(logoSrc(company));
  const brand = escapeDocumentHtml(company?.brandName || BSEVA_BRAND);
  const legal = escapeDocumentHtml(company?.legalName || BSEVA_BRAND);
  const address = escapeDocumentHtml(company?.address || "");
  const location = [company?.state, company?.pincode].filter(Boolean).join(", ");
  const email = escapeDocumentHtml(company?.email || BSEVA_EMAIL);
  const phone = company?.phone ? escapeDocumentHtml(company.phone) : "";
  const website = escapeDocumentHtml(company?.website || BSEVA_WEBSITE);
  const gstin = company?.gstin ? escapeDocumentHtml(company.gstin) : "";
  const companyLines = [
    `<strong>${legal}</strong>`,
    address,
    location ? escapeDocumentHtml(location) : "",
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : "",
    website ? `Website: ${website}` : "",
    gstin ? `GSTIN: ${gstin}` : "",
  ].filter(Boolean).join("<br/>");

  return `
<div class="bseva-doc-header-block">
  <div class="bseva-doc-header-left">
    <div class="bseva-doc-brand-row">
      <img class="bseva-doc-logo" src="${src}" alt="${brand}"/>
      <div class="bseva-doc-brand-text">
        <div class="bseva-doc-brand-name">B-SEVA</div>
        <div class="bseva-doc-motto">${escapeDocumentHtml(BSEVA_MOTTO)}</div>
      </div>
    </div>
    <div class="bseva-doc-company">${companyLines}</div>
  </div>
  <div class="bseva-doc-header-right">
    <h1 class="bseva-doc-doc-title">${escapeDocumentHtml(documentTitle)}</h1>
    <div class="bseva-doc-meta">${renderMetaRowsHtml(metaRows)}</div>
  </div>
</div>`.trim();
}

export function renderDocumentFooter(company?: BSevaDocumentCompany, disclaimer?: string) {
  const legal = escapeDocumentHtml(company?.legalName || BSEVA_BRAND);
  const address = escapeDocumentHtml(company?.address || "");
  const email = escapeDocumentHtml(company?.email || BSEVA_EMAIL);
  const website = escapeDocumentHtml(company?.website || BSEVA_WEBSITE);
  const disc = escapeDocumentHtml(
    disclaimer || "This is a computer-generated document and does not require a physical signature.",
  );
  return `
<div class="bseva-doc-footer-block">
  <strong>${escapeDocumentHtml(BSEVA_FOOTER_LOCKUP)}</strong>
  <p>${legal}<br/>${address}<br/>${email} · ${website}</p>
  <p><em>${disc}</em></p>
</div>`.trim();
}

export function wrapBSevaDocumentHtml(options: BSevaDocumentOptions) {
  const company = options.company || {};
  const src = escapeDocumentHtml(logoSrc(company));
  const title = escapeDocumentHtml(options.pageTitle || options.documentTitle || BSEVA_BRAND);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
${documentChromeCss()}
${options.extraCss || ""}
</style></head><body>
<div class="bseva-doc-watermark" aria-hidden="true"><img src="${src}" alt=""/></div>
<div class="bseva-doc-viewport">
  ${options.toolbarHtml || ""}
  <div class="bseva-doc-page">
    <div class="bseva-doc-body">${options.bodyHtml}</div>
  </div>
</div>
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
