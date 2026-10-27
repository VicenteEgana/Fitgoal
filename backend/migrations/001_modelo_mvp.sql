-- FitGoal · modelo de datos del MVP (PostgreSQL 18).
-- GENERADO desde docs/diagramas/schema/schema.mjs. No editar a mano: modifica el esquema y vuelve a generar.
-- Es la misma fuente que produce los diagramas ER y el diccionario de datos del informe.
BEGIN;

-- Valida que un arreglo de días tenga entre 1 y 7 elementos, entre 1 y 7 y sin repetir.
CREATE FUNCTION fitgoal_days_valid(d smallint[]) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT d IS NOT NULL
     AND cardinality(d) BETWEEN 1 AND 7
     AND NOT EXISTS (SELECT 1 FROM unnest(d) AS x WHERE x IS NULL OR x NOT BETWEEN 1 AND 7)
     AND (SELECT count(DISTINCT x) FROM unnest(d) AS x) = cardinality(d)
$$;

-- Valida que un arreglo de nombres de sesión tenga entre 1 y 7 elementos, cada uno con 1 a 40 caracteres.
CREATE FUNCTION fitgoal_labels_valid(l text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT l IS NOT NULL
     AND cardinality(l) BETWEEN 1 AND 7
     AND NOT EXISTS (SELECT 1 FROM unnest(l) AS x WHERE x IS NULL OR length(btrim(x)) NOT BETWEEN 1 AND 40)
$$;

-- users: Cuenta de acceso. Un mismo modelo cubre participantes, preparadores, nutricionistas y administradores (control de acceso por rol).
CREATE TABLE users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  is_fictitious boolean NOT NULL DEFAULT false,
  session_version integer NOT NULL DEFAULT 1,
  enrolled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_role_key UNIQUE (id, role),
  CONSTRAINT users_email_range CHECK (position('@' in email) > 1 AND length(email) <= 254),
  CONSTRAINT users_password_hash_range CHECK (password_hash LIKE '$argon2id$%'),
  CONSTRAINT users_role_check CHECK (role IN ('user', 'trainer', 'nutritionist', 'admin')),
  CONSTRAINT users_status_check CHECK (status IN ('active', 'blocked', 'deleted')),
  CONSTRAINT users_session_version_range CHECK (session_version >= 1),
  CONSTRAINT users_deleted_pair CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))
);
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
COMMENT ON TABLE users IS 'Cuenta de acceso. Un mismo modelo cubre participantes, preparadores, nutricionistas y administradores (control de acceso por rol).';
COMMENT ON COLUMN users.id IS 'Identificador interno de la cuenta.';
COMMENT ON COLUMN users.email IS 'Correo de acceso. Único sin distinguir mayúsculas.';
COMMENT ON COLUMN users.password_hash IS 'Hash Argon2id con sal individual (formato PHC). Nunca se guarda la contraseña.';
COMMENT ON COLUMN users.role IS 'Rol: participante, preparador físico, nutricionista o administrador.';
COMMENT ON COLUMN users.status IS 'Estado de la cuenta; «blocked» suspende el tratamiento (bloqueo temporal).';
COMMENT ON COLUMN users.is_fictitious IS 'Verdadero en cuentas de demostración o prueba.';
COMMENT ON COLUMN users.session_version IS 'Se incrementa al cambiar contraseña o rol; invalida los JWT emitidos antes.';
COMMENT ON COLUMN users.enrolled_at IS 'Fecha de inscripción confirmada en el piloto (denominador de los KPI).';
COMMENT ON COLUMN users.created_at IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN users.updated_at IS 'Fecha y hora de la última modificación.';
COMMENT ON COLUMN users.deleted_at IS 'Fecha en que se aplicó la eliminación de datos personales.';

-- auth_sessions: Sesión activa de un dispositivo. Guarda solo el hash del refresh token, que rota en cada renovación y vence a los 7 días como máximo.
CREATE TABLE auth_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  refresh_token_hash text NOT NULL,
  session_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  replaced_by uuid,
  CONSTRAINT auth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT auth_sessions_refresh_token_hash_key UNIQUE (refresh_token_hash),
  CONSTRAINT auth_sessions_session_version_range CHECK (session_version >= 1),
  CONSTRAINT auth_sessions_expires_window CHECK (expires_at > created_at AND expires_at <= created_at + interval '7 days'),
  CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT auth_sessions_replaced_by_fkey FOREIGN KEY (replaced_by) REFERENCES auth_sessions (id) ON DELETE SET NULL
);
CREATE INDEX auth_sessions_user_active ON auth_sessions (user_id) WHERE revoked_at IS NULL;
COMMENT ON TABLE auth_sessions IS 'Sesión activa de un dispositivo. Guarda solo el hash del refresh token, que rota en cada renovación y vence a los 7 días como máximo.';
COMMENT ON COLUMN auth_sessions.id IS 'Identificador de la sesión; viaja dentro del JWT como «sid».';
COMMENT ON COLUMN auth_sessions.user_id IS 'Cuenta a la que pertenece la sesión.';
COMMENT ON COLUMN auth_sessions.refresh_token_hash IS 'Hash SHA-256 del refresh token aleatorio; el token nunca se almacena.';
COMMENT ON COLUMN auth_sessions.session_version IS 'Versión de sesión de la cuenta al emitir la sesión; se compara en cada petición.';
COMMENT ON COLUMN auth_sessions.created_at IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN auth_sessions.expires_at IS 'Vencimiento absoluto de la sesión (máximo 7 días).';
COMMENT ON COLUMN auth_sessions.last_used_at IS 'Último uso para renovar el acceso.';
COMMENT ON COLUMN auth_sessions.revoked_at IS 'Fecha de revocación (cierre de sesión, cambio de contraseña o de rol).';
COMMENT ON COLUMN auth_sessions.replaced_by IS 'Sesión que reemplazó a esta al rotar el refresh token.';

-- consents: Registro anexado de cada otorgamiento o revocación de consentimiento, con la versión de la política aplicada. El estado vigente es el último registro por finalidad.
CREATE TABLE consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purpose text NOT NULL,
  policy_version text NOT NULL,
  granted boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consents_pkey PRIMARY KEY (id),
  CONSTRAINT consents_purpose_check CHECK (purpose IN ('registro_cuenta', 'perfil_entrenamiento', 'datos_corporales', 'datos_nutricionales', 'seguimiento_progreso', 'recordatorios', 'evaluacion_piloto')),
  CONSTRAINT consents_policy_version_range CHECK (length(policy_version) BETWEEN 1 AND 40),
  CONSTRAINT consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE INDEX consents_user_purpose ON consents (user_id, purpose, recorded_at DESC);
COMMENT ON TABLE consents IS 'Registro anexado de cada otorgamiento o revocación de consentimiento, con la versión de la política aplicada. El estado vigente es el último registro por finalidad.';
COMMENT ON COLUMN consents.id IS 'Identificador del registro.';
COMMENT ON COLUMN consents.user_id IS 'Titular de los datos.';
COMMENT ON COLUMN consents.purpose IS 'Finalidad del tratamiento a la que se refiere. «datos_corporales» autoriza usar la estatura y el peso (datos de salud) para calcular el IMC y recomendar rutinas; «datos_nutricionales» autoriza usar el sexo y el nivel de actividad para estimar las calorías y ajustar la pauta de alimentación.';
COMMENT ON COLUMN consents.policy_version IS 'Versión de la política de datos mostrada al titular.';
COMMENT ON COLUMN consents.granted IS 'Verdadero si otorga el consentimiento; falso si lo revoca.';
COMMENT ON COLUMN consents.recorded_at IS 'Fecha y hora del otorgamiento o la revocación.';

