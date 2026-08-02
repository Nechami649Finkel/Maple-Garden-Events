# ─── GitHub Actions OIDC provider ─────────────────────────────────────────────
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  # AWS verifies GitHub's certificate automatically; thumbprint is still required by the API
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = local.tags
}

# ─── IAM role assumed by GitHub Actions via OIDC ──────────────────────────────
resource "aws_iam_role" "ci" {
  name = "${var.project}-ci-role"
  tags = local.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "GitHubOIDC"
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Scoped to your repo only — all branches and events (PRs, pushes)
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:*"
        }
      }
    }]
  })
}

# ─── Policy: Terraform state (S3 + DynamoDB) ──────────────────────────────────
resource "aws_iam_policy" "terraform_state" {
  name        = "${var.project}-ci-terraform-state"
  description = "Allow CI to read/write Terraform state and acquire locks"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "StateS3"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.terraform_state.arn,
          "${aws_s3_bucket.terraform_state.arn}/*"
        ]
      },
      {
        Sid    = "StateLock"
        Effect = "Allow"
        Action = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.terraform_state.arn}/*.tflock"
      }
    ]
  })
}

# ─── Policy: VPC / Networking ─────────────────────────────────────────────────
resource "aws_iam_policy" "networking" {
  name        = "${var.project}-ci-networking"
  description = "Allow CI/Terraform to manage VPC, subnets, IGW, route tables, security groups"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "VPC"
      Effect = "Allow"
      Action = [
        "ec2:CreateVpc", "ec2:DeleteVpc", "ec2:ModifyVpcAttribute",
        "ec2:DescribeVpcs", "ec2:DescribeVpcAttribute",
        "ec2:CreateSubnet", "ec2:DeleteSubnet", "ec2:ModifySubnetAttribute",
        "ec2:DescribeSubnets",
        "ec2:CreateInternetGateway", "ec2:DeleteInternetGateway",
        "ec2:AttachInternetGateway", "ec2:DetachInternetGateway",
        "ec2:DescribeInternetGateways",
        "ec2:CreateRouteTable", "ec2:DeleteRouteTable",
        "ec2:CreateRoute", "ec2:DeleteRoute",
        "ec2:AssociateRouteTable", "ec2:DisassociateRouteTable",
        "ec2:DescribeRouteTables",
        "ec2:CreateSecurityGroup", "ec2:DeleteSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress",
        "ec2:AuthorizeSecurityGroupEgress", "ec2:RevokeSecurityGroupEgress",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeAccountAttributes"
      ]
      Resource = "*"
    }]
  })
}

# ─── Policy: EC2 instances + EIP ──────────────────────────────────────────────
resource "aws_iam_policy" "ec2" {
  name        = "${var.project}-ci-ec2"
  description = "Allow CI/Terraform to manage EC2 instances, EIPs, and key pairs"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "EC2"
      Effect = "Allow"
      Action = [
        "ec2:RunInstances", "ec2:TerminateInstances",
        "ec2:StartInstances", "ec2:StopInstances",
        "ec2:DescribeInstances", "ec2:DescribeInstanceStatus",
        "ec2:DescribeInstanceTypes",
        "ec2:ModifyInstanceAttribute",
        "ec2:AllocateAddress", "ec2:ReleaseAddress",
        "ec2:AssociateAddress", "ec2:DisassociateAddress",
        "ec2:DescribeAddresses",
        "ec2:DescribeKeyPairs",
        "ec2:DescribeImages",
        "ec2:CreateTags", "ec2:DeleteTags", "ec2:DescribeTags",
        "ec2:DescribeVolumes",
        "ec2:DescribeNetworkInterfaces"
      ]
      Resource = "*"
    }]
  })
}

# ─── Policy: ECR ──────────────────────────────────────────────────────────────
resource "aws_iam_policy" "ecr" {
  name        = "${var.project}-ci-ecr"
  description = "Allow CI to create ECR repos and push/pull Docker images"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "ECR"
      Effect = "Allow"
      Action = [
        "ecr:GetAuthorizationToken",
        "ecr:CreateRepository", "ecr:DeleteRepository",
        "ecr:DescribeRepositories",
        "ecr:PutLifecyclePolicy", "ecr:GetLifecyclePolicy", "ecr:DeleteLifecyclePolicy",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage",
        "ecr:ListTagsForResource",
        "ecr:TagResource", "ecr:UntagResource"
      ]
      Resource = "*"
    }]
  })
}

# ─── Policy: IAM (scoped to this project only) ────────────────────────────────
resource "aws_iam_policy" "iam_scoped" {
  name        = "${var.project}-ci-iam"
  description = "Allow CI/Terraform to manage IAM roles and policies for this project only"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "IAMRoles"
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole", "iam:GetRole",
          "iam:UpdateRole", "iam:PassRole",
          "iam:TagRole", "iam:UntagRole", "iam:ListRoleTags",
          "iam:AttachRolePolicy", "iam:DetachRolePolicy",
          "iam:ListAttachedRolePolicies",
          "iam:CreateInstanceProfile", "iam:DeleteInstanceProfile",
          "iam:GetInstanceProfile",
          "iam:AddRoleToInstanceProfile", "iam:RemoveRoleFromInstanceProfile",
          "iam:ListInstanceProfilesForRole"
        ]
        Resource = [
          "arn:aws:iam::*:role/${var.project}-*",
          "arn:aws:iam::*:instance-profile/${var.project}-*"
        ]
      },
      {
        Sid    = "IAMPolicies"
        Effect = "Allow"
        Action = [
          "iam:CreatePolicy", "iam:DeletePolicy",
          "iam:GetPolicy", "iam:GetPolicyVersion",
          "iam:ListPolicyVersions",
          "iam:CreatePolicyVersion", "iam:DeletePolicyVersion",
          "iam:TagPolicy", "iam:UntagPolicy"
        ]
        Resource = "arn:aws:iam::*:policy/${var.project}-*"
      }
    ]
  })
}

# ─── Policy: S3 app buckets (files + backups per environment) ─────────────────
resource "aws_iam_policy" "s3_app" {
  name        = "${var.project}-ci-s3-app"
  description = "Allow CI/Terraform to create and manage app S3 buckets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "S3App"
      Effect = "Allow"
      Action = [
        "s3:CreateBucket", "s3:DeleteBucket",
        "s3:GetBucketLocation", "s3:ListBucket",
        "s3:GetBucketVersioning", "s3:PutBucketVersioning",
        "s3:GetEncryptionConfiguration", "s3:PutEncryptionConfiguration",
        "s3:GetBucketPublicAccessBlock", "s3:PutBucketPublicAccessBlock",
        "s3:GetBucketTagging", "s3:PutBucketTagging",
        "s3:GetObject", "s3:PutObject", "s3:DeleteObject"
      ]
      Resource = [
        for env in var.environments : "arn:aws:s3:::${var.project}-${env}-*"
      ]
    }]
  })
}

# ─── Policy: Secrets Manager ──────────────────────────────────────────────────
resource "aws_iam_policy" "secrets" {
  name        = "${var.project}-ci-secrets"
  description = "Allow CI to read project secrets from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "SecretsRead"
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.project}/*"
    }]
  })
}

# ─── Policy: CloudWatch Logs ───────────────────────────────────────────────────
resource "aws_iam_policy" "cloudwatch" {
  name        = "${var.project}-ci-cloudwatch"
  description = "Allow CI/Terraform to manage CloudWatch log groups"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "Logs"
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup", "logs:DeleteLogGroup",
        "logs:DescribeLogGroups",
        "logs:CreateLogStream", "logs:DeleteLogStream",
        "logs:PutLogEvents", "logs:DescribeLogStreams",
        "logs:TagLogGroup", "logs:ListTagsLogGroup"
      ]
      Resource = "*"
    }]
  })
}

# ─── Attach all policies to the CI role ───────────────────────────────────────
resource "aws_iam_role_policy_attachment" "ci" {
  for_each = {
    terraform_state = aws_iam_policy.terraform_state.arn
    networking      = aws_iam_policy.networking.arn
    ec2             = aws_iam_policy.ec2.arn
    ecr             = aws_iam_policy.ecr.arn
    iam_scoped      = aws_iam_policy.iam_scoped.arn
    s3_app          = aws_iam_policy.s3_app.arn
    secrets         = aws_iam_policy.secrets.arn
    cloudwatch      = aws_iam_policy.cloudwatch.arn
  }

  role       = aws_iam_role.ci.name
  policy_arn = each.value
}
