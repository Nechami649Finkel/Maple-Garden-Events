# AWS Infrastructure — Maple Garden Events

Setup guide for staging and production on AWS (App Runner + RDS + S3).

## Architecture

```
Route53 → App Runner (Docker) → RDS PostgreSQL
                ↓
           S3 (files + backups)
           Secrets Manager (env vars)
           ECR (Docker images)
```

## Prerequisites

- AWS CLI v2 configured (`aws configure`)
- GitHub repository secrets for CD pipeline
- Domain in Route 53 (or external DNS)

## 1. Create RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier maple-staging \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username mapleadmin \
  --master-user-password "CHANGE_ME_STRONG" \
  --allocated-storage 20 \
  --storage-encrypted \
  --backup-retention-period 7 \
  --multi-az false \
  --publicly-accessible false
```

For production: set `--db-instance-identifier maple-production`, `--multi-az true`, larger instance class.

## 2. Create S3 Buckets (SSE-S3 enabled by default)

```bash
aws s3api create-bucket --bucket maple-events-staging-files --region il-central-1 \
  --create-bucket-configuration LocationConstraint=il-central-1

aws s3api put-bucket-versioning --bucket maple-events-staging-files \
  --versioning-configuration Status=Enabled

aws s3api put-public-access-block --bucket maple-events-staging-files \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Repeat for `maple-events-staging-backups` and production buckets.

## 3. Create ECR Repository

```bash
aws ecr create-repository --repository-name maple-events --region il-central-1
```

## 4. Store Secrets in Secrets Manager

```bash
aws secretsmanager create-secret \
  --name maple-events/staging \
  --secret-string file://infra/env.staging.example
```

Update with real values after RDS is ready. Map secret to App Runner environment variables.

## 5. Create App Runner Service

Use the AWS Console or:

```bash
# After first image push to ECR:
aws apprunner create-service \
  --service-name maple-staging \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "ACCOUNT.dkr.ecr.il-central-1.amazonaws.com/maple-events:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "5000",
        "RuntimeEnvironmentSecrets": [
          {"Name": "DATABASE_URL", "Value": "arn:aws:secretsmanager:..."}
        ]
      }
    },
    "AutoDeploymentsEnabled": false
  }' \
  --health-check-configuration '{
    "Protocol": "HTTP",
    "Path": "/api/health",
    "Interval": 20,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }'
```

## 6. GitHub Secrets (for deploy.yml)

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user for CI/CD |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `AWS_REGION` | e.g. `il-central-1` |
| `ECR_REPOSITORY` | e.g. `maple-events` |
| `APP_RUNNER_SERVICE_ARN_STAGING` | Staging service ARN |
| `APP_RUNNER_SERVICE_ARN_PRODUCTION` | Production service ARN |
| `DATABASE_URL_STAGING` | RDS URL — GitHub Actions runs `scripts/db-migrate-deploy.sh` before App Runner deploy |
| `DATABASE_URL_PRODUCTION` | Same for production |

### Database migrations

Schema is managed only via **Prisma Migrate** (`server/prisma/migrations/`).

Deploy order (see [`docs/DATABASE-MIGRATIONS.md`](../docs/DATABASE-MIGRATIONS.md)):

1. `docker build` → push ECR  
2. `bash server/scripts/db-migrate-deploy.sh` (CI, using `DATABASE_URL_*`)  
3. App Runner starts new revision → entrypoint runs migrate again (idempotent) → `node dist/server.js`

Local: `cd server && npm run db:migrate`

## 7. Run Setup Script

```bash
# Review and customize variables first:
export AWS_REGION=il-central-1
export PROJECT_PREFIX=maple-events

bash infra/setup-aws-staging.sh
```

## Staging vs Production

| Branch | Environment | App Runner |
|--------|-------------|------------|
| `miriam`, `miryami` | staging | maple-staging |
| `main` | production | maple-production |

See also: [`docs/GO-LIVE-DECISIONS.md`](../docs/GO-LIVE-DECISIONS.md)
