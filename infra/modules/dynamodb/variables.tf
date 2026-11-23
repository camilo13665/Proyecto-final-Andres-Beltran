variable "environment" {
  description = "dev, test o prod (viene de terraform.workspace)."
  type        = string
}

variable "tables" {
  description = "Nombres lógicos de tablas: una por microservicio, más sagas y flags."
  type        = set(string)
}

variable "tags" {
  type    = map(string)
  default = {}
}
