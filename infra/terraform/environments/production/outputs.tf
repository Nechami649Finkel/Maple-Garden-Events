output "server_ip" {
  value       = module.ec2.public_ip
  description = "Point your domain A record to this IP"
}

output "ecr_server" {
  value = module.ecr.server_repo_url
}

output "ecr_proxy" {
  value = module.ecr.proxy_repo_url
}
