import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';

/// Alimentación: pautas de 7 días aprobadas por la nutricionista, con los gramos ajustados a las calorías del objetivo
/// (déficit, mantenimiento o superávit) cuando la persona dio sus datos y consentimientos (RF005).
class NutritionTab extends StatefulWidget {
  const NutritionTab({super.key, required this.api, required this.onGoToProfile});
  final ApiClient api;
  final VoidCallback onGoToProfile;

  @override
  State<NutritionTab> createState() => _NutritionTabState();
}

class _NutritionTabState extends State<NutritionTab> {
  String? _diet;
  int _day = DateTime.now().weekday;

  @override
  Widget build(BuildContext context) {
    return Loader<Map<String, dynamic>>(
      load: () async => await widget.api.get('/api/meal-plans') as Map<String, dynamic>,
      builder: (context, data, reload) {
        final plans = (data['plans'] as List).cast<Map<String, dynamic>>();
        final target = data['target'] as Map<String, dynamic>?;
        final notices = (data['notices'] as List).cast<Map<String, dynamic>>();
        if (plans.isEmpty) return ListView(padding: const EdgeInsets.all(16), children: const [Text('Aún no hay pautas aprobadas por la nutricionista.', key: Key('no-meal-plans'))]);
        final selected = plans.firstWhere((plan) => plan['diet'] == _diet, orElse: () => plans.first);
        final average = selected['average'] as Map<String, dynamic>;
        final percent = average['percent'] as Map<String, dynamic>;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            SectionCard(
              title: 'Tus calorías',
              children: [
                if (target != null) ...[
                  Text('${_capitalize(target['label'] as String)}: ${formatNumber(target['targetKcal'] as num)} kcal al día', key: const Key('nutrition-target'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 4),
                  Text(
                    'Mantenimiento estimado: ${formatNumber(target['maintenanceKcal'] as num)} kcal (Mifflin-St Jeor × ${formatNumber(target['activityFactor'] as num)})'
                    '${(target['adjustmentPercent'] as num) == 0 ? '' : ' · ${(target['adjustmentPercent'] as num) > 0 ? '+' : ''}${target['adjustmentPercent']} %'}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ] else ...[
                  Text('Porciones de referencia: ${formatNumber(selected['referenceKcal'] as num)} kcal al día', key: const Key('nutrition-reference'), style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (data['objectiveLabel'] != null) Text('Tu objetivo es ${data['objectiveLabel']}: con tus datos ajustamos los gramos a tus calorías.', style: Theme.of(context).textTheme.bodySmall),
                  Align(alignment: Alignment.centerLeft, child: TextButton(key: const Key('go-profile-nutrition'), onPressed: widget.onGoToProfile, child: const Text('Completar mis datos'))),
                ],
                for (final notice in notices)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Padding(padding: EdgeInsets.only(top: 2, right: 6), child: Icon(Icons.info_outline, size: 16)),
                      Expanded(child: Text(notice['text'] as String, key: Key('nutrition-notice-${notice['code']}'), style: Theme.of(context).textTheme.bodySmall)),
                    ]),
                  ),
              ],
            ),
            Text('Elige tu dieta', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            Wrap(spacing: 8, runSpacing: 4, children: [
              for (final plan in plans)
                ChoiceChip(key: Key('diet-${plan['diet']}'), label: Text(dietLabels[plan['diet']] ?? plan['name'] as String), selected: plan['id'] == selected['id'], onSelected: (_) => setState(() => _diet = plan['diet'] as String)),
            ]),
            const SizedBox(height: 8),
            Text(selected['summary'] as String, key: const Key('diet-summary')),
            const SizedBox(height: 4),
            Text('Proteínas ${percent['protein']} % · Carbohidratos ${percent['carbs']} % · Grasas ${percent['fat']} % de la energía', key: const Key('diet-macros'), style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 12),
            _MealPlanDays(key: ValueKey(selected['id']), api: widget.api, planId: selected['id'] as String, day: _day, onDay: (day) => setState(() => _day = day)),
            const SizedBox(height: 8),
            Text(data['disclaimer'] as String, key: const Key('nutrition-disclaimer'), style: const TextStyle(fontSize: 12)),
          ],
        );
      },
    );
  }

  static String _capitalize(String text) => text.isEmpty ? text : '${text[0].toUpperCase()}${text.substring(1)}';
}

/// Los 7 días de la pauta elegida: comidas con alimentos, gramos, medida casera y macronutrientes. Tocar un alimento permite
/// cambiarlo por otro equivalente si no lo tienes.
class _MealPlanDays extends StatefulWidget {
  const _MealPlanDays({super.key, required this.api, required this.planId, required this.day, required this.onDay});
  final ApiClient api;
  final String planId;
  final int day;
  final ValueChanged<int> onDay;

  @override
  State<_MealPlanDays> createState() => _MealPlanDaysState();
}

