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
        final tokens = FitTokens.of(context);
        final goalKcal = (target?['targetKcal'] ?? selected['referenceKcal']) as num;
        final calories = FitCard(
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            IconBadge(Icons.local_fire_department_outlined, color: tokens.streak, size: 44),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Tus calorías', style: TextStyle(color: tokens.muted, fontWeight: FontWeight.w700, fontSize: 12.5, letterSpacing: 0.3)),
                const SizedBox(height: 4),
                if (target != null) ...[
                  Text('${_capitalize(target['label'] as String)}: ${formatNumber(target['targetKcal'] as num)} kcal al día', key: const Key('nutrition-target'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20, letterSpacing: -0.4, fontFeatures: tabularFigures)),
                  const SizedBox(height: 4),
                  Text(
                    'Mantenimiento estimado: ${formatNumber(target['maintenanceKcal'] as num)} kcal (Mifflin-St Jeor × ${formatNumber(target['activityFactor'] as num)})'
                    '${(target['adjustmentPercent'] as num) == 0 ? '' : ' · ${(target['adjustmentPercent'] as num) > 0 ? '+' : ''}${target['adjustmentPercent']} %'}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ] else ...[
                  Text('Porciones de referencia: ${formatNumber(selected['referenceKcal'] as num)} kcal al día', key: const Key('nutrition-reference'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, letterSpacing: -0.3)),
                  if (data['objectiveLabel'] != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Tu objetivo es ${data['objectiveLabel']}: con tus datos ajustamos los gramos a tus calorías.', style: Theme.of(context).textTheme.bodySmall)),
                  Align(alignment: Alignment.centerLeft, child: TextButton.icon(key: const Key('go-profile-nutrition'), onPressed: widget.onGoToProfile, icon: const Icon(Icons.tune, size: 18), label: const Text('Completar mis datos'))),
                ],
                for (final notice in notices)
                  Callout(child: Text(notice['text'] as String, key: Key('nutrition-notice-${notice['code']}'))),
              ]),
            ),
          ]),
        );
        final diets = FitCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Elige tu dieta', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final plan in plans)
                ChoiceChip(
                  key: Key('diet-${plan['diet']}'),
                  avatar: Icon(_dietIcons[plan['diet']] ?? Icons.restaurant, size: 16),
                  showCheckmark: false,
                  label: Text(dietLabels[plan['diet']] ?? plan['name'] as String),
                  selected: plan['id'] == selected['id'],
                  onSelected: (_) => setState(() => _diet = plan['diet'] as String),
                ),
            ]),
            const SizedBox(height: 12),
            Text(selected['summary'] as String, key: const Key('diet-summary'), style: const TextStyle(height: 1.4)),
            const SizedBox(height: 6),
            Text('Proteínas ${percent['protein']} % · Carbohidratos ${percent['carbs']} % · Grasas ${percent['fat']} % de la energía', key: const Key('diet-macros'), style: Theme.of(context).textTheme.bodySmall),
          ]),
        );
        return PageList(
          children: [
            BentoColumns(primaryFlex: 5, secondaryFlex: 7, breakpoint: 900, primary: [calories], secondary: [diets]),
            _MealPlanDays(key: ValueKey(selected['id']), api: widget.api, planId: selected['id'] as String, day: _day, goalKcal: goalKcal, onDay: (day) => setState(() => _day = day)),
            const SizedBox(height: 8),
            Text(data['disclaimer'] as String, key: const Key('nutrition-disclaimer'), style: Theme.of(context).textTheme.bodySmall),
          ],
        );
      },
    );
  }

  static const _dietIcons = {'mediterranea': Icons.set_meal_outlined, 'alta_proteina': Icons.egg_alt_outlined, 'baja_carbohidratos': Icons.grass, 'vegetariana': Icons.eco_outlined};

  static String _capitalize(String text) => text.isEmpty ? text : '${text[0].toUpperCase()}${text.substring(1)}';
}

/// Los 7 días de la pauta elegida: comidas con alimentos, gramos, medida casera y macronutrientes. Tocar un alimento permite
/// cambiarlo por otro equivalente si no lo tienes.
class _MealPlanDays extends StatefulWidget {
  const _MealPlanDays({super.key, required this.api, required this.planId, required this.day, required this.goalKcal, required this.onDay});
  final ApiClient api;
  final String planId;
  final int day;
  /// Calorías del objetivo (o de las porciones de referencia), para comparar el total del día.
  final num goalKcal;
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

