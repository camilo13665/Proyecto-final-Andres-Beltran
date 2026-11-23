# Guardia: impide aplicar en el workspace "default" (o en uno inventado).
# Así es imposible crear recursos sin ambiente y mezclar estados.
resource "terraform_data" "workspace_guard" {
  lifecycle {
    precondition {
      condition     = contains(keys(local.env_config), terraform.workspace)
      error_message = "Workspace inválido '${terraform.workspace}'. Usa: terraform workspace select dev|test|prod"
    }
  }
}

module "network" {
  source = "../modules/network"

  name_prefix          = "aegisvolt-${local.env}"
  vpc_cidr             = local.config.vpc_cidr
  azs                  = ["${var.aws_region}a", "${var.aws_region}b"]
  region               = var.aws_region
  enable_vpc_endpoints = var.enable_vpc_endpoints
  tags                 = local.common_tags

  depends_on = [terraform_data.workspace_guard]
}

# Database-per-Service: una tabla por servicio (+ sagas y flags), todas con sufijo del ambiente.
module "dynamodb" {
  source = "../modules/dynamodb"

  environment = local.env
  tables      = ["reservations", "billing", "dispatch", "sagas", "flags"]
  tags        = local.common_tags

  depends_on = [terraform_data.workspace_guard]
}

module "observability" {
  source = "../modules/observability"

  environment       = local.env
  services          = ["gateway", "station-reservation", "billing-wallet", "energy-dispatch"]
  retention_in_days = local.config.log_retention_days
  tags              = local.common_tags

  depends_on = [terraform_data.workspace_guard]
}
