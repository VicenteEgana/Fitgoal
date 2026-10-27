# Diccionario de datos de FitGoal

Generado desde `docs/diagramas/schema/schema.mjs`. Coincide con `backend/migrations/001_modelo_mvp.sql`, que se aplicó y se probó en PostgreSQL 18.

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
| is_fictitious | boolean | No |  | false |  | Verdadero en cuentas de demostración o prueba; habilita los datos nutricionales ficticios. |
| session_version | integer | No |  | 1 | Regla: session_version >= 1 | Se incrementa al cambiar contraseña o rol; invalida los JWT emitidos antes. |
| enrolled_at | timestamptz | Sí |  |  |  | Fecha de inscripción confirmada en el piloto (denominador de los KPI). |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |
| updated_at | timestamptz | No |  | now() |  | Fecha y hora de la última modificación. |
| deleted_at | timestamptz | Sí |  |  |  | Fecha en que se aplicó la eliminación de datos personales. |

Reglas de integridad e índices:

- **users_id_role_key** (único: id, role): Permite que otras tablas verifiquen el rol real del usuario con una clave foránea compuesta.
- **users_deleted_pair**: La fecha de eliminación existe solo en cuentas eliminadas.
- **Índice users_email_lower_key**: Correo único sin distinguir mayúsculas.

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

#### consents — Consentimiento

Registro anexado de cada otorgamiento o revocación de consentimiento, con la versión de la política aplicada. El estado vigente es el último registro por finalidad.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del registro. |
| user_id | uuid | No | FK |  | Referencia a users.id | Titular de los datos. |
| purpose | text | No |  |  | Valores: registro_cuenta, perfil_entrenamiento, datos_nutricionales, seguimiento_progreso, recordatorios, evaluacion_piloto | Finalidad del tratamiento a la que se refiere. |
| policy_version | text | No |  |  | Regla: length(policy_version) BETWEEN 1 AND 40 | Versión de la política de datos mostrada al titular. |
| granted | boolean | No |  |  |  | Verdadero si otorga el consentimiento; falso si lo revoca. |
| recorded_at | timestamptz | No |  | now() |  | Fecha y hora del otorgamiento o la revocación. |

Reglas de integridad e índices:

- **Índice consents_user_purpose**: Consulta del estado vigente por finalidad.

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

#### case_assignments — Asignación de caso

Relaciona a un participante con el profesional que lo atiende en cada ámbito. Permite comprobar la relación con el recurso en cada petición.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la asignación. |
| participant_id | uuid | No | FK |  | Referencia a users.id | Participante atendido. |
| professional_id | uuid | No | FK |  | Clave compuesta (professional_id, professional_role) → users(id, role) | Profesional asignado. |
| professional_role | text | No | FK |  | Valores: trainer, nutritionist. Clave compuesta (professional_id, professional_role) → users(id, role) | Ámbito: entrenamiento (trainer) o alimentación (nutritionist). |
| assigned_by | uuid | No | FK |  | Referencia a users.id | Administrador que realizó la asignación. |
| assigned_at | timestamptz | No |  | now() |  | Fecha de inicio de la asignación. |
| ended_at | timestamptz | Sí |  |  |  | Fecha de término de la asignación. |

Reglas de integridad e índices:

- **Clave foránea compuesta** (professional_id, professional_role) → users(id, role): El rol registrado coincide con el rol real del profesional.
- **case_assignments_not_self**: Nadie puede asignarse a sí mismo.
- **Índice case_assignments_active**: Un solo profesional activo por participante y ámbito.

### Catálogo profesional y reglas

#### exercises — Ejercicio

Catálogo de ejercicios definido por el preparador físico. El sistema no inventa ejercicios: solo combina los existentes.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del ejercicio. |
| code | text | No | UQ |  | Regla: code ~ '^[a-z0-9-]+$' | Código corto estable (slug). |
| name | text | No |  |  | Regla: length(name) BETWEEN 1 AND 80 | Nombre del ejercicio. |
| description | text | No |  |  | Regla: length(description) BETWEEN 1 AND 600 | Descripción de la ejecución, redactada por el profesional. |
| requires_equipment | boolean | No |  | false |  | Indica si necesita material (mancuernas u otro). |
| source_note | text | Sí |  |  |  | Atribución o fuente del contenido profesional. |
| created_by | uuid | No | FK |  | Referencia a users.id | Profesional que registró el ejercicio. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

#### rule_versions — Versión de reglas

