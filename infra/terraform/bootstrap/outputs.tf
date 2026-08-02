output "state_bucket_name" {
  description = "Name of the S3 bucket storing Terraform state for all environments"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "state_bucket_arn" {
  description = "ARN of the Terraform state S3 bucket"
  value       = aws_s3_bucket.terraform_state.arn
}

output "ci_role_arn" {
  description = "ARN of the IAM role GitHub Actions assumes via OIDC — add as GitHub secret: AWS_ROLE_ARN"
  value       = aws_iam_role.ci.arn
}

output "backend_config" {
  description = "Ready-to-paste backend block for each environment"
  value = {
    for env in var.environments : env => {
      bucket       = aws_s3_bucket.terraform_state.bucket
      key          = "${env}/terraform.tfstate"
      region       = var.aws_region
      encrypt      = true
      use_lockfile = true
    }
  }
}
