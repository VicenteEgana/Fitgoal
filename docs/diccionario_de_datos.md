# Diccionario de datos de FitGoal

Generado desde `docs/diagramas/schema/schema.mjs`. Coincide con `backend/migrations/001_modelo_mvp.sql`, que se aplicó y se probó en PostgreSQL 18 (`node schema/validate.mjs`).

El modelo tiene 20 tablas en 4 módulos, con 204 columnas, 33 claves foráneas, 128 reglas de validación (CHECK), 14 restricciones de unicidad, 17 índices y 6 disparadores. Todas las reglas las aplica PostgreSQL, no solo la API.

## 1. Cómo leer este diccionario

- Los nombres de tablas y columnas están en inglés (snake_case), como en el código; las descripciones, en español.
- **Nulo:** «No» significa que la columna es obligatoria (NOT NULL).
- **Clave:** PK es la clave primaria; FK, una clave foránea; UQ, un valor único.
- **Restricción o valores:** «Valores» enumera los valores permitidos; «Regla» es una condición CHECK; «Referencia» indica la tabla y columna a la que apunta la clave foránea y qué ocurre al borrar el registro padre.
- **Protección de datos:** la clasificación de cada tabla y lo que ocurre con sus filas cuando se aplica la eliminación de una cuenta (derecho de supresión).

### Tipos de datos

| Tipo | Uso en el modelo |
| --- | --- |
| uuid | Identificador de 128 bits. Las claves primarias se generan con gen_random_uuid(). |
| text | Texto UTF-8 sin largo fijo; los largos máximos se fijan con reglas (CHECK). |
| smallint · integer · bigint | Enteros de 2, 4 y 8 bytes. «bigint (identidad)» es un correlativo que genera la base de datos. |
| numeric(p,s) | Decimal exacto con p dígitos en total y s decimales, por ejemplo numeric(5,1) para el peso en kilogramos. |
| boolean | Verdadero o falso. |
| date | Fecha calendario, sin hora. |
| timestamptz | Fecha y hora con zona horaria; PostgreSQL la guarda en UTC. |
| jsonb | Documento JSON en formato binario, con reglas de forma (por ejemplo, que sea un objeto). |
| text[] · smallint[] | Arreglos de texto o de enteros, por ejemplo los días de la semana o los nombres de las sesiones. |

### Clasificación de los datos

| Clasificación | Qué incluye |
| --- | --- |
| Identificación y acceso | Datos personales que identifican a la persona o le dan acceso (correo, rol, credenciales protegidas con hash). |
| Personal | Datos asociados a una persona identificable, sin información de salud. |
| Sensible (salud) | Datos relativos a la salud o al perfil biológico (estatura, peso, sexo y actividad física); FitGoal los trata como sensibles y solo con consentimiento específico. |
| Seudonimizado | Datos de uso sin vínculo directo con la cuenta: solo se asocian a un HMAC del identificador. |
| Trazabilidad | Registro de acciones con el actor y la entidad afectada, sin tokens ni contenido sensible. |
| Catálogo (no personal) | Contenido profesional del servicio; solo identifica al profesional autor y aprobador. |

Los respaldos cifrados se conservan 7 días (copias diarias) y 4 semanas (copias semanales). Las solicitudes de eliminación quedan registradas en `data_requests` para reaplicarlas si se restaura una copia anterior.

## 2. Resumen de tablas

| N.º | Tabla | Entidad | Módulo | Columnas | Clave primaria | Clasificación del dato |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | users | Usuario | Identidad, consentimiento y derechos | 11 | id | Identificación y acceso |
| 2 | auth_sessions | Sesión de autenticación | Identidad, consentimiento y derechos | 9 | id | Identificación y acceso |
| 3 | consents | Consentimiento | Identidad, consentimiento y derechos | 6 | id | Personal |
| 4 | data_requests | Solicitud de derechos | Identidad, consentimiento y derechos | 11 | id | Personal |
| 5 | exercises | Ejercicio | Catálogo profesional y reglas | 16 | id | Catálogo (no personal) |
| 6 | rule_versions | Versión de reglas | Catálogo profesional y reglas | 11 | id | Catálogo (no personal) |
| 7 | routine_templates | Plantilla de rutina | Catálogo profesional y reglas | 22 | id | Catálogo (no personal) |
| 8 | template_exercises | Ejercicio de plantilla | Catálogo profesional y reglas | 5 | template_id, session_no, position | Catálogo (no personal) |
| 9 | foods | Alimento | Catálogo profesional y reglas | 17 | id | Catálogo (no personal) |
| 10 | meal_plan_templates | Pauta de alimentación | Catálogo profesional y reglas | 13 | id | Catálogo (no personal) |
| 11 | meal_plan_items | Alimento de la pauta | Catálogo profesional y reglas | 6 | template_id, day_no, meal, position | Catálogo (no personal) |
| 12 | profile_versions | Perfil (versionado) | Perfil y rutinas del participante | 15 | id | Sensible (salud) |
| 13 | user_plans | Rutina del participante | Perfil y rutinas del participante | 15 | id | Personal |
| 14 | user_plan_exercises | Ejercicio de la rutina | Perfil y rutinas del participante | 5 | plan_id, session_no, position | Personal |
| 15 | meal_plan_swaps | Cambio de alimento | Perfil y rutinas del participante | 7 | user_id, template_id, day_no, meal, position | Personal |
| 16 | training_sessions | Sesión de entrenamiento | Seguimiento, avisos y trazabilidad | 10 | id | Personal |
| 17 | weight_records | Registro de peso | Seguimiento, avisos y trazabilidad | 5 | id | Sensible (salud) |
| 18 | notifications | Aviso interno | Seguimiento, avisos y trazabilidad | 7 | id | Personal |
| 19 | audit_log | Auditoría | Seguimiento, avisos y trazabilidad | 9 | id | Trazabilidad |
| 20 | usage_events | Evento de uso seudonimizado | Seguimiento, avisos y trazabilidad | 4 | id | Seudonimizado |

## 3. Detalle por tabla

### Identidad, consentimiento y derechos

#### users — Usuario

