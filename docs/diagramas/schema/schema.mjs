// Fuente única del modelo de datos de FitGoal (PostgreSQL 18).
// De este archivo se generan: el SQL de migración, los diagramas ER y el diccionario de datos.
// Convención: identificadores en inglés (snake_case) como en el código; descripciones en español.

const c = (name, type, o = {}) => ({ name, type, nn: true, ...o });
const ts = (name, desc, o = {}) => c(name, 'timestamptz', { desc, ...o });
const created = () => ts('created_at', 'Fecha y hora de creación del registro.', { def: 'now()' });
const uuidPk = desc => c('id', 'uuid', { pk: true, def: 'gen_random_uuid()', desc });
const FK = (t, col = 'id', onDelete) => ({ t, c: col, onDelete });

export const MODULES = [
  { id: 'identidad', name: 'Identidad, consentimiento y derechos', color: 'blue' },
  { id: 'catalogo', name: 'Catálogo profesional y reglas', color: 'green' },
  { id: 'planes', name: 'Perfil y rutinas del participante', color: 'amber' },
  { id: 'seguimiento', name: 'Seguimiento, avisos y trazabilidad', color: 'violet' },
];

const APPROVAL = role => [
  { name: 'approved_pair', sql: '(approved_by IS NULL) = (approved_by_role IS NULL)', desc: 'El aprobador y su rol se registran juntos.' },
  { name: 'approved_role', sql: `approved_by_role IS NULL OR approved_by_role = '${role}'`, desc: `Solo el rol ${role} puede aprobar este contenido.` },
  { name: 'approved_complete', sql: "status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)", desc: 'Un contenido aprobado exige aprobador y fecha de aprobación.' },
];

