// Genera el SQL de migración y el documento docs/ES2_Arquitectura.md a partir del esquema y del contenido.
// Uso: node generate.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TABLES, MODULES, TRIGGERS } from './schema/schema.mjs';
import { fullMigration } from './schema/sql.mjs';
import { relations } from './src/er.mjs';
import { PROCESSES, USE_CASE_SPECS, COMPONENTS, TRACE } from './content.mjs';
import { USE_CASES } from './src/usecases.mjs';
import { PROTOCOLS, ENVIRONMENTS } from './src/network.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const esc = text => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
const table = (headers, rows) => [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.map(esc).join(' | ')} |`)].join('\n');
const img = (file, alt) => `![${alt}](diagramas/out/png/${file}.png)`;

// 1 · Migración SQL ----------------------------------------------------------------
mkdirSync(`${root}backend/migrations`, { recursive: true });
writeFileSync(`${root}backend/migrations/001_modelo_mvp.sql`, fullMigration(), 'utf8');

// 2 · Diccionario de datos ---------------------------------------------------------
const colRule = (t, col) => {
  const parts = [];
  if (col.values) parts.push(`Valores: ${col.values.join(', ')}`);
  if (col.check) parts.push(`Regla: ${col.check}`);
  if (col.fk) parts.push(`Referencia a ${col.fk.t}.${col.fk.c}${col.fk.onDelete ? ` (al borrar: ${col.fk.onDelete})` : ''}`);
  const composite = (t.fks ?? []).filter(fk => fk.cols.includes(col.name));
  for (const fk of composite) parts.push(`Clave compuesta (${fk.cols.join(', ')}) → ${fk.ref}(${fk.refCols.join(', ')})`);
  return parts.join('. ');
};
const keyOf = (t, col) => {
  const keys = [];
  if (col.pk) keys.push('PK');
  if (col.fk || (t.fks ?? []).some(fk => fk.cols.includes(col.name))) keys.push('FK');
  if (col.uq) keys.push('UQ');
  return keys.join(' ');
};
function dictionary() {
  const out = [];
  for (const module of MODULES) {
    out.push(`### ${module.name}\n`);
    for (const t of TABLES.filter(item => item.module === module.id)) {
      out.push(`#### ${t.name} — ${t.es}\n`);
      out.push(`${t.desc}\n`);
      out.push(table(['Columna', 'Tipo', 'Nulo', 'Clave', 'Por defecto', 'Restricción o valores', 'Descripción'],
        t.columns.map(col => [col.name, col.type + (col.identity ? ' (identidad)' : ''), col.nn ? 'No' : 'Sí', keyOf(t, col), col.def ?? '', colRule(t, col), col.desc])));
      const rules = [
        ...(t.unique ?? []).map(u => `**${u.name}** (único: ${u.cols.join(', ')}): ${u.desc}`),
        ...(t.fks ?? []).map(fk => `**Clave foránea compuesta** (${fk.cols.join(', ')}) → ${fk.ref}(${fk.refCols.join(', ')}): ${fk.desc}`),
        ...(t.checks ?? []).map(chk => `**${t.name}_${chk.name}**: ${chk.desc}`),
        ...(t.indexes ?? []).map(ix => `**Índice ${ix.name}**: ${ix.desc}`),
      ];
      if (rules.length) out.push(`\nReglas de integridad e índices:\n\n${rules.map(rule => `- ${rule}`).join('\n')}`);
      out.push('');
    }
  }
  return out.join('\n');
}
const dictFile = `# Diccionario de datos de FitGoal\n\nGenerado desde \`docs/diagramas/schema/schema.mjs\`. Coincide con \`backend/migrations/001_modelo_mvp.sql\`, que se aplicó y se probó en PostgreSQL 18.\n\n${dictionary()}`;
writeFileSync(`${root}docs/diccionario_de_datos.md`, dictFile, 'utf8');

