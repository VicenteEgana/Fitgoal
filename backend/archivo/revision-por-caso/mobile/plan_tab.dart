import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';

/// Plan del participante: estado de la solicitud, plan aprobado, sesiones y progreso (RF004, RF006, RF007).
class PlanTab extends StatelessWidget {
  const PlanTab({super.key, required this.api, required this.onGoToProfile});
  final ApiClient api;
  final VoidCallback onGoToProfile;

  Future<Map<String, dynamic>> _load() async {
    final results = await Future.wait([
      api.get('/api/drafts/me/status'),
      api.get('/api/plans/me'),
      api.get('/api/sessions/me'),
      api.get('/api/progress/me'),
      api.get('/api/profiles/me'),
    ]);
    return {
      'request': (results[0] as Map)['request'],
      'plan': (results[1] as Map)['plan'],
      'sessions': (results[2] as Map)['sessions'],
      'today': (results[2] as Map)['today'],
      'progress': results[3],
      'profile': (results[4] as Map)['profile'],
    };
  }

  bool _canRequest(Map<String, dynamic>? request, Map<String, dynamic>? profile) {
    if (profile == null) return false;
    if (request == null) return true;
    final status = request['status'];
    if (status == 'rechazado' || status == 'reemplazado') return true;
    return status == 'aprobado' && request['profileVersion'] != profile['version'];
  }

  Future<void> _requestRoutine(BuildContext context, Future<void> Function() reload) async {
    try {
      await api.post('/api/drafts', {'kind': 'rutina'});
      await reload();
      if (context.mounted) showMessage(context, 'Solicitud enviada. Un profesional revisará tu rutina antes de que la veas.');
    } on ApiException catch (error) {
      if (context.mounted) showMessage(context, error.message);
    }
  }