Cuenta de acceso. Un mismo modelo cubre participantes, preparadores, nutricionistas y administradores (control de acceso por rol).

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador interno de la cuenta. |
| email | text | No |  |  | Regla: position('@' in email) > 1 AND length(email) <= 254 | Correo de acceso. Único sin distinguir mayúsculas. |
| password_hash | text | No |  |  | Regla: password_hash LIKE '$argon2id$%' | Hash Argon2id con sal individual (formato PHC). Nunca se guarda la contraseña. |
| role | text | No |  |  | Valores: user, trainer, nutritionist, admin | Rol: participante, preparador físico, nutricionista o administrador. |
| status | text | No |  | 'active' | Valores: active, blocked, deleted | Estado de la cuenta; «blocked» suspende el tratamiento (bloqueo temporal). |
| is_fictitious | boolean | No |  | false |  | Verdadero en cuentas de demostración o prueba. |
| session_version | integer | No |  | 1 | Regla: session_version >= 1 | Se incrementa al cambiar contraseña o rol; invalida los JWT emitidos antes. |
| enrolled_at | timestamptz | Sí |  |  |  | Fecha de inscripción confirmada en el piloto (denominador de los KPI). |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |
| updated_at | timestamptz | No |  | now() |  | Fecha y hora de la última modificación. |
| deleted_at | timestamptz | Sí |  |  |  | Fecha en que se aplicó la eliminación de datos personales. |

Reglas de integridad e índices:

- **users_id_role_key** (único: id, role): Permite que otras tablas verifiquen el rol real del usuario con una clave foránea compuesta.
- **users_deleted_pair**: La fecha de eliminación existe solo en cuentas eliminadas.
- **Índice users_email_lower_key**: Correo único sin distinguir mayúsculas.

Protección de datos:

- **Clasificación:** Identificación y acceso. email identifica a la persona; password_hash es una credencial (Argon2id), nunca la contraseña. enrolled_at se fija al autorizar «evaluacion_piloto» y se borra al revocarlo. La cuenta real sin actividad durante 12 meses se elimina, salvo que tenga una solicitud de derechos abierta.
- **Al eliminar la cuenta:** Se anonimiza: el correo pasa a «eliminado-<id>@invalid», se invalida el hash, status = deleted, se registra deleted_at y se incrementa session_version. La fila se conserva para no romper la auditoría ni las solicitudes.

#### auth_sessions — Sesión de autenticación

Sesión activa de un dispositivo. Guarda solo el hash del refresh token, que rota en cada renovación y vence a los 7 días como máximo.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la sesión; viaja dentro del JWT como «sid». |
| user_id | uuid | No | FK |  | Referencia a users.id (al borrar: CASCADE) | Cuenta a la que pertenece la sesión. |
| refresh_token_hash | text | No | UQ |  |  | Hash SHA-256 del refresh token aleatorio; el token nunca se almacena. |
| session_version | integer | No |  |  | Regla: session_version >= 1 | Versión de sesión de la cuenta al emitir la sesión; se compara en cada petición. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |
| expires_at | timestamptz | No |  |  |  | Vencimiento absoluto de la sesión (máximo 7 días). |
| last_used_at | timestamptz | Sí |  |  |  | Último uso para renovar el acceso. |
| revoked_at | timestamptz | Sí |  |  |  | Fecha de revocación (cierre de sesión, cambio de contraseña o de rol). |
| replaced_by | uuid | Sí | FK |  | Referencia a auth_sessions.id (al borrar: SET NULL) | Sesión que reemplazó a esta al rotar el refresh token. |

Reglas de integridad e índices:

- **auth_sessions_expires_window**: La sesión vence en un máximo de 7 días.
- **Índice auth_sessions_user_active**: Búsqueda de sesiones activas de una cuenta.

Protección de datos:

- **Clasificación:** Identificación y acceso. Solo el hash SHA-256 del refresh token; vence en 7 días como máximo.
- **Al eliminar la cuenta:** Se borran todas las sesiones de la cuenta.

#### consents — Consentimiento

Registro anexado de cada otorgamiento o revocación de consentimiento, con la versión de la política aplicada. El estado vigente es el último registro por finalidad.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del registro. |
| user_id | uuid | No | FK |  | Referencia a users.id | Titular de los datos. |
| purpose | text | No |  |  | Valores: registro_cuenta, perfil_entrenamiento, datos_corporales, datos_nutricionales, seguimiento_progreso, recordatorios, evaluacion_piloto | Finalidad del tratamiento a la que se refiere. «datos_corporales» autoriza usar la estatura y el peso (datos de salud) para calcular el IMC y recomendar rutinas; «datos_nutricionales» autoriza usar el sexo y el nivel de actividad para estimar las calorías y ajustar la pauta de alimentación. |
| policy_version | text | No |  |  | Regla: length(policy_version) BETWEEN 1 AND 40 | Versión de la política de datos mostrada al titular. |
| granted | boolean | No |  |  |  | Verdadero si otorga el consentimiento; falso si lo revoca. |
| recorded_at | timestamptz | No |  | now() |  | Fecha y hora del otorgamiento o la revocación. |

Reglas de integridad e índices:

- **Índice consents_user_purpose**: Consulta del estado vigente por finalidad.

Protección de datos:

- **Clasificación:** Personal. Finalidad, versión de la política y fecha de cada otorgamiento o revocación.
- **Al eliminar la cuenta:** Se borran.

#### data_requests — Solicitud de derechos

Solicitud del titular para ejercer sus derechos sobre los datos personales, con comprobante y plazo de respuesta.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la solicitud. |
| user_id | uuid | No | FK |  | Referencia a users.id | Titular que presenta la solicitud. |
| request_type | text | No |  |  | Valores: acceso, rectificacion, oposicion, bloqueo, exportacion, eliminacion | Derecho que se ejerce. |
| status | text | No |  | 'recibida' | Valores: recibida, en_curso, resuelta, rechazada | Estado de la tramitación. |
| receipt_code | text | No | UQ |  |  | Código del comprobante entregado al titular. |
| received_at | timestamptz | No |  | now() |  | Fecha y hora de recepción. |
| due_at | timestamptz | No |  |  |  | Plazo límite de respuesta: 30 días corridos, o 2 días hábiles para el bloqueo. |
| extension_applied | boolean | No |  | false |  | Indica si se aplicó la única prórroga permitida (hasta 30 días). |
| resolved_at | timestamptz | Sí |  |  |  | Fecha y hora de la resolución. |
| resolved_by | uuid | Sí | FK |  | Referencia a users.id | Responsable de operación que resolvió. |
| resolution_note | text | Sí |  |  | Regla: length(resolution_note) <= 500 | Fundamento o resumen de la respuesta. |

Reglas de integridad e índices:

- **data_requests_due_after_received**: El plazo no puede ser anterior a la recepción.
- **data_requests_resolved_complete**: Una solicitud cerrada exige fecha de resolución.
- **Índice data_requests_open**: Seguimiento de solicitudes abiertas por plazo.

Protección de datos:

- **Clasificación:** Personal. Tipo de derecho, plazos y resolución; la nota de resolución no debe contener datos de salud.
- **Al eliminar la cuenta:** Se conservan, asociadas a la cuenta anonimizada, para responder por la solicitud y reaplicar la eliminación si se restaura un respaldo.

### Catálogo profesional y reglas

#### exercises — Ejercicio

