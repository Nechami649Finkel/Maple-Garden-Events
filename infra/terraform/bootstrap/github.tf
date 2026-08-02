# ─── GitHub Actions secrets — set automatically from Terraform outputs ─────────
resource "github_actions_secret" "aws_role_arn" {
  repository      = var.github_repo
  secret_name     = "AWS_ROLE_ARN"
  value = aws_iam_role.ci.arn
}

resource "github_actions_secret" "aws_region" {
  repository      = var.github_repo
  secret_name     = "AWS_REGION"
  value = var.aws_region
}
