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
    key          = "staging/terraform.tfstate"
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
  env                = "staging"
  aws_region         = var.aws_region
  vpc_cidr           = "10.1.0.0/16"
  public_subnet_cidr = "10.1.1.0/24"
}

module "ecr" {
  source  = "../../modules/ecr"
  project = "maple-garden"
  env     = "staging"
}

# ─── SSH key pair ─────────────────────────────────────────────────────────────
resource "tls_private_key" "ssh" {
  algorithm = "ED25519"
}

resource "aws_key_pair" "app" {
  key_name   = "maple-garden-staging-key"
  public_key = tls_private_key.ssh.public_key_openssh
}

module "ec2" {
  source            = "../../modules/ec2"
  project           = "maple-garden"
  env               = "staging"
  aws_region        = var.aws_region
  vpc_id            = module.vpc.vpc_id
  subnet_id         = module.vpc.public_subnet_id
  instance_type     = "t3.small"
  disk_size_gb      = 20
  key_pair_name     = aws_key_pair.app.key_name
  ssh_allowed_cidrs = var.ssh_allowed_cidrs
  web_allowed_cidrs = var.ssh_allowed_cidrs
  s3_bucket         = "maple-garden-staging-files"
  s3_backup_bucket  = "maple-garden-staging-backups"
}

# ─── Push deploy secrets to GitHub Actions automatically ──────────────────────
resource "github_actions_secret" "ec2_host" {
  repository      = var.github_repo
  secret_name     = "EC2_HOST"
  value = module.ec2.public_ip
}

resource "github_actions_secret" "ec2_ssh_key" {
  repository      = var.github_repo
  secret_name     = "EC2_SSH_KEY"
  value = tls_private_key.ssh.private_key_openssh
}

resource "github_actions_secret" "domain" {
  repository      = var.github_repo
  secret_name     = "DOMAIN"
  value = module.ec2.public_ip
}

resource "github_actions_secret" "ecr_registry" {
  repository      = var.github_repo
  secret_name     = "ECR_REGISTRY"
  value = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

data "aws_caller_identity" "current" {}

# ─── Staging EC2 sleep schedule (Israel time) ─────────────────────────────────
# Weekdays (Sun–Thu): off 01:00–09:00
# Weekend:            off Fri 13:00 – Sat 20:00

resource "aws_iam_role" "scheduler" {
  name = "maple-garden-staging-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "scheduler.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler" {
  name = "maple-garden-staging-scheduler-policy"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ec2:StartInstances", "ec2:StopInstances"]
      Resource = "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${module.ec2.instance_id}"
    }]
  })
}

resource "aws_scheduler_schedule" "stop_weeknights" {
  name       = "maple-garden-staging-stop-weeknights"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = "cron(0 1 ? * SUN-THU *)"
  schedule_expression_timezone = "Asia/Jerusalem"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:stopInstances"
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ InstanceIds = [module.ec2.instance_id] })
  }
}

resource "aws_scheduler_schedule" "start_weekday_mornings" {
  name       = "maple-garden-staging-start-weekday-mornings"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = "cron(0 9 ? * SUN-THU *)"
  schedule_expression_timezone = "Asia/Jerusalem"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:startInstances"
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ InstanceIds = [module.ec2.instance_id] })
  }
}

resource "aws_scheduler_schedule" "stop_friday_afternoon" {
  name       = "maple-garden-staging-stop-friday"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = "cron(0 13 ? * FRI *)"
  schedule_expression_timezone = "Asia/Jerusalem"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:stopInstances"
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ InstanceIds = [module.ec2.instance_id] })
  }
}

resource "aws_scheduler_schedule" "start_saturday_night" {
  name       = "maple-garden-staging-start-saturday"
  group_name = "default"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = "cron(0 20 ? * SAT *)"
  schedule_expression_timezone = "Asia/Jerusalem"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:startInstances"
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ InstanceIds = [module.ec2.instance_id] })
  }
}