-- data_requests: Solicitud del titular para ejercer sus derechos sobre los datos personales, con comprobante y plazo de respuesta.
CREATE TABLE data_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'recibida',
  receipt_code text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  extension_applied boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  CONSTRAINT data_requests_pkey PRIMARY KEY (id),
  CONSTRAINT data_requests_receipt_code_key UNIQUE (receipt_code),
  CONSTRAINT data_requests_request_type_check CHECK (request_type IN ('acceso', 'rectificacion', 'oposicion', 'bloqueo', 'exportacion', 'eliminacion')),
  CONSTRAINT data_requests_status_check CHECK (status IN ('recibida', 'en_curso', 'resuelta', 'rechazada')),
  CONSTRAINT data_requests_resolution_note_range CHECK (length(resolution_note) <= 500),
  CONSTRAINT data_requests_due_after_received CHECK (due_at >= received_at),
  CONSTRAINT data_requests_resolved_complete CHECK (status IN ('recibida', 'en_curso') OR resolved_at IS NOT NULL),
  CONSTRAINT data_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT data_requests_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES users (id)
);
CREATE INDEX data_requests_open ON data_requests (due_at) WHERE status IN ('recibida', 'en_curso');
COMMENT ON TABLE data_requests IS 'Solicitud del titular para ejercer sus derechos sobre los datos personales, con comprobante y plazo de respuesta.';
COMMENT ON COLUMN data_requests.id IS 'Identificador de la solicitud.';
COMMENT ON COLUMN data_requests.user_id IS 'Titular que presenta la solicitud.';
COMMENT ON COLUMN data_requests.request_type IS 'Derecho que se ejerce.';
COMMENT ON COLUMN data_requests.status IS 'Estado de la tramitación.';
COMMENT ON COLUMN data_requests.receipt_code IS 'Código del comprobante entregado al titular.';
COMMENT ON COLUMN data_requests.received_at IS 'Fecha y hora de recepción.';
COMMENT ON COLUMN data_requests.due_at IS 'Plazo límite de respuesta: 30 días corridos, o 2 días hábiles para el bloqueo.';
COMMENT ON COLUMN data_requests.extension_applied IS 'Indica si se aplicó la única prórroga permitida (hasta 30 días).';
COMMENT ON COLUMN data_requests.resolved_at IS 'Fecha y hora de la resolución.';
COMMENT ON COLUMN data_requests.resolved_by IS 'Responsable de operación que resolvió.';
COMMENT ON COLUMN data_requests.resolution_note IS 'Fundamento o resumen de la respuesta.';

-- exercises: Biblioteca de ejercicios redactada y aprobada por el preparador físico. El sistema no inventa ejercicios: solo recomienda y combina los aprobados, y la persona puede elegir cualquiera para armar su rutina.
CREATE TABLE exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  muscle_group text NOT NULL,
  min_level text NOT NULL DEFAULT 'principiante',
  requires_equipment boolean NOT NULL DEFAULT false,
  high_impact boolean NOT NULL DEFAULT false,
  default_prescription text NOT NULL,
  source_note text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  approved_by uuid,
  approved_by_role text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercises_pkey PRIMARY KEY (id),
  CONSTRAINT exercises_code_key UNIQUE (code),
  CONSTRAINT exercises_code_range CHECK (code ~ '^[a-z0-9-]+$'),
  CONSTRAINT exercises_name_range CHECK (length(name) BETWEEN 1 AND 80),
  CONSTRAINT exercises_description_range CHECK (length(description) BETWEEN 1 AND 600),
  CONSTRAINT exercises_muscle_group_check CHECK (muscle_group IN ('piernas', 'empuje', 'traccion', 'core', 'cardio', 'movilidad')),
  CONSTRAINT exercises_min_level_check CHECK (min_level IN ('principiante', 'con_experiencia')),
  CONSTRAINT exercises_default_prescription_range CHECK (length(default_prescription) BETWEEN 1 AND 200),
  CONSTRAINT exercises_status_check CHECK (status IN ('draft', 'approved', 'retired')),
  CONSTRAINT exercises_approved_by_role_check CHECK (approved_by_role IN ('trainer')),
  CONSTRAINT exercises_approved_pair CHECK ((approved_by IS NULL) = (approved_by_role IS NULL)),
  CONSTRAINT exercises_approved_role CHECK (approved_by_role IS NULL OR approved_by_role = 'trainer'),
  CONSTRAINT exercises_approved_complete CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT exercises_created_by_fkey FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT exercises_approved_by_approved_by_role_fkey FOREIGN KEY (approved_by, approved_by_role) REFERENCES users (id, role)
);
CREATE INDEX exercises_library ON exercises (muscle_group, min_level) WHERE status = 'approved';
COMMENT ON TABLE exercises IS 'Biblioteca de ejercicios redactada y aprobada por el preparador físico. El sistema no inventa ejercicios: solo recomienda y combina los aprobados, y la persona puede elegir cualquiera para armar su rutina.';
COMMENT ON COLUMN exercises.id IS 'Identificador del ejercicio.';
COMMENT ON COLUMN exercises.code IS 'Código corto estable (slug).';
COMMENT ON COLUMN exercises.name IS 'Nombre del ejercicio.';
COMMENT ON COLUMN exercises.description IS 'Descripción de la ejecución, redactada por el profesional.';
COMMENT ON COLUMN exercises.muscle_group IS 'Grupo de trabajo: piernas, empuje (pecho, hombros y tríceps), tracción (espalda y bíceps), zona media, cardio o movilidad. Las reglas aprobadas lo usan para sugerir ejercicios según el objetivo, y las rutinas divididas, para armar cada sesión.';
COMMENT ON COLUMN exercises.min_level IS 'Nivel mínimo con el que se recomienda el ejercicio.';
COMMENT ON COLUMN exercises.requires_equipment IS 'Indica si necesita material (mancuernas u otro).';
COMMENT ON COLUMN exercises.high_impact IS 'Indica si es de alto impacto articular (saltos, trote): no se sugiere a personas con sobrepeso u obesidad.';
COMMENT ON COLUMN exercises.default_prescription IS 'Indicación sugerida por el profesional (series, repeticiones o tiempo) cuando la persona no define la suya.';
COMMENT ON COLUMN exercises.source_note IS 'Atribución o fuente del contenido profesional.';
COMMENT ON COLUMN exercises.status IS 'Borrador, aprobado (visible para las personas) o retirado.';
COMMENT ON COLUMN exercises.created_by IS 'Profesional que registró el ejercicio.';
COMMENT ON COLUMN exercises.approved_by IS 'Preparador que aprobó.';
COMMENT ON COLUMN exercises.approved_by_role IS 'Rol del aprobador; siempre trainer.';
COMMENT ON COLUMN exercises.approved_at IS 'Fecha de aprobación.';
COMMENT ON COLUMN exercises.created_at IS 'Fecha y hora de creación del registro.';

-- rule_versions: Conjunto versionado de reglas aprobadas: en entrenamiento, las rutinas para cada combinación de objetivo, nivel, equipo y categoría de IMC (una por división de la semana), la regla que elige la división según el nivel y los días disponibles, las reglas de seguridad y los grupos de ejercicios que se sugieren por objetivo; en nutrición, factores y ajustes. Solo un profesional competente puede aprobarlo.
CREATE TABLE rule_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  content jsonb NOT NULL,
  change_note text,
  author_id uuid NOT NULL,
  approved_by uuid,
  approved_by_role text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rule_versions_pkey PRIMARY KEY (id),
  CONSTRAINT rule_versions_domain_version_key UNIQUE (domain, version),
  CONSTRAINT rule_versions_domain_check CHECK (domain IN ('entrenamiento', 'nutricion')),
  CONSTRAINT rule_versions_version_range CHECK (version > 0),
  CONSTRAINT rule_versions_status_check CHECK (status IN ('draft', 'approved', 'retired')),
  CONSTRAINT rule_versions_content_range CHECK (jsonb_typeof(content) = 'object'),
  CONSTRAINT rule_versions_approved_by_role_check CHECK (approved_by_role IN ('trainer', 'nutritionist')),
  CONSTRAINT rule_versions_approved_pair CHECK ((approved_by IS NULL) = (approved_by_role IS NULL)),
  CONSTRAINT rule_versions_approved_role_by_domain CHECK (approved_by_role IS NULL OR (domain = 'entrenamiento' AND approved_by_role = 'trainer') OR (domain = 'nutricion' AND approved_by_role = 'nutritionist')),
  CONSTRAINT rule_versions_approved_complete CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT rule_versions_author_id_fkey FOREIGN KEY (author_id) REFERENCES users (id),
  CONSTRAINT rule_versions_approved_by_approved_by_role_fkey FOREIGN KEY (approved_by, approved_by_role) REFERENCES users (id, role)
);
CREATE UNIQUE INDEX rule_versions_current ON rule_versions (domain) WHERE status = 'approved';
COMMENT ON TABLE rule_versions IS 'Conjunto versionado de reglas aprobadas: en entrenamiento, las rutinas para cada combinación de objetivo, nivel, equipo y categoría de IMC (una por división de la semana), la regla que elige la división según el nivel y los días disponibles, las reglas de seguridad y los grupos de ejercicios que se sugieren por objetivo; en nutrición, factores y ajustes. Solo un profesional competente puede aprobarlo.';
COMMENT ON COLUMN rule_versions.id IS 'Identificador de la versión de reglas.';
COMMENT ON COLUMN rule_versions.domain IS 'Ámbito de las reglas.';
COMMENT ON COLUMN rule_versions.version IS 'Número correlativo dentro del ámbito.';
COMMENT ON COLUMN rule_versions.status IS 'Borrador, aprobada (vigente) o retirada.';
COMMENT ON COLUMN rule_versions.content IS 'Reglas en formato estructurado (matriz de recomendación, reglas de división, reglas de seguridad, grupos sugeridos por objetivo, factores y ajustes).';
COMMENT ON COLUMN rule_versions.change_note IS 'Motivo del cambio respecto de la versión anterior.';
COMMENT ON COLUMN rule_versions.author_id IS 'Autor de la versión.';
COMMENT ON COLUMN rule_versions.approved_by IS 'Profesional que aprobó.';
COMMENT ON COLUMN rule_versions.approved_by_role IS 'Rol del aprobador al aprobar.';
COMMENT ON COLUMN rule_versions.approved_at IS 'Fecha de aprobación.';
COMMENT ON COLUMN rule_versions.created_at IS 'Fecha y hora de creación del registro.';

