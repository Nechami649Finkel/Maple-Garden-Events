#!/usr/bin/env bash
# Bootstrap AWS staging resources for Maple Garden Events.
# Run once per AWS account/region. Review output before confirming destructive actions.
set -euo pipefail

AWS_REGION="${AWS_REGION:-il-central-1}"
PROJECT_PREFIX="${PROJECT_PREFIX:-maple-events}"
FILES_BUCKET="${PROJECT_PREFIX}-staging-files"
BACKUPS_BUCKET="${PROJECT_PREFIX}-staging-backups"
ECR_REPO="${PROJECT_PREFIX}"

echo "=== Maple Events — AWS Staging Bootstrap ==="
echo "Region: $AWS_REGION"
echo "Prefix: $PROJECT_PREFIX"
echo ""

require_aws() {
  if ! command -v aws &>/dev/null; then
    echo "❌ AWS CLI not found. Install: https://aws.amazon.com/cli/"
    exit 1
  fi
}

create_bucket() {
  local name="$1"
  if aws s3api head-bucket --bucket "$name" 2>/dev/null; then
    echo "✓ Bucket exists: $name"
  else
    echo "Creating bucket: $name"
    if [ "$AWS_REGION" = "us-east-1" ]; then
      aws s3api create-bucket --bucket "$name" --region "$AWS_REGION"
    else
      aws s3api create-bucket --bucket "$name" --region "$AWS_REGION" \
        --create-bucket-configuration "LocationConstraint=$AWS_REGION"
    fi
    aws s3api put-bucket-versioning --bucket "$name" \
      --versioning-configuration Status=Enabled
    aws s3api put-public-access-block --bucket "$name" \
      --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    echo "✓ Created: $name"
  fi
}

create_ecr() {
  if aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" &>/dev/null; then
    echo "✓ ECR repo exists: $ECR_REPO"
  else
    echo "Creating ECR repository: $ECR_REPO"
    aws ecr create-repository --repository-name "$ECR_REPO" --region "$AWS_REGION"
    echo "✓ Created ECR: $ECR_REPO"
  fi
}

create_secret_placeholder() {
  local name="${PROJECT_PREFIX}/staging"
  if aws secretsmanager describe-secret --secret-id "$name" --region "$AWS_REGION" &>/dev/null; then
    echo "✓ Secret exists: $name"
  else
    echo "Creating Secrets Manager placeholder: $name"
    aws secretsmanager create-secret \
      --name "$name" \
      --description "Maple Events staging environment variables" \
      --secret-string '{"NODE_ENV":"production","SERVE_CLIENT":"true","EASY_COUNT_MOCK_MODE":"true"}' \
      --region "$AWS_REGION"
    echo "✓ Created secret: $name — update with real values from infra/env.staging.example"
  fi
}

require_aws
create_bucket "$FILES_BUCKET"
create_bucket "$BACKUPS_BUCKET"
create_ecr
create_secret_placeholder

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo ""
echo "=== Done ==="
echo "ECR URI: ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
echo ""
echo "Next steps:"
echo "  1. Create RDS PostgreSQL (see infra/README.md)"
echo "  2. Update Secrets Manager secret with infra/env.staging.example values"
echo "  3. Configure GitHub secrets for deploy.yml"
echo "  4. Create App Runner service pointing to ECR image"
echo "  5. Push to miriam branch to trigger staging deploy"
