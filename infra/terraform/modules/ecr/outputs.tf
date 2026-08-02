output "server_repo_url" {
  value = aws_ecr_repository.server.repository_url
}

output "proxy_repo_url" {
  value = aws_ecr_repository.proxy.repository_url
}

output "registry" {
  value = split("/", aws_ecr_repository.server.repository_url)[0]
}