-- routine_templates: Rutina prearmada, definida y aprobada una sola vez por el preparador físico, que las personas pueden iniciar al instante. Se dirige a un objetivo, nivel, equipamiento y categoría de IMC, y organiza la semana con una división (full body, upper/lower o push/pull/legs); los ejercicios van en template_exercises.
CREATE TABLE routine_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  version integer NOT NULL,
  name text NOT NULL,
  summary text NOT NULL,
  objective text NOT NULL,
  level text NOT NULL,
  equipment text NOT NULL,
  bmi_category text NOT NULL,
  split text NOT NULL,
  session_labels text[] NOT NULL,
  min_days smallint NOT NULL,
  max_days smallint NOT NULL,
  session_minutes integer NOT NULL,
  weeks smallint NOT NULL DEFAULT 4,
  allowed_adjustments jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  author_id uuid NOT NULL,
  approved_by uuid,
  approved_by_role text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT routine_templates_pkey PRIMARY KEY (id),
  CONSTRAINT routine_templates_code_version_key UNIQUE (code, version),
  CONSTRAINT routine_templates_code_range CHECK (code ~ '^[a-z0-9-]+$'),
  CONSTRAINT routine_templates_version_range CHECK (version > 0),
  CONSTRAINT routine_templates_name_range CHECK (length(name) BETWEEN 1 AND 80),
  CONSTRAINT routine_templates_summary_range CHECK (length(summary) BETWEEN 1 AND 200),
  CONSTRAINT routine_templates_objective_check CHECK (objective IN ('bajar', 'mantener', 'subir')),
  CONSTRAINT routine_templates_level_check CHECK (level IN ('principiante', 'con_experiencia')),
  CONSTRAINT routine_templates_equipment_check CHECK (equipment IN ('sin_equipo', 'con_equipo')),
  CONSTRAINT routine_templates_bmi_category_check CHECK (bmi_category IN ('general', 'bajo_peso', 'normal', 'sobrepeso', 'obesidad')),
  CONSTRAINT routine_templates_split_check CHECK (split IN ('full_body', 'upper_lower', 'push_pull_legs')),
  CONSTRAINT routine_templates_session_labels_range CHECK (fitgoal_labels_valid(session_labels)),
  CONSTRAINT routine_templates_min_days_range CHECK (min_days BETWEEN 1 AND 7),
  CONSTRAINT routine_templates_max_days_range CHECK (max_days BETWEEN 1 AND 7),
  CONSTRAINT routine_templates_session_minutes_check CHECK (session_minutes IN (20, 30, 45, 60)),
  CONSTRAINT routine_templates_weeks_range CHECK (weeks BETWEEN 1 AND 12),
  CONSTRAINT routine_templates_allowed_adjustments_range CHECK (jsonb_typeof(allowed_adjustments) = 'object'),
  CONSTRAINT routine_templates_status_check CHECK (status IN ('draft', 'approved', 'retired')),
  CONSTRAINT routine_templates_approved_by_role_check CHECK (approved_by_role IN ('trainer')),
  CONSTRAINT routine_templates_days_order CHECK (min_days <= max_days),
  CONSTRAINT routine_templates_approved_pair CHECK ((approved_by IS NULL) = (approved_by_role IS NULL)),
  CONSTRAINT routine_templates_approved_role CHECK (approved_by_role IS NULL OR approved_by_role = 'trainer'),
  CONSTRAINT routine_templates_approved_complete CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT routine_templates_author_id_fkey FOREIGN KEY (author_id) REFERENCES users (id),
  CONSTRAINT routine_templates_approved_by_approved_by_role_fkey FOREIGN KEY (approved_by, approved_by_role) REFERENCES users (id, role)
);
CREATE UNIQUE INDEX routine_templates_current ON routine_templates (code) WHERE status = 'approved';
CREATE INDEX routine_templates_selection ON routine_templates (objective, level, equipment, bmi_category, split) WHERE status = 'approved';
COMMENT ON TABLE routine_templates IS 'Rutina prearmada, definida y aprobada una sola vez por el preparador físico, que las personas pueden iniciar al instante. Se dirige a un objetivo, nivel, equipamiento y categoría de IMC, y organiza la semana con una división (full body, upper/lower o push/pull/legs); los ejercicios van en template_exercises.';
COMMENT ON COLUMN routine_templates.id IS 'Identificador de la plantilla.';
COMMENT ON COLUMN routine_templates.code IS 'Código estable de la plantilla (igual para todas sus versiones).';
COMMENT ON COLUMN routine_templates.version IS 'Versión de la plantilla.';
COMMENT ON COLUMN routine_templates.name IS 'Nombre visible de la rutina.';
COMMENT ON COLUMN routine_templates.summary IS 'Descripción breve de para quién es la rutina y qué incluye.';
COMMENT ON COLUMN routine_templates.objective IS 'Objetivo físico al que se dirige.';
COMMENT ON COLUMN routine_templates.level IS 'Nivel de experiencia al que se dirige.';
COMMENT ON COLUMN routine_templates.equipment IS 'Equipamiento requerido.';
COMMENT ON COLUMN routine_templates.bmi_category IS 'Categoría de IMC a la que se dirige. «general» es una rutina conservadora, de bajo impacto, para quien no informa su estatura y peso.';
COMMENT ON COLUMN routine_templates.split IS 'División de la semana: full body (cuerpo completo en cada sesión), upper/lower (tren superior e inferior por separado) o push/pull/legs (empuje, tracción y piernas por separado).';
COMMENT ON COLUMN routine_templates.session_labels IS 'Nombre de cada sesión, en orden (por ejemplo, «Tren superior A»); la sesión k de template_exercises usa el nombre k.';
COMMENT ON COLUMN routine_templates.min_days IS 'Mínimo de días por semana que exige la plantilla.';
COMMENT ON COLUMN routine_templates.max_days IS 'Máximo de días por semana que contempla.';
COMMENT ON COLUMN routine_templates.session_minutes IS 'Duración de cada sesión en minutos.';
COMMENT ON COLUMN routine_templates.weeks IS 'Semanas que cubre el plan al publicarse.';
COMMENT ON COLUMN routine_templates.allowed_adjustments IS 'Ajustes que el sistema puede aplicar (por ejemplo, sustituciones permitidas).';
COMMENT ON COLUMN routine_templates.status IS 'Borrador, aprobada (vigente) o retirada.';
COMMENT ON COLUMN routine_templates.author_id IS 'Preparador que redactó la plantilla.';
COMMENT ON COLUMN routine_templates.approved_by IS 'Preparador que aprobó.';
COMMENT ON COLUMN routine_templates.approved_by_role IS 'Rol del aprobador; siempre trainer.';
COMMENT ON COLUMN routine_templates.approved_at IS 'Fecha de aprobación.';
COMMENT ON COLUMN routine_templates.created_at IS 'Fecha y hora de creación del registro.';

