# Arquitectura — Nandetuiter

Guía para entender cómo está armado el esqueleto, dónde tocar cada cosa, y cómo fluye una request de punta a punta.

> Si recién clonás el repo, leé primero `README.md` (setup). Este documento es para entender el **porqué** del esqueleto.

---

## 1. Vista general

```
┌──────────────┐   HTTP/JSON   ┌──────────────┐   psycopg2   ┌──────────────┐
│  Angular SPA │ ────────────► │ Django + DRF │ ───────────► │ PostgreSQL 16│
│  :4200       │ ◄──── JWT ─── │ :8000        │              │ :5432        │
└──────────────┘               └──────┬───────┘              └──────────────┘
                                      │
                                      │ lee config en runtime
                                      ▼
                               django-constance
                               (tabla en la misma DB)
```

Todo corre en `docker-compose.yml`. 3 servicios: `db`, `backend`, `frontend`. Hot reload activo en backend (volumen `.:/app`) y frontend (volumen `./frontend:/app`).

---

## 2. Layout del repo y responsabilidades

```
nandetuiter/
├── manage.py                       # entrypoint Django, apunta a settings.dev
├── nandetuiter/                    # paquete config del proyecto (NO es una app)
│   ├── settings/
│   │   ├── base.py                 # común a dev y prod
│   │   ├── dev.py                  # DEBUG=True, CORS abierto
│   │   └── prod.py                 # cookies seguras, headers hardening
│   ├── urls.py                     # URLconf raíz, monta /admin/, /api/…
│   ├── wsgi.py / asgi.py           # apuntan a settings.prod
├── apps/
│   ├── accounts/                   # Custom User, JWT, perfil, follows
│   ├── posts/                      # Post, Like, feed
│   └── core/                       # constance config + health + maintenance middleware
├── frontend/                       # Angular (Dev B inicializa)
├── docker/
│   ├── Dockerfile.backend          # python:3.12-slim + requirements
│   └── Dockerfile.frontend         # node:20-alpine
├── docker-compose.yml
├── requirements.txt
├── .env.example                    # plantilla, copiar a .env
└── …
```

### Por qué `apps/` y no apps sueltas en la raíz

Cuando el proyecto crece (más de 2-3 apps) la raíz se ensucia con carpetas. Agrupándolas en `apps/` el repo queda limpio y las imports son explícitas (`apps.posts.models`). El `label = 'posts'` en cada `apps.py` mantiene los nombres cortos en el admin y migraciones.

---

## 3. Settings — por qué están partidos

`settings.py` único es cómodo al principio pero termina lleno de `if DEBUG:`. Lo partimos así:

| Archivo | Cuándo se usa | Qué define |
|---|---|---|
| `base.py` | siempre (lo importan los otros) | INSTALLED_APPS, MIDDLEWARE, DB, DRF, JWT, constance |
| `dev.py` | local + `manage.py` por default | `DEBUG=True`, `CORS_ALLOW_ALL_ORIGINS=True` |
| `prod.py` | `wsgi.py` / `asgi.py` | hardening (`SESSION_COOKIE_SECURE`, `X_FRAME_OPTIONS=DENY`, etc.) |

Todo lo sensible (`SECRET_KEY`, `POSTGRES_PASSWORD`) sale de `.env` vía `python-decouple`. Nunca hardcodear secrets en `base.py`.

**Cambiar entorno**: `export DJANGO_SETTINGS_MODULE=nandetuiter.settings.prod` (o setearlo en `.env`).

---

## 4. Flujo de una request — ejemplo: `POST /api/posts/`

```
1. Angular envía:
   POST http://localhost:8000/api/posts/
   Headers: Authorization: Bearer <access_jwt>
   Body:    { "content": "hola mundo" }

2. CORS middleware  → permite origen :4200 (dev).
3. Security/Session/CSRF middlewares  → estándar Django.
4. AuthenticationMiddleware  → request.user (puede ser AnonymousUser).
5. MaintenanceModeMiddleware (apps/core)  → si MAINTENANCE_MODE=True y user no staff → 503.
6. URLconf raíz (nandetuiter/urls.py)  → matchea 'api/' → apps.posts.urls.
7. View DRF (apps/posts/views.py)
   a. JWTAuthentication decodifica el Bearer → request.user real.
   b. IsAuthenticated permission → 401 si anónimo.
   c. Serializer valida content (longitud ≤ constance.POST_MAX_CHARS).
   d. Crea Post(author=request.user, content=…).
8. Response 201 JSON con el post creado.
```

Los modelos viven en `apps/<x>/models.py`, las views en `views.py`, las URLs en `urls.py`. Para datos serializados: crear `apps/<x>/serializers.py` cuando haga falta (no existen todavía — Sem 1/2 los agrega).

---

## 5. django-constance — config sin redeploy

Cambiar el límite de caracteres de un post **no requiere editar código ni redeployar**: se entra a `/admin/constance/config/` y se actualiza el valor. La app lo lee con `from constance import config; config.POST_MAX_CHARS`.

Keys actuales (definidas en `base.py`):

