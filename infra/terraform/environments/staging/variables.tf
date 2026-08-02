variable "aws_region" {
  type    = string
  default = "il-central-1"
}

variable "ssh_allowed_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to SSH (restrict to your IP)"
  default     = ["0.0.0.0/0"]
}

variable "github_org" {
  type = string
}

variable "github_repo" {
  type = string
}