class _MealPlanDaysState extends State<_MealPlanDays> {
  // Se carga una vez por pauta: cambiar de día no vuelve a consultar la API. Un cambio de alimento devuelve la pauta actualizada.
  late Future<Object?> _detail = widget.api.get('/api/meal-plans/${widget.planId}');

  static String _macros(Map<String, dynamic> totals) => 'P ${totals['protein']} g · C ${totals['carbs']} g · G ${totals['fat']} g';

  void _show(Map<String, dynamic> detail, String message) {
    setState(() {
      _detail = Future.value(detail);
    });
    showMessage(context, message);
  }

  Future<void> _swap(Map<String, dynamic> day, Map<String, dynamic> meal, Map<String, dynamic> item) async {
    final result = await showModalBottomSheet<({Map<String, dynamic> detail, String message})>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => _SwapSheet(api: widget.api, planId: widget.planId, dayNo: day['dayNo'] as int, meal: meal['meal'] as String, position: item['position'] as int),
    );
    if (result != null && mounted) _show(result.detail, result.message);
  }

  Future<void> _undoAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Volver a la pauta original'),
        content: const Text('Se deshacen todos los alimentos que cambiaste en esta pauta, en los 7 días.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
          FilledButton(key: const Key('confirm-undo-swaps'), onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Deshacer cambios')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      final detail = await widget.api.delete('/api/meal-plans/${widget.planId}/swaps') as Map<String, dynamic>;
      if (mounted) _show(detail, 'Volviste a la pauta original.');
    } on ApiException catch (error) {
      if (mounted) showMessage(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final day = widget.day;
    final onDay = widget.onDay;
    final scheme = Theme.of(context).colorScheme;
    return FutureBuilder<Object?>(
      future: _detail,
      builder: (context, snapshot) {
        if (snapshot.hasError) return Text(errorText(snapshot.error!), style: TextStyle(color: scheme.error));
        if (!snapshot.hasData) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(key: Key('meal-plan-loading'))));
        final detail = snapshot.data as Map<String, dynamic>;
        final days = (detail['days'] as List).cast<Map<String, dynamic>>();
        final current = days.firstWhere((item) => item['dayNo'] == day, orElse: () => days.first);
        final totals = current['totals'] as Map<String, dynamic>;
        final swaps = detail['swaps'] as int? ?? 0;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(spacing: 6, children: [
              for (final item in days)
                ChoiceChip(key: Key('meal-day-${item['dayNo']}'), label: Text(dayInitials[(item['dayNo'] as int) - 1]), tooltip: item['dayLabel'] as String, selected: item['dayNo'] == current['dayNo'], onSelected: (_) => onDay(item['dayNo'] as int)),
            ]),
            const SizedBox(height: 8),
            Text('${current['dayLabel']}: ${formatNumber(totals['kcal'] as num)} kcal · ${_macros(totals)}', key: const Key('meal-day-totals'), style: const TextStyle(fontWeight: FontWeight.w600)),
            const HintLine('¿No tienes un alimento? Tócalo y cámbialo por otro equivalente aprobado por la nutricionista.', icon: Icons.swap_horiz),
            if (swaps > 0)
              Row(children: [
                Expanded(child: Text('Cambiaste ${swaps == 1 ? '1 alimento' : '$swaps alimentos'} de esta pauta.', key: const Key('swaps-count'), style: Theme.of(context).textTheme.bodySmall)),
                TextButton(key: const Key('undo-swaps'), onPressed: _undoAll, child: const Text('Volver a la original')),
              ]),
            const SizedBox(height: 8),
            for (final meal in (current['meals'] as List).cast<Map<String, dynamic>>())
              SectionCard(
                title: '${meal['label']} · ${formatNumber((meal['totals'] as Map)['kcal'] as num)} kcal',
                children: [
                  for (final item in (meal['items'] as List).cast<Map<String, dynamic>>())
                    InkWell(
                      key: Key('meal-swap-${meal['meal']}-${item['position']}'),
                      borderRadius: BorderRadius.circular(8),
                      onTap: () => _swap(current, meal, item),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(item['name'] as String),
                              if (item['swappedFrom'] != null)
                                Text('En vez de ${((item['swappedFrom'] as Map)['name'] as String).toLowerCase()}', key: Key('meal-swapped-${meal['meal']}-${item['position']}'), style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: scheme.primary)),
                            ]),
                          ),
                          const SizedBox(width: 8),
                          Text('${formatNumber(item['grams'] as num)} g${item['household'] == null ? '' : '\n${item['household']}'}', key: Key('meal-item-${meal['meal']}-${item['code']}'), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(width: 6),
                          Icon(Icons.swap_horiz, size: 18, color: item['swappedFrom'] != null ? scheme.primary : scheme.outline),
                        ]),
                      ),
                    ),
                  const Divider(height: 12),
                  Text(_macros((meal['totals'] as Map).cast<String, dynamic>()), style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
          ],
        );
      },
    );
  }
}

