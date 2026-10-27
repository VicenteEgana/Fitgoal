import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import '../notifications_view.dart';

const feminineStatus = {'draft': 'Borrador', 'approved': 'Aprobada', 'retired': 'Retirada'};
const masculineStatus = {'draft': 'Borrador', 'approved': 'Aprobado', 'retired': 'Retirado'};

Color statusColor(BuildContext context, String status) => switch (status) {
  'approved' => Colors.green.shade700,
  'draft' => Colors.orange.shade800,
  _ => Theme.of(context).disabledColor,
};

/// Catálogo del preparador físico: aprueba una sola vez las rutinas, los ejercicios y las reglas que reciben todas las personas (RF005).
class CatalogScreen extends StatelessWidget {
  const CatalogScreen({super.key, required this.api, required this.onLogout});
  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Catálogo'),
          actions: [
            IconButton(icon: const Icon(Icons.notifications_outlined), tooltip: 'Avisos', onPressed: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => NotificationsPage(api: api)))),
            AccountMenu(api: api, onLogout: onLogout),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'Rutinas'), Tab(text: 'Ejercicios'), Tab(text: 'Reglas')]),
        ),
        body: SafeArea(
          child: TabBarView(children: [
            _TemplatesTab(api: api),
            _ExercisesTab(api: api),
            RulesTab(api: api),
          ]),
        ),
      ),
    );
  }
}

List<Map<String, dynamic>> draftsFirst(List<Map<String, dynamic>> items, String name) {
  final order = {'draft': 0, 'approved': 1, 'retired': 2};
  return [...items]..sort((a, b) => (order[a['status']]! - order[b['status']]!) != 0 ? order[a['status']]! - order[b['status']]! : (a[name] as String).compareTo(b[name] as String));
}