// 3 · Documento de arquitectura ---------------------------------------------------
const rels = relations();
const entityMap = [
  ['Usuario', 'users', 'Cuenta con rol: participante, preparador físico, nutricionista o administrador.'],
  ['Perfil', 'profile_versions', 'Cada cambio crea una versión; la rutina del participante referencia la versión usada.'],
  ['Objetivo', 'profile_versions.objective', 'Bajar, mantener o subir de peso, dentro del perfil versionado.'],
  ['Plantilla (rutina recomendada)', 'routine_templates, template_exercises, exercises', 'Rutina prearmada, definida y aprobada una sola vez por el preparador; los ejercicios se componen desde el catálogo aprobado.'],
  ['Versión de reglas', 'rule_versions', 'En entrenamiento: matriz de recomendación (objetivo, nivel, equipo, categoría de IMC y división), regla de división, reglas de seguridad y grupos sugeridos. En nutrición: factores de actividad, déficit y superávit por objetivo, tope del déficit, mínimo por sexo y ajustes por IMC. Siempre con aprobación.'],
  ['Minuta (pauta de alimentación)', 'meal_plan_templates, meal_plan_items, foods, meal_plan_swaps', 'Pauta de 7 días por tipo de dieta, aprobada una sola vez por la nutricionista con alimentos aprobados; la API ajusta los gramos a las calorías de cada persona, que puede cambiar un alimento que no tiene por otro aprobado del mismo grupo de esa pauta.'],
  ['Rutina del participante (plan vigente)', 'user_plans, user_plan_exercises', 'Copia inmutable de una rutina aprobada, o rutina propia con ejercicios aprobados; una sola vigente por persona.'],
  ['Aprobación profesional', 'exercises, routine_templates, foods, meal_plan_templates, rule_versions (status, approved_by, approved_by_role)', 'La base exige que quien aprueba tenga el rol competente; solo lo aprobado se ofrece a las personas.'],
  ['Sesión', 'training_sessions (entrenamiento), auth_sessions (acceso)', 'Sesión programada y declarada; la sesión de autenticación se guarda aparte.'],
  ['Consentimiento', 'consents', 'Registro anexado con la versión de la política.'],
  ['Auditoría', 'audit_log', 'Bitácora de solo anexado.'],
];

const sections = [];
sections.push(`# FitGoal · Arquitectura de la solución (borrador del capítulo para ES2)

Este documento reúne el diseño técnico de FitGoal que exige la Evaluación Sumativa 2: procesos de negocio en BPMN, casos de uso y componentes en UML, modelo y diccionario de datos, topología de comunicaciones, infraestructura y arquitectura integrada. Se redactó tomando como especificación el informe de formulación del 01-10-2026 (\`FitGoal_Formulacion_Proyecto_Corregida.docx\`) y se genera con código, de modo que los diagramas, el esquema SQL y el diccionario sean coherentes entre sí.

**Estado de implementación.** Estos diagramas describen el MVP y coinciden con el código del repositorio. El modelo de datos está implementado y verificado como migración SQL (20 tablas, con sus reglas de integridad probadas en PostgreSQL 18), la API Node.js/Express y la app Flutter están construidas según este diseño y tienen pruebas automáticas. Las pautas de alimentación usan contenido de demostración que la nutricionista del proyecto debe revisar y aprobar antes del piloto. Quedan fuera del alcance actual el despliegue en Render y las pruebas de carga.

**Cómo regenerar.** Desde \`docs/diagramas\`: \`node build.mjs\` (diagramas) y \`node generate.mjs\` (SQL y documentos). \`node schema/validate.mjs\` aplica el esquema en PostgreSQL y prueba sus reglas.
`);

sections.push(`## 1. Contexto del sistema

${img('ar-0-contexto', 'Contexto del sistema')}

FitGoal es usado por cuatro roles: el participante, el preparador físico, la nutricionista (por incorporar) y el administrador, que es el equipo fundador a cargo de la operación. El sistema depende de Render (API y base de datos del piloto), de un almacenamiento externo cifrado para los respaldos, de GitHub (código, tablero e integración continua), de Google Play (pruebas internas) y de un sondeo externo que mide la disponibilidad.
`);

sections.push(`## 2. Procesos de negocio (BPMN)

Se modelaron cinco procesos principales con BPMN 2.0. Los tres primeros forman el ciclo de valor de FitGoal para la persona: incorporarla y recomendarle rutinas aprobadas (P1), dejarla empezar de inmediato una rutina recomendada o propia (P2) y acompañar su seguimiento (P3). El cuarto (P4) responde a una obligación legal y ética propia de trabajar con datos asociados a salud: atender los derechos del titular sobre sus datos. El quinto (P5) es el control de calidad del servicio: el profesional aprueba una sola vez, con versión y trazabilidad, todo lo que reciben las personas. Cada proceso tiene un diagrama de nivel 1, con carriles por actor, y otro con sus subprocesos expandidos. Las tareas azules son automáticas y representan la optimización del proceso: lo que el sistema resuelve sin intervención humana.

Los procesos se conectan así: P5 prepara el catálogo aprobado que usan P1 y P2; P1 termina con la lista de rutinas para elegir; P2 inicia la rutina vigente que alimenta P3; un cambio de perfil en P3 vuelve a P1 para ver nuevas recomendaciones; y P4 puede iniciarse en cualquier momento del ciclo. No existe revisión caso a caso: la persona recibe al instante lo que ya está aprobado.
`);
for (const p of PROCESSES) {
  sections.push(`### ${p.id} · ${p.name}

${img(p.file, p.name)}

${img(p.sub, `${p.id} subprocesos`)}

${table(['Elemento', 'Descripción'], [
    ['Objetivo', p.objective], ['Disparador', p.trigger], ['Actores', p.actors], ['Resultado', p.result],
    ['Requerimientos', p.rf], ['Indicadores', p.kpis],
  ])}

**Flujo.**

${p.flow.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**Subprocesos.**

${table(['Subproceso', 'Qué hace', 'Trazabilidad'], p.subs)}

**Optimización.** ${p.optimization}
`);
}