Conjunto versionado de reglas: matriz de selección de entrenamiento o factores y ajustes de nutrición. Solo un profesional competente puede aprobarlo.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la versión de reglas. |
| domain | text | No |  |  | Valores: entrenamiento, nutricion | Ámbito de las reglas. |
| version | integer | No |  |  | Regla: version > 0 | Número correlativo dentro del ámbito. |
| status | text | No |  | 'draft' | Valores: draft, approved, retired | Borrador, aprobada (vigente) o retirada. |
| content | jsonb | No |  |  | Regla: jsonb_typeof(content) = 'object' | Reglas en formato estructurado (matriz de selección, factores, ajustes permitidos). |
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

#### routine_templates — Plantilla de rutina

Plantilla de entrenamiento definida y aprobada por el preparador físico. Guarda frecuencia, duración y ajustes permitidos; los ejercicios van en template_exercises.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la plantilla. |
| code | text | No |  |  | Regla: code ~ '^[a-z0-9-]+$' | Código estable de la plantilla (igual para todas sus versiones). |
| version | integer | No |  |  | Regla: version > 0 | Versión de la plantilla. |
| name | text | No |  |  | Regla: length(name) BETWEEN 1 AND 80 | Nombre visible para el profesional. |
| objective | text | No |  |  | Valores: bajar, mantener, subir | Objetivo físico al que se dirige. |
| level | text | No |  |  | Valores: principiante, con_experiencia | Nivel de experiencia al que se dirige. |
| equipment | text | No |  |  | Valores: sin_equipo, con_equipo | Equipamiento requerido. |
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
- **Índice routine_templates_selection**: Selección por objetivo, nivel y equipo.

#### template_exercises — Ejercicio de plantilla

Composición de una plantilla: qué ejercicios van en cada sesión y con qué indicación. La indicación la escribe el profesional; el sistema no la calcula.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| template_id | uuid | No | PK FK |  | Referencia a routine_templates.id (al borrar: CASCADE) | Plantilla a la que pertenece. |
| session_no | smallint | No | PK |  | Regla: session_no BETWEEN 1 AND 7 | Número de sesión dentro de la semana. |
| position | smallint | No | PK |  | Regla: position BETWEEN 1 AND 20 | Orden del ejercicio dentro de la sesión. |
| exercise_id | uuid | No | FK |  | Referencia a exercises.id | Ejercicio del catálogo. |
| prescription | text | No |  |  | Regla: length(prescription) BETWEEN 1 AND 200 | Indicación del preparador (series, repeticiones o tiempo) en texto libre. |

#### foods — Alimento

Catálogo de alimentos y equivalencias para el módulo de minutas. Mientras no lo apruebe una nutricionista solo contiene datos ficticios.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del alimento. |
| code | text | No | UQ |  | Regla: code ~ '^[a-z0-9-]+$' | Código corto estable. |
| name | text | No |  |  | Regla: length(name) BETWEEN 1 AND 80 | Nombre del alimento. |
| category | text | No |  |  | Regla: length(category) BETWEEN 1 AND 40 | Grupo de alimentos. |
| portion_description | text | No |  |  | Regla: length(portion_description) BETWEEN 1 AND 80 | Porción de referencia (por ejemplo, «1 unidad mediana»). |
| energy_kcal | numeric(6,1) | No |  |  | Regla: energy_kcal >= 0 | Energía por porción, en kcal. |
| protein_g | numeric(5,1) | No |  |  | Regla: protein_g >= 0 | Proteínas por porción, en gramos. |
| carbs_g | numeric(5,1) | No |  |  | Regla: carbs_g >= 0 | Carbohidratos por porción, en gramos. |
| fat_g | numeric(5,1) | No |  |  | Regla: fat_g >= 0 | Grasas por porción, en gramos. |
| equivalence_group | text | Sí |  |  |  | Grupo de sustitución: alimentos intercambiables entre sí. |
| exclusion_tags | text[] | No |  | '{}' |  | Restricciones que el alimento incumple (por ejemplo, gluten o lactosa). |
| is_fictitious | boolean | No |  | true |  | Verdadero mientras sea dato de ejemplo sin respaldo profesional. |
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
- **foods_approved_not_fictitious**: Un alimento aprobado no puede ser dato ficticio.

### Perfil, borradores, revisión y planes

#### profile_versions — Perfil (versionado)

