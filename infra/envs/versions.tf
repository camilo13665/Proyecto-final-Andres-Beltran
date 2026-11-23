terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Estado remoto en S3. Con workspaces, Terraform guarda cada ambiente en:
  #   <workspace_key_prefix>/<workspace>/<key>
  #   => env:/dev/aegisvolt/terraform.tfstate
  #   => env:/test/aegisvolt/terraform.tfstate
  #   => env:/prod/aegisvolt/terraform.tfstate
  # Los valores del backend NO pueden usar variables; por eso están escritos aquí.
  backend "s3" {
    bucket               = "aegisvolt-tfstate"
    key                  = "aegisvolt/terraform.tfstate"
    workspace_key_prefix = "env:"
    region               = "us-east-1"

    # --- Ajustes para el emulador Floci (quitar si algún día se usa AWS real) ---
    endpoints = {
      s3 = "http://localhost:4566"
    }
    access_key                  = "test"
    secret_key                  = "test"
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    skip_region_validation      = true
    skip_s3_checksum            = true
  }
}
