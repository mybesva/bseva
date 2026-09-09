# BSeva shared packages

These packages are consumed by `apps/mobile`. The production Vite app in `bseva-export/` is unchanged and still uses its own `lib/api.ts`.

| Package | Purpose |
|---|---|
| `@bseva/api-client` | Isomorphic FastAPI client (inject token store) |
| `@bseva/types` | Auth, catalog, booking, wallet DTOs |
| `@bseva/validation` | Zod schemas (login/register/address/password) |
| `@bseva/locales` | EN/HI/TE dictionaries (copied from web i18n) |
| `@bseva/config` | Roles, statuses, rupees(), legal versions |
| `@bseva/tokens` | Saffron / navy / gold color tokens |

Do not import React Native or DOM from these packages.
