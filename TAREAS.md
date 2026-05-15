# TAREAS — Nandetuiter

Asignación día por día para que **no nos pisemos**. Cada tarea = una rama + un PR.

**Plazo**: 3 semanas, entrega **miércoles 2026-06-03** (clase 3).
**Sesiones de equipo**: miércoles 18:00–21:00 (clases 1, 2, 3).
**Hoy**: jueves 2026-05-14 → setup hecho por Luis antes de clase 1.

## Calendario

| Hito                 | Fecha       | Día        |
|----------------------|-------------|------------|
| Setup skeleton listo | 2026-05-19  | Martes     |
| Clase 1 (sincrónica) | 2026-05-20  | Miércoles  |
| Clase 2 (sincrónica) | 2026-05-27  | Miércoles  |
| Clase 3 — ENTREGA    | 2026-06-03  | Miércoles  |

## Roles

- **Dev A — Luis** (líder, backend completo): accounts, posts, core, Docker, infra.
- **Dev B**: frontend Angular (auth UI, feed, perfil, composer).
- **Dev C**: backend de soporte (intermitente, tareas aisladas).

---

## Semana 0 — Setup skeleton (HECHO por Luis, 2026-05-14 a 2026-05-19)

| Tarea | Quién | Estado |
|---|---|---|
| Estructura `apps/` + Custom User + Follow | Luis | ✅ |
| `apps/core` + constance + middleware + `/api/config/` | Luis | ✅ |
| Settings split (base/dev/prod) + Postgres | Luis | ✅ |
| Docker compose + Dockerfiles | Luis | ✅ |
| `.env.example`, `.gitignore`, `requirements.txt` | Luis | ✅ |
| README + CONTRIBUTING + PR template | Luis | ✅ |
| BITACORA.md + TAREAS.md | Luis | ✅ |
| **Probar `docker compose up` end-to-end** | Luis | ⏳ |
| **Mergear branch `setup/skeleton` → main** | Luis | ⏳ |
| **Compartir repo + TAREAS.md con Dev B y Dev C** | Luis | ⏳ |

---

## Semana 1 — Auth + frontend base (2026-05-20 a 2026-05-26)

### Clase 1 — miércoles 2026-05-20 (18:00–21:00, todos juntos)

| Hora        | Quién  | Qué |
|-------------|--------|-----|
| 18:00–18:30 | Todos  | Luis muestra estructura y `docker compose up`. Dev B y Dev C clonan, levantan local, crean su superuser. |
| 18:30–19:00 | Todos  | Walk-through Custom User + constance + maintenance middleware. |
| 19:00–20:00 | Dev B  | `ng new frontend` dentro de `frontend/`, primer commit. Genera estructura base con AuthModule y AppRoutingModule. |
| 19:00–20:00 | Dev C  | Lee `apps/accounts/models.py`. Hace endpoint `GET /api/users/<username>/` (perfil público) en `apps/accounts/views.py` con Luis al lado. |
| 19:00–20:00 | Luis   | Pair con Dev C en perfil público. |
| 20:00–21:00 | Todos  | Cada uno abre PR con lo de la clase. Review cruzado (Luis revisa Dev B, Dev B revisa Luis, etc.). Merge antes de irnos. |

### Después de clase 1 — fin de semana 2026-05-23 / 2026-05-24 (Luis)

| Tarea | Owner | Branch | Acceptance |
|---|---|---|---|
| `POST /api/auth/register/` (RegisterSerializer + UserCreateView) | Luis | `feat/accounts-register` | curl crea user, devuelve user serializado sin password |
| `POST /api/auth/login/` (ya está SimpleJWT, agregar test) | Luis | `feat/accounts-login-tests` | login con credenciales válidas devuelve `access` + `refresh` |
| `POST /api/auth/logout/` (blacklist de refresh) | Luis | `feat/accounts-logout` | refresh token blacklisted no funciona después |
| `GET/PATCH /api/me/` (perfil propio) | Luis | `feat/accounts-me` | autenticado puede leer y editar bio/avatar_url |
| `POST/DELETE /api/users/<username>/follow/` | Luis | `feat/accounts-follow` | A sigue B, A no puede seguirse a sí mismo (test del CheckConstraint) |
| `GET /api/users/<username>/followers/` y `/following/` | Luis | `feat/accounts-follow-lists` | Listas paginadas |
| Tests para todo lo anterior | Luis | (mismo PR) | `manage.py test apps.accounts` verde |

