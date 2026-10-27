import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import '../notifications_view.dart';
import 'catalog_screen.dart';

/// Nutricionista: aprueba una sola vez los alimentos, las pautas de 7 días y las reglas nutricionales que reciben todas las personas.
class NutritionistHome extends StatelessWidget {
  const NutritionistHome({super.key, required this.api, required this.onLogout});
  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Catálogo nutricional'),
          actions: [
            IconButton(icon: const Icon(Icons.notifications_outlined), tooltip: 'Avisos', onPressed: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => NotificationsPage(api: api)))),
            AccountMenu(api: api, onLogout: onLogout),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'Pautas'), Tab(text: 'Alimentos'), Tab(text: 'Reglas')]),
        ),
        body: SafeArea(
          child: TabBarView(children: [
            _MealPlansTab(api: api),
            _FoodsTab(api: api),
            RulesTab(
              api: api,
              domain: 'nutricion',
              title: 'Reglas nutricionales',
              intro: 'Las reglas fijan los factores de actividad, el porcentaje de déficit o superávit de cada objetivo, el tope del déficit, el mínimo de calorías por sexo y los ajustes de seguridad según el IMC.',
            ),
          ]),
        ),
      ),
    );
  }
}

class _MealPlansTab extends StatelessWidget {
  const _MealPlansTab({required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Loader<List<Map<String, dynamic>>>(
      load: () async => draftsFirst(((await api.get('/api/catalog/meal-plans') as Map)['mealPlans'] as List).cast<Map<String, dynamic>>(), 'name'),
      builder: (context, plans, reload) {
        final pending = plans.where((item) => item['status'] == 'draft').length;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(pending == 0 ? 'No hay pautas pendientes de aprobación.' : '$pending ${pending == 1 ? 'pauta espera' : 'pautas esperan'} tu aprobación.', key: const Key('meal-plans-pending'), style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            for (final plan in plans)
              Card(
                child: ListTile(
                  key: Key('meal-plan-${plan['id']}'),
                  title: Text(plan['name'] as String),
                  subtitle: Text('Versión ${plan['version']} · ${dietLabels[plan['diet']]} · ${formatNumber(plan['referenceKcal'] as num)} kcal de referencia'),
                  trailing: StatusChip(feminineStatus[plan['status']]!, color: statusColor(context, plan['status'] as String)),
                  onTap: () async {
                    final changed = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => MealPlanReviewScreen(api: api, planId: plan['id'] as String)));
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

/// Revisión de una pauta del catálogo: alimentos y gramos de cada comida, macronutrientes y aprobación o retiro.
class MealPlanReviewScreen extends StatelessWidget {
  const MealPlanReviewScreen({super.key, required this.api, required this.planId});
  final ApiClient api;
  final String planId;

  Future<void> _act(BuildContext context, String action, String done) async {
    try {
      await api.post('/api/catalog/meal-plans/$planId/$action');
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
      appBar: AppBar(title: const Text('Pauta del catálogo')),
      body: SafeArea(
        child: Loader<Map<String, dynamic>>(
          load: () async => (await api.get('/api/catalog/meal-plans/$planId') as Map)['mealPlan'] as Map<String, dynamic>,
          builder: (context, plan, reload) {
            final average = plan['weekAverage'] as Map<String, dynamic>;
            final percent = average['percent'] as Map<String, dynamic>;
            final pending = (plan['pendingFoods'] as List).cast<String>();
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(children: [
                  Expanded(child: Text(plan['name'] as String, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
                  StatusChip(feminineStatus[plan['status']]!, color: statusColor(context, plan['status'] as String)),
                ]),
                const SizedBox(height: 4),
                Text(plan['summary'] as String),
                Text('Versión ${plan['version']} · ${dietLabels[plan['diet']]} · promedio ${formatNumber(average['kcal'] as num)} kcal · proteínas ${percent['protein']} %, carbohidratos ${percent['carbs']} %, grasas ${percent['fat']} %', key: const Key('meal-plan-average'), style: Theme.of(context).textTheme.bodySmall),
                if (pending.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text('Alimentos sin aprobar: ${pending.join(', ')}', key: const Key('pending-foods'), style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ),
                const SizedBox(height: 12),
                for (final day in (plan['days'] as List).cast<Map<String, dynamic>>())
                  Card(
                    child: ExpansionTile(
                      key: Key('review-day-${day['dayNo']}'),
                      title: Text('${day['dayLabel']} · ${formatNumber((day['totals'] as Map)['kcal'] as num)} kcal'),
                      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      expandedCrossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final meal in (day['meals'] as List).cast<Map<String, dynamic>>()) ...[
                          Text(meal['label'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                          for (final item in (meal['items'] as List).cast<Map<String, dynamic>>()) Text('${item['name']}: ${formatNumber(item['grams'] as num)} g'),
                          const SizedBox(height: 6),
                        ],
                      ],
                    ),
                  ),
                const SizedBox(height: 8),
                if (plan['status'] == 'draft')
                  FilledButton(key: const Key('approve-meal-plan'), onPressed: () => _act(context, 'approve', 'Pauta aprobada: ya la ven todas las personas.'), child: const Text('Aprobar pauta')),
                if (plan['status'] == 'approved')
                  OutlinedButton(key: const Key('retire-meal-plan'), onPressed: () => _act(context, 'retire', 'Pauta retirada: ya no se ofrece.'), child: const Text('Retirar pauta')),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _FoodsTab extends StatelessWidget {
  const _FoodsTab({required this.api});
  final ApiClient api;

  Future<void> _act(BuildContext context, String id, String action, String done, Future<void> Function() reload) async {
    try {
      await api.post('/api/catalog/foods/$id/$action');
      await reload();
      if (context.mounted) showMessage(context, done);
    } on ApiException catch (error) {
      if (context.mounted) showMessage(context, error.message);
    }
  }

  Future<void> _create(BuildContext context, Future<void> Function() reload) async {
    final fields = {for (final key in ['name', 'code', 'kcal', 'protein', 'carbs', 'fat', 'unitName', 'unitGrams']) key: TextEditingController()};
    var category = 'cereales';
    double? number(String key) => double.tryParse(fields[key]!.text.trim().replaceAll(',', '.'));
    final created = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialog) => AlertDialog(
          title: const Text('Nuevo alimento'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(key: const Key('food-name'), controller: fields['name'], decoration: const InputDecoration(labelText: 'Nombre (con su preparación)')),
              TextField(key: const Key('food-code'), controller: fields['code'], decoration: const InputDecoration(labelText: 'Código (minúsculas y guiones)')),
              DropdownButtonFormField<String>(key: const Key('food-category'), isExpanded: true, initialValue: category, decoration: const InputDecoration(labelText: 'Grupo'), items: [for (final entry in foodCategoryLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))], onChanged: (value) => setDialog(() => category = value!)),
              const SizedBox(height: 8),
              const Align(alignment: Alignment.centerLeft, child: Text('Composición por 100 g', style: TextStyle(fontSize: 12))),
              TextField(key: const Key('food-kcal'), controller: fields['kcal'], keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Energía (kcal)')),
              TextField(key: const Key('food-protein'), controller: fields['protein'], keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Proteínas (g)')),
              TextField(key: const Key('food-carbs'), controller: fields['carbs'], keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Carbohidratos (g)')),
              TextField(key: const Key('food-fat'), controller: fields['fat'], keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Grasas (g)')),
              TextField(key: const Key('food-unit-name'), controller: fields['unitName'], decoration: const InputDecoration(labelText: 'Medida casera (opcional, por ejemplo «taza»)')),
              TextField(key: const Key('food-unit-grams'), controller: fields['unitGrams'], keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Gramos de la medida casera')),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
            FilledButton(
              key: const Key('save-food'),
              onPressed: () async {
                final unitName = fields['unitName']!.text.trim();
                try {
                  await api.post('/api/catalog/foods', {
                    'code': fields['code']!.text.trim(), 'name': fields['name']!.text.trim(), 'category': category,
                    'kcal100g': number('kcal'), 'protein100g': number('protein'), 'carbs100g': number('carbs'), 'fat100g': number('fat'),
                    'unitName': unitName.isEmpty ? null : unitName, 'unitGrams': unitName.isEmpty ? null : number('unitGrams'),
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
      if (context.mounted) showMessage(context, 'Alimento guardado como borrador. Apruébalo para usarlo en las pautas.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Loader<List<Map<String, dynamic>>>(
      load: () async => draftsFirst(((await api.get('/api/catalog/foods') as Map)['foods'] as List).cast<Map<String, dynamic>>(), 'name'),
      builder: (context, foods, reload) => Scaffold(
        backgroundColor: Colors.transparent,
        floatingActionButton: FloatingActionButton.extended(key: const Key('new-food'), onPressed: () => _create(context, reload), icon: const Icon(Icons.add), label: const Text('Nuevo alimento')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
          children: [
            for (final food in foods)
              Card(
                child: ListTile(
                  key: Key('food-${food['id']}'),
                  title: Text(food['name'] as String),
                  subtitle: Text(
                    '${foodCategoryLabels[food['category']]} · por 100 g: ${formatNumber(food['kcal100g'] as num)} kcal · P ${formatNumber(food['protein100g'] as num)} · C ${formatNumber(food['carbs100g'] as num)} · G ${formatNumber(food['fat100g'] as num)}'
                    '${food['unitName'] == null ? '' : '\n1 ${food['unitName']} = ${formatNumber(food['unitGrams'] as num)} g'}',
                  ),
                  isThreeLine: food['unitName'] != null,
                  trailing: switch (food['status']) {
                    'draft' => FilledButton.tonal(key: Key('approve-food-${food['id']}'), onPressed: () => _act(context, food['id'] as String, 'approve', 'Alimento aprobado: ya se puede usar en las pautas.', reload), child: const Text('Aprobar')),
                    'approved' => TextButton(key: Key('retire-food-${food['id']}'), onPressed: () => _act(context, food['id'] as String, 'retire', 'Alimento retirado del catálogo.', reload), child: const Text('Retirar')),
                    _ => StatusChip(masculineStatus[food['status']]!, color: statusColor(context, food['status'] as String)),
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
