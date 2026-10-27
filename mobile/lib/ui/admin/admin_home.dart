import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import '../notifications_view.dart';

/// Administración: solicitudes de derechos sobre datos (RF009), indicadores del piloto y avisos.
class AdminHome extends StatelessWidget {
  const AdminHome({super.key, required this.api, required this.onLogout});
  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Administración'),
          actions: [AccountMenu(api: api, onLogout: onLogout)],
          bottom: const TabBar(tabs: [Tab(text: 'Solicitudes'), Tab(text: 'Indicadores'), Tab(text: 'Avisos')]),
        ),
        body: SafeArea(
          child: TabBarView(children: [
            _DataRequests(api: api),
            _Kpis(api: api),
            NotificationsView(api: api),
          ]),
        ),
      ),
    );
  }
}

class _DataRequests extends StatelessWidget {
  const _DataRequests({required this.api});
  final ApiClient api;

  Future<void> _resolve(BuildContext context, Map<String, dynamic> request, String action, Future<void> Function() reload) async {
    Map<String, dynamic> body;
    if (action == 'extend') {
      body = {'extend': true};
    } else if (action == 'rechazada') {
      final note = await askText(context, title: 'Fundamento del rechazo', hint: 'Explica el motivo (obligatorio)', confirm: 'Rechazar');
      if (note == null) return;
      body = {'outcome': 'rechazada', 'note': note};
    } else {
      body = {'outcome': 'resuelta'};
    }
    try {
      await api.post('/api/admin/data-requests/${request['id']}/resolve', body);
      await reload();
      if (context.mounted) showMessage(context, action == 'extend' ? 'Prórroga aplicada.' : 'Solicitud actualizada.');
    } on ApiException catch (error) {
      if (context.mounted) showMessage(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Loader<List<Map<String, dynamic>>>(
      load: () async => ((await api.get('/api/admin/data-requests') as Map)['requests'] as List).cast<Map<String, dynamic>>(),
      builder: (context, requests, reload) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (requests.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Text('No hay solicitudes abiertas.', key: Key('no-requests'), textAlign: TextAlign.center)),
          for (final request in requests)
            Card(
              child: ListTile(
                title: Text('${request['type']} · ${request['receiptCode']}'),
                subtitle: Text('${request['email'] ?? 'cuenta eliminada'}\nPlazo: ${formatDateTime(request['dueAt'] as String)}${request['extensionApplied'] == true ? ' (con prórroga)' : ''}'),
                isThreeLine: true,
                trailing: PopupMenuButton<String>(
                  key: Key('actions-${request['id']}'),
                  onSelected: (value) => _resolve(context, request, value, reload),
                  itemBuilder: (context) => [
                    const PopupMenuItem(value: 'resuelta', child: Text('Resolver')),
                    const PopupMenuItem(value: 'rechazada', child: Text('Rechazar con fundamento')),
                    if (request['extensionApplied'] != true && request['type'] != 'bloqueo') const PopupMenuItem(value: 'extend', child: Text('Aplicar prórroga única')),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Kpis extends StatelessWidget {
  const _Kpis({required this.api});
  final ApiClient api;

  static const _titles = {
    'K1': 'K1 · Registro en menos de 5 minutos',
    'K2': 'K2 · Retención en la semana 4',
    'K3': 'K3 · Adherencia',
    'K5': 'K5 · Rutinas con contenido aprobado por el preparador',
  };

  @override
  Widget build(BuildContext context) {
    return Loader<Map<String, dynamic>>(
      load: () async => await api.get('/api/admin/kpis') as Map<String, dynamic>,
      builder: (context, data, reload) {
        final kpis = data['kpis'] as Map<String, dynamic>;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(data['note'] as String, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            for (final entry in _titles.entries)
              SectionCard(title: entry.value, children: [
                Builder(builder: (context) {
                  final kpi = kpis[entry.key] as Map<String, dynamic>;
                  final value = kpi['value'] as num?;
                  return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(value == null ? 'Sin mediciones' : '${(value * 100).round()} %  (${kpi['numerator']} de ${kpi['denominator']})', key: Key('kpi-${entry.key}'), style: Theme.of(context).textTheme.titleMedium),
                    Text(kpi['description'] as String, style: Theme.of(context).textTheme.bodySmall),
                  ]);
                }),
              ]),
            for (final key in ['K6', 'K7'])
              SectionCard(title: key == 'K6' ? 'K6 · Rendimiento' : 'K7 · Disponibilidad', children: [Text((kpis[key] as Map)['description'] as String)]),
          ],
        );
      },
    );
  }
}
