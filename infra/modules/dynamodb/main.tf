# Una tabla por nombre lógico y por ambiente: aegisvolt-<servicio>-<ambiente>.
# Esquema genérico pk/sk (String): cada servicio decide qué guarda en ellas.
resource "aws_dynamodb_table" "this" {
  for_each = var.tables

  name         = "aegisvolt-${each.key}-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  tags = merge(var.tags, { Service = each.key })
}
