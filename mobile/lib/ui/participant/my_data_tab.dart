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
const _rightIcons = {
  'acceso': Icons.visibility_outlined,
  'rectificacion': Icons.edit_outlined,
  'oposicion': Icons.do_not_disturb_on_outlined,
  'bloqueo': Icons.pause_circle_outline,
  'exportacion': Icons.download_outlined,
  'eliminacion': Icons.delete_outline,
};

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
    final tokens = FitTokens.of(context);
    return Loader<List<Map<String, dynamic>>>(
      load: () async => ((await api.get('/api/data-requests/me') as Map)['requests'] as List).cast<Map<String, dynamic>>(),
      builder: (context, requests, reload) => PageList(
        maxWidth: 768,
        children: [
          SectionCard(
            title: 'Tus derechos sobre tus datos',
            icon: Icons.shield_outlined,
            children: [
              Text('Respondemos en 30 días corridos (2 días hábiles en el bloqueo temporal) y te damos un comprobante.', style: TextStyle(fontSize: 13, color: tokens.muted)),
              const SizedBox(height: 8),
              for (final entry in _rights.entries)
                _RightTile(
                  key: Key('right-${entry.key}'),
                  icon: _rightIcons[entry.key] ?? Icons.policy_outlined,
                  title: entry.value.split(': ').first,
                  description: entry.value.split(': ').skip(1).join(': '),
                  danger: entry.key == 'eliminacion',
                  onTap: () => _request(context, entry.key, reload),
                ),
            ],
          ),
          SectionCard(
            title: 'Tus solicitudes',
            icon: Icons.receipt_long_outlined,
            iconColor: tokens.info,
            children: [
              if (requests.isEmpty)
                EmptyState(icon: Icons.inbox_outlined, color: tokens.muted, title: 'Sin solicitudes', message: const Text('Aún no has hecho solicitudes.')),
              for (final request in requests)
                Container(
                  margin: const EdgeInsets.only(top: 8),
                  padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
                  decoration: BoxDecoration(color: tokens.cardHigh, borderRadius: BorderRadius.circular(14), border: Border.all(color: tokens.border)),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${request['type']} · ${request['receiptCode']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                          Pill(
                            _statusLabels[request['status']] ?? request['status'] as String,
                            color: switch (request['status']) { 'resuelta' => tokens.accent, 'rechazada' => tokens.streak, 'en_curso' => tokens.info, _ => null },
                            strong: true,
                          ),
                          Text('Plazo: ${formatDateTime(request['dueAt'] as String)}', style: Theme.of(context).textTheme.bodySmall),
                        ]),
                      ]),
                    ),
                    if (request['status'] == 'resuelta' && (request['type'] == 'acceso' || request['type'] == 'exportacion'))
                      TextButton(key: Key('export-${request['id']}'), onPressed: () => _export(context, request), child: const Text('Ver datos')),
                  ]),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Un derecho (acceso, rectificación, oposición, bloqueo, exportación o eliminación): ícono, nombre y qué significa.
class _RightTile extends StatelessWidget {
  const _RightTile({super.key, required this.icon, required this.title, required this.description, required this.onTap, this.danger = false});
  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final color = danger ? tokens.danger : tokens.accent;
    final radius = BorderRadius.circular(14);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Material(
        color: danger ? tokens.danger.withValues(alpha: 0.05) : tokens.cardHigh,
        shape: RoundedRectangleBorder(borderRadius: radius, side: BorderSide(color: danger ? tokens.danger.withValues(alpha: 0.25) : tokens.border)),
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              IconBadge(icon, color: color, size: 40),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: TextStyle(fontWeight: FontWeight.w800, color: danger ? tokens.danger : null)),
                  const SizedBox(height: 2),
                  Text(description, style: TextStyle(fontSize: 13, color: tokens.muted)),
                ]),
              ),
              Icon(Icons.chevron_right, color: tokens.muted),
            ]),
          ),
        ),
      ),
    );
  }
}
