# Nandetuiter

Clon de Twitter educativo. Backend Django + DRF, frontend Angular, todo en Docker.

## Stack

- **Backend**: Django 5.2 + Django REST Framework + SimpleJWT + django-constance
- **Base de datos**: PostgreSQL 16
- **Frontend**: Angular (servido por Vite/ng en dev)
- **Infra**: Docker + docker-compose

## Estructura

```
nandetuiter/
├── apps/
│   ├── accounts/   # Custom User, auth JWT, perfil, follows
│   ├── posts/      # Posts, likes, feed
│   └── core/       # Constance config, maintenance middleware, /api/config/
├── nandetuiter/
│   └── settings/   # base.py, dev.py, prod.py
├── frontend/       # Angular (Dev B inicializa con `ng new`)
├── docker/
└── docker-compose.yml
```

## Setup local

Requisitos: Docker Desktop + Git. **No necesitás instalar Python ni Node localmente.**

```bash
# 1. Clonar
git clone <repo-url>
cd nandetuiter

# 2. Variables de entorno
cp .env.example .env
# (opcional) cambiar SECRET_KEY usando:
# docker run --rm python:3.12-slim python -c "import secrets; print(secrets.token_urlsafe(50))"

# 3. Levantar todo
docker compose up --build

# 4. En otra terminal: migraciones + superuser
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

Servicios:
- Backend: http://localhost:8000
- Admin: http://localhost:8000/admin/
- Config endpoint: http://localhost:8000/api/config/
- Frontend Angular: http://localhost:4200 (cuando Dev B termine `ng new`)

## Frontend (primera vez, Dev B)

```bash
# Borrar .gitkeep de frontend/
docker compose run --rm frontend npx -p @angular/cli@latest ng new . --routing --style=scss --skip-git --directory=.
docker compose up frontend
```

## Comandos comunes

```bash
# Crear migración después de tocar models.py
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate

# Tests
docker compose exec backend python manage.py test

# Shell Django
docker compose exec backend python manage.py shell

# Ver logs
docker compose logs -f backend
```

## Configuración dinámica (django-constance)

Estas variables se editan desde `/admin/constance/config/` sin redeploy:

| Key               | Default       | Descripción                              |
|-------------------|---------------|------------------------------------------|
| `SITE_NAME`       | "Nandetuiter" | Nombre mostrado en el frontend           |
| `POST_MAX_CHARS`  | 280           | Límite de caracteres por post            |
| `POSTS_PER_PAGE`  | 20            | Tamaño de página del feed                |
| `MAINTENANCE_MODE`| False         | Bloquea la app a usuarios no-staff (503) |

El frontend lee `SITE_NAME`, `POST_MAX_CHARS` y `POSTS_PER_PAGE` desde `GET /api/config/`.

## Decisiones de diseño

- **JWT (no sessions)**: stateless, encaja con SPA Angular separada del backend.
- **PostgreSQL en Docker (no SQLite)**: paridad con producción y soporte completo de constraints.
- **django-constance**: cambiar límite de caracteres / activar mantenimiento sin redeployar.
- **Custom User desde día 0**: cambiarlo después rompe migraciones (decisión irreversible en Django).
- **Apps en `apps/`**: ordena el repo cuando crece.
- **CORS abierto en dev, restringido en prod**: simplifica desarrollo sin sacrificar seguridad real.

## Equipo

- **Dev A (Luis)**: backend lead (accounts, posts, core, Docker, settings, infra).
- **Dev B**: frontend Angular (auth UI, feed, perfil, composer).
- **Dev C**: backend de soporte (endpoints aislados, tests, seed).

Ver `TAREAS.md` para asignación día por día.
Ver `BITACORA.md` para el log de decisiones de Luis.
Ver `CONTRIBUTING.md` para flujo de ramas y reglas de PR.