export const TABLES = [
  // ───────────────────────── Identidad, consentimiento y derechos ─────────────────────────
  {
    name: 'users', module: 'identidad', es: 'Usuario', informe: 'usuario',
    desc: 'Cuenta de acceso. Un mismo modelo cubre participantes, preparadores, nutricionistas y administradores (control de acceso por rol).',
    columns: [
      uuidPk('Identificador interno de la cuenta.'),
      c('email', 'text', { check: "position('@' in email) > 1 AND length(email) <= 254", desc: 'Correo de acceso. Único sin distinguir mayúsculas.' }),
      c('password_hash', 'text', { check: "password_hash LIKE '$argon2id$%'", desc: 'Hash Argon2id con sal individual (formato PHC). Nunca se guarda la contraseña.' }),
      c('role', 'text', { values: ['user', 'trainer', 'nutritionist', 'admin'], desc: 'Rol: participante, preparador físico, nutricionista o administrador.' }),
      c('status', 'text', { def: "'active'", values: ['active', 'blocked', 'deleted'], desc: 'Estado de la cuenta; «blocked» suspende el tratamiento (bloqueo temporal).' }),
      c('is_fictitious', 'boolean', { def: 'false', desc: 'Verdadero en cuentas de demostración o prueba.' }),
      c('session_version', 'integer', { def: '1', check: 'session_version >= 1', desc: 'Se incrementa al cambiar contraseña o rol; invalida los JWT emitidos antes.' }),
      ts('enrolled_at', 'Fecha de inscripción confirmada en el piloto (denominador de los KPI).', { nn: false }),
      created(),
      ts('updated_at', 'Fecha y hora de la última modificación.', { def: 'now()' }),
      ts('deleted_at', 'Fecha en que se aplicó la eliminación de datos personales.', { nn: false }),
    ],
    unique: [{ cols: ['id', 'role'], name: 'users_id_role_key', desc: 'Permite que otras tablas verifiquen el rol real del usuario con una clave foránea compuesta.' }],
    checks: [{ name: 'deleted_pair', sql: "(status = 'deleted') = (deleted_at IS NOT NULL)", desc: 'La fecha de eliminación existe solo en cuentas eliminadas.' }],
    indexes: [{ name: 'users_email_lower_key', sql: 'CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email))', desc: 'Correo único sin distinguir mayúsculas.' }],
  },
  {
    name: 'auth_sessions', module: 'identidad', es: 'Sesión de autenticación', informe: 'sesión de acceso (refresh token)',
    desc: 'Sesión activa de un dispositivo. Guarda solo el hash del refresh token, que rota en cada renovación y vence a los 7 días como máximo.',
    columns: [
      uuidPk('Identificador de la sesión; viaja dentro del JWT como «sid».'),
      c('user_id', 'uuid', { fk: FK('users', 'id', 'CASCADE'), desc: 'Cuenta a la que pertenece la sesión.' }),
      c('refresh_token_hash', 'text', { uq: true, desc: 'Hash SHA-256 del refresh token aleatorio; el token nunca se almacena.' }),
      c('session_version', 'integer', { check: 'session_version >= 1', desc: 'Versión de sesión de la cuenta al emitir la sesión; se compara en cada petición.' }),
      created(),
      ts('expires_at', 'Vencimiento absoluto de la sesión (máximo 7 días).'),
      ts('last_used_at', 'Último uso para renovar el acceso.', { nn: false }),
      ts('revoked_at', 'Fecha de revocación (cierre de sesión, cambio de contraseña o de rol).', { nn: false }),
      c('replaced_by', 'uuid', { nn: false, fk: FK('auth_sessions', 'id', 'SET NULL'), desc: 'Sesión que reemplazó a esta al rotar el refresh token.' }),
    ],
    checks: [{ name: 'expires_window', sql: "expires_at > created_at AND expires_at <= created_at + interval '7 days'", desc: 'La sesión vence en un máximo de 7 días.' }],
    indexes: [{ name: 'auth_sessions_user_active', sql: 'CREATE INDEX auth_sessions_user_active ON auth_sessions (user_id) WHERE revoked_at IS NULL', desc: 'Búsqueda de sesiones activas de una cuenta.' }],
  },
  {
    name: 'consents', module: 'identidad', es: 'Consentimiento', informe: 'consentimiento',
    desc: 'Registro anexado de cada otorgamiento o revocación de consentimiento, con la versión de la política aplicada. El estado vigente es el último registro por finalidad.',
    columns: [
      uuidPk('Identificador del registro.'),
      c('user_id', 'uuid', { fk: FK('users'), desc: 'Titular de los datos.' }),
      c('purpose', 'text', { values: ['registro_cuenta', 'perfil_entrenamiento', 'datos_corporales', 'datos_nutricionales', 'seguimiento_progreso', 'recordatorios', 'evaluacion_piloto'], desc: 'Finalidad del tratamiento a la que se refiere. «datos_corporales» autoriza usar la estatura y el peso (datos de salud) para calcular el IMC y recomendar rutinas; «datos_nutricionales» autoriza usar el sexo y el nivel de actividad para estimar las calorías y ajustar la pauta de alimentación.' }),
      c('policy_version', 'text', { check: "length(policy_version) BETWEEN 1 AND 40", desc: 'Versión de la política de datos mostrada al titular.' }),
      c('granted', 'boolean', { desc: 'Verdadero si otorga el consentimiento; falso si lo revoca.' }),
      ts('recorded_at', 'Fecha y hora del otorgamiento o la revocación.', { def: 'now()' }),
    ],
    indexes: [{ name: 'consents_user_purpose', sql: 'CREATE INDEX consents_user_purpose ON consents (user_id, purpose, recorded_at DESC)', desc: 'Consulta del estado vigente por finalidad.' }],
  },
  {
    name: 'data_requests', module: 'identidad', es: 'Solicitud de derechos', informe: 'solicitud de acceso, rectificación, oposición, bloqueo, exportación o eliminación',
    desc: 'Solicitud del titular para ejercer sus derechos sobre los datos personales, con comprobante y plazo de respuesta.',
    columns: [
      uuidPk('Identificador de la solicitud.'),
      c('user_id', 'uuid', { fk: FK('users'), desc: 'Titular que presenta la solicitud.' }),
      c('request_type', 'text', { values: ['acceso', 'rectificacion', 'oposicion', 'bloqueo', 'exportacion', 'eliminacion'], desc: 'Derecho que se ejerce.' }),
      c('status', 'text', { def: "'recibida'", values: ['recibida', 'en_curso', 'resuelta', 'rechazada'], desc: 'Estado de la tramitación.' }),
      c('receipt_code', 'text', { uq: true, desc: 'Código del comprobante entregado al titular.' }),
      ts('received_at', 'Fecha y hora de recepción.', { def: 'now()' }),
      ts('due_at', 'Plazo límite de respuesta: 30 días corridos, o 2 días hábiles para el bloqueo.'),
      c('extension_applied', 'boolean', { def: 'false', desc: 'Indica si se aplicó la única prórroga permitida (hasta 30 días).' }),
      ts('resolved_at', 'Fecha y hora de la resolución.', { nn: false }),
      c('resolved_by', 'uuid', { nn: false, fk: FK('users'), desc: 'Responsable de operación que resolvió.' }),
      c('resolution_note', 'text', { nn: false, check: 'length(resolution_note) <= 500', desc: 'Fundamento o resumen de la respuesta.' }),
    ],
    checks: [
      { name: 'due_after_received', sql: 'due_at >= received_at', desc: 'El plazo no puede ser anterior a la recepción.' },
      { name: 'resolved_complete', sql: "status IN ('recibida', 'en_curso') OR resolved_at IS NOT NULL", desc: 'Una solicitud cerrada exige fecha de resolución.' },
    ],
    indexes: [{ name: 'data_requests_open', sql: "CREATE INDEX data_requests_open ON data_requests (due_at) WHERE status IN ('recibida', 'en_curso')", desc: 'Seguimiento de solicitudes abiertas por plazo.' }],
  },

  // ───────────────────────── Catálogo profesional y reglas ─────────────────────────
  {
    name: 'exercises', module: 'catalogo', es: 'Ejercicio', informe: 'ejercicio del catálogo',
    desc: 'Biblioteca de ejercicios redactada y aprobada por el preparador físico. El sistema no inventa ejercicios: solo recomienda y combina los aprobados, y la persona puede elegir cualquiera para armar su rutina.',
    columns: [
      uuidPk('Identificador del ejercicio.'),
      c('code', 'text', { uq: true, check: "code ~ '^[a-z0-9-]+$'", desc: 'Código corto estable (slug).' }),
      c('name', 'text', { check: 'length(name) BETWEEN 1 AND 80', desc: 'Nombre del ejercicio.' }),
      c('description', 'text', { check: 'length(description) BETWEEN 1 AND 600', desc: 'Descripción de la ejecución, redactada por el profesional.' }),
      c('muscle_group', 'text', { values: ['piernas', 'empuje', 'traccion', 'core', 'cardio', 'movilidad'], desc: 'Grupo de trabajo: piernas, empuje (pecho, hombros y tríceps), tracción (espalda y bíceps), zona media, cardio o movilidad. Las reglas aprobadas lo usan para sugerir ejercicios según el objetivo, y las rutinas divididas, para armar cada sesión.' }),
      c('min_level', 'text', { def: "'principiante'", values: ['principiante', 'con_experiencia'], desc: 'Nivel mínimo con el que se recomienda el ejercicio.' }),
      c('requires_equipment', 'boolean', { def: 'false', desc: 'Indica si necesita material (mancuernas u otro).' }),
      c('high_impact', 'boolean', { def: 'false', desc: 'Indica si es de alto impacto articular (saltos, trote): no se sugiere a personas con sobrepeso u obesidad.' }),
      c('default_prescription', 'text', { check: 'length(default_prescription) BETWEEN 1 AND 200', desc: 'Indicación sugerida por el profesional (series, repeticiones o tiempo) cuando la persona no define la suya.' }),
      c('source_note', 'text', { nn: false, desc: 'Atribución o fuente del contenido profesional.' }),
      c('status', 'text', { def: "'draft'", values: ['draft', 'approved', 'retired'], desc: 'Borrador, aprobado (visible para las personas) o retirado.' }),
      c('created_by', 'uuid', { fk: FK('users'), desc: 'Profesional que registró el ejercicio.' }),
      c('approved_by', 'uuid', { nn: false, desc: 'Preparador que aprobó.' }),
      c('approved_by_role', 'text', { nn: false, values: ['trainer'], desc: 'Rol del aprobador; siempre trainer.' }),
      ts('approved_at', 'Fecha de aprobación.', { nn: false }),
      created(),
    ],
    fks: [{ cols: ['approved_by', 'approved_by_role'], ref: 'users', refCols: ['id', 'role'], desc: 'El rol del aprobador coincide con su rol real.' }],
    checks: APPROVAL('trainer'),
    indexes: [{ name: 'exercises_library', sql: "CREATE INDEX exercises_library ON exercises (muscle_group, min_level) WHERE status = 'approved'", desc: 'Biblioteca de ejercicios aprobados por grupo y nivel.' }],
  },
  {
    name: 'rule_versions', module: 'catalogo', es: 'Versión de reglas', informe: 'versión de reglas',
    desc: 'Conjunto versionado de reglas aprobadas: en entrenamiento, las rutinas para cada combinación de objetivo, nivel, equipo y categoría de IMC (una por división de la semana), la regla que elige la división según el nivel y los días disponibles, las reglas de seguridad y los grupos de ejercicios que se sugieren por objetivo; en nutrición, factores y ajustes. Solo un profesional competente puede aprobarlo.',
    columns: [
      uuidPk('Identificador de la versión de reglas.'),
      c('domain', 'text', { values: ['entrenamiento', 'nutricion'], desc: 'Ámbito de las reglas.' }),
      c('version', 'integer', { check: 'version > 0', desc: 'Número correlativo dentro del ámbito.' }),
      c('status', 'text', { def: "'draft'", values: ['draft', 'approved', 'retired'], desc: 'Borrador, aprobada (vigente) o retirada.' }),
      c('content', 'jsonb', { check: "jsonb_typeof(content) = 'object'", desc: 'Reglas en formato estructurado (matriz de recomendación, reglas de división, reglas de seguridad, grupos sugeridos por objetivo, factores y ajustes).' }),
      c('change_note', 'text', { nn: false, desc: 'Motivo del cambio respecto de la versión anterior.' }),
      c('author_id', 'uuid', { fk: FK('users'), desc: 'Autor de la versión.' }),
      c('approved_by', 'uuid', { nn: false, desc: 'Profesional que aprobó.' }),
      c('approved_by_role', 'text', { nn: false, values: ['trainer', 'nutritionist'], desc: 'Rol del aprobador al aprobar.' }),
      ts('approved_at', 'Fecha de aprobación.', { nn: false }),
      created(),
    ],
    unique: [{ cols: ['domain', 'version'], name: 'rule_versions_domain_version_key', desc: 'Una sola versión con cada número por ámbito.' }],
    fks: [{ cols: ['approved_by', 'approved_by_role'], ref: 'users', refCols: ['id', 'role'], desc: 'El rol del aprobador coincide con su rol real.' }],
    checks: [
      { name: 'approved_pair', sql: '(approved_by IS NULL) = (approved_by_role IS NULL)', desc: 'El aprobador y su rol se registran juntos.' },
      { name: 'approved_role_by_domain', sql: "approved_by_role IS NULL OR (domain = 'entrenamiento' AND approved_by_role = 'trainer') OR (domain = 'nutricion' AND approved_by_role = 'nutritionist')", desc: 'Las reglas de entrenamiento las aprueba el preparador y las de nutrición, la nutricionista.' },
      { name: 'approved_complete', sql: "status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)", desc: 'Una versión aprobada exige aprobador y fecha.' },
    ],
    indexes: [{ name: 'rule_versions_current', sql: "CREATE UNIQUE INDEX rule_versions_current ON rule_versions (domain) WHERE status = 'approved'", desc: 'Una sola versión vigente por ámbito.' }],
  },
  {
    name: 'routine_templates', module: 'catalogo', es: 'Plantilla de rutina', informe: 'plantilla',
    desc: 'Rutina prearmada, definida y aprobada una sola vez por el preparador físico, que las personas pueden iniciar al instante. Se dirige a un objetivo, nivel, equipamiento y categoría de IMC, y organiza la semana con una división (full body, upper/lower o push/pull/legs); los ejercicios van en template_exercises.',
    columns: [
      uuidPk('Identificador de la plantilla.'),
      c('code', 'text', { check: "code ~ '^[a-z0-9-]+$'", desc: 'Código estable de la plantilla (igual para todas sus versiones).' }),
      c('version', 'integer', { check: 'version > 0', desc: 'Versión de la plantilla.' }),
      c('name', 'text', { check: 'length(name) BETWEEN 1 AND 80', desc: 'Nombre visible de la rutina.' }),
      c('summary', 'text', { check: 'length(summary) BETWEEN 1 AND 200', desc: 'Descripción breve de para quién es la rutina y qué incluye.' }),
      c('objective', 'text', { values: ['bajar', 'mantener', 'subir'], desc: 'Objetivo físico al que se dirige.' }),
      c('level', 'text', { values: ['principiante', 'con_experiencia'], desc: 'Nivel de experiencia al que se dirige.' }),
      c('equipment', 'text', { values: ['sin_equipo', 'con_equipo'], desc: 'Equipamiento requerido.' }),
      c('bmi_category', 'text', { values: ['general', 'bajo_peso', 'normal', 'sobrepeso', 'obesidad'], desc: 'Categoría de IMC a la que se dirige. «general» es una rutina conservadora, de bajo impacto, para quien no informa su estatura y peso.' }),
      c('split', 'text', { values: ['full_body', 'upper_lower', 'push_pull_legs'], desc: 'División de la semana: full body (cuerpo completo en cada sesión), upper/lower (tren superior e inferior por separado) o push/pull/legs (empuje, tracción y piernas por separado).' }),
      c('session_labels', 'text[]', { check: 'fitgoal_labels_valid(session_labels)', desc: 'Nombre de cada sesión, en orden (por ejemplo, «Tren superior A»); la sesión k de template_exercises usa el nombre k.' }),
      c('min_days', 'smallint', { check: 'min_days BETWEEN 1 AND 7', desc: 'Mínimo de días por semana que exige la plantilla.' }),
      c('max_days', 'smallint', { check: 'max_days BETWEEN 1 AND 7', desc: 'Máximo de días por semana que contempla.' }),
      c('session_minutes', 'integer', { values: [20, 30, 45, 60], desc: 'Duración de cada sesión en minutos.' }),
      c('weeks', 'smallint', { def: '4', check: 'weeks BETWEEN 1 AND 12', desc: 'Semanas que cubre el plan al publicarse.' }),
      c('allowed_adjustments', 'jsonb', { def: "'{}'::jsonb", check: "jsonb_typeof(allowed_adjustments) = 'object'", desc: 'Ajustes que el sistema puede aplicar (por ejemplo, sustituciones permitidas).' }),
      c('status', 'text', { def: "'draft'", values: ['draft', 'approved', 'retired'], desc: 'Borrador, aprobada (vigente) o retirada.' }),
      c('author_id', 'uuid', { fk: FK('users'), desc: 'Preparador que redactó la plantilla.' }),
      c('approved_by', 'uuid', { nn: false, desc: 'Preparador que aprobó.' }),
      c('approved_by_role', 'text', { nn: false, values: ['trainer'], desc: 'Rol del aprobador; siempre trainer.' }),
      ts('approved_at', 'Fecha de aprobación.', { nn: false }),
      created(),
    ],
    unique: [{ cols: ['code', 'version'], name: 'routine_templates_code_version_key', desc: 'Una sola plantilla por código y versión.' }],
    fks: [{ cols: ['approved_by', 'approved_by_role'], ref: 'users', refCols: ['id', 'role'], desc: 'El rol del aprobador coincide con su rol real.' }],
    checks: [
      { name: 'days_order', sql: 'min_days <= max_days', desc: 'El mínimo de días no supera al máximo.' },
      ...APPROVAL('trainer'),
    ],
    indexes: [
      { name: 'routine_templates_current', sql: "CREATE UNIQUE INDEX routine_templates_current ON routine_templates (code) WHERE status = 'approved'", desc: 'Una sola versión vigente por código.' },
      { name: 'routine_templates_selection', sql: "CREATE INDEX routine_templates_selection ON routine_templates (objective, level, equipment, bmi_category, split) WHERE status = 'approved'", desc: 'Búsqueda de rutinas por objetivo, nivel, equipo, categoría de IMC y división.' },
    ],
  },
  {
    name: 'template_exercises', module: 'catalogo', es: 'Ejercicio de plantilla', informe: 'ejercicios de la plantilla',
    desc: 'Composición de una plantilla: qué ejercicios van en cada sesión y con qué indicación. La indicación la escribe el profesional; el sistema no la calcula.',
    columns: [
      c('template_id', 'uuid', { pk: true, fk: FK('routine_templates', 'id', 'CASCADE'), desc: 'Plantilla a la que pertenece.' }),
      c('session_no', 'smallint', { pk: true, check: 'session_no BETWEEN 1 AND 7', desc: 'Número de sesión de la plantilla; debe tener nombre en session_labels.' }),
      c('position', 'smallint', { pk: true, check: 'position BETWEEN 1 AND 20', desc: 'Orden del ejercicio dentro de la sesión.' }),
      c('exercise_id', 'uuid', { fk: FK('exercises'), desc: 'Ejercicio del catálogo.' }),
      c('prescription', 'text', { check: 'length(prescription) BETWEEN 1 AND 200', desc: 'Indicación del preparador (series, repeticiones o tiempo) en texto libre.' }),
    ],
  },
  {
    name: 'foods', module: 'catalogo', es: 'Alimento', informe: 'catálogo de alimentos',
    desc: 'Alimentos del mercado chileno con su composición por 100 g, redactados y aprobados por la nutricionista. Las pautas de alimentación solo usan alimentos aprobados.',
    columns: [
      uuidPk('Identificador del alimento.'),
      c('code', 'text', { uq: true, check: "code ~ '^[a-z0-9-]+$'", desc: 'Código corto estable.' }),
      c('name', 'text', { check: 'length(name) BETWEEN 1 AND 80', desc: 'Nombre del alimento, con su preparación cuando importa (por ejemplo, «Arroz blanco cocido»).' }),
      c('category', 'text', { values: ['proteinas', 'lacteos', 'cereales', 'legumbres', 'frutas', 'verduras', 'grasas'], desc: 'Grupo de alimentos. Las verduras no se escalan al ajustar las calorías: se mantienen como base libre de la pauta.' }),
      c('kcal_100g', 'numeric(6,1)', { check: 'kcal_100g BETWEEN 0 AND 900', desc: 'Energía por 100 g, en kcal.' }),
      c('protein_100g', 'numeric(5,1)', { check: 'protein_100g >= 0', desc: 'Proteínas por 100 g, en gramos.' }),
      c('carbs_100g', 'numeric(5,1)', { check: 'carbs_100g >= 0', desc: 'Carbohidratos por 100 g, en gramos.' }),
      c('fat_100g', 'numeric(5,1)', { check: 'fat_100g >= 0', desc: 'Grasas por 100 g, en gramos.' }),
      c('unit_name', 'text', { nn: false, check: 'length(unit_name) BETWEEN 1 AND 30', desc: 'Medida casera opcional (por ejemplo, «unidad», «rebanada» o «taza»).' }),
      c('unit_grams', 'numeric(6,1)', { nn: false, check: 'unit_grams > 0', desc: 'Gramos que pesa la medida casera.' }),
      c('source_note', 'text', { nn: false, desc: 'Fuente de la composición (tabla de composición o etiqueta).' }),
      c('status', 'text', { def: "'draft'", values: ['draft', 'approved', 'retired'], desc: 'Borrador, aprobado o retirado.' }),
      c('author_id', 'uuid', { fk: FK('users'), desc: 'Profesional que cargó el alimento.' }),
      c('approved_by', 'uuid', { nn: false, desc: 'Nutricionista que aprobó.' }),
      c('approved_by_role', 'text', { nn: false, values: ['nutritionist'], desc: 'Rol del aprobador; siempre nutritionist.' }),
      ts('approved_at', 'Fecha de aprobación.', { nn: false }),
      created(),
    ],
    fks: [{ cols: ['approved_by', 'approved_by_role'], ref: 'users', refCols: ['id', 'role'], desc: 'El rol del aprobador coincide con su rol real.' }],
    checks: [
      ...APPROVAL('nutritionist'),
      { name: 'macros_per_100g', sql: 'protein_100g + carbs_100g + fat_100g <= 100', desc: 'Proteínas, carbohidratos y grasas no suman más de 100 g por cada 100 g.' },
      { name: 'unit_pair', sql: '(unit_name IS NULL) = (unit_grams IS NULL)', desc: 'La medida casera y su peso se informan juntos.' },
    ],
  },
  {
    name: 'meal_plan_templates', module: 'catalogo', es: 'Pauta de alimentación', informe: 'pauta de alimentación',
    desc: 'Pauta de alimentación de 7 días, redactada y aprobada una sola vez por la nutricionista para un tipo de dieta, con gramos para una energía de referencia. Al mostrarla, la app ajusta los gramos a las calorías de la persona con las reglas nutricionales aprobadas.',
    columns: [
      uuidPk('Identificador de la pauta.'),
      c('code', 'text', { check: "code ~ '^[a-z0-9-]+$'", desc: 'Código estable de la pauta (igual para todas sus versiones).' }),
      c('version', 'integer', { check: 'version > 0', desc: 'Versión de la pauta.' }),
      c('name', 'text', { check: 'length(name) BETWEEN 1 AND 80', desc: 'Nombre visible de la pauta.' }),
      c('summary', 'text', { check: 'length(summary) BETWEEN 1 AND 300', desc: 'Descripción breve de la dieta y su fundamento.' }),
      c('diet', 'text', { values: ['mediterranea', 'alta_proteina', 'baja_carbohidratos', 'vegetariana'], desc: 'Tipo de dieta: mediterránea, alta en proteína, baja en carbohidratos (moderada) u ovolactovegetariana.' }),
      c('reference_kcal', 'integer', { check: 'reference_kcal BETWEEN 1200 AND 4000', desc: 'Energía diaria (kcal) para la que están escritos los gramos.' }),
      c('status', 'text', { def: "'draft'", values: ['draft', 'approved', 'retired'], desc: 'Borrador, aprobada (vigente) o retirada.' }),
      c('author_id', 'uuid', { fk: FK('users'), desc: 'Nutricionista que redactó la pauta.' }),
      c('approved_by', 'uuid', { nn: false, desc: 'Nutricionista que aprobó.' }),
      c('approved_by_role', 'text', { nn: false, values: ['nutritionist'], desc: 'Rol del aprobador; siempre nutritionist.' }),
      ts('approved_at', 'Fecha de aprobación.', { nn: false }),
      created(),
    ],
    unique: [{ cols: ['code', 'version'], name: 'meal_plan_templates_code_version_key', desc: 'Una sola pauta por código y versión.' }],
    fks: [{ cols: ['approved_by', 'approved_by_role'], ref: 'users', refCols: ['id', 'role'], desc: 'El rol del aprobador coincide con su rol real.' }],
    checks: APPROVAL('nutritionist'),
    indexes: [
      { name: 'meal_plan_templates_current', sql: "CREATE UNIQUE INDEX meal_plan_templates_current ON meal_plan_templates (code) WHERE status = 'approved'", desc: 'Una sola versión vigente por código.' },
      { name: 'meal_plan_templates_diet', sql: "CREATE INDEX meal_plan_templates_diet ON meal_plan_templates (diet) WHERE status = 'approved'", desc: 'Búsqueda de pautas vigentes por tipo de dieta.' },
    ],
  },
  {
    name: 'meal_plan_items', module: 'catalogo', es: 'Alimento de la pauta', informe: 'alimentos de la pauta',
    desc: 'Composición de una pauta: qué alimento y cuántos gramos van en cada comida de cada día, para la energía de referencia.',
    columns: [
      c('template_id', 'uuid', { pk: true, fk: FK('meal_plan_templates', 'id', 'CASCADE'), desc: 'Pauta a la que pertenece.' }),
      c('day_no', 'smallint', { pk: true, check: 'day_no BETWEEN 1 AND 7', desc: 'Día de la pauta (1 = lunes … 7 = domingo).' }),
      c('meal', 'text', { pk: true, values: ['desayuno', 'colacion', 'almuerzo', 'once', 'cena'], desc: 'Comida del día.' }),
      c('position', 'smallint', { pk: true, check: 'position BETWEEN 1 AND 12', desc: 'Orden del alimento dentro de la comida.' }),
      c('food_id', 'uuid', { fk: FK('foods'), desc: 'Alimento del catálogo.' }),
      c('grams', 'numeric(6,1)', { check: 'grams > 0 AND grams <= 1000', desc: 'Gramos del alimento para la energía de referencia.' }),
    ],
  },

  // ───────────────────────── Perfil y rutinas del participante ─────────────────────────
  {
    name: 'profile_versions', module: 'planes', es: 'Perfil (versionado)', informe: 'perfil y objetivo',
    desc: 'Cada cambio del perfil crea una versión nueva. Incluye el objetivo físico, la disponibilidad y, con consentimiento específico, la estatura y el peso con que se calcula el IMC y, con otro consentimiento específico, el sexo y el nivel de actividad con que se estiman las calorías de la pauta de alimentación.',
    columns: [
      uuidPk('Identificador de la versión del perfil.'),
      c('user_id', 'uuid', { fk: FK('users'), desc: 'Participante dueño del perfil.' }),
      c('version', 'integer', { check: 'version > 0', desc: 'Número correlativo por participante.' }),
      c('age', 'integer', { check: 'age BETWEEN 18 AND 120', desc: 'Edad en años (solo personas adultas).' }),
      c('objective', 'text', { values: ['bajar', 'mantener', 'subir'], desc: 'Objetivo físico: bajar, mantener o subir de peso.' }),
      c('level', 'text', { values: ['principiante', 'con_experiencia'], desc: 'Nivel de experiencia declarado.' }),
      c('days', 'smallint[]', { check: 'fitgoal_days_valid(days)', desc: 'Días disponibles (1 = lunes … 7 = domingo), sin repetir.' }),
      c('duration_minutes', 'integer', { values: [20, 30, 45, 60], desc: 'Minutos disponibles por sesión.' }),
      c('equipment', 'text', { values: ['sin_equipo', 'con_equipo'], desc: 'Equipamiento disponible.' }),
      c('sex_param', 'text', { nn: false, values: ['masculino', 'femenino'], desc: 'Parámetro de sexo del modelo de Mifflin-St Jeor (opcional, con el consentimiento «datos_nutricionales»; se borra si se revoca).' }),
      c('weight_kg', 'numeric(5,1)', { nn: false, check: 'weight_kg BETWEEN 30 AND 300', desc: 'Peso en kilogramos (opcional, dato de salud). Solo se guarda con el consentimiento «datos_corporales» y se borra si se revoca.' }),
      c('height_cm', 'numeric(4,1)', { nn: false, check: 'height_cm BETWEEN 100 AND 250', desc: 'Estatura en centímetros (opcional, dato de salud). Junto al peso permite calcular el IMC.' }),
      c('activity_level', 'text', { nn: false, values: ['sedentario', 'ligero', 'moderado', 'intenso'], desc: 'Nivel de actividad física habitual, que fija el factor de actividad de las reglas nutricionales (opcional, con el consentimiento «datos_nutricionales»).' }),
      c('is_fictitious', 'boolean', { def: 'false', desc: 'Copia de la condición de cuenta ficticia al guardar el perfil.' }),
      created(),
    ],
    unique: [
      { cols: ['user_id', 'version'], name: 'profile_versions_user_version_key', desc: 'Una sola versión con cada número por participante.' },
      { cols: ['id', 'user_id'], name: 'profile_versions_id_user_key', desc: 'Permite que las rutinas verifiquen que el perfil es del mismo participante.' },
    ],
    checks: [
      { name: 'body_pair', sql: '(weight_kg IS NULL) = (height_cm IS NULL)', desc: 'La estatura y el peso se informan juntos o no se informan.' },
      { name: 'estimate_needs_body', sql: '(sex_param IS NULL) = (activity_level IS NULL) AND (sex_param IS NULL OR weight_kg IS NOT NULL)', desc: 'El sexo y la actividad se informan juntos y exigen estatura y peso: son los cuatro datos del cálculo energético.' },
    ],
  },
  {
    name: 'user_plans', module: 'planes', es: 'Rutina del participante', informe: 'rutina activa',
    desc: 'Rutina que la persona inició: una rutina recomendada (copia de una plantilla aprobada) o una rutina propia armada con ejercicios aprobados. Es una copia que no cambia; la persona tiene una sola rutina vigente y al iniciar otra la anterior queda reemplazada.',
    columns: [
      uuidPk('Identificador de la rutina del participante.'),
      c('user_id', 'uuid', { fk: FK('users'), desc: 'Participante dueño de la rutina.' }),
      c('profile_version_id', 'uuid', { desc: 'Versión del perfil vigente al iniciar la rutina.' }),
      c('source', 'text', { values: ['recomendada', 'propia'], desc: 'Origen: «recomendada» (plantilla aprobada) o «propia» (armada por la persona).' }),
      c('template_id', 'uuid', { nn: false, fk: FK('routine_templates'), desc: 'Plantilla aprobada de la que se copió (solo en rutinas recomendadas).' }),
      c('rule_version_id', 'uuid', { nn: false, fk: FK('rule_versions'), desc: 'Versión de reglas aprobadas que produjo la recomendación o las sugerencias de ejercicios.' }),
      c('name', 'text', { check: 'length(name) BETWEEN 1 AND 80', desc: 'Nombre visible de la rutina.' }),
      c('version', 'integer', { check: 'version > 0', desc: 'Número correlativo de rutinas iniciadas por el participante.' }),
      c('weeks', 'smallint', { check: 'weeks BETWEEN 1 AND 12', desc: 'Semanas que se programan al iniciarla.' }),
      c('session_minutes', 'integer', { values: [20, 30, 45, 60], desc: 'Duración de cada sesión en minutos.' }),
      c('days', 'smallint[]', { check: 'fitgoal_days_valid(days)', desc: 'Días de entrenamiento elegidos, de menor a mayor (1 = lunes … 7 = domingo). La sesión k cae el día k; los días no elegidos son de descanso (no se guardan: el horario y la racha los deducen).' }),
      c('session_labels', 'text[]', { check: 'fitgoal_labels_valid(session_labels)', desc: 'Nombre de la sesión de cada día elegido (en las recomendadas, el de la plantilla, repetido en ciclo; en las propias, el que la persona le da o «Sesión k»).' }),
      c('status', 'text', { def: "'vigente'", values: ['vigente', 'reemplazado'], desc: 'Vigente o reemplazada por una rutina iniciada después.' }),
      ts('started_at', 'Fecha y hora en que la persona inició la rutina.', { def: 'now()' }),
      ts('replaced_at', 'Fecha en que dejó de estar vigente.', { nn: false }),
    ],
    unique: [
      { cols: ['user_id', 'version'], name: 'user_plans_user_version_key', desc: 'Una sola rutina con cada número por participante.' },
      { cols: ['id', 'user_id'], name: 'user_plans_id_user_key', desc: 'Permite que las sesiones verifiquen que la rutina es del mismo participante.' },
    ],
    fks: [{ cols: ['profile_version_id', 'user_id'], ref: 'profile_versions', refCols: ['id', 'user_id'], desc: 'El perfil usado pertenece al mismo participante.' }],
    checks: [
      { name: 'source_template_pair', sql: "(source = 'recomendada') = (template_id IS NOT NULL)", desc: 'Solo las rutinas recomendadas provienen de una plantilla.' },
      { name: 'recommended_has_rules', sql: "source <> 'recomendada' OR rule_version_id IS NOT NULL", desc: 'Una rutina recomendada registra las reglas aprobadas que la produjeron.' },
      { name: 'labels_per_day', sql: 'cardinality(session_labels) = cardinality(days)', desc: 'Cada día elegido tiene el nombre de su sesión.' },
      { name: 'replaced_pair', sql: "(status = 'reemplazado') = (replaced_at IS NOT NULL)", desc: 'La fecha de reemplazo existe solo en rutinas reemplazadas.' },
    ],
    indexes: [{ name: 'user_plans_current', sql: "CREATE UNIQUE INDEX user_plans_current ON user_plans (user_id) WHERE status = 'vigente'", desc: 'Una sola rutina vigente por participante.' }],
  },
  {
    name: 'user_plan_exercises', module: 'planes', es: 'Ejercicio de la rutina', informe: 'ejercicios de la rutina',
    desc: 'Composición de una rutina del participante: qué ejercicios van en cada sesión y con qué indicación. En las rutinas recomendadas se copia de la plantilla; en las propias la define la persona con ejercicios aprobados.',
    columns: [
      c('plan_id', 'uuid', { pk: true, fk: FK('user_plans', 'id', 'CASCADE'), desc: 'Rutina del participante a la que pertenece.' }),
      c('session_no', 'smallint', { pk: true, check: 'session_no BETWEEN 1 AND 7', desc: 'Número de sesión dentro de la semana.' }),
      c('position', 'smallint', { pk: true, check: 'position BETWEEN 1 AND 20', desc: 'Orden del ejercicio dentro de la sesión.' }),
      c('exercise_id', 'uuid', { fk: FK('exercises'), desc: 'Ejercicio aprobado del catálogo.' }),
      c('prescription', 'text', { check: 'length(prescription) BETWEEN 1 AND 200', desc: 'Indicación (series, repeticiones o tiempo): la del profesional, o la que armó la persona con límites seguros.' }),
    ],
  },
  {
    name: 'meal_plan_swaps', module: 'planes', es: 'Cambio de alimento', informe: 'cambios de alimentos de la pauta',
    desc: 'Alimento de una pauta aprobada que la persona cambió porque no lo tiene o no le gusta, por otro aprobado del mismo grupo que la nutricionista incluyó en esa pauta. No se guardan gramos: la API calcula los que aportan la misma energía. Vale solo para esa versión de la pauta y se puede deshacer.',
    columns: [
      c('user_id', 'uuid', { pk: true, fk: FK('users'), desc: 'Participante que hizo el cambio.' }),
      c('template_id', 'uuid', { pk: true, desc: 'Pauta aprobada.' }),
      c('day_no', 'smallint', { pk: true, desc: 'Día de la pauta (1 = lunes … 7 = domingo).' }),
      c('meal', 'text', { pk: true, desc: 'Comida del día.' }),
      c('position', 'smallint', { pk: true, desc: 'Posición del alimento reemplazado dentro de la comida.' }),
      c('food_id', 'uuid', { fk: FK('foods'), desc: 'Alimento que lo reemplaza: aprobado, del mismo grupo y presente en la misma pauta.' }),
      created(),
    ],
    fks: [{ cols: ['template_id', 'day_no', 'meal', 'position'], ref: 'meal_plan_items', refCols: ['template_id', 'day_no', 'meal', 'position'], desc: 'El alimento reemplazado existe en la pauta.' }],
  },

  // ───────────────────────── Seguimiento, avisos y trazabilidad ─────────────────────────
  {
    name: 'training_sessions', module: 'seguimiento', es: 'Sesión de entrenamiento', informe: 'sesión',
    desc: 'Sesión programada al iniciar la rutina. El participante declara si la realizó; una sesión sin registro cuenta como no realizada en la adherencia. Si no puede hacerla ese día, la mueve a otro día libre. Los días de descanso no tienen filas: el horario semanal y la racha los deducen de los días de la rutina, y la racha no se guarda.',
    columns: [
      uuidPk('Identificador de la sesión.'),
      c('user_id', 'uuid', { desc: 'Participante.' }),
      c('plan_id', 'uuid', { desc: 'Rutina del participante a la que pertenece.' }),
      c('session_no', 'smallint', { check: 'session_no BETWEEN 1 AND 7', desc: 'Número de sesión dentro de la semana del plan.' }),
      c('label', 'text', { check: 'length(label) BETWEEN 1 AND 80', desc: 'Nombre visible de la sesión.' }),
      c('planned_date', 'date', { desc: 'Fecha programada. Al mover la sesión cambia a hoy o a un día futuro, nunca a una fecha pasada.' }),
      c('rescheduled_from', 'date', { nn: false, check: 'rescheduled_from <> planned_date', desc: 'Fecha programada original, si la persona movió la sesión a otro día; ese día queda como «movida» (no suma ni corta la racha).' }),
      ts('completed_at', 'Momento en que el participante declaró la sesión como realizada.', { nn: false }),
      c('note', 'text', { nn: false, check: 'length(note) <= 200', desc: 'Nota breve del participante.' }),
      created(),
    ],
    unique: [{ cols: ['plan_id', 'planned_date'], name: 'training_sessions_plan_date_key', desc: 'Una sesión por día y plan.' }],
    fks: [{ cols: ['plan_id', 'user_id'], ref: 'user_plans', refCols: ['id', 'user_id'], desc: 'La rutina pertenece al mismo participante.' }],
    indexes: [{ name: 'training_sessions_user_date', sql: 'CREATE INDEX training_sessions_user_date ON training_sessions (user_id, planned_date)', desc: 'Consulta de la agenda del participante.' }],
  },
  {
    name: 'weight_records', module: 'seguimiento', es: 'Registro de peso', informe: 'registro de progreso',
    desc: 'Peso declarado por el participante. Solo se habilita con consentimiento de seguimiento y tratamiento de datos autorizado.',
    columns: [
      uuidPk('Identificador del registro.'),
      c('user_id', 'uuid', { fk: FK('users'), desc: 'Participante.' }),
      c('recorded_on', 'date', { desc: 'Fecha a la que corresponde el peso.' }),
      c('weight_kg', 'numeric(5,1)', { check: 'weight_kg > 0 AND weight_kg <= 500', desc: 'Peso en kilogramos.' }),
      created(),
    ],
    unique: [{ cols: ['user_id', 'recorded_on'], name: 'weight_records_user_day_key', desc: 'Un registro de peso por día.' }],
  },
  {
    name: 'notifications', module: 'seguimiento', es: 'Aviso interno', informe: 'aviso interno',
    desc: 'Aviso dentro de la aplicación, sin información sensible. Se consulta por la API; no se envían notificaciones externas.',
    columns: [
      uuidPk('Identificador del aviso.'),
      c('user_id', 'uuid', { fk: FK('users'), desc: 'Destinatario.' }),
      c('type', 'text', { values: ['sesiones_pendientes', 'solicitud_derechos'], desc: 'Tipo de aviso: recordatorio de sesiones sin registrar o novedad de una solicitud de derechos.' }),
      c('ref_id', 'uuid', { nn: false, desc: 'Identificador del registro al que se refiere.' }),
      c('message', 'text', { check: 'length(message) BETWEEN 1 AND 200', desc: 'Texto del aviso, sin datos de salud.' }),
      created(),
      ts('read_at', 'Momento en que el destinatario lo leyó.', { nn: false }),
    ],
    indexes: [{ name: 'notifications_user_recent', sql: 'CREATE INDEX notifications_user_recent ON notifications (user_id, created_at DESC)', desc: 'Listado reciente de avisos por usuario.' }],
  },
  {
    name: 'audit_log', module: 'seguimiento', es: 'Auditoría', informe: 'auditoría',
    desc: 'Bitácora de solo anexado: quién hizo qué, cuándo y sobre qué versión. No contiene tokens ni contenido sensible; la base impide modificar o borrar sus filas.',
    columns: [
      c('id', 'bigint', { pk: true, identity: true, desc: 'Número correlativo del evento.' }),
      ts('occurred_at', 'Fecha y hora del evento.', { def: 'now()' }),
      c('actor_id', 'uuid', { nn: false, fk: FK('users'), desc: 'Quien ejecutó la acción (vacío en acciones del sistema).' }),
      c('actor_role', 'text', { nn: false, desc: 'Rol del actor al ejecutar la acción.' }),
      c('action', 'text', { check: "action ~ '^[a-z_]+\\.[a-z_]+$'", desc: 'Acción en formato «entidad.verbo», por ejemplo template.approved.' }),
      c('entity_type', 'text', { desc: 'Tipo de entidad afectada.' }),
      c('entity_id', 'uuid', { nn: false, desc: 'Identificador de la entidad afectada.' }),
      c('entity_version', 'integer', { nn: false, desc: 'Versión de la entidad, cuando aplica.' }),
      c('detail', 'jsonb', { def: "'{}'::jsonb", check: "jsonb_typeof(detail) = 'object'", desc: 'Metadatos no sensibles del evento.' }),
    ],
    indexes: [
      { name: 'audit_log_entity', sql: 'CREATE INDEX audit_log_entity ON audit_log (entity_type, entity_id)', desc: 'Historial de una entidad.' },
      { name: 'audit_log_time', sql: 'CREATE INDEX audit_log_time ON audit_log (occurred_at)', desc: 'Consulta por período.' },
    ],
  },
  {
    name: 'usage_events', module: 'seguimiento', es: 'Evento de uso seudonimizado', informe: 'eventos seudonimizados',
    desc: 'Eventos para calcular los KPI del piloto. Se asocian a un seudónimo (HMAC del identificador) y no tienen clave foránea hacia la cuenta, de modo que el vínculo queda separado.',
    columns: [
      c('id', 'bigint', { pk: true, identity: true, desc: 'Número correlativo del evento.' }),
      c('pseudonym', 'text', { check: "pseudonym ~ '^[0-9a-f]{64}$'", desc: 'HMAC-SHA256 en hexadecimal del identificador de la cuenta, con secreto del piloto.' }),
      c('event_type', 'text', { values: ['registro_iniciado', 'registro_completado', 'sesion_iniciada', 'rutina_iniciada', 'plan_consultado', 'sesion_registrada', 'peso_registrado', 'pauta_consultada'], desc: 'Tipo de evento.' }),
      ts('occurred_at', 'Fecha y hora del evento.', { def: 'now()' }),
    ],
    indexes: [
      { name: 'usage_events_pseudonym', sql: 'CREATE INDEX usage_events_pseudonym ON usage_events (pseudonym, occurred_at)', desc: 'Actividad por participante seudonimizado.' },
      { name: 'usage_events_type', sql: 'CREATE INDEX usage_events_type ON usage_events (event_type, occurred_at)', desc: 'Conteo de eventos por tipo y período.' },
    ],
  },
];

