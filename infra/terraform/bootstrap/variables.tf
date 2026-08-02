variable "aws_region" {
  description = "AWS region for all bootstrap resources"
  type        = string
  default     = "il-central-1"
}

variable "project" {
  description = "Project name used as a prefix for all resource names"
  type        = string
  default     = "maple-garden"
}

variable "environments" {
  description = "List of environments that will use this state bucket"
  type        = list(string)
  default     = ["staging", "production"]
}

variable "github_org" {
  description = "GitHub organization or username that owns the repository"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without the org prefix)"
  type        = string
}
