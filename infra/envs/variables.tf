variable "aws_region" {
  description = "Región AWS (o la que simula Floci)."
  type        = string
  default     = "us-east-1"
}

variable "aws_endpoint" {
  description = "Endpoint del emulador Floci. Usa null para AWS real."
  type        = string
  default     = "http://localhost:4566"
}

variable "enable_vpc_endpoints" {
  description = "Crea los VPC Endpoints. Si Floci no los soporta, ponlo en false y usa solo terraform plan para ellos."
  type        = bool
  default     = true
}
