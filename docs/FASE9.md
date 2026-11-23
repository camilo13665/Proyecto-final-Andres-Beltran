# Fase 9 – CI/CD y gobernanza Git

## Workflows

- `.github/workflows/pr-checks.yml`: 5 checks obligatorios en PR hacia `dev`, `test` o `prod`.
  - `lint-build`
  - `unit-tests`
  - `integration-tests`
  - `e2e-tests`
  - `terraform-plan`
- `.github/workflows/deploy.yml`: se ejecuta después de un push a `dev`, `test` o `prod`.
- Terraform aplica únicamente el workspace igual al nombre de la rama destino.
- El despliegue usa runner self-hosted Windows etiquetado `aegisvolt`.

## Protección de ramas

Instalar y autenticar GitHub CLI:

```powershell
winget install --id GitHub.cli -e
gh auth login
.\scripts\protect-branches.ps1 owner/repository
```

Alternativa Bash:

```bash
./scripts/protect-branches.sh owner/repository
```

La protección exige PR, 1 aprobación, los 5 estados verdes, administradores incluidos, sin force push y sin borrado.

## Runner self-hosted

1. Abrir GitHub → Settings → Actions → Runners → New self-hosted runner.
2. Seleccionar Windows x64 y ejecutar exactamente los comandos que GitHub muestra.
3. Iniciar el runner con etiquetas `self-hosted,Windows,aegisvolt`.
4. Mantener Docker Desktop, kind, kubectl y Terraform disponibles en el PATH.
5. Mantener Floci y el clúster kind activos en el equipo.

## Promoción lineal

```text
feature/* -> dev -> test -> prod
```

Nunca se permite promover directamente una rama feature a test o prod. La rama destino determina el workspace de Terraform y el overlay Kustomize.

## Pruebas

### PR con check rojo

Crear un PR hacia `dev` y romper deliberadamente una prueba o lint. Verificar que el merge quede bloqueado hasta que los 5 checks sean verdes.

### Push directo

Ejecutar:

```powershell
git push origin dev
```

Debe ser rechazado por la protección de rama.

### Force push

Ejecutar:

```powershell
git push --force origin dev
```

Debe ser rechazado por `allow_force_pushes=false`.

### Deployment

Después de merge/push:

```powershell
git switch dev
git pull
```

El workflow debe derivar `github.ref_name=dev`, seleccionar el workspace `dev`, aplicar infraestructura, cargar imágenes en kind y desplegar el overlay `dev`.

## Resultado esperado

- PR a dev/test/prod ejecuta cinco checks.
- Plan Terraform usa `github.base_ref` como ambiente objetivo.
- Merge usa `github.ref_name` como ambiente de apply.
- Direct push y force push quedan prohibidos por rama protegida.
- Deploy local usa solo el runner self-hosted.

## Resultado ejecutado

- Workflows creados y parseados como YAML válido: `pr-checks.yml` y `deploy.yml`.
- Script PowerShell de protección validado sintácticamente.
- GitHub CLI 2.105.0 instalado.
- GitHub CLI no está autenticado en esta máquina; la protección real aún debe aplicarse con `gh auth login` y el script correspondiente.
- No existía repositorio Git ni remoto; se inicializó un repositorio local en la rama `dev`.
- No se configuró un remoto ni se protegieron ramas reales porque requieren URL del repositorio y autenticación del usuario.
- Los 5 checks de PR están definidos con nombres: `lint-build`, `unit-tests`, `integration-tests`, `e2e-tests`, `terraform-plan`.

Detener aquí hasta indicar la siguiente fase.
