# ─── Latest Ubuntu 24.04 LTS AMI (auto-resolved per region) ──────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ─── Security Group ───────────────────────────────────────────────────────────
resource "aws_security_group" "app" {
  name        = "${var.project}-${var.env}-sg"
  description = "Allow HTTP, HTTPS, SSH"
  vpc_id      = var.vpc_id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidrs
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.web_allowed_cidrs
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.web_allowed_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

# ─── IAM role for EC2 (ECR pull + S3 + Secrets Manager) ──────────────────────
resource "aws_iam_role" "ec2" {
  name = "${var.project}-${var.env}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "ec2_permissions" {
  name = "${var.project}-${var.env}-ec2-policy"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRPull"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${var.s3_bucket}",
          "arn:aws:s3:::${var.s3_bucket}/*",
          "arn:aws:s3:::${var.s3_backup_bucket}",
          "arn:aws:s3:::${var.s3_backup_bucket}/*"
        ]
      },
      {
        Sid      = "SecretsManager"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.project}/${var.env}/*"
      },
      {
        Sid      = "CloudWatchLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project}-${var.env}-profile"
  role = aws_iam_role.ec2.name
}

# ─── S3 buckets ───────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "files" {
  bucket = var.s3_bucket
  tags   = local.tags
}

resource "aws_s3_bucket" "backups" {
  bucket = var.s3_backup_bucket
  tags   = local.tags
}

resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── EC2 instance ─────────────────────────────────────────────────────────────
resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  vpc_security_group_ids = [aws_security_group.app.id]
  subnet_id              = var.subnet_id
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  root_block_device {
    volume_size = var.disk_size_gb
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    aws_region      = var.aws_region
    project         = var.project
    env             = var.env
  }))

  tags = merge(local.tags, { Name = "${var.project}-${var.env}" })
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
  tags     = local.tags
}

locals {
  tags = {
    Project     = var.project
    Environment = var.env
    ManagedBy   = "terraform"
  }
}