  static const _mealIcons = {
    'desayuno': Icons.free_breakfast_outlined,
    'colacion': Icons.apple,
    'almuerzo': Icons.lunch_dining_outlined,
    'once': Icons.coffee_outlined,
    'cena': Icons.dinner_dining_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final day = widget.day;
    final onDay = widget.onDay;
    final scheme = Theme.of(context).colorScheme;
    final tokens = FitTokens.of(context);
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
        final meals = (current['meals'] as List).cast<Map<String, dynamic>>();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Días de la semana: un selector horizontal de siete botones iguales.
            Row(children: [
              for (final item in days)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: _DayButton(
                      key: Key('meal-day-${item['dayNo']}'),
                      label: dayInitials[(item['dayNo'] as int) - 1],
                      tooltip: item['dayLabel'] as String,
                      selected: item['dayNo'] == current['dayNo'],
                      onTap: () => onDay(item['dayNo'] as int),
                    ),
                  ),
                ),
            ]),
            const SizedBox(height: 16),
            _NutritionPanel(dayLabel: current['dayLabel'] as String, totals: totals, goalKcal: widget.goalKcal, totalsText: Text('${current['dayLabel']}: ${formatNumber(totals['kcal'] as num)} kcal · ${_macros(totals)}', key: const Key('meal-day-totals'), style: Theme.of(context).textTheme.bodySmall)),
            const HintLine('¿No tienes un alimento? Tócalo y cámbialo por otro equivalente aprobado por la nutricionista.', icon: Icons.swap_horiz),
            if (swaps > 0)
              Callout(
                icon: Icons.swap_horiz,
                color: tokens.accent,
                child: Row(children: [
                  Expanded(child: Text('Cambiaste ${swaps == 1 ? '1 alimento' : '$swaps alimentos'} de esta pauta.', key: const Key('swaps-count'))),
                  TextButton(key: const Key('undo-swaps'), onPressed: _undoAll, child: const Text('Volver a la original')),
                ]),
              ),
            const SizedBox(height: 16),
            ResponsiveGrid(
              minItemWidth: 380,
              children: [
                for (final meal in meals)
                  FitCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        IconBadge(_mealIcons[meal['meal']] ?? Icons.restaurant, color: tokens.carbs, size: 36),
                        const SizedBox(width: 12),
                        Expanded(child: Text(meal['label'] as String, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, letterSpacing: -0.2))),
                        Pill('${formatNumber((meal['totals'] as Map)['kcal'] as num)} kcal', color: tokens.accent, strong: true),
                      ]),
                      const SizedBox(height: 10),
                      for (final item in (meal['items'] as List).cast<Map<String, dynamic>>())
                        _FoodRow(
                          key: Key('meal-swap-${meal['meal']}-${item['position']}'),
                          meal: meal['meal'] as String,
                          item: item,
                          onTap: () => _swap(current, meal, item),
                        ),
                      Divider(height: 20, color: tokens.border),
                      Wrap(spacing: 6, runSpacing: 6, children: [
                        Pill('P ${(meal['totals'] as Map)['protein']} g', color: tokens.protein),
                        Pill('C ${(meal['totals'] as Map)['carbs']} g', color: tokens.carbs),
                        Pill('G ${(meal['totals'] as Map)['fat']} g', color: tokens.fat),
                      ]),
                    ]),
                  ),
              ],
            ),
          ],
        );
      },
    );
  }
}

/// Un día en el selector de la pauta.
class _DayButton extends StatelessWidget {
  const _DayButton({super.key, required this.label, required this.tooltip, required this.selected, required this.onTap});
  final String label;
  final String tooltip;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = FitTokens.of(context);
    final radius = BorderRadius.circular(12);
    return Tooltip(
      message: tooltip,
      child: Semantics(
        button: true,
        selected: selected,
        label: tooltip,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: 44,
          decoration: BoxDecoration(
            color: selected ? scheme.primary : tokens.card,
            borderRadius: radius,
            border: Border.all(color: selected ? Colors.transparent : tokens.border),
            boxShadow: [if (selected) BoxShadow(color: scheme.primary.withValues(alpha: 0.35), blurRadius: 14, spreadRadius: -4, offset: const Offset(0, 4))],
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              borderRadius: radius,
              onTap: onTap,
              child: Center(child: Text(label, style: TextStyle(fontWeight: FontWeight.w800, color: selected ? scheme.onPrimary : tokens.muted))),
            ),
          ),
        ),
      ),
    );
  }
}

