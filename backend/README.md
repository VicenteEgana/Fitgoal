# FitGoal API

Monolito modular en Node.js 24 + Express 5 sobre PostgreSQL. Implementa el modelo del producto: **un catálogo de rutinas, ejercicios y reglas que el preparador físico aprueba una sola vez, y personas que empiezan una rutina recomendada al instante o arman la propia**. Incluye cuentas por rol, consentimientos, derechos sobre datos y auditoría.

## Ejecución

```powershell
npm ci
npm start          # http://127.0.0.1:3000 · /app/ sirve el cliente Flutter de ../mobile/build/web
```

Sin `DATABASE_URL`, la API usa **PGlite** (PostgreSQL 18.3 compilado a WASM) en `data/pgdata`, aplica las migraciones y, si no es producción, crea datos de demostración ficticios (cuentas `admin@`, `preparador@`, `nutricionista@` y `participante@fitgoal.demo`; contraseña en `src/seed/demo.js`; 39 ejercicios y 156 rutinas aprobadas por objetivo, nivel, equipo, categoría de IMC y división (full body, upper/lower y push/pull/legs), 57 alimentos, 4 pautas de alimentación de 7 días, reglas de entrenamiento y nutricionales vigentes, y un ejercicio y una rutina en borrador). Con `DATABASE_URL` usa `pg` contra PostgreSQL con las mismas migraciones y sin semilla.

`npm run reset-demo` borra solo la base local de desarrollo (se niega si hay `DATABASE_URL`). `npm run migrate` aplica las migraciones pendientes.

### Variables de entorno

| Variable | Uso |
|---|---|
| `PORT`, `HOST` | Por defecto `3000` y `127.0.0.1` (`0.0.0.0` en producción). |
| `NODE_ENV=production` | Exige secretos explícitos, desactiva la semilla y el registro de cuentas ficticias. |
| `DATABASE_URL` | PostgreSQL gestionado; sin ella se usa PGlite. |
| `JWT_SECRET`, `PSEUDONYM_SECRET` | Obligatorios en producción (≥ 32 caracteres). En desarrollo se generan secretos efímeros. |
| `CORS_ORIGIN` | Lista separada por comas. Sin ella solo se aceptan orígenes `localhost`, `127.0.0.1` y `[::1]`. |
| `TRUST_PROXY=1` | Confía en `X-Forwarded-For` detrás de un proxy (para los límites por IP). |
| `WEIGHT_TRACKING_ENABLED=1` | Permite registrar peso en cuentas reales (por defecto solo en cuentas ficticias). |
| `ALLOW_FICTITIOUS_REGISTRATION` | Permite crear cuentas ficticias desde el registro (por defecto sí fuera de producción). |
| `FITGOAL_DATA_DIR`, `FITGOAL_TIMEZONE` | Carpeta de PGlite y zona horaria de las sesiones (`America/Santiago`). |

## Seguridad aplicada

- Contraseñas con **Argon2id** (m = 19 MiB, t = 2, p = 1). Acceso con **JWT de 15 minutos** y **refresh rotativo de 7 días**; reutilizar un refresh ya rotado cierra la sesión y queda auditado. Cada petición verifica el JWT, la fila de sesión, la versión de sesión y el estado de la cuenta.
- Límites: 120 solicitudes/minuto y 10 intentos fallidos de acceso cada 15 minutos.
- Cabeceras de seguridad, JSON limitado a 100 kB, `Cache-Control: no-store` en `/api`.
- Roles `user`, `trainer`, `nutritionist`, `admin`. La competencia se impone en la base de datos mediante claves foráneas compuestas (solo el preparador aprueba ejercicios, rutinas y reglas de entrenamiento; solo la nutricionista, los alimentos, las pautas de alimentación y las reglas nutricionales).
- **Solo lo aprobado llega a las personas.** Un disparador impide iniciar una plantilla o usar un ejercicio que no esté aprobado, y congela las rutinas iniciadas y las versiones aprobadas. `audit_log` es de solo inserción.
- La **estatura y el peso** son datos de salud: solo se guardan con el consentimiento específico `datos_corporales`, y se borran de todas las versiones del perfil si se revoca o si se ejerce la oposición. El IMC se calcula en el servidor y nunca se almacena.
- Datos de estimación energética (sexo, peso, talla, actividad) únicamente en perfiles ficticios, exigido por una restricción `CHECK`.
- Eventos de uso seudonimizados con HMAC, sin clave foránea a la persona.

## Módulos (`src/modules`)