-- template_exercises: Composición de una plantilla: qué ejercicios van en cada sesión y con qué indicación. La indicación la escribe el profesional; el sistema no la calcula.
CREATE TABLE template_exercises (
  template_id uuid NOT NULL,
  session_no smallint NOT NULL,
  position smallint NOT NULL,
  exercise_id uuid NOT NULL,
  prescription text NOT NULL,
  CONSTRAINT template_exercises_pkey PRIMARY KEY (template_id, session_no, position),
  CONSTRAINT template_exercises_session_no_range CHECK (session_no BETWEEN 1 AND 7),
  CONSTRAINT template_exercises_position_range CHECK (position BETWEEN 1 AND 20),
  CONSTRAINT template_exercises_prescription_range CHECK (length(prescription) BETWEEN 1 AND 200),
  CONSTRAINT template_exercises_template_id_fkey FOREIGN KEY (template_id) REFERENCES routine_templates (id) ON DELETE CASCADE,
  CONSTRAINT template_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
COMMENT ON TABLE template_exercises IS 'Composición de una plantilla: qué ejercicios van en cada sesión y con qué indicación. La indicación la escribe el profesional; el sistema no la calcula.';
COMMENT ON COLUMN template_exercises.template_id IS 'Plantilla a la que pertenece.';
COMMENT ON COLUMN template_exercises.session_no IS 'Número de sesión de la plantilla; debe tener nombre en session_labels.';
COMMENT ON COLUMN template_exercises.position IS 'Orden del ejercicio dentro de la sesión.';
COMMENT ON COLUMN template_exercises.exercise_id IS 'Ejercicio del catálogo.';
COMMENT ON COLUMN template_exercises.prescription IS 'Indicación del preparador (series, repeticiones o tiempo) en texto libre.';

-- foods: Alimentos del mercado chileno con su composición por 100 g, redactados y aprobados por la nutricionista. Las pautas de alimentación solo usan alimentos aprobados.
CREATE TABLE foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  kcal_100g numeric(6,1) NOT NULL,
  protein_100g numeric(5,1) NOT NULL,
  carbs_100g numeric(5,1) NOT NULL,
  fat_100g numeric(5,1) NOT NULL,
  unit_name text,
  unit_grams numeric(6,1),
  source_note text,
  status text NOT NULL DEFAULT 'draft',
  author_id uuid NOT NULL,
  approved_by uuid,
  approved_by_role text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT foods_pkey PRIMARY KEY (id),
  CONSTRAINT foods_code_key UNIQUE (code),
  CONSTRAINT foods_code_range CHECK (code ~ '^[a-z0-9-]+$'),
  CONSTRAINT foods_name_range CHECK (length(name) BETWEEN 1 AND 80),
  CONSTRAINT foods_category_check CHECK (category IN ('proteinas', 'lacteos', 'cereales', 'legumbres', 'frutas', 'verduras', 'grasas')),
  CONSTRAINT foods_kcal_100g_range CHECK (kcal_100g BETWEEN 0 AND 900),
  CONSTRAINT foods_protein_100g_range CHECK (protein_100g >= 0),
  CONSTRAINT foods_carbs_100g_range CHECK (carbs_100g >= 0),
  CONSTRAINT foods_fat_100g_range CHECK (fat_100g >= 0),
  CONSTRAINT foods_unit_name_range CHECK (length(unit_name) BETWEEN 1 AND 30),
  CONSTRAINT foods_unit_grams_range CHECK (unit_grams > 0),
  CONSTRAINT foods_status_check CHECK (status IN ('draft', 'approved', 'retired')),
  CONSTRAINT foods_approved_by_role_check CHECK (approved_by_role IN ('nutritionist')),
  CONSTRAINT foods_approved_pair CHECK ((approved_by IS NULL) = (approved_by_role IS NULL)),
  CONSTRAINT foods_approved_role CHECK (approved_by_role IS NULL OR approved_by_role = 'nutritionist'),
  CONSTRAINT foods_approved_complete CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT foods_macros_per_100g CHECK (protein_100g + carbs_100g + fat_100g <= 100),
  CONSTRAINT foods_unit_pair CHECK ((unit_name IS NULL) = (unit_grams IS NULL)),
  CONSTRAINT foods_author_id_fkey FOREIGN KEY (author_id) REFERENCES users (id),
  CONSTRAINT foods_approved_by_approved_by_role_fkey FOREIGN KEY (approved_by, approved_by_role) REFERENCES users (id, role)
);
COMMENT ON TABLE foods IS 'Alimentos del mercado chileno con su composición por 100 g, redactados y aprobados por la nutricionista. Las pautas de alimentación solo usan alimentos aprobados.';
COMMENT ON COLUMN foods.id IS 'Identificador del alimento.';
COMMENT ON COLUMN foods.code IS 'Código corto estable.';
COMMENT ON COLUMN foods.name IS 'Nombre del alimento, con su preparación cuando importa (por ejemplo, «Arroz blanco cocido»).';
COMMENT ON COLUMN foods.category IS 'Grupo de alimentos. Las verduras no se escalan al ajustar las calorías: se mantienen como base libre de la pauta.';
COMMENT ON COLUMN foods.kcal_100g IS 'Energía por 100 g, en kcal.';
COMMENT ON COLUMN foods.protein_100g IS 'Proteínas por 100 g, en gramos.';
COMMENT ON COLUMN foods.carbs_100g IS 'Carbohidratos por 100 g, en gramos.';
COMMENT ON COLUMN foods.fat_100g IS 'Grasas por 100 g, en gramos.';
COMMENT ON COLUMN foods.unit_name IS 'Medida casera opcional (por ejemplo, «unidad», «rebanada» o «taza»).';
COMMENT ON COLUMN foods.unit_grams IS 'Gramos que pesa la medida casera.';
COMMENT ON COLUMN foods.source_note IS 'Fuente de la composición (tabla de composición o etiqueta).';
COMMENT ON COLUMN foods.status IS 'Borrador, aprobado o retirado.';
COMMENT ON COLUMN foods.author_id IS 'Profesional que cargó el alimento.';
COMMENT ON COLUMN foods.approved_by IS 'Nutricionista que aprobó.';
COMMENT ON COLUMN foods.approved_by_role IS 'Rol del aprobador; siempre nutritionist.';
COMMENT ON COLUMN foods.approved_at IS 'Fecha de aprobación.';
COMMENT ON COLUMN foods.created_at IS 'Fecha y hora de creación del registro.';

