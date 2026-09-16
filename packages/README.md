# BSeva shared packages

Consumed by `apps/mobile` (Customer + Pujari) and `apps/admin-mobile` (Admin + Super Admin). The production Vite app in `bseva-export/` still uses its own `lib/api.ts` and is unchanged.

| Package | Purpose |
|---|---|
| `@bseva/api-client` | Isomorphic FastAPI client (inject token store) |
| `@bseva/types` | Auth, catalog, booking, wallet, notification DTOs |
| `@bseva/validation` | Zod schemas (login/register/address/password) |
| `@bseva/locales` | EN/HI/TE dictionaries plus MR/TA/KN mobile extras |
| `@bseva/config` | Roles, statuses, rupees(), notification path mapping, admin permissions |
| `@bseva/tokens` | Saffron / navy / gold color tokens |

Do not import React Native or DOM from these packages.
