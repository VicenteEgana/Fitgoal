# FitGoal

Proyecto de título (TIHI84): aplicación de rutinas de entrenamiento **aprobadas por un profesional**, que cada persona puede empezar al instante o armar a su medida. Este repositorio contiene el código del MVP (Flutter + Node.js/Express + PostgreSQL) y la documentación de arquitectura de la Evaluación Sumativa 2.

La fuente de verdad del alcance base es `FitGoal_Formulacion_Proyecto_Corregida.docx` (01-10-2026). El producto evolucionó respecto de ese informe (ver `docs/cambios_al_informe.md`): el profesional ya no revisa cada caso, sino que aprueba **una sola vez** el catálogo que reciben todas las personas.

## Qué hace

1. La persona se registra aceptando por separado el tratamiento de sus datos (consentimientos con versión de política) y completa su perfil: objetivo (bajar, mantener o subir de peso), nivel, días, duración, equipo y, si quiere, su **estatura y peso** (datos de salud, con consentimiento específico), con los que la app calcula su **IMC**.
2. **Rutinas recomendadas:** con el IMC, la app muestra la rutina ya aprobada que corresponde a su objetivo, nivel, equipo y categoría de IMC (bajo peso, normal, sobrepeso u obesidad), organizada en **full body, upper/lower o push/pull/legs** según su nivel y sus días disponibles, con los motivos; las otras divisiones aparecen como alternativas. Las reglas de seguridad que aprueba el preparador evitan, por ejemplo, recomendar bajar de peso con bajo peso o ejercicios de alto impacto con sobrepeso. Sin estatura y peso se ofrece una rutina general de bajo impacto. También puede explorar todo el catálogo aprobado.
3. **Empieza al instante:** elige una rutina y sus días, y sus sesiones quedan programadas. No hay cola de revisión.
4. **Rutina propia:** arma la suya con ejercicios de la biblioteca aprobada; la app sugiere primero los ejercicios que las reglas del preparador indican para su objetivo, y limita series y repeticiones a valores seguros.
5. Registra sesiones (y peso, si lo habilitó), ve su adherencia y recibe avisos.
6. **El preparador físico** administra el catálogo: crea ejercicios, rutinas y reglas en borrador y los **aprueba una vez**, con versión. La base de datos exige su rol y solo se ofrece lo aprobado.
7. **Administración** gestiona cuentas, solicitudes de derechos sobre datos (acceso, rectificación, eliminación, bloqueo, portabilidad, con plazos de la Ley 21.719), auditoría e indicadores K1, K2, K3 y K5.

Roles: `user`, `trainer`, `nutritionist`, `admin`. El módulo de nutrición (minutas) aún no está construido.

## Iniciar

Requiere Node.js 24 o superior. Haz doble clic en `Iniciar_FitGoal.cmd` (o ejecuta `.\iniciar.ps1`) y abre http://127.0.0.1:3000/app/.

En desarrollo la API usa PostgreSQL 18 embebido (PGlite, en `backend/data/pgdata`, fuera de Git) y crea datos de demostración ficticios: 39 ejercicios y 156 rutinas aprobadas (objetivo × nivel × equipo × categoría de IMC × división: full body, upper/lower y push/pull/legs), 57 alimentos del mercado chileno y 4 pautas de alimentación de 7 días, más un ejercicio y una rutina en borrador para mostrar la aprobación. Cuentas: `participante@fitgoal.demo`, `preparador@fitgoal.demo`, `nutricionista@fitgoal.demo` y `admin@fitgoal.demo`; la contraseña común está en `backend/src/seed/demo.js`.

Recorrido sugerido (≈3 minutos):

1. Entra como participante: en **Mi rutina** verás una racha de demostración (la cuenta trae dos semanas de historial ficticio), el horario de la semana con los días de descanso y, si hoy toca, **Empezar sesión** con el temporizador de descanso. Revisa **Perfil** (activa «estatura y peso» y escríbelos para ver tu IMC) (activa «estatura y peso» y escríbelos para ver tu IMC) y abre **Rutinas**: verás la rutina recomendada para tu perfil (la división depende de tu nivel y tus días), con avisos según tu IMC y las otras divisiones como alternativas. Ábrela, revisa sus sesiones y pulsa **Empezar esta rutina**.
2. En **Rutinas → Crear mi propia rutina**, elige un día, agrega ejercicios sugeridos y empieza: reemplaza a la anterior.
3. Cierra sesión y entra como preparador: en **Catálogo** hay una rutina y un ejercicio en borrador; apruébalos. Apenas se aprueban, las personas los ven.
4. Entra como administración para ver solicitudes de datos, indicadores y avisos.