-- meal_plan_templates: Pauta de alimentación de 7 días, redactada y aprobada una sola vez por la nutricionista para un tipo de dieta, con gramos para una energía de referencia. Al mostrarla, la app ajusta los gramos a las calorías de la persona con las reglas nutricionales aprobadas.
CREATE TABLE meal_plan_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  version integer NOT NULL,
  name text NOT NULL,
  summary text NOT NULL,
  diet text NOT NULL,
  reference_kcal integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  author_id uuid NOT NULL,
  approved_by uuid,
  approved_by_role text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_plan_templates_pkey PRIMARY KEY (id),
  CONSTRAINT meal_plan_templates_code_version_key UNIQUE (code, version),
  CONSTRAINT meal_plan_templates_code_range CHECK (code ~ '^[a-z0-9-]+$'),
  CONSTRAINT meal_plan_templates_version_range CHECK (version > 0),
  CONSTRAINT meal_plan_templates_name_range CHECK (length(name) BETWEEN 1 AND 80),
  CONSTRAINT meal_plan_templates_summary_range CHECK (length(summary) BETWEEN 1 AND 300),
  CONSTRAINT meal_plan_templates_diet_check CHECK (diet IN ('mediterranea', 'alta_proteina', 'baja_carbohidratos', 'vegetariana')),
  CONSTRAINT meal_plan_templates_reference_kcal_range CHECK (reference_kcal BETWEEN 1200 AND 4000),
  CONSTRAINT meal_plan_templates_status_check CHECK (status IN ('draft', 'approved', 'retired')),
  CONSTRAINT meal_plan_templates_approved_by_role_check CHECK (approved_by_role IN ('nutritionist')),
  CONSTRAINT meal_plan_templates_approved_pair CHECK ((approved_by IS NULL) = (approved_by_role IS NULL)),
  CONSTRAINT meal_plan_templates_approved_role CHECK (approved_by_role IS NULL OR approved_by_role = 'nutritionist'),
  CONSTRAINT meal_plan_templates_approved_complete CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT meal_plan_templates_author_id_fkey FOREIGN KEY (author_id) REFERENCES users (id),
  CONSTRAINT meal_plan_templates_approved_by_approved_by_role_fkey FOREIGN KEY (approved_by, approved_by_role) REFERENCES users (id, role)
);
CREATE UNIQUE INDEX meal_plan_templates_current ON meal_plan_templates (code) WHERE status = 'approved';
CREATE INDEX meal_plan_templates_diet ON meal_plan_templates (diet) WHERE status = 'approved';
COMMENT ON TABLE meal_plan_templates IS 'Pauta de alimentación de 7 días, redactada y aprobada una sola vez por la nutricionista para un tipo de dieta, con gramos para una energía de referencia. Al mostrarla, la app ajusta los gramos a las calorías de la persona con las reglas nutricionales aprobadas.';
COMMENT ON COLUMN meal_plan_templates.id IS 'Identificador de la pauta.';
COMMENT ON COLUMN meal_plan_templates.code IS 'Código estable de la pauta (igual para todas sus versiones).';
COMMENT ON COLUMN meal_plan_templates.version IS 'Versión de la pauta.';
COMMENT ON COLUMN meal_plan_templates.name IS 'Nombre visible de la pauta.';
COMMENT ON COLUMN meal_plan_templates.summary IS 'Descripción breve de la dieta y su fundamento.';
COMMENT ON COLUMN meal_plan_templates.diet IS 'Tipo de dieta: mediterránea, alta en proteína, baja en carbohidratos (moderada) u ovolactovegetariana.';
COMMENT ON COLUMN meal_plan_templates.reference_kcal IS 'Energía diaria (kcal) para la que están escritos los gramos.';
COMMENT ON COLUMN meal_plan_templates.status IS 'Borrador, aprobada (vigente) o retirada.';
COMMENT ON COLUMN meal_plan_templates.author_id IS 'Nutricionista que redactó la pauta.';
COMMENT ON COLUMN meal_plan_templates.approved_by IS 'Nutricionista que aprobó.';
COMMENT ON COLUMN meal_plan_templates.approved_by_role IS 'Rol del aprobador; siempre nutritionist.';
COMMENT ON COLUMN meal_plan_templates.approved_at IS 'Fecha de aprobación.';
COMMENT ON COLUMN meal_plan_templates.created_at IS 'Fecha y hora de creación del registro.';

-- meal_plan_items: Composición de una pauta: qué alimento y cuántos gramos van en cada comida de cada día, para la energía de referencia.
CREATE TABLE meal_plan_items (
  template_id uuid NOT NULL,
  day_no smallint NOT NULL,
  meal text NOT NULL,
  position smallint NOT NULL,
  food_id uuid NOT NULL,
  grams numeric(6,1) NOT NULL,
  CONSTRAINT meal_plan_items_pkey PRIMARY KEY (template_id, day_no, meal, position),
  CONSTRAINT meal_plan_items_day_no_range CHECK (day_no BETWEEN 1 AND 7),
  CONSTRAINT meal_plan_items_meal_check CHECK (meal IN ('desayuno', 'colacion', 'almuerzo', 'once', 'cena')),
  CONSTRAINT meal_plan_items_position_range CHECK (position BETWEEN 1 AND 12),
  CONSTRAINT meal_plan_items_grams_range CHECK (grams > 0 AND grams <= 1000),
  CONSTRAINT meal_plan_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES meal_plan_templates (id) ON DELETE CASCADE,
  CONSTRAINT meal_plan_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES foods (id)
);
COMMENT ON TABLE meal_plan_items IS 'Composición de una pauta: qué alimento y cuántos gramos van en cada comida de cada día, para la energía de referencia.';
COMMENT ON COLUMN meal_plan_items.template_id IS 'Pauta a la que pertenece.';
COMMENT ON COLUMN meal_plan_items.day_no IS 'Día de la pauta (1 = lunes … 7 = domingo).';
COMMENT ON COLUMN meal_plan_items.meal IS 'Comida del día.';
COMMENT ON COLUMN meal_plan_items.position IS 'Orden del alimento dentro de la comida.';
COMMENT ON COLUMN meal_plan_items.food_id IS 'Alimento del catálogo.';
COMMENT ON COLUMN meal_plan_items.grams IS 'Gramos del alimento para la energía de referencia.';

-- profile_versions: Cada cambio del perfil crea una versión nueva. Incluye el objetivo físico, la disponibilidad y, con consentimiento específico, la estatura y el peso con que se calcula el IMC y, con otro consentimiento específico, el sexo y el nivel de actividad con que se estiman las calorías de la pauta de alimentación.
CREATE TABLE profile_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  version integer NOT NULL,
  age integer NOT NULL,
  objective text NOT NULL,
  level text NOT NULL,
  days smallint[] NOT NULL,
  duration_minutes integer NOT NULL,
  equipment text NOT NULL,
  sex_param text,
  weight_kg numeric(5,1),
  height_cm numeric(4,1),
  activity_level text,
  is_fictitious boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_versions_pkey PRIMARY KEY (id),
  CONSTRAINT profile_versions_user_version_key UNIQUE (user_id, version),
  CONSTRAINT profile_versions_id_user_key UNIQUE (id, user_id),
  CONSTRAINT profile_versions_version_range CHECK (version > 0),
  CONSTRAINT profile_versions_age_range CHECK (age BETWEEN 18 AND 120),
  CONSTRAINT profile_versions_objective_check CHECK (objective IN ('bajar', 'mantener', 'subir')),
  CONSTRAINT profile_versions_level_check CHECK (level IN ('principiante', 'con_experiencia')),
  CONSTRAINT profile_versions_days_range CHECK (fitgoal_days_valid(days)),
  CONSTRAINT profile_versions_duration_minutes_check CHECK (duration_minutes IN (20, 30, 45, 60)),
  CONSTRAINT profile_versions_equipment_check CHECK (equipment IN ('sin_equipo', 'con_equipo')),
  CONSTRAINT profile_versions_sex_param_check CHECK (sex_param IN ('masculino', 'femenino')),
  CONSTRAINT profile_versions_weight_kg_range CHECK (weight_kg BETWEEN 30 AND 300),
  CONSTRAINT profile_versions_height_cm_range CHECK (height_cm BETWEEN 100 AND 250),
  CONSTRAINT profile_versions_activity_level_check CHECK (activity_level IN ('sedentario', 'ligero', 'moderado', 'intenso')),
  CONSTRAINT profile_versions_body_pair CHECK ((weight_kg IS NULL) = (height_cm IS NULL)),
  CONSTRAINT profile_versions_estimate_needs_body CHECK ((sex_param IS NULL) = (activity_level IS NULL) AND (sex_param IS NULL OR weight_kg IS NOT NULL)),
  CONSTRAINT profile_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
);
COMMENT ON TABLE profile_versions IS 'Cada cambio del perfil crea una versión nueva. Incluye el objetivo físico, la disponibilidad y, con consentimiento específico, la estatura y el peso con que se calcula el IMC y, con otro consentimiento específico, el sexo y el nivel de actividad con que se estiman las calorías de la pauta de alimentación.';
COMMENT ON COLUMN profile_versions.id IS 'Identificador de la versión del perfil.';
COMMENT ON COLUMN profile_versions.user_id IS 'Participante dueño del perfil.';
COMMENT ON COLUMN profile_versions.version IS 'Número correlativo por participante.';
COMMENT ON COLUMN profile_versions.age IS 'Edad en años (solo personas adultas).';
COMMENT ON COLUMN profile_versions.objective IS 'Objetivo físico: bajar, mantener o subir de peso.';
COMMENT ON COLUMN profile_versions.level IS 'Nivel de experiencia declarado.';
COMMENT ON COLUMN profile_versions.days IS 'Días disponibles (1 = lunes … 7 = domingo), sin repetir.';
COMMENT ON COLUMN profile_versions.duration_minutes IS 'Minutos disponibles por sesión.';
COMMENT ON COLUMN profile_versions.equipment IS 'Equipamiento disponible.';
COMMENT ON COLUMN profile_versions.sex_param IS 'Parámetro de sexo del modelo de Mifflin-St Jeor (opcional, con el consentimiento «datos_nutricionales»; se borra si se revoca).';
COMMENT ON COLUMN profile_versions.weight_kg IS 'Peso en kilogramos (opcional, dato de salud). Solo se guarda con el consentimiento «datos_corporales» y se borra si se revoca.';
COMMENT ON COLUMN profile_versions.height_cm IS 'Estatura en centímetros (opcional, dato de salud). Junto al peso permite calcular el IMC.';
COMMENT ON COLUMN profile_versions.activity_level IS 'Nivel de actividad física habitual, que fija el factor de actividad de las reglas nutricionales (opcional, con el consentimiento «datos_nutricionales»).';
COMMENT ON COLUMN profile_versions.is_fictitious IS 'Copia de la condición de cuenta ficticia al guardar el perfil.';
COMMENT ON COLUMN profile_versions.created_at IS 'Fecha y hora de creación del registro.';

