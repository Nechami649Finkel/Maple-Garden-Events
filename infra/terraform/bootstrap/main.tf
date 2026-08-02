terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
  # Local backend — this config manages its own state locally.
  # It is run ONCE to create the S3 bucket that all other
  # environments use as their remote backend.
  backend "local" {}
}

provider "aws" {
  region = var.aws_region
}

data "aws_secretsmanager_secret_version" "github_token" {
  secret_id = "${var.project}/github-token"
}

provider "github" {
  token = data.aws_secretsmanager_secret_version.github_token.secret_string
  owner = var.github_org
}

locals {
  state_bucket = "${var.project}-terraform-state"

  tags = {
    Project   = var.project
    ManagedBy = "terraform-bootstrap"
  }
}

# ─── S3 bucket for Terraform state ────────────────────────────────────────────
resource "aws_s3_bucket" "terraform_state" {
  bucket = local.state_bucket
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