Para volver al estado inicial: detén el servidor, ejecuta `npm run reset-demo` en `backend` y vuelve a iniciar.

Para recompilar la app web tras cambiar código Flutter: `.\iniciar.ps1 -RebuildMobile`. Si el puerto 3000 está ocupado, `.\iniciar.ps1 -Port 3002` recompila el cliente para ese puerto.

## Estructura

| Carpeta | Contenido |
|---|---|
| `backend/` | API Node.js/Express (monolito modular), migraciones SQL, semilla de demostración y 146 pruebas. Ver `backend/README.md`. |
| `mobile/` | Cliente Flutter (web, Android) con 77 pruebas. Ver `mobile/README.md`. |
| `docs/ES2_Arquitectura.md` | Capítulo de arquitectura generado: 5 procesos BPMN, casos de uso, componentes, modelo de datos, comunicaciones, infraestructura, trazabilidad. |
| `docs/diccionario_de_datos.md` | Diccionario de datos de las 20 tablas, generado desde el mismo esquema que la migración. |
| `docs/cambios_al_informe.md` | Qué debe cambiar el informe para coincidir con el producto. |
| `docs/diagramas/` | Generador de diagramas (SVG → PNG) y del modelo de datos. `out/png` contiene los 24 diagramas. |

El modelo de datos tiene una sola fuente (`docs/diagramas/schema/schema.mjs`) que produce el diagrama ER, `backend/migrations/001_modelo_mvp.sql` y el diccionario. `docs/diagramas/schema/validate.mjs` ejecuta 70 comprobaciones sobre PostgreSQL 18 (competencia del aprobador, solo plantillas y ejercicios aprobados en una rutina, rutinas iniciadas inmutables, auditoría solo de inserción, datos nutricionales solo en perfiles ficticios, etc.).

Regenerar diagramas y documentos:

```powershell
cd docs\diagramas
npm ci
node build.mjs          # diagramas (requiere Google Chrome instalado)
node generate.mjs       # SQL, diccionario y capítulo de arquitectura
node schema\validate.mjs
```

## Verificación

```powershell
cd backend; npm ci; npm test            # 146 pruebas
cd ..\mobile; flutter analyze; flutter test   # 77 pruebas
```

Además se recorrió el flujo completo en el navegador contra la API real: perfil con estatura y peso (IMC) y consentimiento, rutina recomendada, reemplazo por una rutina propia con ejercicios sugeridos, y el catálogo del preparador con su contenido pendiente.

## Pendiente

- La API usa PGlite en desarrollo y `pg` cuando `DATABASE_URL` está definida; el SQL y las migraciones son los mismos. No se ha probado contra un PostgreSQL gestionado ni desplegado en Render.
- No hay aún Dockerfile, CI ni pruebas de carga; el informe los menciona.
- Nutrición: existe el cálculo energético (Mifflin-St Jeor) solo para cuentas ficticias; las minutas siguen pendientes.
- El preparador crea rutinas y reglas por la API; en la app puede crear ejercicios y aprobar, retirar y ver todo el catálogo, pero la redacción de rutinas completas en pantalla queda para un siguiente incremento.
- Android: no hay SDK ni emulador en este equipo; solo se verificó la versión web.
- Todo el contenido de rutinas es de demostración y no constituye prescripción: lo real lo redacta y aprueba el preparador del proyecto.
- La estatura y el peso son datos de salud: conviene validar con el docente guía el tratamiento y la redacción del consentimiento antes del piloto. El IMC se muestra solo como referencia (no distingue músculo de grasa; ver `docs/investigacion_imc_y_ejercicio.md`). El fundamento de las divisiones (full body, upper/lower y push/pull/legs) está en `docs/investigacion_divisiones_de_entrenamiento.md`, el del horario semanal, los días de descanso y la racha, en `docs/investigacion_ideas_apps_fitness.md`, y el de las dietas y las calorías, en `docs/investigacion_alimentacion.md` (las pautas completas con gramos están en `docs/pautas_de_alimentacion.md`). El sexo y el nivel de actividad también son datos de salud: se piden con el consentimiento `datos_nutricionales`, revocable.