-- user_plans: Rutina que la persona inició: una rutina recomendada (copia de una plantilla aprobada) o una rutina propia armada con ejercicios aprobados. Es una copia que no cambia; la persona tiene una sola rutina vigente y al iniciar otra la anterior queda reemplazada.
CREATE TABLE user_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_version_id uuid NOT NULL,
  source text NOT NULL,
  template_id uuid,
  rule_version_id uuid,
  name text NOT NULL,
  version integer NOT NULL,
  weeks smallint NOT NULL,
  session_minutes integer NOT NULL,
  days smallint[] NOT NULL,
  session_labels text[] NOT NULL,
  status text NOT NULL DEFAULT 'vigente',
  started_at timestamptz NOT NULL DEFAULT now(),
  replaced_at timestamptz,
  CONSTRAINT user_plans_pkey PRIMARY KEY (id),
  CONSTRAINT user_plans_user_version_key UNIQUE (user_id, version),
  CONSTRAINT user_plans_id_user_key UNIQUE (id, user_id),
  CONSTRAINT user_plans_source_check CHECK (source IN ('recomendada', 'propia')),
  CONSTRAINT user_plans_name_range CHECK (length(name) BETWEEN 1 AND 80),
  CONSTRAINT user_plans_version_range CHECK (version > 0),
  CONSTRAINT user_plans_weeks_range CHECK (weeks BETWEEN 1 AND 12),
  CONSTRAINT user_plans_session_minutes_check CHECK (session_minutes IN (20, 30, 45, 60)),
  CONSTRAINT user_plans_days_range CHECK (fitgoal_days_valid(days)),
  CONSTRAINT user_plans_session_labels_range CHECK (fitgoal_labels_valid(session_labels)),
  CONSTRAINT user_plans_status_check CHECK (status IN ('vigente', 'reemplazado')),
  CONSTRAINT user_plans_source_template_pair CHECK ((source = 'recomendada') = (template_id IS NOT NULL)),
  CONSTRAINT user_plans_recommended_has_rules CHECK (source <> 'recomendada' OR rule_version_id IS NOT NULL),
  CONSTRAINT user_plans_labels_per_day CHECK (cardinality(session_labels) = cardinality(days)),
  CONSTRAINT user_plans_replaced_pair CHECK ((status = 'reemplazado') = (replaced_at IS NOT NULL)),
  CONSTRAINT user_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT user_plans_template_id_fkey FOREIGN KEY (template_id) REFERENCES routine_templates (id),
  CONSTRAINT user_plans_rule_version_id_fkey FOREIGN KEY (rule_version_id) REFERENCES rule_versions (id),
  CONSTRAINT user_plans_profile_version_id_user_id_fkey FOREIGN KEY (profile_version_id, user_id) REFERENCES profile_versions (id, user_id)
);
CREATE UNIQUE INDEX user_plans_current ON user_plans (user_id) WHERE status = 'vigente';
COMMENT ON TABLE user_plans IS 'Rutina que la persona inició: una rutina recomendada (copia de una plantilla aprobada) o una rutina propia armada con ejercicios aprobados. Es una copia que no cambia; la persona tiene una sola rutina vigente y al iniciar otra la anterior queda reemplazada.';
COMMENT ON COLUMN user_plans.id IS 'Identificador de la rutina del participante.';
COMMENT ON COLUMN user_plans.user_id IS 'Participante dueño de la rutina.';
COMMENT ON COLUMN user_plans.profile_version_id IS 'Versión del perfil vigente al iniciar la rutina.';
COMMENT ON COLUMN user_plans.source IS 'Origen: «recomendada» (plantilla aprobada) o «propia» (armada por la persona).';
COMMENT ON COLUMN user_plans.template_id IS 'Plantilla aprobada de la que se copió (solo en rutinas recomendadas).';
COMMENT ON COLUMN user_plans.rule_version_id IS 'Versión de reglas aprobadas que produjo la recomendación o las sugerencias de ejercicios.';
COMMENT ON COLUMN user_plans.name IS 'Nombre visible de la rutina.';
COMMENT ON COLUMN user_plans.version IS 'Número correlativo de rutinas iniciadas por el participante.';
COMMENT ON COLUMN user_plans.weeks IS 'Semanas que se programan al iniciarla.';
COMMENT ON COLUMN user_plans.session_minutes IS 'Duración de cada sesión en minutos.';
COMMENT ON COLUMN user_plans.days IS 'Días de entrenamiento elegidos, de menor a mayor (1 = lunes … 7 = domingo). La sesión k cae el día k; los días no elegidos son de descanso (no se guardan: el horario y la racha los deducen).';
COMMENT ON COLUMN user_plans.session_labels IS 'Nombre de la sesión de cada día elegido (en las recomendadas, el de la plantilla, repetido en ciclo; en las propias, el que la persona le da o «Sesión k»).';
COMMENT ON COLUMN user_plans.status IS 'Vigente o reemplazada por una rutina iniciada después.';
COMMENT ON COLUMN user_plans.started_at IS 'Fecha y hora en que la persona inició la rutina.';
COMMENT ON COLUMN user_plans.replaced_at IS 'Fecha en que dejó de estar vigente.';

-- user_plan_exercises: Composición de una rutina del participante: qué ejercicios van en cada sesión y con qué indicación. En las rutinas recomendadas se copia de la plantilla; en las propias la define la persona con ejercicios aprobados.
CREATE TABLE user_plan_exercises (
  plan_id uuid NOT NULL,
  session_no smallint NOT NULL,
  position smallint NOT NULL,
  exercise_id uuid NOT NULL,
  prescription text NOT NULL,
  CONSTRAINT user_plan_exercises_pkey PRIMARY KEY (plan_id, session_no, position),
  CONSTRAINT user_plan_exercises_session_no_range CHECK (session_no BETWEEN 1 AND 7),
  CONSTRAINT user_plan_exercises_position_range CHECK (position BETWEEN 1 AND 20),
  CONSTRAINT user_plan_exercises_prescription_range CHECK (length(prescription) BETWEEN 1 AND 200),
  CONSTRAINT user_plan_exercises_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES user_plans (id) ON DELETE CASCADE,
  CONSTRAINT user_plan_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);
COMMENT ON TABLE user_plan_exercises IS 'Composición de una rutina del participante: qué ejercicios van en cada sesión y con qué indicación. En las rutinas recomendadas se copia de la plantilla; en las propias la define la persona con ejercicios aprobados.';
COMMENT ON COLUMN user_plan_exercises.plan_id IS 'Rutina del participante a la que pertenece.';
COMMENT ON COLUMN user_plan_exercises.session_no IS 'Número de sesión dentro de la semana.';
COMMENT ON COLUMN user_plan_exercises.position IS 'Orden del ejercicio dentro de la sesión.';
COMMENT ON COLUMN user_plan_exercises.exercise_id IS 'Ejercicio aprobado del catálogo.';
COMMENT ON COLUMN user_plan_exercises.prescription IS 'Indicación (series, repeticiones o tiempo): la del profesional, o la que armó la persona con límites seguros.';

