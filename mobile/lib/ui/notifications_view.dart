import 'package:flutter/material.dart';

import '../api/api_client.dart';
import 'common.dart';

/// Avisos internos (RF008): no llevan información sensible y se consultan al abrir o actualizar.
class NotificationsView extends StatelessWidget {
  const NotificationsView({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Loader<Map<String, dynamic>>(
      load: () async => await api.get('/api/notifications/me') as Map<String, dynamic>,
      builder: (context, data, reload) {
        final items = (data['notifications'] as List).cast<Map<String, dynamic>>();
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(child: Text('${data['unread']} sin leer', style: Theme.of(context).textTheme.titleMedium)),
                TextButton(
                  key: const Key('read-all'),
                  onPressed: items.isEmpty ? null : () async {
                    try {
                      await api.post('/api/notifications/read-all');
                      await reload();
                    } on ApiException catch (error) {
                      if (context.mounted) showMessage(context, error.message);
                    }
                  },
                  child: const Text('Marcar todos como leídos'),
                ),
              ],
            ),
            if (items.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('No tienes avisos por ahora.', textAlign: TextAlign.center)),
            for (final item in items)
              Card(
                child: ListTile(
                  leading: Icon(item['read'] == true ? Icons.notifications_none : Icons.notifications_active),
                  title: Text(item['message'] as String, style: TextStyle(fontWeight: item['read'] == true ? FontWeight.normal : FontWeight.w700)),
                  subtitle: Text(formatDateTime(item['createdAt'] as String)),
                  onTap: item['read'] == true ? null : () async {
                    try {
                      await api.post('/api/notifications/${item['id']}/read');
                      await reload();
                    } on ApiException catch (error) {
                      if (context.mounted) showMessage(context, error.message);
                    }
                  },
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Pantalla completa de avisos para los roles que no tienen una pestaña propia.
class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Avisos')), body: NotificationsView(api: api));
}