Biblioteca de ejercicios redactada y aprobada por el preparador físico. El sistema no inventa ejercicios: solo recomienda y combina los aprobados, y la persona puede elegir cualquiera para armar su rutina.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del ejercicio. |
| code | text | No | UQ |  | Regla: code ~ '^[a-z0-9-]+$' | Código corto estable (slug). |
| name | text | No |  |  | Regla: length(name) BETWEEN 1 AND 80 | Nombre del ejercicio. |
| description | text | No |  |  | Regla: length(description) BETWEEN 1 AND 600 | Descripción de la ejecución, redactada por el profesional. |
| muscle_group | text | No |  |  | Valores: piernas, empuje, traccion, core, cardio, movilidad | Grupo de trabajo: piernas, empuje (pecho, hombros y tríceps), tracción (espalda y bíceps), zona media, cardio o movilidad. Las reglas aprobadas lo usan para sugerir ejercicios según el objetivo, y las rutinas divididas, para armar cada sesión. |
| min_level | text | No |  | 'principiante' | Valores: principiante, con_experiencia | Nivel mínimo con el que se recomienda el ejercicio. |
| requires_equipment | boolean | No |  | false |  | Indica si necesita material (mancuernas u otro). |
| high_impact | boolean | No |  | false |  | Indica si es de alto impacto articular (saltos, trote): no se sugiere a personas con sobrepeso u obesidad. |
| default_prescription | text | No |  |  | Regla: length(default_prescription) BETWEEN 1 AND 200 | Indicación sugerida por el profesional (series, repeticiones o tiempo) cuando la persona no define la suya. |
| source_note | text | Sí |  |  |  | Atribución o fuente del contenido profesional. |
| status | text | No |  | 'draft' | Valores: draft, approved, retired | Borrador, aprobado (visible para las personas) o retirado. |
| created_by | uuid | No | FK |  | Referencia a users.id | Profesional que registró el ejercicio. |
| approved_by | uuid | Sí | FK |  | Clave compuesta (approved_by, approved_by_role) → users(id, role) | Preparador que aprobó. |
| approved_by_role | text | Sí | FK |  | Valores: trainer. Clave compuesta (approved_by, approved_by_role) → users(id, role) | Rol del aprobador; siempre trainer. |
| approved_at | timestamptz | Sí |  |  |  | Fecha de aprobación. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **Clave foránea compuesta** (approved_by, approved_by_role) → users(id, role): El rol del aprobador coincide con su rol real.
- **exercises_approved_pair**: El aprobador y su rol se registran juntos.
- **exercises_approved_role**: Solo el rol trainer puede aprobar este contenido.
- **exercises_approved_complete**: Un contenido aprobado exige aprobador y fecha de aprobación.
- **Índice exercises_library**: Biblioteca de ejercicios aprobados por grupo y nivel.

Protección de datos:

- **Clasificación:** Catálogo (no personal). created_by y approved_by identifican al preparador.
- **Al eliminar la cuenta:** No aplica: el contenido no es personal. Se conserva con sus versiones; lo retirado deja de ofrecerse, pero no se borra, para mantener la trazabilidad.

#### rule_versions — Versión de reglas

Conjunto versionado de reglas aprobadas: en entrenamiento, las rutinas para cada combinación de objetivo, nivel, equipo y categoría de IMC (una por división de la semana), la regla que elige la división según el nivel y los días disponibles, las reglas de seguridad y los grupos de ejercicios que se sugieren por objetivo; en nutrición, factores y ajustes. Solo un profesional competente puede aprobarlo.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la versión de reglas. |
| domain | text | No |  |  | Valores: entrenamiento, nutricion | Ámbito de las reglas. |
| version | integer | No |  |  | Regla: version > 0 | Número correlativo dentro del ámbito. |
| status | text | No |  | 'draft' | Valores: draft, approved, retired | Borrador, aprobada (vigente) o retirada. |
| content | jsonb | No |  |  | Regla: jsonb_typeof(content) = 'object' | Reglas en formato estructurado (matriz de recomendación, reglas de división, reglas de seguridad, grupos sugeridos por objetivo, factores y ajustes). |
| change_note | text | Sí |  |  |  | Motivo del cambio respecto de la versión anterior. |
| author_id | uuid | No | FK |  | Referencia a users.id | Autor de la versión. |
| approved_by | uuid | Sí | FK |  | Clave compuesta (approved_by, approved_by_role) → users(id, role) | Profesional que aprobó. |
| approved_by_role | text | Sí | FK |  | Valores: trainer, nutritionist. Clave compuesta (approved_by, approved_by_role) → users(id, role) | Rol del aprobador al aprobar. |
| approved_at | timestamptz | Sí |  |  |  | Fecha de aprobación. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **rule_versions_domain_version_key** (único: domain, version): Una sola versión con cada número por ámbito.
- **Clave foránea compuesta** (approved_by, approved_by_role) → users(id, role): El rol del aprobador coincide con su rol real.
- **rule_versions_approved_pair**: El aprobador y su rol se registran juntos.
- **rule_versions_approved_role_by_domain**: Las reglas de entrenamiento las aprueba el preparador y las de nutrición, la nutricionista.
- **rule_versions_approved_complete**: Una versión aprobada exige aprobador y fecha.
- **Índice rule_versions_current**: Una sola versión vigente por ámbito.

Protección de datos:

- **Clasificación:** Catálogo (no personal). author_id y approved_by identifican al profesional.
- **Al eliminar la cuenta:** No aplica: el contenido no es personal. Se conserva con sus versiones; lo retirado deja de ofrecerse, pero no se borra, para mantener la trazabilidad.

#### routine_templates — Plantilla de rutina

