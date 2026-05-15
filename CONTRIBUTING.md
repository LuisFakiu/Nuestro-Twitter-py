# Cómo contribuir a Nandetuiter

Equipo chico, plazos cortos. Reglas simples para no pisarnos.

## Flujo de ramas (GitHub Flow)

- `main` siempre desplegable. Nadie commitea directo.
- Para cada tarea: crear rama desde `main`:
  ```bash
  git checkout main
  git pull
  git checkout -b feat/<area>-<descripcion-corta>
  ```
- Convención de nombres:
  - `feat/accounts-jwt-login`
  - `feat/posts-feed-endpoint`
  - `feat/angular-feed-component`
  - `fix/posts-paginacion-rota`
  - `docs/readme-setup-windows`

## Pull Requests

1. Antes de abrir PR:
   - Tu rama está rebaseada sobre `main` (o al menos al día).
   - Tests pasan: `docker compose exec backend python manage.py test`
   - `docker compose up --build` levanta sin errores.
   - No quedan `print()`, `console.log()`, `debugger`, secrets hardcodeados.
2. PR pequeño: idealmente < 300 líneas. Si es más grande, partir en varios.
3. Título: `[area] qué hace`. Ej: `[accounts] add JWT login endpoint`.
4. Descripción incluye:
   - **Qué**: una frase.
   - **Por qué**: motivación.
   - **Cómo probarlo**: pasos con `curl` o instrucciones UI.
5. **Review obligatorio por OTRO miembro** (no el autor). Si tocás backend, te revisa Dev B o Dev C, etc. Esto fuerza que todos lean código de los demás → defendemos el proyecto en clase.
6. Mergear con **squash merge**.

## Commits

- Mensajes en imperativo: `add login endpoint`, `fix off-by-one en paginación`.
- Prefijo de área: `[accounts]`, `[posts]`, `[core]`, `[frontend]`, `[docker]`, `[docs]`.
- **Escritos a mano**, no copiar de IA. Mensajes claros = profe contento.

## Política de uso de IA

- IA permitida como asistente (igual que Stack Overflow o documentación).
- **Cada dev debe poder explicar línea por línea su código en clase.** Si no lo entendés, no lo mergees.
- Si IA te ayudó, igual revisás, ajustás al estilo del proyecto, agregás tests propios.
- Tests siempre los escribe el humano que entiende el feature.

## Estilo

- Backend: PEP8, comillas simples, líneas ≤ 100 chars.
- Frontend: convenciones de Angular CLI (sin tocar `tsconfig` salvo necesidad).
- Sin comentarios obvios. Solo comentar el "por qué" cuando no es evidente.

## División de trabajo

- **No tocar archivos de otra área sin avisar**. Si necesitás un endpoint nuevo, abrir un issue o pedirlo en el chat.
- `nandetuiter/settings/` lo edita SOLO Luis. Cambios pedirlos por issue.
- Migraciones: si dos personas crean migraciones en la misma app a la vez, hay que merguear con cuidado. Coordinar en el chat antes.
