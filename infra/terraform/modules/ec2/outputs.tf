output "public_ip" {
  value = aws_eip.app.public_ip
}


output "instance_id" {
  value = aws_instance.app.id
}

output "security_group_id" {
  value = aws_security_group.app.id
}

output "s3_bucket" {
  value = aws_s3_bucket.files.bucket
}