/** Disparadores y funciones auxiliares que acompañan al esquema. */
export const FUNCTIONS = [
  {
    name: 'fitgoal_days_valid',
    desc: 'Valida que un arreglo de días tenga entre 1 y 7 elementos, entre 1 y 7 y sin repetir.',
    sql: `CREATE FUNCTION fitgoal_days_valid(d smallint[]) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT d IS NOT NULL
     AND cardinality(d) BETWEEN 1 AND 7
     AND NOT EXISTS (SELECT 1 FROM unnest(d) AS x WHERE x IS NULL OR x NOT BETWEEN 1 AND 7)
     AND (SELECT count(DISTINCT x) FROM unnest(d) AS x) = cardinality(d)
$$;`,
  },
  {
    name: 'fitgoal_labels_valid',
    desc: 'Valida que un arreglo de nombres de sesión tenga entre 1 y 7 elementos, cada uno con 1 a 40 caracteres.',
    sql: `CREATE FUNCTION fitgoal_labels_valid(l text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT l IS NOT NULL
     AND cardinality(l) BETWEEN 1 AND 7
     AND NOT EXISTS (SELECT 1 FROM unnest(l) AS x WHERE x IS NULL OR length(btrim(x)) NOT BETWEEN 1 AND 40)
$$;`,
  },
];