-- meal_plan_swaps: Alimento de una pauta aprobada que la persona cambió porque no lo tiene o no le gusta, por otro aprobado del mismo grupo que la nutricionista incluyó en esa pauta. No se guardan gramos: la API calcula los que aportan la misma energía. Vale solo para esa versión de la pauta y se puede deshacer.
CREATE TABLE meal_plan_swaps (
  user_id uuid NOT NULL,
  template_id uuid NOT NULL,
  day_no smallint NOT NULL,
  meal text NOT NULL,
  position smallint NOT NULL,
  food_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_plan_swaps_pkey PRIMARY KEY (user_id, template_id, day_no, meal, position),
  CONSTRAINT meal_plan_swaps_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT meal_plan_swaps_food_id_fkey FOREIGN KEY (food_id) REFERENCES foods (id),
  CONSTRAINT meal_plan_swaps_template_id_day_no_meal_position_fkey FOREIGN KEY (template_id, day_no, meal, position) REFERENCES meal_plan_items (template_id, day_no, meal, position)
);
COMMENT ON TABLE meal_plan_swaps IS 'Alimento de una pauta aprobada que la persona cambió porque no lo tiene o no le gusta, por otro aprobado del mismo grupo que la nutricionista incluyó en esa pauta. No se guardan gramos: la API calcula los que aportan la misma energía. Vale solo para esa versión de la pauta y se puede deshacer.';
COMMENT ON COLUMN meal_plan_swaps.user_id IS 'Participante que hizo el cambio.';
COMMENT ON COLUMN meal_plan_swaps.template_id IS 'Pauta aprobada.';
COMMENT ON COLUMN meal_plan_swaps.day_no IS 'Día de la pauta (1 = lunes … 7 = domingo).';
COMMENT ON COLUMN meal_plan_swaps.meal IS 'Comida del día.';
COMMENT ON COLUMN meal_plan_swaps.position IS 'Posición del alimento reemplazado dentro de la comida.';
COMMENT ON COLUMN meal_plan_swaps.food_id IS 'Alimento que lo reemplaza: aprobado, del mismo grupo y presente en la misma pauta.';
COMMENT ON COLUMN meal_plan_swaps.created_at IS 'Fecha y hora de creación del registro.';

-- training_sessions: Sesión programada al iniciar la rutina. El participante declara si la realizó; una sesión sin registro cuenta como no realizada en la adherencia. Los días de descanso no tienen filas: el horario semanal y la racha los deducen de los días de la rutina, y la racha no se guarda.
CREATE TABLE training_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  session_no smallint NOT NULL,
  label text NOT NULL,
  planned_date date NOT NULL,
  completed_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT training_sessions_plan_date_key UNIQUE (plan_id, planned_date),
  CONSTRAINT training_sessions_session_no_range CHECK (session_no BETWEEN 1 AND 7),
  CONSTRAINT training_sessions_label_range CHECK (length(label) BETWEEN 1 AND 80),
  CONSTRAINT training_sessions_note_range CHECK (length(note) <= 200),
  CONSTRAINT training_sessions_plan_id_user_id_fkey FOREIGN KEY (plan_id, user_id) REFERENCES user_plans (id, user_id)
);
CREATE INDEX training_sessions_user_date ON training_sessions (user_id, planned_date);
COMMENT ON TABLE training_sessions IS 'Sesión programada al iniciar la rutina. El participante declara si la realizó; una sesión sin registro cuenta como no realizada en la adherencia. Los días de descanso no tienen filas: el horario semanal y la racha los deducen de los días de la rutina, y la racha no se guarda.';
COMMENT ON COLUMN training_sessions.id IS 'Identificador de la sesión.';
COMMENT ON COLUMN training_sessions.user_id IS 'Participante.';
COMMENT ON COLUMN training_sessions.plan_id IS 'Rutina del participante a la que pertenece.';
COMMENT ON COLUMN training_sessions.session_no IS 'Número de sesión dentro de la semana del plan.';
COMMENT ON COLUMN training_sessions.label IS 'Nombre visible de la sesión.';
COMMENT ON COLUMN training_sessions.planned_date IS 'Fecha programada. No se modifica retroactivamente.';
COMMENT ON COLUMN training_sessions.completed_at IS 'Momento en que el participante declaró la sesión como realizada.';
COMMENT ON COLUMN training_sessions.note IS 'Nota breve del participante.';
COMMENT ON COLUMN training_sessions.created_at IS 'Fecha y hora de creación del registro.';

-- weight_records: Peso declarado por el participante. Solo se habilita con consentimiento de seguimiento y tratamiento de datos autorizado.
CREATE TABLE weight_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recorded_on date NOT NULL,
  weight_kg numeric(5,1) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weight_records_pkey PRIMARY KEY (id),
  CONSTRAINT weight_records_user_day_key UNIQUE (user_id, recorded_on),
  CONSTRAINT weight_records_weight_kg_range CHECK (weight_kg > 0 AND weight_kg <= 500),
  CONSTRAINT weight_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
);
COMMENT ON TABLE weight_records IS 'Peso declarado por el participante. Solo se habilita con consentimiento de seguimiento y tratamiento de datos autorizado.';
COMMENT ON COLUMN weight_records.id IS 'Identificador del registro.';
COMMENT ON COLUMN weight_records.user_id IS 'Participante.';
COMMENT ON COLUMN weight_records.recorded_on IS 'Fecha a la que corresponde el peso.';
COMMENT ON COLUMN weight_records.weight_kg IS 'Peso en kilogramos.';
COMMENT ON COLUMN weight_records.created_at IS 'Fecha y hora de creación del registro.';

-- notifications: Aviso dentro de la aplicación, sin información sensible. Se consulta por la API; no se envían notificaciones externas.
CREATE TABLE notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  ref_id uuid,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_type_check CHECK (type IN ('sesiones_pendientes', 'solicitud_derechos')),
  CONSTRAINT notifications_message_range CHECK (length(message) BETWEEN 1 AND 200),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE INDEX notifications_user_recent ON notifications (user_id, created_at DESC);
COMMENT ON TABLE notifications IS 'Aviso dentro de la aplicación, sin información sensible. Se consulta por la API; no se envían notificaciones externas.';
COMMENT ON COLUMN notifications.id IS 'Identificador del aviso.';
COMMENT ON COLUMN notifications.user_id IS 'Destinatario.';
COMMENT ON COLUMN notifications.type IS 'Tipo de aviso: recordatorio de sesiones sin registrar o novedad de una solicitud de derechos.';
COMMENT ON COLUMN notifications.ref_id IS 'Identificador del registro al que se refiere.';
COMMENT ON COLUMN notifications.message IS 'Texto del aviso, sin datos de salud.';
COMMENT ON COLUMN notifications.created_at IS 'Fecha y hora de creación del registro.';
COMMENT ON COLUMN notifications.read_at IS 'Momento en que el destinatario lo leyó.';

-- audit_log: Bitácora de solo anexado: quién hizo qué, cuándo y sobre qué versión. No contiene tokens ni contenido sensible; la base impide modificar o borrar sus filas.
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_version integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_action_range CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
  CONSTRAINT audit_log_detail_range CHECK (jsonb_typeof(detail) = 'object'),
  CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users (id)
);
CREATE INDEX audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX audit_log_time ON audit_log (occurred_at);
COMMENT ON TABLE audit_log IS 'Bitácora de solo anexado: quién hizo qué, cuándo y sobre qué versión. No contiene tokens ni contenido sensible; la base impide modificar o borrar sus filas.';
COMMENT ON COLUMN audit_log.id IS 'Número correlativo del evento.';
COMMENT ON COLUMN audit_log.occurred_at IS 'Fecha y hora del evento.';
COMMENT ON COLUMN audit_log.actor_id IS 'Quien ejecutó la acción (vacío en acciones del sistema).';
COMMENT ON COLUMN audit_log.actor_role IS 'Rol del actor al ejecutar la acción.';
COMMENT ON COLUMN audit_log.action IS 'Acción en formato «entidad.verbo», por ejemplo template.approved.';
COMMENT ON COLUMN audit_log.entity_type IS 'Tipo de entidad afectada.';
COMMENT ON COLUMN audit_log.entity_id IS 'Identificador de la entidad afectada.';
COMMENT ON COLUMN audit_log.entity_version IS 'Versión de la entidad, cuando aplica.';
COMMENT ON COLUMN audit_log.detail IS 'Metadatos no sensibles del evento.';

