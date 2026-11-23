# Un grupo de logs por servicio y ambiente: /aegisvolt/<ambiente>/<servicio>
resource "aws_cloudwatch_log_group" "this" {
  for_each = var.services

  name              = "/aegisvolt/${var.environment}/${each.key}"
  retention_in_days = var.retention_in_days

  tags = merge(var.tags, { Service = each.key })
}
