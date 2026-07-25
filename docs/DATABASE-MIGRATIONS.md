# Database migrations (Prisma Migrate)

Maple Garden Events uses **Prisma Migrate** as the only schema change path.
Ad-hoc `prisma db execute` / tribal `migrate:*` npm scripts are retired.

## Local development

```bash
cd server
cp .env.example .env   # set DATABASE_URL

# After editing prisma/schema.prisma:
npm run db:migrate
# equivalent: npx prisma migrate dev
# → creates a timestamped folder under prisma/migrations/, applies it, regenerates client
```

Useful commands:

| Command | When |
|---------|------|
| `npm run db:migrate` | Create + apply a migration while developing |
| `npm run db:migrate:status` | See pending / applied migrations |
| `npm run db:migrate:deploy` | Apply pending migrations (same script as CI/Docker) |
| `npm run db:generate` | Regenerate Prisma Client only |

Never use `prisma db push` against shared staging/production databases.

## Deployment sequence (staging / production)

On push to `miriam` / `miryami` (staging) or `main` (production):

1. **CI** — install, `prisma validate`, tests, builds  
2. **Build & push** Docker image to ECR  
3. **`bash scripts/db-migrate-deploy.sh`** (`prisma migrate deploy`) against the target RDS URL **before** App Runner rolls tasks  
4. **App Runner** deploy new image  
5. **Container entrypoint** runs the same migrate script again (idempotent safety net), then `node dist/server.js`  
6. Health check `/api/health`

So the effective production command sequence is:

```text
npm ci → prisma generate → prisma migrate deploy → start server
```

Docker entrypoint:

```text
bash scripts/db-migrate-deploy.sh → node dist/server.js
```

## First-time baseline (existing RDS)

Environments that already have the full schema from old ad-hoc SQL, but no
`_prisma_migrations` table, are handled automatically by
`scripts/db-migrate-deploy.sh`:

1. Detect “not managed by Prisma Migrate”
2. Diff live DB vs `schema.prisma` — must be empty (in sync)
3. `prisma migrate resolve --applied 20260725215013_init`
4. `prisma migrate deploy` (no-op until the next migration)

If the live DB **drifts** from `schema.prisma`, the script **fails closed** —
fix the drift (or create a forward migration) before deploying.

Manual one-shot (ops only):

```bash
cd server
export DATABASE_URL="postgresql://…"
npx prisma migrate resolve --applied 20260725215013_init
npx prisma migrate deploy
```

## Safe schema evolution (multi-tenant, zero downtime)

All tenant data is scoped by `tenantId`. Prefer **expand → migrate data → contract**:

1. **Expand** — additive changes only (`CREATE TABLE`, nullable columns, new indexes). Deploy app code that works with old + new shape.  
2. **Backfill** — data jobs / app writes populate new columns (tenant-safe).  
3. **Contract** — drop unused columns/tables in a later release after readers are gone.

Avoid in a single deploy:

- `DROP COLUMN` / `DROP TABLE` still read by the running App Runner revision  
- Renaming columns without a dual-write window  
- Non-concurrent heavy locks on large tables during business hours  

`migrate deploy` is run **before** traffic shifts to the new revision so expand-only migrations stay compatible with the previous app version still serving requests.

## Archived SQL

Historical one-off files live under [`server/prisma/legacy-sql/`](../server/prisma/legacy-sql/) for reference only. Do not execute them on managed environments.