/// Cambiar un alimento de la pauta: opciones aprobadas del mismo grupo de esa pauta, con los gramos que aportan la misma energía.
class _SwapSheet extends StatefulWidget {
  const _SwapSheet({required this.api, required this.planId, required this.dayNo, required this.meal, required this.position});
  final ApiClient api;
  final String planId;
  final int dayNo;
  final String meal;
  final int position;

  @override
  State<_SwapSheet> createState() => _SwapSheetState();
}

class _SwapSheetState extends State<_SwapSheet> {
  late final Future<Object?> _options = widget.api.get('/api/meal-plans/${widget.planId}/alternatives?dayNo=${widget.dayNo}&meal=${widget.meal}&position=${widget.position}');
  bool _wholeWeek = false;
  bool _busy = false;
  String? _error;

  static String _amount(Map<String, dynamic> food) => '${formatNumber(food['grams'] as num)} g${food['household'] == null ? '' : ' (${food['household']})'}';

  Future<void> _choose(String food, String Function(int changed) message) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final detail = await widget.api.put('/api/meal-plans/${widget.planId}/swaps', {'dayNo': widget.dayNo, 'meal': widget.meal, 'position': widget.position, 'food': food, 'wholeWeek': _wholeWeek}) as Map<String, dynamic>;
      if (mounted) Navigator.pop(context, (detail: detail, message: message(detail['changed'] as int? ?? 1)));
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = error.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: FutureBuilder<Object?>(
        future: _options,
        builder: (context, snapshot) {
          if (snapshot.hasError) return Padding(padding: const EdgeInsets.all(24), child: Text(errorText(snapshot.error!), style: TextStyle(color: scheme.error)));
          if (!snapshot.hasData) return const SizedBox(height: 160, child: Center(child: CircularProgressIndicator(key: Key('swap-loading'))));
          final data = snapshot.data as Map<String, dynamic>;
          final item = data['item'] as Map<String, dynamic>;
          final current = item['current'] as Map<String, dynamic>;
          final original = item['original'] as Map<String, dynamic>?;
          final alternatives = (data['alternatives'] as List).cast<Map<String, dynamic>>();
          final sameFood = data['sameFoodCount'] as int;
          final name = (current['name'] as String).toLowerCase();
          return ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.85),
            child: ListView(
              key: const Key('swap-sheet'),
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              children: [
                Text('Cambiar ${current['name']}', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                Text('${item['dayLabel']} · ${item['mealLabel']} · ${_amount(current)}', style: text.bodySmall),
                const SizedBox(height: 8),
                Text(
                  'Opciones aprobadas por la nutricionista para esta dieta, del grupo ${(foodCategoryLabels[item['category']] ?? item['category'] as String).toLowerCase()}. '
                  '${item['category'] == 'verduras' ? 'Las verduras se cambian por la misma cantidad.' : 'Las cantidades aportan una energía parecida (lo que va por unidad se redondea) y el resto del día se ajusta para mantener tus calorías.'}',
                  style: text.bodySmall,
                ),
                if (sameFood > 1)
                  SwitchListTile(
                    key: const Key('swap-whole-week'),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Cambiarlo en toda la semana'),
                    subtitle: Text('${original?['name'] ?? current['name']} aparece en $sameFood comidas de esta pauta.'),
                    value: _wholeWeek,
                    onChanged: _busy ? null : (value) => setState(() => _wholeWeek = value),
                  ),
                if (original != null)
                  ListTile(
                    key: const Key('swap-restore'),
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.undo),
                    title: Text('Volver a ${(original['name'] as String).toLowerCase()}'),
                    subtitle: Text('El alimento de la pauta · ${_amount(original)}'),
                    enabled: !_busy,
                    onTap: () => _choose(original['code'] as String, (changed) => changed > 1 ? 'Volviste a ${(original['name'] as String).toLowerCase()} en $changed comidas.' : 'Volviste a ${(original['name'] as String).toLowerCase()}.'),
                  ),
                const Divider(),
                if (alternatives.isEmpty)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Esta pauta no tiene otro alimento de ese grupo para esta comida.', key: Key('swap-none'))),
                for (final option in alternatives)
                  ListTile(
                    key: Key('swap-option-${option['code']}'),
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(option['code'] == current['code'] ? Icons.check_circle : Icons.restaurant_outlined, color: option['code'] == current['code'] ? scheme.primary : null),
                    title: Text(option['name'] as String),
                    subtitle: Text('${option['usual'] == true ? 'Habitual en esta comida · ' : ''}${_amount(option)}\n${option['kcal']} kcal · P ${option['protein']} g · C ${option['carbs']} g · G ${option['fat']} g'),
                    isThreeLine: true,
                    enabled: !_busy && option['code'] != current['code'],
                    onTap: () => _choose(option['code'] as String, (changed) => changed > 1 ? '${option['name']} en vez de $name en $changed comidas.' : '${option['name']} en vez de $name.'),
                  ),
                if (_error != null) Text(_error!, key: const Key('swap-error'), style: TextStyle(color: scheme.error)),
              ],
            ),
          );
        },
      ),
    );
  }
}