Rutina prearmada, definida y aprobada una sola vez por el preparador físico, que las personas pueden iniciar al instante. Se dirige a un objetivo, nivel, equipamiento y categoría de IMC, y organiza la semana con una división (full body, upper/lower o push/pull/legs); los ejercicios van en template_exercises.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la plantilla. |
| code | text | No |  |  | Regla: code ~ '^[a-z0-9-]+$' | Código estable de la plantilla (igual para todas sus versiones). |
| version | integer | No |  |  | Regla: version > 0 | Versión de la plantilla. |
| name | text | No |  |  | Regla: length(name) BETWEEN 1 AND 80 | Nombre visible de la rutina. |
| summary | text | No |  |  | Regla: length(summary) BETWEEN 1 AND 200 | Descripción breve de para quién es la rutina y qué incluye. |
| objective | text | No |  |  | Valores: bajar, mantener, subir | Objetivo físico al que se dirige. |
| level | text | No |  |  | Valores: principiante, con_experiencia | Nivel de experiencia al que se dirige. |
| equipment | text | No |  |  | Valores: sin_equipo, con_equipo | Equipamiento requerido. |
| bmi_category | text | No |  |  | Valores: general, bajo_peso, normal, sobrepeso, obesidad | Categoría de IMC a la que se dirige. «general» es una rutina conservadora, de bajo impacto, para quien no informa su estatura y peso. |
| split | text | No |  |  | Valores: full_body, upper_lower, push_pull_legs | División de la semana: full body (cuerpo completo en cada sesión), upper/lower (tren superior e inferior por separado) o push/pull/legs (empuje, tracción y piernas por separado). |
| session_labels | text[] | No |  |  | Regla: fitgoal_labels_valid(session_labels) | Nombre de cada sesión, en orden (por ejemplo, «Tren superior A»); la sesión k de template_exercises usa el nombre k. |
| min_days | smallint | No |  |  | Regla: min_days BETWEEN 1 AND 7 | Mínimo de días por semana que exige la plantilla. |
| max_days | smallint | No |  |  | Regla: max_days BETWEEN 1 AND 7 | Máximo de días por semana que contempla. |
| session_minutes | integer | No |  |  | Valores: 20, 30, 45, 60 | Duración de cada sesión en minutos. |
| weeks | smallint | No |  | 4 | Regla: weeks BETWEEN 1 AND 12 | Semanas que cubre el plan al publicarse. |
| allowed_adjustments | jsonb | No |  | '{}'::jsonb | Regla: jsonb_typeof(allowed_adjustments) = 'object' | Ajustes que el sistema puede aplicar (por ejemplo, sustituciones permitidas). |
| status | text | No |  | 'draft' | Valores: draft, approved, retired | Borrador, aprobada (vigente) o retirada. |
| author_id | uuid | No | FK |  | Referencia a users.id | Preparador que redactó la plantilla. |
| approved_by | uuid | Sí | FK |  | Clave compuesta (approved_by, approved_by_role) → users(id, role) | Preparador que aprobó. |
| approved_by_role | text | Sí | FK |  | Valores: trainer. Clave compuesta (approved_by, approved_by_role) → users(id, role) | Rol del aprobador; siempre trainer. |
| approved_at | timestamptz | Sí |  |  |  | Fecha de aprobación. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **routine_templates_code_version_key** (único: code, version): Una sola plantilla por código y versión.
- **Clave foránea compuesta** (approved_by, approved_by_role) → users(id, role): El rol del aprobador coincide con su rol real.
- **routine_templates_days_order**: El mínimo de días no supera al máximo.
- **routine_templates_approved_pair**: El aprobador y su rol se registran juntos.
- **routine_templates_approved_role**: Solo el rol trainer puede aprobar este contenido.
- **routine_templates_approved_complete**: Un contenido aprobado exige aprobador y fecha de aprobación.
- **Índice routine_templates_current**: Una sola versión vigente por código.
- **Índice routine_templates_selection**: Búsqueda de rutinas por objetivo, nivel, equipo, categoría de IMC y división.

Protección de datos:

- **Clasificación:** Catálogo (no personal). author_id y approved_by identifican al preparador.
- **Al eliminar la cuenta:** No aplica: el contenido no es personal. Se conserva con sus versiones; lo retirado deja de ofrecerse, pero no se borra, para mantener la trazabilidad.

#### template_exercises — Ejercicio de plantilla

Composición de una plantilla: qué ejercicios van en cada sesión y con qué indicación. La indicación la escribe el profesional; el sistema no la calcula.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| template_id | uuid | No | PK FK |  | Referencia a routine_templates.id (al borrar: CASCADE) | Plantilla a la que pertenece. |
| session_no | smallint | No | PK |  | Regla: session_no BETWEEN 1 AND 7 | Número de sesión de la plantilla; debe tener nombre en session_labels. |
| position | smallint | No | PK |  | Regla: position BETWEEN 1 AND 20 | Orden del ejercicio dentro de la sesión. |
| exercise_id | uuid | No | FK |  | Referencia a exercises.id | Ejercicio del catálogo. |
| prescription | text | No |  |  | Regla: length(prescription) BETWEEN 1 AND 200 | Indicación del preparador (series, repeticiones o tiempo) en texto libre. |

Reglas de integridad e índices:

- **Disparador template_exercises_frozen**: Impide cambiar los ejercicios de una plantilla que ya no es borrador (se crea una versión nueva) y exige que cada ejercicio vaya en una sesión con nombre.

Protección de datos:

- **Clasificación:** Catálogo (no personal). Composición de la plantilla.
- **Al eliminar la cuenta:** No aplica; sigue a su plantilla (ON DELETE CASCADE).

#### foods — Alimento

Alimentos del mercado chileno con su composición por 100 g, redactados y aprobados por la nutricionista. Las pautas de alimentación solo usan alimentos aprobados.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del alimento. |
| code | text | No | UQ |  | Regla: code ~ '^[a-z0-9-]+$' | Código corto estable. |
| name | text | No |  |  | Regla: length(name) BETWEEN 1 AND 80 | Nombre del alimento, con su preparación cuando importa (por ejemplo, «Arroz blanco cocido»). |
| category | text | No |  |  | Valores: proteinas, lacteos, cereales, legumbres, frutas, verduras, grasas | Grupo de alimentos. Las verduras no se escalan al ajustar las calorías: se mantienen como base libre de la pauta. |
| kcal_100g | numeric(6,1) | No |  |  | Regla: kcal_100g BETWEEN 0 AND 900 | Energía por 100 g, en kcal. |
| protein_100g | numeric(5,1) | No |  |  | Regla: protein_100g >= 0 | Proteínas por 100 g, en gramos. |
| carbs_100g | numeric(5,1) | No |  |  | Regla: carbs_100g >= 0 | Carbohidratos por 100 g, en gramos. |
| fat_100g | numeric(5,1) | No |  |  | Regla: fat_100g >= 0 | Grasas por 100 g, en gramos. |
| unit_name | text | Sí |  |  | Regla: length(unit_name) BETWEEN 1 AND 30 | Medida casera opcional (por ejemplo, «unidad», «rebanada» o «taza»). |
| unit_grams | numeric(6,1) | Sí |  |  | Regla: unit_grams > 0 | Gramos que pesa la medida casera. |
| source_note | text | Sí |  |  |  | Fuente de la composición (tabla de composición o etiqueta). |
| status | text | No |  | 'draft' | Valores: draft, approved, retired | Borrador, aprobado o retirado. |
| author_id | uuid | No | FK |  | Referencia a users.id | Profesional que cargó el alimento. |
| approved_by | uuid | Sí | FK |  | Clave compuesta (approved_by, approved_by_role) → users(id, role) | Nutricionista que aprobó. |
| approved_by_role | text | Sí | FK |  | Valores: nutritionist. Clave compuesta (approved_by, approved_by_role) → users(id, role) | Rol del aprobador; siempre nutritionist. |
| approved_at | timestamptz | Sí |  |  |  | Fecha de aprobación. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **Clave foránea compuesta** (approved_by, approved_by_role) → users(id, role): El rol del aprobador coincide con su rol real.
- **foods_approved_pair**: El aprobador y su rol se registran juntos.
- **foods_approved_role**: Solo el rol nutritionist puede aprobar este contenido.
- **foods_approved_complete**: Un contenido aprobado exige aprobador y fecha de aprobación.
- **foods_macros_per_100g**: Proteínas, carbohidratos y grasas no suman más de 100 g por cada 100 g.
- **foods_unit_pair**: La medida casera y su peso se informan juntos.