Cada cambio del perfil crea una versión nueva. Incluye el objetivo físico y la disponibilidad. Los datos para el cálculo energético solo existen en perfiles ficticios.

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
| sex_param | text | Sí |  |  | Valores: masculino, femenino | Parámetro de sexo del modelo de Mifflin-St Jeor. |
| weight_kg | numeric(5,1) | Sí |  |  | Regla: weight_kg > 0 AND weight_kg <= 500 | Peso en kilogramos. |
| height_cm | numeric(4,1) | Sí |  |  | Regla: height_cm > 0 AND height_cm <= 300 | Talla en centímetros. |
| activity_level | text | Sí |  |  | Valores: sedentario, ligero, moderado, intenso | Nivel de actividad física habitual. |
| is_fictitious | boolean | No |  | false |  | Copia de la condición de cuenta ficticia al guardar el perfil. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **profile_versions_user_version_key** (único: user_id, version): Una sola versión con cada número por participante.
- **profile_versions_id_user_key** (único: id, user_id): Permite que los borradores verifiquen que el perfil es del mismo participante.
- **profile_versions_nutrition_all_or_none**: Los cuatro datos del cálculo energético se informan completos o no se informan.
- **profile_versions_nutrition_only_fictitious**: Regla ética: sin habilitación nutricional y de datos, peso, talla, sexo y actividad solo existen en perfiles ficticios.

#### plan_drafts — Borrador de plan

Propuesta generada por el sistema (rutina o minuta) que espera la revisión de un profesional. El participante no la ve. Un cambio de perfil genera otro borrador.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del borrador. |
| user_id | uuid | No | FK |  | Referencia a users.id. Clave compuesta (profile_version_id, user_id) → profile_versions(id, user_id) | Participante destinatario. |
| profile_version_id | uuid | No | FK |  | Clave compuesta (profile_version_id, user_id) → profile_versions(id, user_id) | Versión del perfil usada para generar el borrador. |
| kind | text | No |  |  | Valores: rutina, minuta | Tipo de plan: rutina de entrenamiento o minuta de alimentación. |
| version | integer | No |  |  | Regla: version > 0 | Número correlativo por participante y tipo. |
| status | text | No |  | 'borrador' | Valores: pendiente, borrador, en_revision, aprobado, rechazado, reemplazado | Estado dentro del flujo de revisión. |
| pending_reason | text | Sí |  |  | Valores: sin_plantilla, sin_profesional, requiere_evaluacion | Motivo por el que no se pudo generar el borrador (estado pendiente). |
| template_id | uuid | Sí | FK |  | Referencia a routine_templates.id | Plantilla aprobada seleccionada (solo en rutinas). |
| rule_version_id | uuid | No | FK |  | Referencia a rule_versions.id | Versión de reglas aplicada. |
| selection_reasons | jsonb | No |  | '[]'::jsonb |  | Motivos de selección explicables (criterios coincidentes y descartados). |
| content | jsonb | No |  | '{}'::jsonb | Regla: jsonb_typeof(content) = 'object' | Contenido propuesto del plan. |
| energy_estimate | jsonb | Sí |  |  |  | Estimación energética con fórmula, versión y unidades (solo minutas de perfiles ficticios). |
| assigned_reviewer_id | uuid | Sí | FK |  | Referencia a users.id | Profesional asignado para revisar. |
| reviewing_since | timestamptz | Sí |  |  |  | Momento en que el profesional tomó el caso. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |
| decided_at | timestamptz | Sí |  |  |  | Fecha de la decisión del profesional. |
| superseded_at | timestamptz | Sí |  |  |  | Fecha en que fue reemplazado por otro borrador. |

Reglas de integridad e índices:

- **plan_drafts_user_kind_version_key** (único: user_id, kind, version): Versión única por participante y tipo.
- **plan_drafts_id_kind_key** (único: id, kind): Permite verificar el tipo desde la revisión y el plan aprobado.
- **Clave foránea compuesta** (profile_version_id, user_id) → profile_versions(id, user_id): El perfil usado pertenece al mismo participante.
- **plan_drafts_pending_pair**: El motivo pendiente existe solo en borradores pendientes.
- **plan_drafts_template_only_routines**: Solo las rutinas usan plantilla.
- **plan_drafts_energy_only_menus**: La estimación energética solo acompaña a las minutas.
- **plan_drafts_review_has_reviewer**: Un borrador en revisión tiene revisor asignado.
- **plan_drafts_decided_has_date**: Una decisión registra su fecha.
- **plan_drafts_superseded_has_date**: Un borrador reemplazado registra la fecha.
- **Índice plan_drafts_one_active**: Un solo borrador activo por participante y tipo.
- **Índice plan_drafts_queue**: Cola de revisión de cada profesional.

#### reviews — Revisión profesional