| Key | Default | Uso |
|---|---|---|
| `SITE_NAME` | "Nandetuiter" | mostrado en frontend (lo lee Angular vía `/api/config/`) |
| `POST_MAX_CHARS` | 280 | valida largo de post en backend y frontend |
| `POSTS_PER_PAGE` | 20 | tamaño de página del feed |
| `MAINTENANCE_MODE` | False | si True, el middleware corta no-staff con 503 |

Backend = `database`. No usamos Redis porque suma un servicio más a Docker sin beneficio para este scope.

---

## 6. Autenticación — JWT con simplejwt

| Endpoint | Qué hace |
|---|---|
| `POST /api/auth/login/` | recibe `{username, password}` → devuelve `{access, refresh}` |
| `POST /api/auth/refresh/` | recibe `{refresh}` → devuelve nuevo `{access}` |

- Access token vive **15 min**, refresh **7 días**.
- `ROTATE_REFRESH_TOKENS=True` + `BLACKLIST_AFTER_ROTATION=True`: cada refresh emite uno nuevo y el viejo queda inválido.
- Angular guarda los tokens (localStorage o memoria) y mete `Authorization: Bearer <access>` en cada request vía HTTP interceptor.

Custom User (`apps.accounts.User`) extiende `AbstractUser` con `bio` y `avatar_url`. **Crítico**: definirlo desde el día 0 — cambiar el modelo de usuario después rompe migraciones.

---

## 7. Maintenance mode (apps/core/middleware.py)

Cuando `MAINTENANCE_MODE=True`:
- Usuarios staff siguen entrando normal.
- Anónimos y usuarios comunes reciben `503` JSON.
- Excepciones (siempre pasan): `/admin/`, `/static/`, `/api/config/`.

Útil para hacer migraciones o tocar producción sin tirar el sitio del todo: el admin sigue funcionando y los clientes ven un mensaje claro.

---

## 8. Cómo agregar una feature nueva (receta)

Ejemplo: endpoint `GET /api/users/<username>/posts/`.

1. **Migración** (si tocás models.py): `docker compose exec backend python manage.py makemigrations posts && python manage.py migrate`.
2. **Serializer**: `apps/posts/serializers.py` con `PostSerializer(serializers.ModelSerializer)`.
3. **View**: `apps/posts/views.py` con `UserPostsView(generics.ListAPIView)` filtrando por `author__username`.
4. **URL**: `apps/posts/urls.py` → `path('users/<str:username>/posts/', UserPostsView.as_view())`.
5. **Test**: `apps/posts/tests.py` — un test creando user + post + GET y assertEqual status 200.
6. **Probar**: `curl http://localhost:8000/api/users/luis/posts/`.
7. **PR**: rama `feat/posts-user-posts-endpoint`, descripción + cómo probarlo.

---

## 9. Convenciones de código

- Imports: stdlib → terceros → locales, separados por línea en blanco.
- Strings: comillas simples (`'…'`), salvo cuando contienen apóstrofes.
- Migraciones: **siempre** se commitean. Nunca se editan a mano (salvo `RunPython` data migrations).
- No `print()` en código de prod. Usar `logging` (a configurar en Sem 3).
- No commitear `db.sqlite3`, `.env`, `__pycache__`, `node_modules/`.

---

## 10. Decisiones que cuesta revertir (justificación pal' profe)

| Decisión | Por qué | Costo de revertir |
|---|---|---|
| Custom User desde día 0 | Cambiar AUTH_USER_MODEL después invalida todas las migraciones | Reset DB |
| Postgres en Docker (no SQLite) | Constraints reales (CheckConstraint funcionan), paridad con prod | Dump + reload |
| `apps/` con paquete | Imports explícitas, repo limpio cuando crece | Mover archivos + renombrar imports |
| JWT en vez de session auth | SPA separada, sin cookies cross-domain | Cambio grande en Angular |
| django-constance backend=database | No suma Redis al stack | Migrar a Redis si crece tráfico |

---

## 11. Qué falta (esqueleto → MVP)

- **Sem 1 (Luis)**: serializers + views de `accounts` (register, me, follows). Tests.
- **Sem 1 (Dev B)**: Angular auth (login/register, AuthService, interceptor, guard).
- **Sem 2 (Luis)**: serializers + views de `posts` (CRUD, like, feed paginado).
- **Sem 2 (Dev B)**: feed UI, composer con contador de chars, perfil.
- **Sem 3**: `docker-compose.prod.yml` (gunicorn + nginx sirviendo build Angular), README final, defensa.

Ver `TAREAS.md` pa' desglose día a día.

---

## 12. Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `relation "auth_user" does not exist` | Migraciones no aplicadas | `docker compose exec backend python manage.py migrate` |
| `CORS error` desde Angular | `CORS_ALLOWED_ORIGINS` no incluye :4200 | Editar `.env` o usar `dev.py` |
| `psycopg2 OperationalError: could not connect` | DB todavía arrancando | Esperar healthcheck, o `docker compose restart backend` |
| `SECRET_KEY not found` | Falta `.env` | `cp .env.example .env` |
| Docker no levanta en Windows | WSL2 / Docker Desktop / build de SO no soportada | Probar `wsl --update`; alternativa: correr backend con venv local apuntando a DB en Docker |

---

Cualquier duda de arquitectura → preguntar en el grupo antes de inventar. Mejor 5 min preguntando que 2h reescribiendo.
