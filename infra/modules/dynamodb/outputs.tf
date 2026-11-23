output "table_names" {
  value = { for k, t in aws_dynamodb_table.this : k => t.name }
}