Decisión del profesional sobre un borrador. Solo el preparador revisa rutinas y solo la nutricionista revisa minutas; la base de datos lo exige.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la revisión. |
| draft_id | uuid | No | FK UQ |  | Clave compuesta (draft_id, draft_kind) → plan_drafts(id, kind) | Borrador revisado (una decisión definitiva por borrador). |
| draft_kind | text | No | FK |  | Valores: rutina, minuta. Clave compuesta (draft_id, draft_kind) → plan_drafts(id, kind) | Tipo del borrador revisado (copia verificada por clave foránea). |
| draft_version | integer | No |  |  | Regla: draft_version > 0 | Versión del borrador revisado, para la trazabilidad. |
| reviewer_id | uuid | No | FK |  | Clave compuesta (reviewer_id, reviewer_role) → users(id, role) | Profesional que decide. |
| reviewer_role | text | No | FK |  | Valores: trainer, nutritionist. Clave compuesta (reviewer_id, reviewer_role) → users(id, role) | Rol del revisor al decidir. |
| decision | text | No |  |  | Valores: aprobado, rechazado | Decisión adoptada. |
| corrected | boolean | No |  | false |  | Indica si el profesional corrigió el contenido antes de aprobar. |
| corrected_content | jsonb | Sí |  |  |  | Contenido corregido por el profesional. |
| notes | text | Sí |  |  | Regla: length(notes) <= 500 | Observaciones; obligatorias al rechazar. |
| reviewed_at | timestamptz | No |  | now() |  | Fecha y hora de la decisión. |

Reglas de integridad e índices:

- **reviews_id_draft_decision_key** (único: id, draft_id, decision): Permite que el plan aprobado verifique que su revisión fue una aprobación.
- **Clave foránea compuesta** (draft_id, draft_kind) → plan_drafts(id, kind): El tipo registrado coincide con el del borrador.
- **Clave foránea compuesta** (reviewer_id, reviewer_role) → users(id, role): El rol registrado coincide con el rol real del revisor.
- **reviews_competent_reviewer**: Competencia: el preparador revisa rutinas y la nutricionista revisa minutas.
- **reviews_reject_needs_notes**: Un rechazo exige motivo.
- **reviews_corrected_pair**: El contenido corregido existe solo si hubo corrección.
- **reviews_reject_not_corrected**: Un borrador rechazado no se corrige.

#### approved_plans — Plan aprobado

Plan publicado para el participante: copia inmutable del contenido aprobado. Cada participante tiene un solo plan vigente por tipo.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del plan aprobado. |
| draft_id | uuid | No | FK UQ |  | Clave compuesta (review_id, draft_id, decision) → reviews(id, draft_id, decision). Clave compuesta (draft_id, kind) → plan_drafts(id, kind) | Borrador del que proviene. |
| review_id | uuid | No | FK UQ |  | Clave compuesta (review_id, draft_id, decision) → reviews(id, draft_id, decision) | Revisión que lo aprobó. |
| decision | text | No | FK | 'aprobado' | Valores: aprobado. Clave compuesta (review_id, draft_id, decision) → reviews(id, draft_id, decision) | Siempre «aprobado»; permite verificar que la revisión fue una aprobación. |
| user_id | uuid | No | FK |  | Referencia a users.id | Participante destinatario. |
| kind | text | No | FK |  | Valores: rutina, minuta. Clave compuesta (draft_id, kind) → plan_drafts(id, kind) | Tipo de plan. |
| version | integer | No |  |  | Regla: version > 0 | Versión visible del plan. |
| content | jsonb | No |  |  | Regla: jsonb_typeof(content) = 'object' | Contenido publicado (borrador o contenido corregido). No se modifica. |
| status | text | No |  | 'vigente' | Valores: vigente, reemplazado | Vigente o reemplazado por una versión posterior. |
| published_at | timestamptz | No |  | now() |  | Fecha y hora de publicación. |
| replaced_at | timestamptz | Sí |  |  |  | Fecha en que dejó de estar vigente. |

Reglas de integridad e índices:

- **approved_plans_id_user_key** (único: id, user_id): Permite que las sesiones verifiquen que el plan es del mismo participante.
- **Clave foránea compuesta** (review_id, draft_id, decision) → reviews(id, draft_id, decision): Solo una revisión aprobatoria del mismo borrador puede publicar un plan.
- **Clave foránea compuesta** (draft_id, kind) → plan_drafts(id, kind): El tipo coincide con el del borrador.
- **approved_plans_replaced_pair**: La fecha de reemplazo existe solo en planes reemplazados.
- **Índice approved_plans_current**: Un solo plan vigente por participante y tipo.

### Seguimiento, avisos y trazabilidad

#### training_sessions — Sesión de entrenamiento

