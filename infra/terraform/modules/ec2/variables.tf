variable "project" {
  type    = string
  default = "maple-garden"
}

variable "env" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "disk_size_gb" {
  type    = number
  default = 20
}

variable "key_pair_name" {
  type        = string
  description = "AWS key pair name for SSH access"
}

variable "ssh_allowed_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to SSH"
  default     = ["0.0.0.0/0"]
}

variable "web_allowed_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to reach HTTP/HTTPS. Use team IPs for staging, 0.0.0.0/0 for production."
  default     = ["0.0.0.0/0"]
}

variable "s3_bucket" {
  type = string
}

variable "s3_backup_bucket" {
  type = string
}
