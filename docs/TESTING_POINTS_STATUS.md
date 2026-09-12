# Testing Points — Status

Source: `docs/Testing_Points.docx` / checklist `docs/TESTING_POINTS_CHECKLIST.md`  
App: `bseva-export/client`

| # | Issue | Root cause | Fix | Files | Status |
|---|--------|------------|-----|-------|--------|
| 1 | FB/WA social icons not brand-colored | Icons inherited sidebar text color | Apply `SOCIAL_BRAND` colors; filled icons use `currentColor` | `Layout.tsx` | FIXED |
| 2 | Hyderabad missing in location dropdown | City list incomplete | Added Hyderabad option | `Home.tsx` | FIXED |
| 3 | Login “Email or phone” | Lowercase “phone” | Label → “Email or Phone” | `Login.tsx` | FIXED |
| 4 | Custom Puja → Contact lands at bottom | No scroll-to-top on navigate | Scroll before navigate + Contact mount scroll + `ScrollToTop` | `Services.tsx`, `Contact.tsx`, `ScrollToTop.tsx` | FIXED |
| 5 | Address / map missing | Footer had phone/email only; map was placeholder | Footer address + Google Maps embed when `VITE_GOOGLE_MAPS_API_KEY` set | `Layout.tsx`, `Contact.tsx` | FIXED |
| 6 | Search highlights on mouse click | Strong focus/selection ring | Softer `focus-visible` ring; transparent selection on search | `Services.tsx` | FIXED |
| 7 | “Get in Touch” / page heroes too tall | Large `py-20`/`py-24` heroes | Reduced to `py-10 md:py-12` on Contact, About, Services | `Contact.tsx`, `About.tsx`, `Services.tsx` | FIXED |
| 8 | No pagination / page size on Services | Full list rendered | Prev/Next + page size 6/9/12/24 | `Services.tsx` | FIXED |
| 9 | Language incomplete on all screens | Many strings hardcoded / incomplete locale catalogs | Needs full i18n pass | — | PARTIAL |
| 10 | Duplicate language selectors | Top bar + header both had language | Removed from top bar; keep header (+ mobile) only | `Layout.tsx` | FIXED |

## Notes
- Restart Vite after Maps key changes (`envDir` = repo root).
- Issue #9 remains open for a dedicated translation sweep.
- Coming Soon missing images (img10) not claimed FIXED here — depends on admin `image_url` / `serviceImageUrl` assets.