class _TemplatesTab extends StatelessWidget {
  const _TemplatesTab({required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Loader<List<Map<String, dynamic>>>(
      load: () async => draftsFirst(((await api.get('/api/catalog/templates') as Map)['templates'] as List).cast<Map<String, dynamic>>(), 'name'),
      builder: (context, templates, reload) {
        final pending = templates.where((item) => item['status'] == 'draft').length;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(pending == 0 ? 'No hay rutinas pendientes de aprobación.' : '$pending ${pending == 1 ? 'rutina espera' : 'rutinas esperan'} tu aprobación.', key: const Key('templates-pending'), style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            for (final template in templates)
              Card(
                child: ListTile(
                  key: Key('template-${template['id']}'),
                  title: Text(template['name'] as String),
                  subtitle: Text('Versión ${template['version']} · ${splitLabels[template['split']]} · ${objectiveLabels[template['objective']]} · ${bmiCategoryLabels[template['bmiCategory']]}'),
                  trailing: StatusChip(feminineStatus[template['status']]!, color: statusColor(context, template['status'] as String)),
                  onTap: () async {
                    final changed = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => TemplateScreen(api: api, templateId: template['id'] as String)));
                    if (changed == true) await reload();
                  },
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Detalle de una rutina del catálogo, con su aprobación o retiro.
class TemplateScreen extends StatelessWidget {
  const TemplateScreen({super.key, required this.api, required this.templateId});
  final ApiClient api;
  final String templateId;

  Future<void> _act(BuildContext context, String action, String done) async {
    try {
      await api.post('/api/catalog/templates/$templateId/$action');
      if (context.mounted) {
        showMessage(context, done);
        Navigator.pop(context, true);
      }
    } on ApiException catch (error) {
      if (context.mounted) showMessage(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Rutina del catálogo')),
      body: SafeArea(
        child: Loader<Map<String, dynamic>>(
          load: () async => (await api.get('/api/catalog/templates/$templateId') as Map)['template'] as Map<String, dynamic>,
          builder: (context, template, reload) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(children: [
                Expanded(child: Text(template['name'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
                StatusChip(feminineStatus[template['status']]!, color: statusColor(context, template['status'] as String)),
              ]),
              const SizedBox(height: 4),
              Text(template['summary'] as String),
              Text('Versión ${template['version']} · ${splitLabels[template['split']]} · ${levelLabels[template['level']]} · ${equipmentLabels[template['equipment']]} · ${bmiCategoryLabels[template['bmiCategory']]} · ${template['minDays']} a ${template['maxDays']} días · ${template['sessionMinutes']} min · ${template['weeks']} semanas', style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 12),
              for (final session in (template['sessions'] as List).cast<Map<String, dynamic>>())
                SectionCard(
                  title: 'Sesión ${session['sessionNo']} · ${session['label']}',
                  children: [
                    for (final exercise in (session['exercises'] as List).cast<Map<String, dynamic>>())
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text(exercise['name'] as String),
                        subtitle: Text('${exercise['prescription']}${exercise['status'] == 'approved' ? '' : ' · ejercicio sin aprobar'}'),
                      ),
                  ],
                ),
              if (template['status'] == 'draft')
                FilledButton(key: const Key('approve-template'), onPressed: () => _act(context, 'approve', 'Rutina aprobada: ya la ven todas las personas.'), child: const Text('Aprobar rutina')),
              if (template['status'] == 'approved')
                OutlinedButton(key: const Key('retire-template'), onPressed: () => _act(context, 'retire', 'Rutina retirada: ya no se ofrece. Las rutinas ya iniciadas se conservan.'), child: const Text('Retirar rutina')),
            ],
          ),
        ),
      ),
    );
  }
}

class _ExercisesTab extends StatelessWidget {
  const _ExercisesTab({required this.api});
  final ApiClient api;

  Future<void> _act(BuildContext context, String id, String action, String done, Future<void> Function() reload) async {
    try {
      await api.post('/api/catalog/exercises/$id/$action');
      await reload();
      if (context.mounted) showMessage(context, done);
    } on ApiException catch (error) {
      if (context.mounted) showMessage(context, error.message);
    }
  }

  Future<void> _create(BuildContext context, Future<void> Function() reload) async {
    final code = TextEditingController();
    final name = TextEditingController();
    final description = TextEditingController();
    final prescription = TextEditingController();
    var group = 'piernas';
    var level = 'principiante';
    var equipment = false;
    var highImpact = false;
    final created = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialog) => AlertDialog(
          title: const Text('Nuevo ejercicio'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(key: const Key('exercise-name'), controller: name, decoration: const InputDecoration(labelText: 'Nombre')),
              TextField(key: const Key('exercise-code'), controller: code, decoration: const InputDecoration(labelText: 'Código (minúsculas y guiones)')),
              TextField(key: const Key('exercise-description'), controller: description, maxLines: 3, decoration: const InputDecoration(labelText: 'Descripción de la ejecución')),
              TextField(key: const Key('exercise-prescription'), controller: prescription, decoration: const InputDecoration(labelText: 'Indicación sugerida')),
              DropdownButtonFormField<String>(key: const Key('exercise-group'), isExpanded: true, initialValue: group, decoration: const InputDecoration(labelText: 'Grupo'), items: [for (final entry in muscleGroupLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))], onChanged: (value) => setDialog(() => group = value!)),
              DropdownButtonFormField<String>(key: const Key('exercise-level'), isExpanded: true, initialValue: level, decoration: const InputDecoration(labelText: 'Nivel mínimo'), items: [for (final entry in levelLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))], onChanged: (value) => setDialog(() => level = value!)),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Requiere equipo'), value: equipment, onChanged: (value) => setDialog(() => equipment = value)),
              SwitchListTile(key: const Key('exercise-impact'), contentPadding: EdgeInsets.zero, title: const Text('Alto impacto (saltos, trote)'), subtitle: const Text('No se sugiere con sobrepeso u obesidad.'), value: highImpact, onChanged: (value) => setDialog(() => highImpact = value)),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
            FilledButton(
              key: const Key('save-exercise'),
              onPressed: () async {
                try {
                  await api.post('/api/catalog/exercises', {
                    'code': code.text.trim(), 'name': name.text.trim(), 'description': description.text.trim(),
                    'muscleGroup': group, 'minLevel': level, 'requiresEquipment': equipment, 'highImpact': highImpact, 'defaultPrescription': prescription.text.trim(),
                  });
                  if (dialogContext.mounted) Navigator.pop(dialogContext, true);
                } on ApiException catch (error) {
                  if (dialogContext.mounted) showMessage(dialogContext, error.message);
                }
              },
              child: const Text('Guardar borrador'),
            ),
          ],
        ),
      ),
    );
    if (created == true) {
      await reload();
      if (context.mounted) showMessage(context, 'Ejercicio guardado como borrador. Apruébalo para publicarlo.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Loader<List<Map<String, dynamic>>>(
      load: () async => draftsFirst(((await api.get('/api/catalog/exercises') as Map)['exercises'] as List).cast<Map<String, dynamic>>(), 'name'),
      builder: (context, exercises, reload) => Scaffold(
        backgroundColor: Colors.transparent,
        floatingActionButton: FloatingActionButton.extended(key: const Key('new-exercise'), onPressed: () => _create(context, reload), icon: const Icon(Icons.add), label: const Text('Nuevo ejercicio')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
          children: [
            for (final exercise in exercises)
              Card(
                child: ListTile(
                  key: Key('exercise-${exercise['id']}'),
                  title: Text(exercise['name'] as String),
                  subtitle: Text('${muscleGroupLabels[exercise['muscleGroup']]} · ${levelLabels[exercise['minLevel']]}${exercise['requiresEquipment'] == true ? ' · con equipo' : ''}${exercise['highImpact'] == true ? ' · alto impacto' : ''}\n${exercise['defaultPrescription']}'),
                  isThreeLine: true,
                  trailing: switch (exercise['status']) {
                    'draft' => FilledButton.tonal(key: Key('approve-exercise-${exercise['id']}'), onPressed: () => _act(context, exercise['id'] as String, 'approve', 'Ejercicio aprobado: ya está en la biblioteca.', reload), child: const Text('Aprobar')),
                    'approved' => TextButton(key: Key('retire-exercise-${exercise['id']}'), onPressed: () => _act(context, exercise['id'] as String, 'retire', 'Ejercicio retirado de la biblioteca.', reload), child: const Text('Retirar')),
                    _ => StatusChip(masculineStatus[exercise['status']]!, color: statusColor(context, exercise['status'] as String)),
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Versiones de reglas de un ámbito (entrenamiento o nutrición), con la aprobación de las que están en borrador.
class RulesTab extends StatelessWidget {
  const RulesTab({
    super.key,
    required this.api,
    this.domain = 'entrenamiento',
    this.title = 'Reglas de entrenamiento',
    this.intro = 'Las reglas indican qué rutina se recomienda para cada objetivo, nivel, equipo y categoría de IMC, qué división de la semana corresponde según el nivel y los días, y qué grupos de ejercicios se sugieren a quien arma la suya.',
  });
  final ApiClient api;
  final String domain;
  final String title;
  final String intro;

  @override
  Widget build(BuildContext context) {
    return Loader<List<Map<String, dynamic>>>(
      load: () async => ((await api.get('/api/catalog/rules') as Map)['rules'] as List).cast<Map<String, dynamic>>().where((rule) => rule['domain'] == domain).toList(),
      builder: (context, rules, reload) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(intro, style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 8),
          for (final rule in rules)
            Card(
              child: ListTile(
                key: Key('rules-${rule['id']}'),
                title: Text('$title · versión ${rule['version']}'),
                subtitle: Text(rule['changeNote'] as String? ?? 'Sin nota de cambio'),
                trailing: rule['status'] == 'draft'
                    ? FilledButton.tonal(
                        key: Key('approve-rules-${rule['id']}'),
                        onPressed: () async {
                          try {
                            await api.post('/api/catalog/rules/${rule['id']}/approve');
                            await reload();
                            if (context.mounted) showMessage(context, 'Reglas aprobadas: ya orientan las recomendaciones.');
                          } on ApiException catch (error) {
                            if (context.mounted) showMessage(context, error.message);
                          }
                        },
                        child: const Text('Aprobar'),
                      )
                    : StatusChip(feminineStatus[rule['status']]!, color: statusColor(context, rule['status'] as String)),
              ),
            ),
        ],
      ),
    );
  }
}
