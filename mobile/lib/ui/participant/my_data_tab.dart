import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/api_client.dart';
import '../common.dart';

const _rights = {
  'acceso': 'Acceso: conocer los datos que FitGoal tiene sobre mí',
  'rectificacion': 'Rectificación: corregir un dato',
  'oposicion': 'Oposición: dejar de tratar mis datos para fines opcionales',
  'bloqueo': 'Bloqueo temporal: suspender el tratamiento de mis datos',
  'exportacion': 'Exportación: recibir mis datos en un archivo',
  'eliminacion': 'Eliminación: borrar mis datos y mi cuenta',
};
const _statusLabels = {'recibida': 'Recibida', 'en_curso': 'En curso', 'resuelta': 'Resuelta', 'rechazada': 'Respondida con fundamento'};

/// Derechos sobre los datos personales (RF009): solicitud con comprobante y plazo.
class MyDataTab extends StatelessWidget {
  const MyDataTab({super.key, required this.api});
  final ApiClient api;

  Future<void> _request(BuildContext context, String type, Future<void> Function() reload) async {
    if (type == 'eliminacion') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Solicitar eliminación'),
          content: const Text('Se borrarán tu cuenta, tu perfil, tus rutinas y tu historial. Esta acción no se puede deshacer una vez resuelta.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
            FilledButton(key: const Key('confirm-erase'), onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Solicitar eliminación')),
          ],
        ),
      );
      if (ok != true || !context.mounted) return;
    }
    try {
      final result = await api.post('/api/data-requests', {'type': type}) as Map<String, dynamic>;
      await reload();
      if (context.mounted) showMessage(context, 'Solicitud registrada. Comprobante: ${(result['request'] as Map)['receiptCode']}');
    } on ApiException catch (error) {
      if (context.mounted) showMessage(context, error.message);
    }
  }

  Future<void> _export(BuildContext context, Map<String, dynamic> request) async {
    try {
      final data = await api.get('/api/data-requests/${request['id']}/export');
      final text = const JsonEncoder.withIndent('  ').convert(data);
      if (!context.mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Tus datos'),
          content: SizedBox(width: 480, child: SingleChildScrollView(child: SelectableText(text, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)))),
          actions: [
            TextButton(onPressed: () async { await Clipboard.setData(ClipboardData(text: text)); }, child: const Text('Copiar')),
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cerrar')),
          ],
        ),
      );
    } on ApiException catch (error) {
      if (context.mounted) showMessage(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Loader<List<Map<String, dynamic>>>(
      load: () async => ((await api.get('/api/data-requests/me') as Map)['requests'] as List).cast<Map<String, dynamic>>(),
      builder: (context, requests, reload) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            title: 'Tus derechos sobre tus datos',
            children: [
              const Text('Respondemos en 30 días corridos (2 días hábiles en el bloqueo temporal) y te damos un comprobante.', style: TextStyle(fontSize: 12)),
              for (final entry in _rights.entries)
                ListTile(
                  key: Key('right-${entry.key}'),
                  contentPadding: EdgeInsets.zero,
                  title: Text(entry.value),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _request(context, entry.key, reload),
                ),
            ],
          ),
          SectionCard(
            title: 'Tus solicitudes',
            children: [
              if (requests.isEmpty) const Text('Aún no has hecho solicitudes.'),
              for (final request in requests)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${request['type']} · ${request['receiptCode']}'),
                  subtitle: Text('${_statusLabels[request['status']]} · plazo ${formatDateTime(request['dueAt'] as String)}'),
                  trailing: request['status'] == 'resuelta' && (request['type'] == 'acceso' || request['type'] == 'exportacion')
                      ? TextButton(key: Key('export-${request['id']}'), onPressed: () => _export(context, request), child: const Text('Ver datos'))
                      : null,
                ),
            ],
          ),
        ],
      ),
    );
  }
}