Sesión programada al publicar la rutina. El participante declara si la realizó; una sesión sin registro cuenta como no realizada en la adherencia.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador de la sesión. |
| user_id | uuid | No | FK |  | Clave compuesta (plan_id, user_id) → approved_plans(id, user_id) | Participante. |
| plan_id | uuid | No | FK |  | Clave compuesta (plan_id, user_id) → approved_plans(id, user_id) | Plan aprobado al que pertenece. |
| session_no | smallint | No |  |  | Regla: session_no BETWEEN 1 AND 7 | Número de sesión dentro de la semana del plan. |
| label | text | No |  |  | Regla: length(label) BETWEEN 1 AND 80 | Nombre visible de la sesión. |
| planned_date | date | No |  |  |  | Fecha programada. No se modifica retroactivamente. |
| completed_at | timestamptz | Sí |  |  |  | Momento en que el participante declaró la sesión como realizada. |
| note | text | Sí |  |  | Regla: length(note) <= 200 | Nota breve del participante. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |

Reglas de integridad e índices:

- **training_sessions_plan_date_key** (único: plan_id, planned_date): Una sesión por día y plan.
- **Clave foránea compuesta** (plan_id, user_id) → approved_plans(id, user_id): El plan pertenece al mismo participante.
- **Índice training_sessions_user_date**: Consulta de la agenda del participante.

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

#### notifications — Aviso interno

Aviso dentro de la aplicación, sin información sensible. Se consulta por la API; no se envían notificaciones externas.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | No | PK | gen_random_uuid() |  | Identificador del aviso. |
| user_id | uuid | No | FK |  | Referencia a users.id | Destinatario. |
| type | text | No |  |  | Valores: plan_publicado, borrador_rechazado, revision_pendiente, caso_pendiente, sesiones_pendientes, solicitud_derechos | Tipo de aviso. |
| ref_id | uuid | Sí |  |  |  | Identificador del registro al que se refiere. |
| message | text | No |  |  | Regla: length(message) BETWEEN 1 AND 200 | Texto del aviso, sin datos de salud. |
| created_at | timestamptz | No |  | now() |  | Fecha y hora de creación del registro. |
| read_at | timestamptz | Sí |  |  |  | Momento en que el destinatario lo leyó. |

Reglas de integridad e índices:

- **Índice notifications_user_recent**: Listado reciente de avisos por usuario.

#### audit_log — Auditoría

Bitácora de solo anexado: quién hizo qué, cuándo y sobre qué versión. No contiene tokens ni contenido sensible; la base impide modificar o borrar sus filas.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint (identidad) | No | PK |  |  | Número correlativo del evento. |
| occurred_at | timestamptz | No |  | now() |  | Fecha y hora del evento. |
| actor_id | uuid | Sí | FK |  | Referencia a users.id | Quien ejecutó la acción (vacío en acciones del sistema). |
| actor_role | text | Sí |  |  |  | Rol del actor al ejecutar la acción. |
| action | text | No |  |  | Regla: action ~ '^[a-z_]+\.[a-z_]+$' | Acción en formato «entidad.verbo», por ejemplo review.approved. |
| entity_type | text | No |  |  |  | Tipo de entidad afectada. |
| entity_id | uuid | Sí |  |  |  | Identificador de la entidad afectada. |
| entity_version | integer | Sí |  |  |  | Versión de la entidad, cuando aplica. |
| detail | jsonb | No |  | '{}'::jsonb | Regla: jsonb_typeof(detail) = 'object' | Metadatos no sensibles del evento. |

Reglas de integridad e índices:

- **Índice audit_log_entity**: Historial de una entidad.
- **Índice audit_log_time**: Consulta por período.

#### usage_events — Evento de uso seudonimizado

Eventos para calcular los KPI del piloto. Se asocian a un seudónimo (HMAC del identificador) y no tienen clave foránea hacia la cuenta, de modo que el vínculo queda separado.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint (identidad) | No | PK |  |  | Número correlativo del evento. |
| pseudonym | text | No |  |  | Regla: pseudonym ~ '^[0-9a-f]{64}$' | HMAC-SHA256 en hexadecimal del identificador de la cuenta, con secreto del piloto. |
| event_type | text | No |  |  | Valores: registro_iniciado, registro_completado, sesion_iniciada, plan_consultado, sesion_registrada, peso_registrado | Tipo de evento. |
| occurred_at | timestamptz | No |  | now() |  | Fecha y hora del evento. |

Reglas de integridad e índices:

- **Índice usage_events_pseudonym**: Actividad por participante seudonimizado.
- **Índice usage_events_type**: Conteo de eventos por tipo y período.