Protección de datos:

- **Clasificación:** Catálogo (no personal). author_id y approved_by identifican a la nutricionista.
- **Al eliminar la cuenta:** No aplica: el contenido no es personal. Se conserva con sus versiones; lo retirado deja de ofrecerse, pero no se borra, para mantener la trazabilidad.

#### meal_plan_templates — Pauta de alimentación

Pauta de alimentación de 7 días, redactada y aprobada una sola vez por la nutricionista para un tipo de dieta, con gramos para una energía de referencia. Al mostrarla, la app ajusta los gramos a las calorías de la persona con las reglas nutricionales aprobadas.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la pauta. |
| code | text | No |  |  | Regla: code ~ '^[a-z0-9-]+$' | Código estable de la pauta (igual para todas sus versiones). |
| version | integer | No |  |  | Regla: version > 0 | Versión de la pauta. |
| name | text | No |  |  | Regla: length(name) BETWEEN 1 AND 80 | Nombre visible de la pauta. |
| summary | text | No |  |  | Regla: length(summary) BETWEEN 1 AND 300 | Descripción breve de la dieta y su fundamento. |
| diet | text | No |  |  | Valores: mediterranea, alta_proteina, baja_carbohidratos, vegetariana | Tipo de dieta: mediterránea, alta en proteína, baja en carbohidratos (moderada) u ovolactovegetariana. |
| reference_kcal | integer | No |  |  | Regla: reference_kcal BETWEEN 1200 AND 4000 | Energía diaria (kcal) para la que están escritos los gramos. |
| status | text | No |  | 'draft' | Valores: draft, approved, retired | Borrador, aprobada (vigente) o retirada. |
| author_id | uuid | No | FK |  | Referencia a users.id | Nutricionista que redactó la pauta. |
| approved_by | uuid | Sí | FK |  | Clave compuesta (approved_by, approved_by_role) → users(id, role) | Nutricionista que aprobó. |
| approved_by_role | text | Sí | FK |  | Valores: nutritionist. Clave compuesta (approved_by, approved_by_role) → users(id, role) | Rol del aprobador; siempre nutritionist. |
| approved_at | timestamptz | Sí |  |  |  | Fecha de aprobación. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **meal_plan_templates_code_version_key** (único: code, version): Una sola pauta por código y versión.
- **Clave foránea compuesta** (approved_by, approved_by_role) → users(id, role): El rol del aprobador coincide con su rol real.
- **meal_plan_templates_approved_pair**: El aprobador y su rol se registran juntos.
- **meal_plan_templates_approved_role**: Solo el rol nutritionist puede aprobar este contenido.
- **meal_plan_templates_approved_complete**: Un contenido aprobado exige aprobador y fecha de aprobación.
- **Índice meal_plan_templates_current**: Una sola versión vigente por código.
- **Índice meal_plan_templates_diet**: Búsqueda de pautas vigentes por tipo de dieta.

Protección de datos:

- **Clasificación:** Catálogo (no personal). author_id y approved_by identifican a la nutricionista.
- **Al eliminar la cuenta:** No aplica: el contenido no es personal. Se conserva con sus versiones; lo retirado deja de ofrecerse, pero no se borra, para mantener la trazabilidad.

#### meal_plan_items — Alimento de la pauta

Composición de una pauta: qué alimento y cuántos gramos van en cada comida de cada día, para la energía de referencia.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| template_id | uuid | No | PK FK |  | Referencia a meal_plan_templates.id (al borrar: CASCADE) | Pauta a la que pertenece. |
| day_no | smallint | No | PK |  | Regla: day_no BETWEEN 1 AND 7 | Día de la pauta (1 = lunes … 7 = domingo). |
| meal | text | No | PK |  | Valores: desayuno, colacion, almuerzo, once, cena | Comida del día. |
| position | smallint | No | PK |  | Regla: position BETWEEN 1 AND 12 | Orden del alimento dentro de la comida. |
| food_id | uuid | No | FK |  | Referencia a foods.id | Alimento del catálogo. |
| grams | numeric(6,1) | No |  |  | Regla: grams > 0 AND grams <= 1000 | Gramos del alimento para la energía de referencia. |

Reglas de integridad e índices:

- **Disparador meal_plan_items_frozen**: Impide cambiar los alimentos de una pauta que ya no es borrador (se crea una versión nueva), exige alimentos aprobados al aprobarla e impide borrar una pauta aprobada.

Protección de datos:

- **Clasificación:** Catálogo (no personal). Composición de la pauta.
- **Al eliminar la cuenta:** No aplica; sigue a su pauta (ON DELETE CASCADE).

### Perfil y rutinas del participante

#### profile_versions — Perfil (versionado)

