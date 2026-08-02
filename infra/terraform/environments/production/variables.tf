variable "aws_region" {
  type    = string
  default = "il-central-1"
}

variable "key_pair_name" {
  type        = string
  description = "AWS key pair name for SSH access"
}

variable "ssh_allowed_cidrs" {
  type        = list(string)
  description = "Restrict SSH to your office/home IP only"
}