sections.push(`## 3. Casos de uso (UML)

${img('cu-1-participante', 'Casos de uso del participante')}

${img('cu-2-profesionales-y-administracion', 'Casos de uso de profesionales y administración')}

Los 31 casos de uso cubren los diez requerimientos funcionales. CU-02 (autenticación) es previo a todos los casos protegidos. CU-17 a CU-20 son funciones del sistema incluidas por otros casos; CU-12 extiende a CU-10 y CU-23 extiende a CU-21 y CU-22. Cada caso se relaciona con el problema del informe: personas que no saben estructurar un plan coherente (CU-03 a CU-09, con rutinas recomendadas y ayuda para armar la propia), la necesidad de validación profesional sin frenar el uso (CU-21 a CU-24: el profesional aprueba el catálogo una sola vez), el seguimiento que sostiene la continuidad (CU-10 a CU-13) y el cuidado de datos de salud (CU-12, CU-14, CU-20, CU-27).

### Especificación de los casos de uso

${table(['Caso de uso', 'Actor', 'Requerimientos', 'Precondición', 'Flujo principal', 'Flujos alternativos', 'Postcondición'],
  USE_CASES.map(uc => { const s = USE_CASE_SPECS[uc.id]; return [`**${uc.id}** ${uc.name}`, uc.actor, uc.rf.join(', '), s.pre, s.flow.map((step, i) => `${i + 1}) ${step}`).join(' '), s.alt, s.post]; }))}
`);

sections.push(`## 4. Diagrama de componentes

${img('ar-1-componentes', 'Diagrama de componentes')}

El backend es un monolito modular: cada módulo es un componente lógico con responsabilidades y dependencias explícitas, y todos acceden a los datos mediante la capa de acceso a datos. Se eligió un solo despliegue porque tres estudiantes pueden operarlo; los límites entre módulos y los contratos internos permiten separarlos en el futuro si fuera necesario.

${table(['Componente', 'Tipo', 'Responsabilidad', 'Depende de', 'Rutas o puertos'], COMPONENTS)}
`);

sections.push(`## 5. Modelo de datos

${img('er-0-general', 'Vista general del modelo de datos')}

El modelo relacional tiene 20 tablas en cuatro módulos y se implementa en PostgreSQL 18, elegido por las relaciones entre usuarios, perfiles, catálogo aprobado y rutinas, y por la necesidad de integridad referencial y transacciones. La base de datos aplica por sí misma las reglas que el informe declara como requisitos: solo el preparador aprueba ejercicios, rutinas y reglas de entrenamiento y solo la nutricionista los alimentos, las pautas de alimentación y las reglas nutricionales, una rutina solo puede iniciarse desde una plantilla aprobada y solo con ejercicios aprobados, una pauta solo se aprueba con alimentos aprobados, un alimento de la pauta solo se cambia por otro aprobado del mismo grupo que esa pauta incluye, una rutina iniciada y una pauta aprobada no se modifican, la bitácora es de solo anexado, el sexo y la actividad del cálculo de calorías exigen la estatura y el peso, y hay una única rutina vigente por participante.

${img('er-1-identidad', 'ER 1')}

${img('er-2-catalogo', 'ER 2')}

${img('er-2b-alimentacion', 'ER 2b')}

${img('er-3-planes', 'ER 3')}

${img('er-4-seguimiento', 'ER 4')}

### Correspondencia con las entidades del informe

${table(['Entidad del informe', 'Tabla', 'Observación'], entityMap)}

### Relaciones

${table(['Tabla hija', 'Columnas', 'Tabla padre', 'Columnas', 'Cardinalidad'], rels.map(r => [r.child, r.cols.join(', '), r.parent, r.parentCols.join(', '), `${r.optional ? '0..1' : '1'} : ${r.unique ? '0..1' : '0..N'}`]))}

### Disparadores y funciones

${table(['Nombre', 'Tabla', 'Finalidad'], TRIGGERS.map(tr => [tr.name, tr.table, tr.desc]))}

### Verificación del modelo

El script \`docs/diagramas/schema/validate.mjs\` aplica la migración en un PostgreSQL real (PGlite 0.5.8, que ejecuta PostgreSQL 18.3) y ejecuta 79 comprobaciones de integridad: contraseña con Argon2id, correo único sin distinguir mayúsculas, perfil adulto, días válidos, estatura y peso juntos y en rangos humanos, sexo y actividad solo con estatura y peso, competencia del aprobador de ejercicios, rutinas, alimentos, pautas y reglas, plantillas aprobadas inmutables, división válida y sesiones con nombre, solo plantillas y ejercicios aprobados en una rutina, rutina iniciada inmutable (con los nombres de sus sesiones), una sola rutina vigente, sesión movida con su fecha original distinta de la nueva, composición plausible de los alimentos, pautas solo con alimentos aprobados e inmutables una vez aprobadas, cambios de alimento solo por otro aprobado del mismo grupo que la pauta incluye, bitácora de solo anexado y formato del seudónimo.

El diccionario de datos completo, con cada columna, tipo, restricción y descripción, está en \`docs/diccionario_de_datos.md\`.
`);