Cada cambio del perfil crea una versión nueva. Incluye el objetivo físico, la disponibilidad y, con consentimiento específico, la estatura y el peso con que se calcula el IMC y, con otro consentimiento específico, el sexo y el nivel de actividad con que se estiman las calorías de la pauta de alimentación.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la versión del perfil. |
| user_id | uuid | No | FK |  | Referencia a users.id | Participante dueño del perfil. |
| version | integer | No |  |  | Regla: version > 0 | Número correlativo por participante. |
| age | integer | No |  |  | Regla: age BETWEEN 18 AND 120 | Edad en años (solo personas adultas). |
| objective | text | No |  |  | Valores: bajar, mantener, subir | Objetivo físico: bajar, mantener o subir de peso. |
| level | text | No |  |  | Valores: principiante, con_experiencia | Nivel de experiencia declarado. |
| days | smallint[] | No |  |  | Regla: fitgoal_days_valid(days) | Días disponibles (1 = lunes … 7 = domingo), sin repetir. |
| duration_minutes | integer | No |  |  | Valores: 20, 30, 45, 60 | Minutos disponibles por sesión. |
| equipment | text | No |  |  | Valores: sin_equipo, con_equipo | Equipamiento disponible. |
| sex_param | text | Sí |  |  | Valores: masculino, femenino | Parámetro de sexo del modelo de Mifflin-St Jeor (opcional, con el consentimiento «datos_nutricionales»; se borra si se revoca). |
| weight_kg | numeric(5,1) | Sí |  |  | Regla: weight_kg BETWEEN 30 AND 300 | Peso en kilogramos (opcional, dato de salud). Solo se guarda con el consentimiento «datos_corporales» y se borra si se revoca. |
| height_cm | numeric(4,1) | Sí |  |  | Regla: height_cm BETWEEN 100 AND 250 | Estatura en centímetros (opcional, dato de salud). Junto al peso permite calcular el IMC. |
| activity_level | text | Sí |  |  | Valores: sedentario, ligero, moderado, intenso | Nivel de actividad física habitual, que fija el factor de actividad de las reglas nutricionales (opcional, con el consentimiento «datos_nutricionales»). |
| is_fictitious | boolean | No |  | false |  | Copia de la condición de cuenta ficticia al guardar el perfil. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **profile_versions_user_version_key** (único: user_id, version): Una sola versión con cada número por participante.
- **profile_versions_id_user_key** (único: id, user_id): Permite que las rutinas verifiquen que el perfil es del mismo participante.
- **profile_versions_body_pair**: La estatura y el peso se informan juntos o no se informan.
- **profile_versions_estimate_needs_body**: El sexo y la actividad se informan juntos y exigen estatura y peso: son los cuatro datos del cálculo energético.

Protección de datos:

- **Clasificación:** Sensible (salud). height_cm y weight_kg (consentimiento «datos_corporales») y sex_param y activity_level (consentimiento «datos_nutricionales») son sensibles; el resto del perfil es personal. El IMC se calcula y no se guarda. Al revocar «datos_corporales» se borran los cuatro campos en todas las versiones; al revocar «datos_nutricionales», el sexo y la actividad.
- **Al eliminar la cuenta:** Se borran todas las versiones.

#### user_plans — Rutina del participante

Rutina que la persona inició: una rutina recomendada (copia de una plantilla aprobada) o una rutina propia armada con ejercicios aprobados. Es una copia que no cambia; la persona tiene una sola rutina vigente y al iniciar otra la anterior queda reemplazada.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la rutina del participante. |
| user_id | uuid | No | FK |  | Referencia a users.id. Clave compuesta (profile_version_id, user_id) → profile_versions(id, user_id) | Participante dueño de la rutina. |
| profile_version_id | uuid | No | FK |  | Clave compuesta (profile_version_id, user_id) → profile_versions(id, user_id) | Versión del perfil vigente al iniciar la rutina. |
| source | text | No |  |  | Valores: recomendada, propia | Origen: «recomendada» (plantilla aprobada) o «propia» (armada por la persona). |
| template_id | uuid | Sí | FK |  | Referencia a routine_templates.id | Plantilla aprobada de la que se copió (solo en rutinas recomendadas). |
| rule_version_id | uuid | Sí | FK |  | Referencia a rule_versions.id | Versión de reglas aprobadas que produjo la recomendación o las sugerencias de ejercicios. |
| name | text | No |  |  | Regla: length(name) BETWEEN 1 AND 80 | Nombre visible de la rutina. |
| version | integer | No |  |  | Regla: version > 0 | Número correlativo de rutinas iniciadas por el participante. |
| weeks | smallint | No |  |  | Regla: weeks BETWEEN 1 AND 12 | Semanas que se programan al iniciarla. |
| session_minutes | integer | No |  |  | Valores: 20, 30, 45, 60 | Duración de cada sesión en minutos. |
| days | smallint[] | No |  |  | Regla: fitgoal_days_valid(days) | Días de entrenamiento elegidos, de menor a mayor (1 = lunes … 7 = domingo). La sesión k cae el día k; los días no elegidos son de descanso (no se guardan: el horario y la racha los deducen). |
| session_labels | text[] | No |  |  | Regla: fitgoal_labels_valid(session_labels) | Nombre de la sesión de cada día elegido (en las recomendadas, el de la plantilla, repetido en ciclo; en las propias, el que la persona le da o «Sesión k»). |
| status | text | No |  | 'vigente' | Valores: vigente, reemplazado | Vigente o reemplazada por una rutina iniciada después. |
| started_at | timestamptz | No |  | now() |  | Fecha y hora en que la persona inició la rutina. |
| replaced_at | timestamptz | Sí |  |  |  | Fecha en que dejó de estar vigente. |

Reglas de integridad e índices:

- **user_plans_user_version_key** (único: user_id, version): Una sola rutina con cada número por participante.
- **user_plans_id_user_key** (único: id, user_id): Permite que las sesiones verifiquen que la rutina es del mismo participante.
- **Clave foránea compuesta** (profile_version_id, user_id) → profile_versions(id, user_id): El perfil usado pertenece al mismo participante.
- **user_plans_source_template_pair**: Solo las rutinas recomendadas provienen de una plantilla.
- **user_plans_recommended_has_rules**: Una rutina recomendada registra las reglas aprobadas que la produjeron.
- **user_plans_labels_per_day**: Cada día elegido tiene el nombre de su sesión.
- **user_plans_replaced_pair**: La fecha de reemplazo existe solo en rutinas reemplazadas.
- **Índice user_plans_current**: Una sola rutina vigente por participante.
- **Disparador user_plans_integrity**: Una rutina recomendada solo puede copiarse de una plantilla aprobada, y una rutina ya iniciada conserva su contenido (solo cambian el estado y la fecha de reemplazo).

Protección de datos:

- **Clasificación:** Personal. Rutina elegida o armada y sus días.
- **Al eliminar la cuenta:** Se borran, con sus ejercicios (ON DELETE CASCADE).

#### user_plan_exercises — Ejercicio de la rutina

Composición de una rutina del participante: qué ejercicios van en cada sesión y con qué indicación. En las rutinas recomendadas se copia de la plantilla; en las propias la define la persona con ejercicios aprobados.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| plan_id | uuid | No | PK FK |  | Referencia a user_plans.id (al borrar: CASCADE) | Rutina del participante a la que pertenece. |
| session_no | smallint | No | PK |  | Regla: session_no BETWEEN 1 AND 7 | Número de sesión dentro de la semana. |
| position | smallint | No | PK |  | Regla: position BETWEEN 1 AND 20 | Orden del ejercicio dentro de la sesión. |
| exercise_id | uuid | No | FK |  | Referencia a exercises.id | Ejercicio aprobado del catálogo. |
| prescription | text | No |  |  | Regla: length(prescription) BETWEEN 1 AND 200 | Indicación (series, repeticiones o tiempo): la del profesional, o la que armó la persona con límites seguros. |

Reglas de integridad e índices:

- **Disparador user_plan_exercises_integrity**: Solo se pueden agregar ejercicios aprobados a una rutina, y la composición de una rutina iniciada no se modifica.

