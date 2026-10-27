import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import '../notifications_view.dart';
import 'review_screen.dart';

/// Cola de casos asignados al preparador físico (RF006).
class QueueScreen extends StatelessWidget {
  const QueueScreen({super.key, required this.api, required this.onLogout});
  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Casos para revisar'), actions: [
        IconButton(icon: const Icon(Icons.notifications_outlined), tooltip: 'Avisos', onPressed: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => NotificationsPage(api: api)))),
        AccountMenu(api: api, onLogout: onLogout),
      ]),
      body: SafeArea(
        child: Loader<List<Map<String, dynamic>>>(
          load: () async => ((await api.get('/api/reviews/queue') as Map)['queue'] as List).cast<Map<String, dynamic>>(),
          builder: (context, queue, reload) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (queue.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Text('No tienes casos pendientes de revisión.', key: Key('empty-queue'), textAlign: TextAlign.center)),
              for (final item in queue)
                Card(
                  child: ListTile(
                    key: Key('case-${item['id']}'),
                    title: Text((item['participant'] as Map)['label'] as String),
                    subtitle: Text(_summary(item['participant'] as Map<String, dynamic>)),
                    trailing: StatusChip(item['status'] == 'en_revision' ? 'En revisión' : 'Nuevo'),
                    onTap: () async {
                      final done = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => ReviewScreen(api: api, draftId: item['id'] as String)));
                      if (done == true) await reload();
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  static String _summary(Map<String, dynamic> p) =>
      '${objectiveLabels[p['objective']]} · ${levelLabels[p['level']]} · ${equipmentLabels[p['equipment']]}\n'
      '${(p['days'] as List).length} días · ${p['durationMinutes']} min · ${p['age']} años';
}
