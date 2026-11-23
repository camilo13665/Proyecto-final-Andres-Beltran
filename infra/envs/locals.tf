locals {
  # El ambiente ES el workspace activo: dev, test o prod.
  env = terraform.workspace

  # Configuración propia de cada ambiente. CIDRs distintos => redes no solapadas.
  env_config = {
    dev  = { vpc_cidr = "10.10.0.0/16", log_retention_days = 7 }
    test = { vpc_cidr = "10.20.0.0/16", log_retention_days = 14 }
    prod = { vpc_cidr = "10.30.0.0/16", log_retention_days = 30 }
  }

  # El fallback a "dev" solo existe para que el plan llegue hasta workspace_guard,
  # que es quien aborta con un mensaje claro si el workspace no es válido.
  config = try(local.env_config[local.env], local.env_config["dev"])

  common_tags = {
    Project     = "aegisvolt"
    Environment = local.env
    ManagedBy   = "terraform"
  }
}
