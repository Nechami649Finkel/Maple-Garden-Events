# Monorepo layout (npm workspaces)

Packages:

| Workspace | Name | Role |
|-----------|------|------|
| `shared/` | `@maple/shared` | Brand, contract, gallery, i18n (compiled to `shared/dist`) |
| `client/` | `client` | React / Vite SPA — imports `@shared/*` (Vite alias → shared sources) |
| `server/` | `server` | Express API — imports `@maple/shared/*` from the built package |

## Install / build

```bash
# from repo root
npm install
npm run build:shared          # required before server tests/build
npm run dev                   # server + client
npm run build                 # shared → client → server
npm run test:client           # Vitest
npm run test:server           # Jest
```

There is **no** `copy-shared.js` / `server/src/vendor/shared` anymore. The server depends on `@maple/shared` via workspaces.

## Docker / CI

- Root `package-lock.json` is the single lockfile.
- CI runs `npm ci` at the repo root, then builds `@maple/shared` before server jobs.
- App image builds shared, then runs `prisma migrate deploy` via the server entrypoint.
