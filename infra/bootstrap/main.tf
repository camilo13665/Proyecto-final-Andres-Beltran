# BOOTSTRAP: crea UNA sola vez el bucket S3 que guardará los tfstate de todos los ambientes.
# Usa estado LOCAL a propósito: no puede guardar su estado en un bucket que aún no existe.

terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "aws_endpoint" {
  description = "Endpoint de Floci. Pon null para usar AWS real."
  type        = string
  default     = "http://localhost:4566"
}

variable "state_bucket_name" {
  description = "Nombre del bucket de estado (debe coincidir con backend.tf de infra/envs)."
  type        = string
  default     = "aegisvolt-tfstate"
}

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    s3 = var.aws_endpoint
  }
}

resource "aws_s3_bucket" "tfstate" {
  bucket = var.state_bucket_name

  tags = {
    Project   = "aegisvolt"
    Purpose   = "terraform-state"
    ManagedBy = "terraform-bootstrap"
  }
}

# Requisito obligatorio del PDF: Versioning Enabled (historial/backups de cada tfstate)
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

output "state_bucket" {
  value = aws_s3_bucket.tfstate.bucket
}

output "versioning_status" {
  value = aws_s3_bucket_versioning.tfstate.versioning_configuration[0].status
}
