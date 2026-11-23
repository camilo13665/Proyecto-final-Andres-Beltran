provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  # Todos los servicios apuntan a Floci. Con aws_endpoint = null se usaría AWS real.
  endpoints {
    s3       = var.aws_endpoint
    dynamodb = var.aws_endpoint
    ec2      = var.aws_endpoint
    logs     = var.aws_endpoint
  }
}