/// Panel del día: calorías frente al objetivo y una barra por macronutriente, con su color.
class _NutritionPanel extends StatelessWidget {
  const _NutritionPanel({required this.dayLabel, required this.totals, required this.goalKcal, required this.totalsText});
  final String dayLabel;
  final Map<String, dynamic> totals;
  final num goalKcal;
  final Widget totalsText;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final kcal = totals['kcal'] as num;
    final percent = (totals['percent'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    int share(String key, int factor) => (percent[key] as num?)?.round() ?? (kcal > 0 ? ((totals[key] as num) * factor * 100 / kcal).round() : 0);
    final macros = [
      (label: 'Proteínas', grams: totals['protein'] as num, share: share('protein', 4), color: tokens.protein, icon: Icons.egg_outlined),
      (label: 'Carbohidratos', grams: totals['carbs'] as num, share: share('carbs', 4), color: tokens.carbs, icon: Icons.bakery_dining_outlined),
      (label: 'Grasas', grams: totals['fat'] as num, share: share('fat', 9), color: tokens.fat, icon: Icons.water_drop_outlined),
    ];
    final ring = SizedBox(
      width: 132,
      height: 132,
      child: Stack(fit: StackFit.expand, children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: goalKcal > 0 ? (kcal / goalKcal).clamp(0.0, 1.0).toDouble() : 0),
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeOutCubic,
          builder: (context, value, _) => CircularProgressIndicator(value: value, strokeWidth: 10, strokeCap: StrokeCap.round, backgroundColor: tokens.border, color: Theme.of(context).colorScheme.primary),
        ),
        Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(formatNumber(kcal), style: const TextStyle(fontSize: 28, height: 1, fontWeight: FontWeight.w800, letterSpacing: -1, fontFeatures: tabularFigures)),
            const SizedBox(height: 4),
            Text('de ${formatNumber(goalKcal)} kcal', style: TextStyle(fontSize: 11.5, color: tokens.muted, fontWeight: FontWeight.w600)),
          ]),
        ),
      ]),
    );
    final bars = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final macro in macros)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(macro.icon, size: 16, color: macro.color),
              const SizedBox(width: 6),
              Expanded(child: Text(macro.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5))),
              Text('${formatNumber(macro.grams)} g · ${macro.share} %', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: macro.color, fontFeatures: tabularFigures)),
            ]),
            const SizedBox(height: 6),
            MeterBar(value: macro.share / 100, color: macro.color),
          ]),
        ),
    ]);
    return FitCard(
      hero: true,
      child: LayoutBuilder(builder: (context, constraints) {
        final heading = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(dayLabel, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          totalsText,
        ]);
        if (constraints.maxWidth < 520) {
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [ring, const SizedBox(width: 16), Expanded(child: heading)]),
            const SizedBox(height: 16),
            bars,
          ]);
        }
        return Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          ring,
          const SizedBox(width: 28),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [heading, const SizedBox(height: 14), bars])),
        ]);
      }),
    );
  }
}

/// Un alimento de la comida: se nota que se puede tocar para cambiarlo. Muestra los gramos y la medida casera.
class _FoodRow extends StatefulWidget {
  const _FoodRow({super.key, required this.meal, required this.item, required this.onTap});
  final String meal;
  final Map<String, dynamic> item;
  final VoidCallback onTap;

  @override
  State<_FoodRow> createState() => _FoodRowState();
}

class _FoodRowState extends State<_FoodRow> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final scheme = Theme.of(context).colorScheme;
    final item = widget.item;
    final swapped = item['swappedFrom'] != null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: widget.onTap,
        onHover: (value) => setState(() => _hover = value),
        hoverColor: scheme.onSurface.withValues(alpha: 0.05),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(item['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                if (swapped)
                  Text('En vez de ${((item['swappedFrom'] as Map)['name'] as String).toLowerCase()}', key: Key('meal-swapped-${widget.meal}-${item['position']}'), style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: tokens.accent)),
              ]),
            ),
            const SizedBox(width: 8),
            if (item['household'] != null) ...[Pill(item['household'] as String), const SizedBox(width: 10)],
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 48),
              child: Text('${formatNumber(item['grams'] as num)} g', key: Key('meal-item-${widget.meal}-${item['code']}'), textAlign: TextAlign.end, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, fontFeatures: tabularFigures)),
            ),
            const SizedBox(width: 10),
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: swapped || _hover ? scheme.primary.withValues(alpha: 0.16) : tokens.cardHigh,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: swapped || _hover ? scheme.primary.withValues(alpha: 0.4) : tokens.border),
              ),
              child: Icon(Icons.swap_horiz, size: 18, color: swapped || _hover ? tokens.accent : tokens.muted),
            ),
          ]),
        ),
      ),
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
