import 'package:flutter/material.dart';

import '../api/api_client.dart';

/// Si se constituye una sociedad, ella pasa a ser la responsable.
const policyController = 'Vicente Egaña, Jorge Farias y Jonatan Fernandez, fundadores de FitGoal, que deciden en conjunto cómo se tratan tus datos';

/// Debe completarse antes del piloto: la ley exige un canal de contacto.
const policyContact = 'Por definir antes del piloto';

/// Mismo texto de docs/politica_de_datos.md. Si cambia el fondo, se sube la versión de la política.
const policySections = <(String, String)>[
  ('Quién trata tus datos', 'Responsables: $policyController. Contacto: $policyContact.'),
  ('Para qué los usamos', 'Crear tu cuenta y tu perfil, recomendarte rutinas y pautas de alimentación aprobadas por profesionales, llevar tu seguimiento y enviarte recordatorios si los activas. Si participas en el piloto, también para evaluar la aplicación.'),
  ('Qué datos tratamos', 'Correo, edad, objetivo, nivel, días, duración y equipo; sesiones, rutinas y cambios de alimento. Solo si lo autorizas: estatura, peso, sexo y nivel de actividad, que tratamos como datos de salud. Tú nos entregas estos datos.'),
  ('Tu consentimiento', 'Cada finalidad opcional tiene su propio consentimiento. Puedes retirarlo cuando quieras, sin afectar lo tratado antes. Al retirarlo borramos lo que autorizaba: la estatura y el peso, el sexo y la actividad, tu historial de peso o tus datos de uso del piloto, según corresponda.'),
  ('Cuánto tiempo los conservamos', 'Mientras uses tu cuenta. Si no la usas durante 12 meses, la eliminamos. Los avisos se borran a los 6 meses, las sesiones cerradas a los 30 días y los eventos de uso a los 24 meses. Las copias de respaldo duran hasta 4 semanas. Conservamos sin datos de salud las solicitudes de derechos y la bitácora que acredita lo que hicimos.'),
  ('Con quién los compartimos', 'No vendemos tus datos ni los cedemos para publicidad. Render Services, Inc. aloja la aplicación y la base de datos por encargo nuestro en Virginia, Estados Unidos, y usa proveedores de ese país. Los respaldos cifrados quedan en otro proveedor, que se informará aquí antes del piloto. En Chile aún no existe una lista oficial de países con nivel adecuado de protección, por lo que no podemos afirmar que Estados Unidos lo tenga. Esta transferencia se apoya en el contrato de tratamiento de datos de Render, que limita el uso de tus datos a prestar el servicio y le exige medidas de seguridad y avisarnos de vulneraciones.'),
  ('Cómo los protegemos', 'Contraseñas con hash Argon2id, sesiones que expiran, comunicación cifrada, permisos por rol, bitácora de auditoría y respaldos cifrados.'),
  ('Tus derechos', 'Puedes pedir acceso, rectificación, supresión, oposición, portabilidad y bloqueo temporal en «Mis datos». Respondemos en 30 días corridos, con una prórroga única de hasta 30, y en 2 días hábiles el bloqueo. Si rechazamos tu solicitud o no respondemos a tiempo, puedes recurrir a la Agencia de Protección de Datos Personales.'),
  ('Solo para personas adultas', 'FitGoal entrega orientación general y no reemplaza una evaluación de salud.'),
];

Future<void> showPrivacyPolicy(BuildContext context) => showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        key: const Key('policy-dialog'),
        title: const Text('Política de datos'),
        content: SizedBox(
          width: 480,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Versión: $policyVersion', style: Theme.of(dialogContext).textTheme.bodySmall),
                for (final (title, body) in policySections) ...[
                  const SizedBox(height: 12),
                  Text(title, style: Theme.of(dialogContext).textTheme.titleSmall),
                  const SizedBox(height: 2),
                  Text(body),
                ],
              ],
            ),
          ),
        ),
        actions: [TextButton(key: const Key('policy-close'), onPressed: () => Navigator.pop(dialogContext), child: const Text('Cerrar'))],
      ),
    );
