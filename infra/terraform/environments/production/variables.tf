variable "aws_region" {
  type    = string
  default = "il-central-1"
}

variable "ssh_allowed_cidrs" {
  type        = list(string)
  description = "Restrict SSH to your office/home IP only"
}

variable "domain" {
  type        = string
  description = "Production domain name (e.g. maple-garden.co.il)"
}

variable "github_org" {
  type = string
}

variable "github_repo" {
  type = string
}