### Después de clase 1 — Dev B (en su tiempo, antes de clase 2)

| Tarea | Branch | Acceptance |
|---|---|---|
| `AuthService` (login, register, logout, refresh, almacena tokens en localStorage) | `feat/angular-auth-service` | Inyectable en componentes, tests de servicio pasan |
| HTTP interceptor: agrega `Authorization: Bearer <access>` automáticamente | `feat/angular-jwt-interceptor` | Llamadas a `/api/me/` van con header |
| Página Login | `feat/angular-login-page` | Form reactivo, validación, llama a AuthService.login |
| Página Register | `feat/angular-register-page` | Form, llama AuthService.register, redirige a login |
| AuthGuard que redirige a /login si no hay token | `feat/angular-auth-guard` | Rutas protegidas funcionan |
| `ConfigService` que llama `GET /api/config/` y cachea | `feat/angular-config-service` | Componentes leen `site_name`, `post_max_chars` |

### Después de clase 1 — Dev C (cuando pueda, antes de clase 2)

Tareas aisladas. Si no entrega, Luis cubre las críticas el último fin de semana.

| Tarea | Branch | Prioridad | Acceptance |
|---|---|---|---|
| `GET /api/users/<username>/` (perfil público — empezado en clase 1) | `feat/accounts-public-profile` | Alta | Devuelve username, bio, avatar_url, followers_count, following_count, posts_count |
| Tests de modelos (User, Follow) | `feat/accounts-model-tests` | Media | Cubre constraints unique_follow + no_self_follow |
| Validación: si intenta self-follow, error 400 con mensaje claro | `feat/accounts-validation-self-follow` | Media | Test que verifica el 400 |

---

## Semana 2 — Posts + feed (2026-05-27 a 2026-06-02)

### Clase 2 — miércoles 2026-05-27 (18:00–21:00, todos juntos)

| Hora        | Quién  | Qué |
|-------------|--------|-----|
| 18:00–19:00 | Todos  | Demo de auth funcionando E2E (Angular ↔ backend). Bug bash. |
| 19:00–20:00 | Luis   | Live coding: `PostSerializer`, `PostListCreateView`, validación con `config.POST_MAX_CHARS`, paginación con `config.POSTS_PER_PAGE`. |
| 19:00–20:00 | Dev B  | Empieza componente `FeedComponent` (lista posts vacía + servicio HTTP que pega a `/api/feed/`). |
| 19:00–20:00 | Dev C  | `LikeView` con POST/DELETE en `apps/posts/views.py`. |
| 20:00–21:00 | Todos  | PRs + review cruzada + merge. |

### Después de clase 2 — fin de semana 2026-05-30 / 2026-05-31 (Luis)

| Tarea | Branch | Acceptance |
|---|---|---|
| Completar CRUD de Post (`GET /api/posts/<id>/`, `DELETE /api/posts/<id>/`) | `feat/posts-crud` | Solo el autor puede borrar. Tests. |
| `GET /api/feed/` (posts de seguidos, paginado, orden desc) | `feat/posts-feed` | Si A sigue a B, A ve posts de B en su feed. Test E2E. |
| Validación `POST_MAX_CHARS` desde constance (no hardcodeado) | `feat/posts-max-chars-from-constance` | Cambiar config en admin → próximo POST respeta nuevo límite |
| Paginación con `POSTS_PER_PAGE` desde constance | `feat/posts-pagination-from-constance` | Cambiar config → respuesta tiene nuevo `page_size` |
| Tests: E2E flujo completo (register → follow → post → like → feed) | `feat/posts-e2e-tests` | `manage.py test` verde |

### Después de clase 2 — Dev B (antes de clase 3)

