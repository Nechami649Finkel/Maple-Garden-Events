output "ssh_private_key" {
  value     = tls_private_key.ssh.private_key_openssh
  sensitive = true
}

output "server_ip" {
  value       = module.ec2.public_ip
  description = "SSH: ssh ubuntu@<ip> -i maple-staging-key.pem"
}

output "ecr_server" {
  value = module.ecr.server_repo_url
}

output "ecr_proxy" {
  value = module.ecr.proxy_repo_url
}
