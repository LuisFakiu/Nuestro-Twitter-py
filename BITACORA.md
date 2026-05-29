# Bitácora — Luis (Dev A, líder)

Log cronológico de decisiones, trabajo y problemas. Una entrada por sesión de trabajo.

**Formato de cada entrada:**
- **Fecha** (YYYY-MM-DD) — sesión del día.
- **Qué hice**: lista de cambios concretos.
- **Por qué**: razón / contexto / problema que resolvía.
- **Problemas encontrados**: bugs, dudas, cosas que no funcionaron.
- **Decisiones tomadas**: si elegí entre opciones, cuál y por qué.
- **Próximos pasos**: lo que sigue.

---

## 2026-05-14 — Setup inicial del esqueleto

### Qué hice
- Definí estructura del proyecto en equipo (3 personas, 3 semanas, 3 clases).
- Creé plan completo en `C:\Users\luisk\.claude\plans\c-workspace-nandetuiter-nandetuiter-mira-groovy-mitten.md`.
- Splitéo `settings.py` en `settings/base.py`, `dev.py`, `prod.py` con `python-decouple`.
- Creé `apps/accounts/` con Custom User (`AbstractUser`) + modelo `Follow` con constraints (unique + no_self_follow).
- Creé `apps/posts/` con modelos `Post` y `Like` (placeholders, lógica viene Sem 2).
- Creé `apps/core/` con:
  - django-constance configurado: `SITE_NAME`, `POST_MAX_CHARS`, `POSTS_PER_PAGE`, `MAINTENANCE_MODE`.
  - `MaintenanceModeMiddleware` que devuelve 503 si la flag está activa y el user no es staff.
  - Endpoint `GET /api/config/` para que Angular consuma config en runtime.
  - Endpoint `GET /api/health/` para chequeos.
- Configuré DRF + SimpleJWT + CORS en `base.py`.
- Cambié DB de SQLite a PostgreSQL 16 en Docker.
- Creé `docker-compose.yml` con `db` + `backend` + `frontend`. Healthcheck en Postgres.
- `Dockerfile.backend` (python:3.12-slim) y `Dockerfile.frontend` (node:20-alpine).
- Creé `.env.example`, `.gitignore`, `.dockerignore`.
- Escribí `README.md` con setup paso a paso.
- Escribí `CONTRIBUTING.md` con flujo de ramas, reglas de PR y política de IA.
- Creé `TAREAS.md` con asignación día por día para Dev A/B/C.
- Plantilla de PR en `.github/PULL_REQUEST_TEMPLATE.md`.

### Por qué
- Profe pide Docker → todo dockerizado desde día 0, sin venv local.
- Profe pide django-constance → expusimos 4 keys útiles y un endpoint público para que el frontend las consuma.
- Equipo de 3 con tiempo limitado → MVP estricto (auth + posts + likes + follows + feed). Hashtags / comentarios / notif / búsqueda quedan como **stretch** (no entran si no hay tiempo).
- Custom User desde el día 0: cambiarlo después rompe migraciones, así que lo dejé bloqueado antes de cualquier `migrate`.
- Apps en `apps/` para que el repo quede ordenado cuando crezca.

### Decisiones tomadas
- **Postgres en vez de SQLite** → paridad con prod, soporta `CheckConstraint` que uso en `Follow.no_self_follow`.
- **JWT en vez de sessions** → Angular es SPA separada, JWT encaja naturalmente.
- **Constance backend `database`** (no Redis) → un servicio menos en Docker.
- **GitHub Flow** (no Git Flow) → equipo nuevo + plazo corto, no necesitamos `develop`.
- **`apps/core` para constance + middleware + config endpoint** en vez de meterlos en `nandetuiter/` → mantiene la config del proyecto separada de la lógica de la app.

### Problemas encontrados
- Ninguno todavía. Pendiente probar `docker compose up --build` end-to-end y correr migraciones.

### Próximos pasos (antes de clase 1)
1. Probar `docker compose up --build` localmente y `migrate`.
2. Crear superuser y verificar admin + `/admin/constance/config/`.
3. Verificar `GET /api/config/` devuelve los 3 valores.
4. Verificar maintenance mode: activar desde admin y comprobar 503.
5. Crear branch `setup/skeleton`, commitear todo, abrir PR a main, mergear (auto-review porque soy el único hasta ahora).
6. Pasar `TAREAS.md` y link al repo a Dev B y Dev C.

---

<!-- Plantilla para próximas entradas. Copiar y completar.

## YYYY-MM-DD — Título corto

### Qué hice
-

### Por qué
-

### Problemas encontrados
-

### Decisiones tomadas
-

### Próximos pasos
-

---
-->