-- usage_events: Eventos para calcular los KPI del piloto. Se asocian a un seudónimo (HMAC del identificador) y no tienen clave foránea hacia la cuenta, de modo que el vínculo queda separado.
CREATE TABLE usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  pseudonym text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usage_events_pkey PRIMARY KEY (id),
  CONSTRAINT usage_events_pseudonym_range CHECK (pseudonym ~ '^[0-9a-f]{64}$'),
  CONSTRAINT usage_events_event_type_check CHECK (event_type IN ('registro_iniciado', 'registro_completado', 'sesion_iniciada', 'rutina_iniciada', 'plan_consultado', 'sesion_registrada', 'peso_registrado', 'pauta_consultada'))
);
CREATE INDEX usage_events_pseudonym ON usage_events (pseudonym, occurred_at);
CREATE INDEX usage_events_type ON usage_events (event_type, occurred_at);
COMMENT ON TABLE usage_events IS 'Eventos para calcular los KPI del piloto. Se asocian a un seudónimo (HMAC del identificador) y no tienen clave foránea hacia la cuenta, de modo que el vínculo queda separado.';
COMMENT ON COLUMN usage_events.id IS 'Número correlativo del evento.';
COMMENT ON COLUMN usage_events.pseudonym IS 'HMAC-SHA256 en hexadecimal del identificador de la cuenta, con secreto del piloto.';
COMMENT ON COLUMN usage_events.event_type IS 'Tipo de evento.';
COMMENT ON COLUMN usage_events.occurred_at IS 'Fecha y hora del evento.';

-- Impide modificar o borrar filas de la bitácora.
CREATE FUNCTION fitgoal_forbid_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo anexado', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION fitgoal_forbid_change();

-- Una rutina recomendada solo puede copiarse de una plantilla aprobada, y una rutina ya iniciada conserva su contenido (solo cambian el estado y la fecha de reemplazo).
CREATE FUNCTION fitgoal_plan_requires_approved_template() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.template_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM routine_templates WHERE id = NEW.template_id AND status = 'approved') THEN
    RAISE EXCEPTION 'Solo se pueden iniciar plantillas aprobadas' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER user_plans_approved_template BEFORE INSERT ON user_plans
  FOR EACH ROW EXECUTE FUNCTION fitgoal_plan_requires_approved_template();
CREATE FUNCTION fitgoal_freeze_user_plan() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.profile_version_id <> OLD.profile_version_id OR NEW.source <> OLD.source
     OR NEW.template_id IS DISTINCT FROM OLD.template_id OR NEW.rule_version_id IS DISTINCT FROM OLD.rule_version_id
     OR NEW.name <> OLD.name OR NEW.version <> OLD.version OR NEW.weeks <> OLD.weeks OR NEW.session_minutes <> OLD.session_minutes
     OR NEW.days <> OLD.days OR NEW.session_labels <> OLD.session_labels OR NEW.started_at <> OLD.started_at THEN
    RAISE EXCEPTION 'Una rutina iniciada no se modifica; inicia otra y la anterior queda reemplazada' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER user_plans_frozen BEFORE UPDATE ON user_plans
  FOR EACH ROW EXECUTE FUNCTION fitgoal_freeze_user_plan();

-- Solo se pueden agregar ejercicios aprobados a una rutina, y la composición de una rutina iniciada no se modifica.
CREATE FUNCTION fitgoal_plan_requires_approved_exercise() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM exercises WHERE id = NEW.exercise_id AND status = 'approved') THEN
    RAISE EXCEPTION 'Solo se pueden usar ejercicios aprobados' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER user_plan_exercises_approved BEFORE INSERT ON user_plan_exercises
  FOR EACH ROW EXECUTE FUNCTION fitgoal_plan_requires_approved_exercise();
CREATE TRIGGER user_plan_exercises_frozen BEFORE UPDATE ON user_plan_exercises
  FOR EACH ROW EXECUTE FUNCTION fitgoal_forbid_change();

-- Impide cambiar los ejercicios de una plantilla que ya no es borrador (se crea una versión nueva) y exige que cada ejercicio vaya en una sesión con nombre.
CREATE FUNCTION fitgoal_freeze_template_exercises() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE tid uuid; st text; n integer;
BEGIN
  tid := CASE WHEN TG_OP = 'DELETE' THEN OLD.template_id ELSE NEW.template_id END;
  SELECT status, cardinality(session_labels) INTO st, n FROM routine_templates WHERE id = tid;
  IF st IS NOT NULL AND st <> 'draft' THEN
    RAISE EXCEPTION 'La plantilla ya no es borrador; crea una versión nueva' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.session_no > n THEN
    RAISE EXCEPTION 'La sesión % no tiene nombre en la plantilla', NEW.session_no USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER template_exercises_frozen BEFORE INSERT OR UPDATE OR DELETE ON template_exercises
  FOR EACH ROW EXECUTE FUNCTION fitgoal_freeze_template_exercises();
CREATE FUNCTION fitgoal_no_delete_template() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Solo se pueden eliminar plantillas en borrador; retira la plantilla' USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER routine_templates_no_delete BEFORE DELETE ON routine_templates
  FOR EACH ROW WHEN (OLD.status <> 'draft') EXECUTE FUNCTION fitgoal_no_delete_template();

-- Impide cambiar los alimentos de una pauta que ya no es borrador (se crea una versión nueva), exige alimentos aprobados al aprobarla e impide borrar una pauta aprobada.
CREATE FUNCTION fitgoal_freeze_meal_plan_items() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE tid uuid; st text;
BEGIN
  tid := CASE WHEN TG_OP = 'DELETE' THEN OLD.template_id ELSE NEW.template_id END;
  SELECT status INTO st FROM meal_plan_templates WHERE id = tid;
  IF st IS NOT NULL AND st <> 'draft' THEN
    RAISE EXCEPTION 'La pauta ya no es borrador; crea una versión nueva' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER meal_plan_items_frozen BEFORE INSERT OR UPDATE OR DELETE ON meal_plan_items
  FOR EACH ROW EXECUTE FUNCTION fitgoal_freeze_meal_plan_items();
CREATE FUNCTION fitgoal_meal_plan_requires_approved_foods() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM meal_plan_items i JOIN foods f ON f.id = i.food_id WHERE i.template_id = NEW.id AND f.status <> 'approved') THEN
    RAISE EXCEPTION 'Solo se aprueban pautas cuyos alimentos están aprobados' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER meal_plan_templates_approved_foods BEFORE UPDATE OF status ON meal_plan_templates
  FOR EACH ROW WHEN (NEW.status = 'approved' AND OLD.status <> 'approved') EXECUTE FUNCTION fitgoal_meal_plan_requires_approved_foods();
CREATE TRIGGER meal_plan_templates_no_delete BEFORE DELETE ON meal_plan_templates
  FOR EACH ROW WHEN (OLD.status <> 'draft') EXECUTE FUNCTION fitgoal_no_delete_template();

-- Un alimento solo se cambia en una pauta aprobada y por otro distinto, aprobado, del mismo grupo y que la nutricionista incluyó en esa misma pauta.
CREATE FUNCTION fitgoal_meal_swap_valid() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE original uuid; grp text; st text;
BEGIN
  SELECT i.food_id, f.category, t.status INTO original, grp, st
    FROM meal_plan_items i JOIN foods f ON f.id = i.food_id JOIN meal_plan_templates t ON t.id = i.template_id
   WHERE i.template_id = NEW.template_id AND i.day_no = NEW.day_no AND i.meal = NEW.meal AND i.position = NEW.position;
  IF original IS NULL THEN
    RAISE EXCEPTION 'Ese alimento no está en la pauta' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF st <> 'approved' THEN
    RAISE EXCEPTION 'Solo se cambian alimentos de una pauta aprobada' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.food_id = original THEN
    RAISE EXCEPTION 'El reemplazo es el mismo alimento de la pauta' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM foods WHERE id = NEW.food_id AND status = 'approved' AND category = grp)
     OR NOT EXISTS (SELECT 1 FROM meal_plan_items WHERE template_id = NEW.template_id AND food_id = NEW.food_id) THEN
    RAISE EXCEPTION 'Solo se cambia por un alimento aprobado del mismo grupo que esté en la pauta' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER meal_plan_swaps_valid BEFORE INSERT OR UPDATE ON meal_plan_swaps
  FOR EACH ROW EXECUTE FUNCTION fitgoal_meal_swap_valid();

COMMIT;
