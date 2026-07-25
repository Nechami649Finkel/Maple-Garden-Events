# Legacy ad-hoc SQL (archived)

These files were applied manually via `prisma db execute` / `npm run migrate:*`
before the project adopted Prisma Migrate.

They are **not** part of the Migrate history. The canonical schema history lives in
`../migrations/` (starting with `20260725215013_init`).

Do not run these scripts against managed environments. Use:

```bash
npx prisma migrate dev     # local
npx prisma migrate deploy  # staging / production (via CI or Docker entrypoint)
```