sections.push(`## 6. Comportamiento

${img('st-1-estados', 'Estados del catálogo y de la rutina')}

${img('sq-1-secuencia', 'Secuencia del flujo crítico')}

El diagrama de estados define dos ciclos de vida. El contenido del catálogo (ejercicios, rutinas y reglas) nace «draft», pasa a «approved» cuando lo aprueba el profesional competente y termina «retired» cuando se retira o se aprueba una versión nueva. La rutina del participante solo está «vigente» o «reemplazada». La secuencia muestra el flujo crítico completo: la aprobación previa del catálogo, el perfil y la recomendación, el inicio inmediato de la rutina y su consulta, con las transacciones que garantizan la consistencia entre aprobación, inicio de la rutina y auditoría.
`);

sections.push(`## 7. Topología de comunicaciones

${img('ar-2-topologia', 'Topología de comunicaciones')}

Todo el tráfico del usuario entra por HTTPS (puerto 443) al borde gestionado de Render, que termina TLS 1.2 o superior; la API y la base de datos se comunican por la red privada del proveedor y la base exige TLS. El tramo entre el borde y el servicio ocurre dentro de la red del proveedor, y se solicitará evidencia de su protección antes del piloto.

${table(['N.º', 'Enlace', 'Protocolo y puerto', 'Seguridad', 'Características de transmisión'], PROTOCOLS)}
`);

sections.push(`## 8. Infraestructura

${img('ar-3-infraestructura', 'Diagrama de infraestructura')}

${table(['Ambiente', 'Dónde corre', 'Datos', 'Secretos y accesos', 'Uso y condición'], ENVIRONMENTS)}

Las cifras de CPU, memoria y almacenamiento corresponden a las tarifas públicas consultadas el 1 de octubre de 2026 y a las condiciones del presupuesto del informe; deben confirmarse al contratar. La región se definirá al abrir la cuenta, considerando la latencia desde Chile.
`);

sections.push(`## 9. Arquitectura de la solución

${img('ar-4-arquitectura-integrada', 'Arquitectura de la solución')}

La vista integrada une las capas de software (presentación, servicios y datos) con el hardware y los servicios que las soportan, y muestra los aspectos transversales de seguridad y ética, calidad y operación que atraviesan todas las capas.
`);

sections.push(`## 10. Matriz de trazabilidad

${table(['Requerimiento', 'Nombre', 'Casos de uso', 'Módulos', 'Tablas', 'Proceso BPMN', 'KPI', 'Prueba'], TRACE)}

La columna «Prueba» remite a las evidencias propuestas en el Anexo 2 del informe. Esta matriz extiende la trazabilidad del informe (requisito → KPI → prueba) hacia el diseño: requisito → caso de uso → módulo → tabla → proceso.
`);

writeFileSync(`${root}docs/ES2_Arquitectura.md`, sections.join('\n'), 'utf8');
console.log('SQL: backend/migrations/001_modelo_mvp.sql');
console.log('Documentos: docs/ES2_Arquitectura.md, docs/diccionario_de_datos.md');