Protección de datos:

- **Clasificación:** Personal. Copia de los ejercicios aprobados de la rutina.
- **Al eliminar la cuenta:** Se borran con la rutina.

#### meal_plan_swaps — Cambio de alimento

Alimento de una pauta aprobada que la persona cambió porque no lo tiene o no le gusta, por otro aprobado del mismo grupo que la nutricionista incluyó en esa pauta. No se guardan gramos: la API calcula los que aportan la misma energía. Vale solo para esa versión de la pauta y se puede deshacer.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | No | PK FK |  | Referencia a users.id | Participante que hizo el cambio. |
| template_id | uuid | No | PK FK |  | Clave compuesta (template_id, day_no, meal, position) → meal_plan_items(template_id, day_no, meal, position) | Pauta aprobada. |
| day_no | smallint | No | PK FK |  | Clave compuesta (template_id, day_no, meal, position) → meal_plan_items(template_id, day_no, meal, position) | Día de la pauta (1 = lunes … 7 = domingo). |
| meal | text | No | PK FK |  | Clave compuesta (template_id, day_no, meal, position) → meal_plan_items(template_id, day_no, meal, position) | Comida del día. |
| position | smallint | No | PK FK |  | Clave compuesta (template_id, day_no, meal, position) → meal_plan_items(template_id, day_no, meal, position) | Posición del alimento reemplazado dentro de la comida. |
| food_id | uuid | No | FK |  | Referencia a foods.id | Alimento que lo reemplaza: aprobado, del mismo grupo y presente en la misma pauta. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **Clave foránea compuesta** (template_id, day_no, meal, position) → meal_plan_items(template_id, day_no, meal, position): El alimento reemplazado existe en la pauta.
- **Disparador meal_plan_swaps_valid**: Un alimento solo se cambia en una pauta aprobada y por otro distinto, aprobado, del mismo grupo y que la nutricionista incluyó en esa misma pauta.

Protección de datos:

- **Clasificación:** Personal. Alimentos que la persona cambió en su pauta (preferencias o disponibilidad); se incluyen en la exportación.
- **Al eliminar la cuenta:** Se borran.

### Seguimiento, avisos y trazabilidad

#### training_sessions — Sesión de entrenamiento

Sesión programada al iniciar la rutina. El participante declara si la realizó; una sesión sin registro cuenta como no realizada en la adherencia. Si no puede hacerla ese día, la mueve a otro día libre. Los días de descanso no tienen filas: el horario semanal y la racha los deducen de los días de la rutina, y la racha no se guarda.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la sesión. |
| user_id | uuid | No | FK |  | Clave compuesta (plan_id, user_id) → user_plans(id, user_id) | Participante. |
| plan_id | uuid | No | FK |  | Clave compuesta (plan_id, user_id) → user_plans(id, user_id) | Rutina del participante a la que pertenece. |
| session_no | smallint | No |  |  | Regla: session_no BETWEEN 1 AND 7 | Número de sesión dentro de la semana del plan. |
| label | text | No |  |  | Regla: length(label) BETWEEN 1 AND 80 | Nombre visible de la sesión. |
| planned_date | date | No |  |  |  | Fecha programada. Al mover la sesión cambia a hoy o a un día futuro, nunca a una fecha pasada. |
| rescheduled_from | date | Sí |  |  | Regla: rescheduled_from <> planned_date | Fecha programada original, si la persona movió la sesión a otro día; ese día queda como «movida» (no suma ni corta la racha). |
| completed_at | timestamptz | Sí |  |  |  | Momento en que el participante declaró la sesión como realizada. |
| note | text | Sí |  |  | Regla: length(note) <= 200 | Nota breve del participante. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **training_sessions_plan_date_key** (único: plan_id, planned_date): Una sesión por día y plan.
- **Clave foránea compuesta** (plan_id, user_id) → user_plans(id, user_id): La rutina pertenece al mismo participante.
- **Índice training_sessions_user_date**: Consulta de la agenda del participante.

Protección de datos:

- **Clasificación:** Personal. Agenda, sesiones realizadas, cambios de día y nota breve.
- **Al eliminar la cuenta:** Se borran.

#### weight_records — Registro de peso

Peso declarado por el participante. Solo se habilita con consentimiento de seguimiento y tratamiento de datos autorizado.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del registro. |
| user_id | uuid | No | FK |  | Referencia a users.id | Participante. |
| recorded_on | date | No |  |  |  | Fecha a la que corresponde el peso. |
| weight_kg | numeric(5,1) | No |  |  | Regla: weight_kg > 0 AND weight_kg <= 500 | Peso en kilogramos. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **weight_records_user_day_key** (único: user_id, recorded_on): Un registro de peso por día.

Protección de datos:

- **Clasificación:** Sensible (salud). weight_kg; solo con consentimiento «seguimiento_progreso» y tratamiento de datos habilitado. Se borra al revocar «seguimiento_progreso» o «datos_corporales» y con la oposición.
- **Al eliminar la cuenta:** Se borran.

#### notifications — Aviso interno

Aviso dentro de la aplicación, sin información sensible. Se consulta por la API; no se envían notificaciones externas.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del aviso. |
| user_id | uuid | No | FK |  | Referencia a users.id | Destinatario. |
| type | text | No |  |  | Valores: sesiones_pendientes, solicitud_derechos | Tipo de aviso: recordatorio de sesiones sin registrar o novedad de una solicitud de derechos. |
| ref_id | uuid | Sí |  |  |  | Identificador del registro al que se refiere. |
| message | text | No |  |  | Regla: length(message) BETWEEN 1 AND 200 | Texto del aviso, sin datos de salud. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |
| read_at | timestamptz | Sí |  |  |  | Momento en que el destinatario lo leyó. |

Reglas de integridad e índices:

- **Índice notifications_user_recent**: Listado reciente de avisos por usuario.

Protección de datos:

- **Clasificación:** Personal. Mensajes sin información de salud. Se borran a los 6 meses.
- **Al eliminar la cuenta:** Se borran.

#### audit_log — Auditoría

Bitácora de solo anexado: quién hizo qué, cuándo y sobre qué versión. No contiene tokens ni contenido sensible; la base impide modificar o borrar sus filas.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint (identidad) | No | PK |  |  | Número correlativo del evento. |
| occurred_at | timestamptz | No |  | now() |  | Fecha y hora del evento. |
| actor_id | uuid | Sí | FK |  | Referencia a users.id | Quien ejecutó la acción (vacío en acciones del sistema). |
| actor_role | text | Sí |  |  |  | Rol del actor al ejecutar la acción. |
| action | text | No |  |  | Regla: action ~ '^[a-z_]+\.[a-z_]+$' | Acción en formato «entidad.verbo», por ejemplo template.approved. |
| entity_type | text | No |  |  |  | Tipo de entidad afectada. |
| entity_id | uuid | Sí |  |  |  | Identificador de la entidad afectada. |
| entity_version | integer | Sí |  |  |  | Versión de la entidad, cuando aplica. |
| detail | jsonb | No |  | '{}'::jsonb | Regla: jsonb_typeof(detail) = 'object' | Metadatos no sensibles del evento. |

