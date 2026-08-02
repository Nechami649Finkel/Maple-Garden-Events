terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

module "ec2" {
  source            = "../../modules/ec2"
  project           = "maple-garden"
  env               = "production"
  aws_region        = var.aws_region
  vpc_id            = module.vpc.vpc_id
  subnet_id         = module.vpc.public_subnet_id
  instance_type     = "t3.medium"
  disk_size_gb      = 40
  key_pair_name     = var.key_pair_name
  ssh_allowed_cidrs = var.ssh_allowed_cidrs
  s3_bucket         = "maple-garden-prod-files"
  s3_backup_bucket  = "maple-garden-prod-backups"
}