  Future<void> _complete(BuildContext context, Map<String, dynamic> session, bool weightsEnabled, Future<void> Function() reload) async {
    final noteController = TextEditingController();
    final weightController = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Registrar ${session['label']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(key: const Key('session-note'), controller: noteController, maxLength: 200, decoration: const InputDecoration(labelText: 'Nota (opcional)')),
            if (weightsEnabled)
              TextField(
                key: const Key('session-weight'),
                controller: weightController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Peso en kg (opcional)'),
              ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
          FilledButton(key: const Key('session-save'), onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Marcar como realizada')),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final weight = double.tryParse(weightController.text.replaceAll(',', '.'));
    try {
      final result = await api.post('/api/sessions/${session['id']}/complete', {
        if (noteController.text.trim().isNotEmpty) 'note': noteController.text.trim(),
        'weightKg': ?weight,
      }) as Map<String, dynamic>;
      await reload();
      if (context.mounted) showMessage(context, result['weightRejected'] as String? ?? 'Sesión registrada.');
    } on ApiException catch (error) {
      if (context.mounted) showMessage(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Loader<Map<String, dynamic>>(
      load: _load,
      builder: (context, data, reload) {
        final request = data['request'] as Map<String, dynamic>?;
        final plan = data['plan'] as Map<String, dynamic>?;
        final profile = data['profile'] as Map<String, dynamic>?;
        final progress = data['progress'] as Map<String, dynamic>;
        final today = data['today'] as String;
        final sessions = (data['sessions'] as List).cast<Map<String, dynamic>>();
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            SectionCard(
              title: 'Tu solicitud',
              trailing: request == null ? null : StatusChip(_statusLabel(request['status'] as String), color: _statusColor(context, request['status'] as String)),
              children: [
                if (profile == null)
                  const Text('Primero completa tu perfil: objetivo, nivel, días y equipo.')
                else if (request == null)
                  const Text('Aún no solicitaste una rutina.')
                else
                  Text(request['message'] as String, key: const Key('request-message')),
                const SizedBox(height: 12),
                if (profile == null)
                  FilledButton.tonal(key: const Key('go-profile'), onPressed: onGoToProfile, child: const Text('Completar perfil'))
                else if (_canRequest(request, profile))
                  FilledButton(key: const Key('request-routine'), onPressed: () => _requestRoutine(context, reload), child: const Text('Solicitar rutina')),
                if (request != null && request['status'] != 'aprobado')
                  const Padding(padding: EdgeInsets.only(top: 8), child: Text('Por tu seguridad, ves el plan solo cuando un profesional lo aprueba.', style: TextStyle(fontSize: 12))),
              ],
            ),
            SectionCard(
              title: 'Tu plan aprobado',
              trailing: plan == null ? null : StatusChip('Versión ${plan['version']}'),
              children: plan == null
                  ? const [Text('Aún no tienes un plan aprobado.', key: Key('no-plan'))]
                  : [
                      Text((plan['content'] as Map)['title'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      const Row(children: [Icon(Icons.verified, size: 16), SizedBox(width: 6), Expanded(child: Text('Aprobado por un profesional'))]),
                      const SizedBox(height: 8),
                      for (final day in ((plan['content'] as Map)['schedule'] as List).cast<Map<String, dynamic>>())
                        ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          title: Text('${day['dayLabel']} · ${day['label']}'),
                          children: [
                            for (final exercise in (day['exercises'] as List).cast<Map<String, dynamic>>())
                              ListTile(dense: true, title: Text(exercise['name'] as String), subtitle: Text(exercise['prescription'] as String)),
                          ],
                        ),
                    ],
            ),
            SectionCard(
              title: 'Sesiones',
              children: [
                if (sessions.isEmpty) const Text('Cuando se publique tu plan verás aquí tus sesiones.'),
                for (final session in sessions.where((item) => item['planStatus'] == 'vigente'))
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(session['completed'] == true ? Icons.check_circle : Icons.radio_button_unchecked),
                    title: Text(session['label'] as String),
                    subtitle: Text(formatDate(session['plannedDate'] as String)),
                    trailing: session['completed'] == true || (session['plannedDate'] as String).compareTo(today) > 0
                        ? null
                        : FilledButton.tonal(
                            key: Key('complete-${session['id']}'),
                            onPressed: () => _complete(context, session, progress['weightsEnabled'] == true, reload),
                            child: const Text('Registrar'),
                          ),
                  ),
              ],
            ),
            SectionCard(
              title: 'Progreso',
              children: [
                if (progress['adherence'] == null)
                  const Text('Todavía no hay sesiones vencidas para calcular tu adherencia.')
                else ...[
                  Text('Adherencia: ${((progress['adherence'] as num) * 100).round()} %', key: const Key('adherence'), style: Theme.of(context).textTheme.titleMedium),
                  Text('${progress['completed']} de ${progress['planned']} sesiones realizadas. Una sesión sin registro cuenta como no realizada.', style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 8),
                  for (final week in (progress['weeks'] as List).cast<Map<String, dynamic>>())
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(children: [
                        SizedBox(width: 92, child: Text('Sem. ${formatDate(week['weekStart'] as String)}', style: Theme.of(context).textTheme.bodySmall)),
                        Expanded(child: LinearProgressIndicator(value: (week['completed'] as int) / (week['planned'] as int))),
                        const SizedBox(width: 8),
                        Text('${week['completed']}/${week['planned']}'),
                      ]),
                    ),
                ],
                if ((progress['weights'] as List).isNotEmpty) ...[
                  const Divider(),
                  Text('Peso: ${(progress['weights'] as List).last['weightKg']} kg (${(progress['weights'] as List).length} registros)'),
                ],
              ],
            ),
          ],
        );
      },
    );
  }

  static String _statusLabel(String status) => switch (status) {
    'pendiente' => 'Pendiente',
    'borrador' => 'En revisión',
    'en_revision' => 'En revisión',
    'aprobado' => 'Aprobada',
    'rechazado' => 'Requiere ajustes',
    _ => 'Reemplazada',
  };

  static Color _statusColor(BuildContext context, String status) => switch (status) {
    'aprobado' => Colors.green.shade700,
    'rechazado' => Theme.of(context).colorScheme.error,
    'pendiente' => Colors.orange.shade800,
    _ => Theme.of(context).colorScheme.primary,
  };
}
