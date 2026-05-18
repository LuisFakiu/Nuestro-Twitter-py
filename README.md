# Nandetuiter

Clon de Twitter educativo. Backend **Django + DRF**, frontend **Angular 18**, base **SQLite** en dev. Tema visual: terminal negro + verde fosforescente.

---

## Stack

| Capa        | Tecnología                                                      |
|-------------|-----------------------------------------------------------------|
| Backend     | Django 5.2, Django REST Framework, SimpleJWT, django-constance  |
| Frontend    | Angular 18 (standalone components, signals, SCSS)               |
| Base (dev)  | SQLite (archivo local, cero instalación)                        |
| Base (prod) | PostgreSQL 16 (más adelante)                                    |

> Docker existe en el repo (`docker/`, `docker-compose.yml`) pero **no se usa en dev**. Queda para producción futura. Ignoralo por ahora.

## Estructura

```
nandetuiter/
├── apps/
│   ├── accounts/   # User custom, JWT, follows
│   ├── posts/      # Posts, likes, paginación
│   └── core/       # /api/config/, /api/health/, seeder, middleware
├── nandetuiter/
│   └── settings/   # base.py (SQLite), dev.py, prod.py
├── frontend/       # App Angular 18
├── manage.py
├── requirements.txt
├── .env.example
└── db.sqlite3      # Se crea al correr `migrate` o `seed`
```

---

## Requisitos previos

Instalá en tu máquina:

1. **Git** → https://git-scm.com/downloads
2. **Python 3.12+** → https://www.python.org/downloads/
   - Windows: tildá **"Add Python to PATH"** durante la instalación.
3. **Node.js 20+ LTS** → https://nodejs.org/

Verificá:

```bash
git --version
python --version       # macOS/Linux puede ser python3
node --version
npm --version
```

---

## Setup paso a paso (primera vez)

### 1. Cloná el repositorio

```bash
git clone <URL-del-repo>
cd nandetuiter
```

### 2. Creá el `.env`

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**

```bash
cp .env.example .env
```

El `.env` por defecto ya funciona, no necesitás editar nada para arrancar.

### 3. Backend — crear y activar virtualenv

**Windows PowerShell:**

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Si PowerShell bloquea el script:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

**Linux / macOS:**

```bash
python3 -m venv venv
source venv/bin/activate
```

> Tu prompt debe mostrar `(venv)` al inicio.

### 4. Instalar dependencias Python

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Migrar SQLite

```bash
python manage.py migrate
```

Crea `db.sqlite3` en la raíz.

### 6. Cargar datos de prueba (seeder)

```bash
python manage.py seed
```

Esto crea:

| Tipo       | Detalle                                                    |
|------------|------------------------------------------------------------|
| Superuser  | `admin` / `admin12345`                                     |
| Demo users | `user1`...`user5` / `demo12345`                            |
| Posts      | 40 posts random                                            |
| Likes      | Random entre los usuarios                                  |
| Follows    | Random entre los usuarios                                  |

Opciones:

```bash
python manage.py seed --users 10 --posts 100   # cantidades custom
python manage.py seed --flush                   # borra todo y reseedea
```

### 7. Levantar el backend

```bash
python manage.py runserver
```

Backend en **http://localhost:8000**. Dejá la terminal abierta.

### 8. Frontend — abrir OTRA terminal

```bash
cd frontend
npm install
```

(la primera vez tarda unos minutos)

### 9. Levantar el frontend

```bash
npm start
```

Si el puerto 4200 está ocupado:

```bash
npm start -- --port 4201
```

Frontend en **http://localhost:4200**.

### 10. Abrí la app

| Servicio              | URL                                         |
|-----------------------|---------------------------------------------|
| Frontend Angular      | http://localhost:4200                       |
| Backend (índice)      | http://localhost:8000                       |
| Admin Django          | http://localhost:8000/admin/                |
| Endpoint config       | http://localhost:8000/api/config/           |
| Endpoint posts        | http://localhost:8000/api/posts/            |

Login admin: `admin` / `admin12345`.

---

## Flujo diario (después de la primera vez)

**Terminal 1 — backend:**

```bash
# Windows
.\venv\Scripts\Activate.ps1
# Linux/macOS
source venv/bin/activate

python manage.py runserver
```

**Terminal 2 — frontend:**

```bash
cd frontend
npm start
```

Abrí http://localhost:4200.

---

## Comandos comunes