| Módulo | Responsabilidad |
|---|---|
| `identity` | Registro con consentimientos, acceso, refresh, cierre de sesión, cambio de contraseña. |
| `profile` | Perfil versionado (con estatura y peso opcionales, y su IMC) y consentimientos. |
| `catalog` | Ejercicios, rutinas (plantillas) y reglas de recomendación, con versión, aprobación y retiro por el profesional competente. |
| `recommend` | Rutinas recomendadas según las reglas aprobadas, exploración del catálogo, biblioteca de ejercicios y sugerencias según el objetivo. |
| `plans` | Iniciar una rutina recomendada o propia (validación, copia del contenido y programación de sesiones), rutina vigente e historial. |
| `progress` | Horario semanal con días de descanso, sesiones, registro, peso, adherencia, racha (con comodín semanal; `src/lib/streak.js`) y avisos. |
| `estimates` | Estimación energética (Mifflin-St Jeor), solo perfiles ficticios. |
| `datarights` | Solicitudes de acceso, rectificación, eliminación, bloqueo y portabilidad con plazos y prórroga. |
| `admin` | Cuentas, auditoría, indicadores K1, K2, K3 y K5 y mantenimiento (recordatorios de sesiones). |

El servidor ejecuta el mantenimiento cada hora; `POST /api/admin/maintenance/run` lo dispara a mano.

## Cómo se recomienda y cómo se arma una rutina

- **Reglas de entrenamiento** (`rule_versions`, ámbito `entrenamiento`): `matrix[objetivo][nivel][equipo][rangoDePeso]` indica el código de la rutina recomendada, y `focusGroups[objetivo]` los grupos de ejercicios que se sugieren, en orden. Al aprobarlas, el sistema comprueba que cada rutina nombrada esté aprobada y corresponda a su combinación.
- **IMC y recomendación:** el IMC es peso / estatura². La categoría usa los cortes de la OMS para adultos (bajo peso < 18,5; normal hasta 24,9; sobrepeso hasta 29,9; obesidad desde 30) y los del Minsal desde los 65 años (< 23; hasta 27,9; hasta 31,9; desde 32). Con ella, `recommendationFor` aplica los ajustes de las reglas aprobadas (`safety.adjustObjective`: con bajo peso no se recomienda bajar de peso; con obesidad, no subir de peso) elige la división con `splitRules` (la primera condición de nivel y días que se cumple: principiante → full body; con experiencia y 6 días → push/pull/legs; 4 o 5 días → upper/lower; si no, full body) y busca en la matriz la rutina de la categoría y la división; las otras divisiones de la misma combinación se devuelven como alternativas. Sin estatura y peso (o sin consentimiento vigente) se usa la categoría `general`, de bajo impacto. Con sobrepeso u obesidad no se sugieren ejercicios de alto impacto (`safety.avoidHighImpact`). Las rutinas que piden más o menos días, o más minutos, que el perfil se recomiendan igual, con un aviso. Al iniciar una rutina, cada día elegido recibe el nombre de su sesión en ciclo (por ejemplo, push/pull/legs en 6 días repite empuje, tracción y piernas).
- **Iniciar una rutina recomendada:** la persona elige entre el mínimo y el máximo de días de la rutina. El sistema copia los ejercicios de la plantilla, guarda las versiones de plantilla, reglas y perfil usadas, reemplaza la rutina vigente (quita las sesiones futuras sin hacer) y programa las sesiones desde el día siguiente.
- **Rutina propia:** una sesión por día elegido, de 1 a 12 ejercicios aprobados sin repetir, con series 1–6 y repeticiones 1–50 o segundos 5–600; sin ajuste se usa la indicación sugerida por el profesional.

## Contrato de API (resumen)

Todas las rutas cuelgan de `/api`. Los errores siguen `{ "error": { "code", "message" } }`. Excepto las públicas, requieren `Authorization: Bearer <accessToken>`.