export const TRIGGERS = [
  {
    name: 'audit_log_append_only', table: 'audit_log',
    desc: 'Impide modificar o borrar filas de la bitácora.',
    sql: `CREATE FUNCTION fitgoal_forbid_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo anexado', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION fitgoal_forbid_change();`,
  },
  {
    name: 'user_plans_integrity', table: 'user_plans',
    desc: 'Una rutina recomendada solo puede copiarse de una plantilla aprobada, y una rutina ya iniciada conserva su contenido (solo cambian el estado y la fecha de reemplazo).',
    sql: `CREATE FUNCTION fitgoal_plan_requires_approved_template() RETURNS trigger
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
  FOR EACH ROW EXECUTE FUNCTION fitgoal_freeze_user_plan();`,
  },
  {
    name: 'user_plan_exercises_integrity', table: 'user_plan_exercises',
    desc: 'Solo se pueden agregar ejercicios aprobados a una rutina, y la composición de una rutina iniciada no se modifica.',
    sql: `CREATE FUNCTION fitgoal_plan_requires_approved_exercise() RETURNS trigger
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
  FOR EACH ROW EXECUTE FUNCTION fitgoal_forbid_change();`,
  },
  {
    name: 'template_exercises_frozen', table: 'template_exercises',
    desc: 'Impide cambiar los ejercicios de una plantilla que ya no es borrador (se crea una versión nueva) y exige que cada ejercicio vaya en una sesión con nombre.',
    sql: `CREATE FUNCTION fitgoal_freeze_template_exercises() RETURNS trigger
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
  FOR EACH ROW WHEN (OLD.status <> 'draft') EXECUTE FUNCTION fitgoal_no_delete_template();`,
  },
  {
    name: 'meal_plan_items_frozen', table: 'meal_plan_items',
    desc: 'Impide cambiar los alimentos de una pauta que ya no es borrador (se crea una versión nueva), exige alimentos aprobados al aprobarla e impide borrar una pauta aprobada.',
    sql: `CREATE FUNCTION fitgoal_freeze_meal_plan_items() RETURNS trigger
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
  FOR EACH ROW WHEN (OLD.status <> 'draft') EXECUTE FUNCTION fitgoal_no_delete_template();`,
  },
  {
    name: 'meal_plan_swaps_valid', table: 'meal_plan_swaps',
    desc: 'Un alimento solo se cambia en una pauta aprobada y por otro distinto, aprobado, del mismo grupo y que la nutricionista incluyó en esa misma pauta.',
    sql: `CREATE FUNCTION fitgoal_meal_swap_valid() RETURNS trigger
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
  FOR EACH ROW EXECUTE FUNCTION fitgoal_meal_swap_valid();`,
  },
];

export const byName = Object.fromEntries(TABLES.map(t => [t.name, t]));
