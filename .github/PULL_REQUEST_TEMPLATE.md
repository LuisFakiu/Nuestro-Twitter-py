## Qué

<!-- Una frase: qué hace este PR. -->

## Por qué

<!-- Motivación / issue / parte de qué tarea de TAREAS.md. -->

## Cómo probarlo

<!-- Pasos concretos. Ejemplo:
1. docker compose up --build
2. curl -X POST http://localhost:8000/api/auth/login/ -d '...'
3. Esperar status 200 con `access` y `refresh` en respuesta.
-->

## Checklist

- [ ] Tests pasan (`docker compose exec backend python manage.py test`)
- [ ] `docker compose up --build` levanta sin errores
- [ ] Migraciones incluidas si toqué models
- [ ] Sin `print()`, `console.log()`, `debugger`, secrets
- [ ] Puedo explicar cada línea de mi código (no copy-paste ciego de IA)
- [ ] Lo revisó otro miembro del equipo