| Grupo | Rutas | Rol |
|---|---|---|
| Salud | `GET /health`, `GET /api/health` | público |
| Acceso | `POST /public/registration-started`, `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` | público |
| Cuenta | `POST /auth/logout`, `POST /auth/change-password`, `GET /auth/me` | todos |
| Perfil | `GET/PUT /profiles/me`, `GET /profiles/me/versions`, `GET/POST /consents` | user |
| Recomendación | `GET /routines`, `GET /routines/:id`, `GET /exercises`, `GET /exercises/suggestions` | user |
| Rutina | `POST /plans/start`, `GET /plans/me`, `GET /plans/me/history` | user |
| Seguimiento | `GET /schedule/me?date=` (semana de lunes a domingo), `GET /sessions/me`, `POST /sessions/:id/complete`, `GET /sessions/:id/move-options` y `POST /sessions/:id/move` (cambiar una sesión a otro día libre), `GET/POST /weights/me`, `GET /progress/me` (adherencia, racha y calendario) | user |
| Avisos | `GET /notifications/me`, `POST /notifications/:id/read`, `POST /notifications/read-all` | todos los roles |
| Alimentación | `GET /meal-plans`, `GET /meal-plans/:id`, `GET /meal-plans/:id/alternatives?dayNo=&meal=&position=` (alimentos equivalentes), `PUT /meal-plans/:id/swaps` (cambiar un alimento, en una comida o en toda la semana; el alimento original lo deshace), `DELETE /meal-plans/:id/swaps` (volver a la pauta original) | user |
| Estimación | `GET /estimates/energy` | user (ficticio) |
| Datos personales | `POST /data-requests`, `GET /data-requests/me`, `GET /data-requests/:id/export` | user |
| Catálogo | `GET /catalog/exercises`, `/templates`, `/templates/:id`, `/rules`; `POST` de creación; `.../approve` y `.../retire` | lectura: trainer, nutritionist, admin · ejercicios y rutinas: trainer · reglas: trainer, nutritionist |
| Administración | `GET/POST/PATCH /admin/users`, `GET /admin/audit`, `GET /admin/kpis`, `GET /admin/data-requests`, `POST /admin/data-requests/:id/resolve`, `POST /admin/maintenance/run` | admin |

La persona nunca ve contenido en borrador: `GET /routines` y `GET /exercises` devuelven solo lo aprobado y vigente. Lo mismo con `GET /meal-plans`: solo pautas aprobadas por la nutricionista, con los gramos ajustados a las calorías del objetivo cuando la persona dio sus datos y consentimientos (`src/lib/energy.js` y `src/lib/meal-plans.js`). Si a la persona le falta un alimento, lo cambia por otro aprobado del mismo grupo que esa pauta incluye, con los gramos que aportan la misma energía; el cambio se guarda en `meal_plan_swaps` y un disparador de la base impide reemplazos de otro grupo. Si la persona no puede hacer una sesión, la cambia a otro día libre: desde hoy hasta 6 días después de su fecha (o de hoy, si ya venció), solo si no está registrada y venció hace 7 días o menos; nunca a un día pasado. `training_sessions.rescheduled_from` guarda la fecha original: ese día queda como «movida» en el horario y la racha (no suma ni corta) y la sesión cuenta en su nueva fecha para la adherencia. Si al iniciar la API la base local es de una versión anterior del modelo (faltan tablas o columnas), el servidor lo avisa: ejecuta `npm run reset-demo`. `node src/seed/export-meal-plans.js` escribe las pautas completas en `docs/pautas_de_alimentacion.md`.

## Base de datos

`migrations/001_modelo_mvp.sql` se genera desde `../docs/diagramas/schema/schema.mjs` (20 tablas). No se edita a mano: cambia el esquema, ejecuta `node generate.mjs` en `docs/diagramas` y `node schema/validate.mjs` (79 comprobaciones sobre PostgreSQL 18.3). `archivo/` conserva, solo como referencia, el primer incremento (demo sin cuentas) y la versión anterior del flujo con revisión por caso (borradores, revisiones y asignaciones), que ya no forma parte de la API.

## Pruebas

```powershell
npm test      # 148 pruebas, usan una base PGlite en memoria y un reloj inyectable
```

Cubren identidad (consentimientos, rotación y reutilización de refresh, límites), perfil versionado, estatura, peso e IMC con consentimiento, catálogo (borrador, aprobación, retiro, versiones y reglas con referencias válidas), recomendaciones (IMC y división de la semana) y biblioteca, calorías por objetivo y pautas de alimentación, cambio de alimentos por equivalentes, catálogo nutricional, inicio de rutinas (recomendada y propia, límites seguros, reemplazo, inmutabilidad), seguimiento, adherencia y cambio de una sesión a otro día, derechos sobre datos (plazos, prórroga, eliminación), administración e indicadores, y una prueba de humo del servidor.

## Alcance pendiente

Minutas y revisión nutricional, redacción de rutinas completas desde la app del preparador, despliegue (Dockerfile, Render, CI), pruebas de carga y copia de seguridad real contra un PostgreSQL gestionado quedan fuera de este avance.