### Backend

```bash
# Migraciones después de tocar models.py
python manage.py makemigrations
python manage.py migrate

# Seeder
python manage.py seed
python manage.py seed --flush --users 10 --posts 100

# Shell Django
python manage.py shell

# Tests
python manage.py test

# Crear superuser manual
python manage.py createsuperuser

# Instalar paquete y persistirlo
pip install <paquete>
pip freeze > requirements.txt
```

### Frontend

```bash
# Generar componente
npx ng generate component pages/feed --standalone

# Generar servicio
npx ng generate service services/api

# Build producción
npx ng build

# Tests
npx ng test
```

---

## API actual

| Método | Endpoint                  | Auth      | Descripción                              |
|--------|---------------------------|-----------|------------------------------------------|
| GET    | `/`                       | -         | Índice JSON con links útiles             |
| GET    | `/api/config/`            | -         | Config dinámica (constance)              |
| GET    | `/api/health/`            | -         | Healthcheck                              |
| POST   | `/api/auth/login/`        | -         | JWT login (devuelve access + refresh)    |
| POST   | `/api/auth/refresh/`      | -         | Refresh del access token                 |
| GET    | `/api/posts/`             | -         | Listar posts paginados (`?page=N`)       |
| POST   | `/api/posts/`             | JWT       | Crear post                               |

---

## Configuración dinámica (django-constance)

Editables desde `/admin/constance/config/` sin reiniciar:

| Key                | Default       | Descripción                                  |
|--------------------|---------------|----------------------------------------------|
| `SITE_NAME`        | "Nandetuiter" | Nombre mostrado en el frontend               |
| `POST_MAX_CHARS`   | 280           | Límite de caracteres por post                |
| `POSTS_PER_PAGE`   | 20            | Tamaño de página del feed                    |
| `MAINTENANCE_MODE` | False         | Bloquea la app a usuarios no-staff (503)     |

El frontend hace `GET /api/config/` y respeta `POSTS_PER_PAGE` para el paginador.

---

## Solución de problemas

**`python` no encontrado (Windows)**
Reinstalá Python tildando "Add Python to PATH". O usá `py` en vez de `python`.

**`.\venv\Scripts\Activate.ps1` bloqueado**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

**`ModuleNotFoundError: No module named 'django'`**
Activá el venv. Tu prompt debe empezar con `(venv)`.

**Puerto 8000 / 4200 ocupado**
- Backend: `python manage.py runserver 8001`
- Frontend: `npm start -- --port 4201`

Matar proceso en Windows:
```powershell
netstat -ano | findstr :4200
taskkill /PID <PID> /F
```

**`npm error could not determine executable to run`**
Estás corriendo `npm`/`npx` desde la raíz. Hacé `cd frontend` primero.

**Frontend muestra "Backend no disponible"**
El backend Django no está corriendo en `:8000`. Levantalo en otra terminal.

**CORS error en consola del navegador**
Verificá que `.env` tenga `DJANGO_SETTINGS_MODULE=nandetuiter.settings.dev` (en dev se permite todo origen).

**Reset total**
```bash
# Borrar DB + volver a empezar
rm db.sqlite3
python manage.py migrate
python manage.py seed
```

---

## Decisiones de diseño

- **SQLite en dev**: arranque inmediato, sin instalar Postgres ni Docker.
- **Postgres reservado para prod**: paridad real cuando se llegue a deploy.
- **JWT (no sessions)**: stateless, encaja con SPA Angular.
- **django-constance**: cambiar límites o activar mantenimiento sin redeploy.
- **Custom User desde día 0**: cambiarlo después rompe migraciones (irreversible).
- **Apps bajo `apps/`**: organización cuando el repo crece.
- **Angular standalone + signals**: idiomático en Angular 18, sin NgModules.
- **Tema terminal (negro + neon)**: identidad visual; vars CSS globales en `frontend/src/styles.scss`.

---

## Equipo

- **Dev A (Luis)**: backend lead (accounts, posts, core, settings, seeder).
- **Dev B**: frontend Angular (auth UI, feed, perfil, composer).
- **Dev C**: backend de soporte (endpoints aislados, tests, seed).

Más docs:
- `TAREAS.md` — asignación día por día.
- `BITACORA.md` — log de decisiones técnicas.
- `CONTRIBUTING.md` — flujo de ramas y reglas de PR.
- `ARQUITECTURA.md` — diagrama de capas y datos.
