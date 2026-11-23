variable "name_prefix" {
  description = "Prefijo de nombres, p. ej. aegisvolt-dev."
  type        = string
}

variable "vpc_cidr" {
  type = string
}

variable "azs" {
  description = "Zonas de disponibilidad (una subred pública y una privada por zona)."
  type        = list(string)
}

variable "region" {
  type = string
}

variable "enable_vpc_endpoints" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
