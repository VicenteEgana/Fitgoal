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
| purpose | text | No |  |  | Valores: registro_cuenta, perfil_entrenamiento, datos_corporales, datos_nutricionales, seguimiento_progreso, recordatorios, evaluacion_piloto | Finalidad del tratamiento a la que se refiere. «datos_corporales» autoriza usar la estatura y el peso (datos de salud) para calcular el IMC y recomendar rutinas; «datos_nutricionales» autoriza usar el sexo y el nivel de actividad para estimar las calorías y ajustar la pauta de alimentación. |
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

#### template_exercises — Ejercicio de plantilla

Composición de una plantilla: qué ejercicios van en cada sesión y con qué indicación. La indicación la escribe el profesional; el sistema no la calcula.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| template_id | uuid | No | PK FK |  | Referencia a routine_templates.id (al borrar: CASCADE) | Plantilla a la que pertenece. |
| session_no | smallint | No | PK |  | Regla: session_no BETWEEN 1 AND 7 | Número de sesión de la plantilla; debe tener nombre en session_labels. |
| position | smallint | No | PK |  | Regla: position BETWEEN 1 AND 20 | Orden del ejercicio dentro de la sesión. |
| exercise_id | uuid | No | FK |  | Referencia a exercises.id | Ejercicio del catálogo. |
| prescription | text | No |  |  | Regla: length(prescription) BETWEEN 1 AND 200 | Indicación del preparador (series, repeticiones o tiempo) en texto libre. |

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

#### user_plan_exercises — Ejercicio de la rutina

Composición de una rutina del participante: qué ejercicios van en cada sesión y con qué indicación. En las rutinas recomendadas se copia de la plantilla; en las propias la define la persona con ejercicios aprobados.

| Columna | Tipo | Nulo | Clave | Por defecto | Restricción o valores | Descripción |
| --- | --- | --- | --- | --- | --- | --- |
| plan_id | uuid | No | PK FK |  | Referencia a user_plans.id (al borrar: CASCADE) | Rutina del participante a la que pertenece. |
| session_no | smallint | No | PK |  | Regla: session_no BETWEEN 1 AND 7 | Número de sesión dentro de la semana. |
| position | smallint | No | PK |  | Regla: position BETWEEN 1 AND 20 | Orden del ejercicio dentro de la sesión. |
| exercise_id | uuid | No | FK |  | Referencia a exercises.id | Ejercicio aprobado del catálogo. |
| prescription | text | No |  |  | Regla: length(prescription) BETWEEN 1 AND 200 | Indicación (series, repeticiones o tiempo): la del profesional, o la que armó la persona con límites seguros. |

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
| type | text | No |  |  | Valores: sesiones_pendientes, solicitud_derechos | Tipo de aviso: recordatorio de sesiones sin registrar o novedad de una solicitud de derechos. |
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
| action | text | No |  |  | Regla: action ~ '^[a-z_]+\.[a-z_]+$' | Acción en formato «entidad.verbo», por ejemplo template.approved. |
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
| event_type | text | No |  |  | Valores: registro_iniciado, registro_completado, sesion_iniciada, rutina_iniciada, plan_consultado, sesion_registrada, peso_registrado, pauta_consultada | Tipo de evento. |
| occurred_at | timestamptz | No |  | now() |  | Fecha y hora del evento. |

Reglas de integridad e índices:

- **Índice usage_events_pseudonym**: Actividad por participante seudonimizado.
- **Índice usage_events_type**: Conteo de eventos por tipo y período.
