terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
  backend "s3" {
    bucket       = "maple-garden-terraform-state"
    key          = "production/terraform.tfstate"
    region       = "il-central-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_secretsmanager_secret_version" "github_token" {
  secret_id = "maple-garden/github-token"
}

provider "github" {
  token = data.aws_secretsmanager_secret_version.github_token.secret_string
  owner = var.github_org
}

module "vpc" {
  source             = "../../modules/vpc"
  project            = "maple-garden"
  env                = "production"
  aws_region         = var.aws_region
  vpc_cidr           = "10.2.0.0/16"
  public_subnet_cidr = "10.2.1.0/24"
}

module "ecr" {
  source  = "../../modules/ecr"
  project = "maple-garden"
  env     = "production"
}

# ─── SSH key pair ─────────────────────────────────────────────────────────────
resource "tls_private_key" "ssh" {
  algorithm = "ED25519"
}

resource "aws_key_pair" "app" {
  key_name   = "maple-garden-production-key"
  public_key = tls_private_key.ssh.public_key_openssh
}

module "ec2" {
  source            = "../../modules/ec2"
  project           = "maple-garden"
  env               = "production"
  aws_region        = var.aws_region
  vpc_id            = module.vpc.vpc_id
  subnet_id         = module.vpc.public_subnet_id
  instance_type     = "t3.medium"
  disk_size_gb      = 40
  key_pair_name     = aws_key_pair.app.key_name
  ssh_allowed_cidrs = var.ssh_allowed_cidrs
  web_allowed_cidrs = ["0.0.0.0/0"]
  s3_bucket         = "maple-garden-prod-files"
  s3_backup_bucket  = "maple-garden-prod-backups"
}

data "aws_caller_identity" "current" {}

# ─── Push production deploy secrets to GitHub Actions ─────────────────────────
resource "github_actions_secret" "prod_ec2_host" {
  repository  = var.github_repo
  secret_name = "PROD_EC2_HOST"
  value       = module.ec2.public_ip
}

resource "github_actions_secret" "prod_ec2_ssh_key" {
  repository  = var.github_repo
  secret_name = "PROD_EC2_SSH_KEY"
  value       = tls_private_key.ssh.private_key_openssh
}

resource "github_actions_secret" "prod_domain" {
  repository  = var.github_repo
  secret_name = "PROD_DOMAIN"
  value       = var.domain
}

resource "github_actions_secret" "prod_ecr_registry" {
  repository  = var.github_repo
  secret_name = "PROD_ECR_REGISTRY"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}