Reglas de integridad e índices:

- **Índice audit_log_entity**: Historial de una entidad.
- **Índice audit_log_time**: Consulta por período.
- **Disparador audit_log_append_only**: Impide modificar o borrar filas de la bitácora.

Protección de datos:

- **Clasificación:** Trazabilidad. actor_id, entidad y versión; detail no guarda tokens ni contenido sensible.
- **Al eliminar la cuenta:** Se conserva (solo anexado); el actor queda asociado a la cuenta anonimizada.

#### usage_events — Evento de uso seudonimizado

Eventos para calcular los KPI del piloto. Se asocian a un seudónimo (HMAC del identificador) y no tienen clave foránea hacia la cuenta, de modo que el vínculo queda separado.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint (identidad) | No | PK |  |  | Número correlativo del evento. |
| pseudonym | text | No |  |  | Regla: pseudonym ~ '^[0-9a-f]{64}$' | HMAC-SHA256 en hexadecimal del identificador de la cuenta, con secreto del piloto. |
| event_type | text | No |  |  | Valores: registro_iniciado, registro_completado, sesion_iniciada, rutina_iniciada, plan_consultado, sesion_registrada, peso_registrado, pauta_consultada | Tipo de evento. |
| occurred_at | timestamptz | No |  | now() |  | Fecha y hora del evento. |

Reglas de integridad e índices:

- **Índice usage_events_pseudonym**: Actividad por participante seudonimizado.
- **Índice usage_events_type**: Conteo de eventos por tipo y período.

Protección de datos:

- **Clasificación:** Seudonimizado. pseudonym = HMAC-SHA256 del identificador con un secreto del piloto; no tiene clave foránea hacia users. Solo con consentimiento «evaluacion_piloto»; se borra al revocarlo y a los 24 meses.
- **Al eliminar la cuenta:** Se borran los eventos del seudónimo de la cuenta.


## 4. Relaciones

La cardinalidad se lee padre : hija. Por ejemplo, «1 : 0..N» indica que cada fila hija apunta a una fila padre y que un padre puede tener cero o más hijas; «0..1» en el lado del padre indica que la referencia es opcional.

| N.º | Tabla hija | Columnas | Tabla padre | Columnas | Cardinalidad | Al borrar el padre |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | auth_sessions | user_id | users | id | 1 : 0..N | CASCADE: borra también las filas hijas |
| 2 | auth_sessions | replaced_by | auth_sessions | id | 0..1 : 0..N | SET NULL: deja vacía la referencia |
| 3 | consents | user_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 4 | data_requests | user_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 5 | data_requests | resolved_by | users | id | 0..1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 6 | exercises | created_by | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 7 | exercises | approved_by, approved_by_role | users | id, role | 0..1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 8 | rule_versions | author_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 9 | rule_versions | approved_by, approved_by_role | users | id, role | 0..1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 10 | routine_templates | author_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 11 | routine_templates | approved_by, approved_by_role | users | id, role | 0..1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 12 | template_exercises | template_id | routine_templates | id | 1 : 0..N | CASCADE: borra también las filas hijas |
| 13 | template_exercises | exercise_id | exercises | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 14 | foods | author_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 15 | foods | approved_by, approved_by_role | users | id, role | 0..1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 16 | meal_plan_templates | author_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 17 | meal_plan_templates | approved_by, approved_by_role | users | id, role | 0..1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 18 | meal_plan_items | template_id | meal_plan_templates | id | 1 : 0..N | CASCADE: borra también las filas hijas |
| 19 | meal_plan_items | food_id | foods | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 20 | profile_versions | user_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 21 | user_plans | user_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 22 | user_plans | template_id | routine_templates | id | 0..1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 23 | user_plans | rule_version_id | rule_versions | id | 0..1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 24 | user_plans | profile_version_id, user_id | profile_versions | id, user_id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 25 | user_plan_exercises | plan_id | user_plans | id | 1 : 0..N | CASCADE: borra también las filas hijas |
| 26 | user_plan_exercises | exercise_id | exercises | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 27 | meal_plan_swaps | user_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 28 | meal_plan_swaps | food_id | foods | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 29 | meal_plan_swaps | template_id, day_no, meal, position | meal_plan_items | template_id, day_no, meal, position | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 30 | training_sessions | plan_id, user_id | user_plans | id, user_id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 31 | weight_records | user_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 32 | notifications | user_id | users | id | 1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |
| 33 | audit_log | actor_id | users | id | 0..1 : 0..N | NO ACTION: impide borrar el padre mientras tenga filas hijas |

## 5. Disparadores y funciones

| Disparador | Tabla | Momento | Función | Finalidad |
| --- | --- | --- | --- | --- |
| audit_log_append_only | audit_log | BEFORE UPDATE OR DELETE | fitgoal_forbid_change() | Impide modificar o borrar filas de la bitácora. |
| user_plans_integrity | user_plans | BEFORE INSERT | fitgoal_plan_requires_approved_template() | Una rutina recomendada solo puede copiarse de una plantilla aprobada, y una rutina ya iniciada conserva su contenido (solo cambian el estado y la fecha de reemplazo). |
| user_plan_exercises_integrity | user_plan_exercises | BEFORE INSERT | fitgoal_plan_requires_approved_exercise() | Solo se pueden agregar ejercicios aprobados a una rutina, y la composición de una rutina iniciada no se modifica. |
| template_exercises_frozen | template_exercises | BEFORE INSERT OR UPDATE OR DELETE | fitgoal_freeze_template_exercises() | Impide cambiar los ejercicios de una plantilla que ya no es borrador (se crea una versión nueva) y exige que cada ejercicio vaya en una sesión con nombre. |
| meal_plan_items_frozen | meal_plan_items | BEFORE INSERT OR UPDATE OR DELETE | fitgoal_freeze_meal_plan_items() | Impide cambiar los alimentos de una pauta que ya no es borrador (se crea una versión nueva), exige alimentos aprobados al aprobarla e impide borrar una pauta aprobada. |
| meal_plan_swaps_valid | meal_plan_swaps | BEFORE INSERT OR UPDATE | fitgoal_meal_swap_valid() | Un alimento solo se cambia en una pauta aprobada y por otro distinto, aprobado, del mismo grupo y que la nutricionista incluyó en esa misma pauta. |