| Tarea | Branch | Acceptance |
|---|---|---|
| `FeedComponent` lista posts con paginación | `feat/angular-feed-list` | Scroll o botón "siguiente página" funciona |
| `ComposerComponent` (crear post) con contador `POST_MAX_CHARS` leído de ConfigService | `feat/angular-composer` | Botón submit deshabilitado si excede límite |
| `LikeButtonComponent` (toggle like) | `feat/angular-like-button` | Click optimista, rollback si falla |
| `ProfilePageComponent` (perfil de cualquier user, con follow button + lista posts) | `feat/angular-profile-page` | Funciona con username en la URL |
| Estilos mínimos (no hace falta diseño bonito, pero usable) | `feat/angular-basic-styles` | Se ve decente |

### Después de clase 2 — Dev C (cuando pueda)

| Tarea | Branch | Prioridad | Acceptance |
|---|---|---|---|
| `GET /api/users/<username>/posts/` (posts de un usuario, paginado) | `feat/posts-by-user` | Alta | Funciona, paginado |
| Tests de modelos Post + Like | `feat/posts-model-tests` | Media | Cubre unique_like |
| Seed script `apps/core/management/commands/seed.py` (5 users + 20 posts + follows random) | `feat/core-seed-command` | Baja | `manage.py seed` deja DB con datos demo |

---

## Semana 3 — Pulido + entrega (2026-06-01 a 2026-06-03)

### Lunes 2026-06-01 y martes 2026-06-02 (Luis)

| Tarea | Branch | Acceptance |
|---|---|---|
| `docker-compose.prod.yml` (gunicorn + Angular build estático) | `feat/docker-prod` | `docker compose -f docker-compose.prod.yml up` funciona |
| Probar `MAINTENANCE_MODE=True` desde admin → frontend muestra mensaje | `feat/maintenance-e2e` | Activar flag → users no-staff ven 503 + mensaje en Angular |
| README sección "Decisiones de diseño" detallada | `docs/readme-decisiones` | Justifica JWT, Postgres, constance, Docker, Angular |
| Bug bash final + tests E2E corriendo verdes | `fix/bugs-finales` | Todo verde |
| Tag `v1.0` después de aprobar | (en main, después del PR final) | Tag pusheado |

### Clase 3 — miércoles 2026-06-03 (ENTREGA)

| Hora        | Quién  | Qué |
|-------------|--------|-----|
| 18:00–18:30 | Luis   | Levanta `docker-compose.prod.yml` desde cero. Crea 2 users via UI. |
| 18:30–19:00 | Todos  | Demo en vivo: register → follow → post → like → feed. Cambiar `POST_MAX_CHARS` en admin en vivo. Activar maintenance mode. |
| 19:00–19:30 | Dev A  | Explica backend (modelos, JWT, constance, middleware). |
| 19:30–19:45 | Dev B  | Explica frontend (AuthService, interceptor, FeedComponent, ConfigService). |
| 19:45–20:00 | Dev C  | Explica lo que hizo (perfil público, posts por user, tests, seed). |
| 20:00–21:00 | Todos  | Buffer para preguntas del profe. Tag `v1.0`. |

---

## Stretch (NO obligatorio, agregar solo si sobra tiempo en sem 3)

En orden de valor:
1. Hashtags (parser `#palabra` + endpoint listar por hashtag).
2. Búsqueda de usuarios (`GET /api/search/?q=`).
3. Comentarios (modelo + CRUD).
4. Notificaciones (signals + endpoint).

---

## Reglas de oro

1. **Nadie commitea directo a `main`.** Todo va por PR.
2. **Review cruzado obligatorio** (Luis revisa Dev B, Dev B revisa Luis, etc.).
3. **Cada PR pequeño** (< 300 líneas idealmente).
4. **Tests con cada feature** del backend.
5. **Si te trabás más de 1 hora**, avisar al chat. No quedarse pegado.
6. **Settings y `docker-compose.yml`** los toca SOLO Luis. Cambios pedirlos por issue.
7. **Migraciones**: si dos personas tocan la misma app a la vez, coordinar en chat.
8. **Cada dev debe poder explicar SU código** en clase 3. IA OK como ayuda, no como autor.
