// AR 4 · Arquitectura de la solución: vista integrada de capas con componentes de software y hardware.
import { Svg, THEME, textBlock } from '../kit/svg.mjs';

export function integrated() {
  const w = 1660;
  const h = 1210;
  const s = new Svg(w, h, { title: 'AR 4 Arquitectura de la solución', desc: 'Vista integrada por capas con software, hardware y aspectos transversales' });
  s.text(30, 24, 'AR 4 · Arquitectura de la solución (vista integrada)', { size: 20, weight: 700, anchor: 'start' });
  s.text(30, 46, 'Capas de software y hardware con las tecnologías elegidas y los aspectos transversales de seguridad, calidad y operación', { size: 13, anchor: 'start', fill: THEME.sub });

  const X0 = 30;
  const BW = 1180; // ancho de la pila de capas
  const layer = (y, h2, title, tech, color) => {
    s.rect(X0, y, BW, h2, { r: 12, fill: color.fill, stroke: color.stroke, sw: 1.8, layer: 'bg', opacity: 0.6 });
    s.add('bg', textBlock(X0 + 16, y + 16, title, { size: 15, weight: 700, anchor: 'start', fill: color.ink }).svg);
    s.add('bg', textBlock(X0 + BW - 16, y + 16, tech, { size: 12, anchor: 'end', fill: THEME.sub, italic: true }).svg);
  };
  const chip = (x, y, cw, ch, title, lines, color = THEME.white) => {
    s.rect(x, y, cw, ch, { r: 8, fill: '#fff', stroke: color.stroke, sw: 1.6 });
    s.add('nodes', textBlock(x + 10, y + 16, title, { size: 12.5, weight: 700, anchor: 'start', fill: color.ink, maxWidth: cw - 20 }).svg);
    if (lines) s.add('nodes', textBlock(x + 10, y + 34, lines, { size: 11.2, anchor: 'start', fill: THEME.ink, maxWidth: cw - 20, valign: 'top', lh: 1.22 }).svg);
  };
  const arrow = (x, y1, y2, label) => {
    s.edge([[x, y1], [x, y2]], { color: THEME.line, head: 'fill', tail: 'fill', width: 1.8, label, labelDx: 10, labelDy: 0, labelAnchor: 'start', labelSize: 11.5, labelFill: THEME.sub });
  };

  // 0 · Usuarios y roles
  layer(80, 96, 'Usuarios y roles', 'Control de acceso por rol (RBAC)', THEME.gray);
  [['Participante', 'Adulto que entrena'], ['Preparador físico', 'Catálogo: ejercicios, rutinas y reglas'], ['Nutricionista', 'Alimentos, pautas y reglas nutricionales'], ['Administrador', 'Cuentas, derechos y operación']].forEach(([t, d], i) => chip(X0 + 16 + i * 290, 112, 276, 54, t, d, THEME.gray));
  arrow(600, 176, 214, 'Interacción');

  // 1 · Presentación
  layer(214, 150, 'Capa de presentación (cliente móvil)', 'Flutter · Dart · Material Design 3 · Android 10+ y web', THEME.blue);
  [['Interfaz del participante', 'Horario semanal y racha · modo sesión · rutinas recomendadas y propia · ejercicios · pauta de alimentación con cambio de alimentos · perfil · avisos · derechos'],
    ['Interfaz del profesional', 'Preparador: ejercicios, rutinas y reglas · nutricionista: alimentos, pautas y reglas · aprobar o retirar contenido'],
    ['Interfaz de administración', 'Cuentas y roles · solicitudes de derechos · auditoría e indicadores'],
    ['Servicios del cliente', 'Cliente de la API con JWT · almacén seguro de tokens (Keystore) · consulta de avisos']].forEach(([t, d], i) => chip(X0 + 16 + i * 290, 248, 276, 108, t, d, THEME.blue));
  arrow(600, 364, 400, 'HTTPS · TLS 1.2+ · JSON · JWT');

  // 2 · Servicios
  layer(400, 270, 'Capa de servicios (backend)', 'Node.js 24 LTS · Express 5 · monolito modular · API REST', THEME.amber);
  s.rect(X0 + 16, 434, BW - 32, 44, { r: 8, fill: THEME.violet.fill, stroke: THEME.violet.stroke, sw: 1.6 });
  s.add('nodes', textBlock(X0 + 28, 456, 'Plataforma transversal: validación de entradas · autorización por rol y por relación con el recurso · límite de solicitudes · cabeceras y CORS · registros sin datos sensibles · /health', { size: 11.8, anchor: 'start', fill: THEME.violet.ink, maxWidth: BW - 60, weight: 600 }).svg);
  const mods = [['Identidad', 'Argon2id · JWT · roles'], ['Perfil y consentimiento', 'Versionado y política'], ['Catálogo', 'Rutinas, ejercicios y reglas aprobados'], ['Cálculo energético', 'Mifflin-St Jeor y objetivo'], ['Recomendación', 'Rutinas y ejercicios sugeridos'],
    ['Rutinas del participante', 'Iniciar, vigente, historial'], ['Alimentación', 'Pautas de 7 días y cambio de alimentos'], ['Progreso', 'Horario, sesiones, adherencia, racha'], ['Notificaciones', 'Avisos internos'], ['Derechos de datos', 'Solicitudes y plazos'], ['Auditoría', 'Solo anexado']];
  mods.forEach(([t, d], i) => chip(X0 + 16 + (i % 6) * 192, 486 + Math.floor(i / 6) * 73, 182, 68, t, d, THEME.amber));
  s.rect(X0 + 16, 634, BW - 32, 26, { r: 6, fill: THEME.gray.fill, stroke: THEME.gray.stroke, sw: 1.4 });
  s.add('nodes', textBlock(X0 + 28, 647, 'Acceso a datos: repositorios con SQL parametrizado, transacciones, pool acotado y migraciones versionadas', { size: 11.8, anchor: 'start', fill: THEME.gray.ink, weight: 600 }).svg);
  arrow(600, 670, 698, 'SQL parametrizado · TLS · puerto 5432');

  // 3 · Datos
  layer(698, 150, 'Capa de datos', 'PostgreSQL 18 · 20 tablas · restricciones, claves compuestas y disparadores', THEME.teal);
  [['Identidad y derechos', 'users · auth_sessions · consents · data_requests'],
    ['Catálogo y reglas', 'exercises · rule_versions · routine_templates · template_exercises · foods · meal_plan_templates · meal_plan_items'],
    ['Perfil, rutinas y cambios de alimentos', 'profile_versions · user_plans · user_plan_exercises · meal_plan_swaps'],
    ['Seguimiento y trazabilidad', 'training_sessions · weight_records · notifications · audit_log · usage_events']].forEach(([t, d], i) => chip(X0 + 16 + i * 290, 732, 276, 108, t, d, THEME.teal));
  arrow(600, 848, 884, 'Se ejecuta sobre');

  // 4 · Infraestructura y hardware
  layer(884, 212, 'Infraestructura y hardware', 'Render · GitHub · Google Play · equipos propios', THEME.gray);
  const hw = [['Smartphone Android ×2', 'Android 10+, 2 GB de RAM, 360 dp mínimo, 200 MB libres, más un emulador'],
    ['Estaciones de desarrollo ×3', '8 GB de RAM mínimo (16 GB con emulador), 20 GB libres; Node.js 24 y PostgreSQL en proceso (PGlite)'],
    ['Servicio web en Render', '0,5 CPU · 512 MB de RAM · Node.js 24 LTS · despliegue automático'],
    ['PostgreSQL gestionado en Render', '0,1 CPU · 256 MB de RAM · 1 GB de almacenamiento · TLS'],
    ['Almacenamiento de respaldo', 'Compatible con S3 · cifrado en reposo · copias diarias de 7 días y 4 semanas'],
    ['GitHub y Actions', 'Repositorio, tablero y CI en cada cambio; prueba interna en Google Play']];
  hw.forEach(([t, d], i) => chip(X0 + 16 + (i % 3) * 386, 918 + Math.floor(i / 3) * 90, 372, 80, t, d, THEME.gray));
  s.text(X0 + BW / 2, 1114, 'Las piezas de hardware propias del equipo y los servicios en la nube cubren los tres ambientes: desarrollo local, staging local ficticio y piloto en Render.', { size: 12, fill: THEME.sub, maxWidth: BW - 40 });

  // Aspectos transversales
  const bar = (y, h2, title, items, color) => {
    s.rect(1240, y, 390, h2, { r: 12, fill: color.fill, stroke: color.stroke, sw: 1.8 });
    s.add('nodes', textBlock(1256, y + 20, title, { size: 15, weight: 700, anchor: 'start', fill: color.ink }).svg);
    s.add('nodes', textBlock(1256, y + 40, items.map(t => `• ${t}`).join('\n'), { size: 12, anchor: 'start', fill: THEME.ink, valign: 'top', lh: 1.3, maxWidth: 360 }).svg);
  };
  bar(80, 360, 'Seguridad y ética', ['TLS 1.2 o superior en todo el tráfico público', 'Contraseñas con Argon2id y sal individual', 'JWT de 15 min y refresh token rotativo de 7 días, con versión de sesión', 'Autorización por rol y por relación con el recurso', 'Límite de 120 solicitudes por minuto y de 10 intentos fallidos en 15 min', 'Datos de salud (estatura, peso, sexo y actividad) solo con consentimiento específico y revocable', 'Auditoría de solo anexado y seudonimización de eventos', 'Cumplimiento de la Ley 19.628 y de la Ley 21.719 (desde 01-12-2026)'], THEME.rose);
  bar(460, 330, 'Calidad', ['Modelo ISO/IEC 25010:2023: adecuación funcional, eficiencia, fiabilidad, seguridad, capacidad de interacción y mantenibilidad', 'Pruebas unitarias, de integración, extremo a extremo, de seguridad y de carga', 'flutter_test, integration_test, Node, Supertest y k6', 'GitHub Actions en cada solicitud de cambio', 'Cobertura meta de ramas ≥ 80% en cálculo y reglas'], THEME.green);
  bar(810, 360, 'Operación y continuidad', ['Sondeo de API y base de datos cada 5 minutos', 'Disponibilidad ≥ 95% en 28 días', 'Respaldo diario cifrado: RPO de 24 h y RTO de 4 h', 'Restauración ensayada antes del piloto', 'Control de cambios y revisión del responsable de operación', 'Gestión de incidentes: detener acceso afectado, preservar registros y evaluar alcance', 'Ambientes separados con secretos independientes'], THEME.violet);
  return { id: 'AR4', file: 'ar-4-arquitectura-integrada', title: 'AR 4 Arquitectura de la solución', svg: s.toString(), width: w, height: h };
}
