import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';

typedef SeedExercise = ({String id, String name, String group, String defaultPrescription});

/// Punto de partida de una rutina propia: por ejemplo, una rutina recomendada que la persona quiere personalizar.
class BuilderSeed {
  const BuilderSeed({required this.name, required this.sessions});
  final String name;
  final Map<int, ({String label, List<SeedExercise> exercises})> sessions;
}

class _Item {
  _Item({required this.id, required this.name, required this.group, required this.defaultPrescription});
  final String id;
  final String name;
  final String group;
  final String defaultPrescription;
  int? sets;
  int? reps;
  int? seconds;

  String get text => sets == null ? 'Sugerida: $defaultPrescription' : '$sets series de ${reps ?? seconds} ${reps != null ? 'repeticiones' : 'segundos'}';

  Map<String, dynamic> toJson() => {'exerciseId': id, 'sets': ?sets, 'reps': ?reps, 'seconds': ?seconds};
}

/// Armar una rutina propia: la persona elige sus días de entrenamiento y de descanso, nombra cada sesión y elige los ejercicios
/// del catálogo aprobado, con sugerencias según su objetivo y avisos de equilibrio y recuperación (RF005).
class BuilderScreen extends StatefulWidget {
  const BuilderScreen({super.key, required this.api, required this.profile, required this.hasPlan, this.seed});
  final ApiClient api;
  final Map<String, dynamic>? profile;
  final bool hasPlan;
  final BuilderSeed? seed;

  @override
  State<BuilderScreen> createState() => _BuilderScreenState();
}

class _BuilderScreenState extends State<BuilderScreen> {
  static const _mainGroups = ['piernas', 'empuje', 'traccion'];
  late final _name = TextEditingController(text: widget.seed?.name ?? '');
  final Set<int> _days = {};
  final Map<int, List<_Item>> _items = {};
  final Map<int, TextEditingController> _labels = {};
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    for (final MapEntry(key: day, value: session) in (widget.seed?.sessions ?? const <int, ({String label, List<SeedExercise> exercises})>{}).entries) {
      _days.add(day);
      _label(day).text = session.label;
      _items[day] = [for (final exercise in session.exercises) _Item(id: exercise.id, name: exercise.name, group: exercise.group, defaultPrescription: exercise.defaultPrescription)];
    }
  }

  @override
  void dispose() {
    _name.dispose();
    for (final controller in _labels.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _label(int day) => _labels.putIfAbsent(day, TextEditingController.new);
  List<int> get _sortedDays => _days.toList()..sort();
  String _sessionName(int day) {
    final custom = _label(day).text.trim();
    return custom.isEmpty ? 'Sesión ${_sortedDays.indexOf(day) + 1}' : custom;
  }

  Future<void> _add(int day) async {
    final taken = (_items[day] ?? []).map((item) => item.id).toSet();
    final picked = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => _ExercisePicker(api: widget.api, hasProfile: widget.profile != null, excluded: taken));
    if (picked == null) return;
    setState(() {
      (_items[day] ??= []).add(_Item(id: picked['id'] as String, name: picked['name'] as String, group: picked['muscleGroup'] as String, defaultPrescription: picked['defaultPrescription'] as String));
      _error = null;
    });
  }

  void _move(int day, int position, int delta) {
    final items = _items[day]!;
    final target = position + delta;
    if (target < 0 || target >= items.length) return;
    setState(() => items.insert(target, items.removeAt(position)));
  }

  Future<void> _edit(_Item item) async {
    final sets = TextEditingController(text: item.sets?.toString() ?? '');
    final amount = TextEditingController(text: (item.reps ?? item.seconds)?.toString() ?? '');
    var unit = item.seconds != null ? 'seconds' : 'reps';
    String? problem;
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialog) => AlertDialog(
          title: Text(item.name),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Sugerida por el profesional: ${item.defaultPrescription}', style: const TextStyle(fontSize: 12)),
              const SizedBox(height: 8),
              TextField(key: const Key('sets-field'), controller: sets, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Series (1 a 6)')),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [
                ChoiceChip(key: const Key('unit-reps'), label: const Text('Repeticiones'), selected: unit == 'reps', onSelected: (_) => setDialog(() => unit = 'reps')),
                ChoiceChip(key: const Key('unit-seconds'), label: const Text('Segundos'), selected: unit == 'seconds', onSelected: (_) => setDialog(() => unit = 'seconds')),
              ]),
              const SizedBox(height: 8),
              TextField(key: const Key('amount-field'), controller: amount, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: unit == 'reps' ? 'Repeticiones por serie (1 a 50)' : 'Segundos por serie (5 a 600)')),
              if (problem != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(problem!, key: const Key('edit-error'), style: TextStyle(color: Theme.of(context).colorScheme.error))),
            ],
          ),
          actions: [
            TextButton(key: const Key('use-default'), onPressed: () => Navigator.pop(dialogContext, 'default'), child: const Text('Usar la sugerida')),
            FilledButton(
              key: const Key('save-prescription'),
              onPressed: () {
                final s = int.tryParse(sets.text.trim());
                final a = int.tryParse(amount.text.trim());
                final max = unit == 'reps' ? 50 : 600;
                final min = unit == 'reps' ? 1 : 5;
                if (s == null || s < 1 || s > 6 || a == null || a < min || a > max) {
                  setDialog(() => problem = 'Series de 1 a 6 y ${unit == 'reps' ? 'repeticiones de 1 a 50' : 'segundos de 5 a 600'}.');
                  return;
                }
                Navigator.pop(dialogContext, 'save');
              },
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
    if (result == 'default') {
      setState(() { item.sets = null; item.reps = null; item.seconds = null; });
    } else if (result == 'save') {
      final amountValue = int.parse(amount.text.trim());
      setState(() {
        item.sets = int.parse(sets.text.trim());
        item.reps = unit == 'reps' ? amountValue : null;
        item.seconds = unit == 'seconds' ? amountValue : null;
      });
    }
  }

  Future<void> _start() async {
    final days = _sortedDays;
    final name = _name.text.trim();
    String? problem;
    if (name.isEmpty) {
      problem = 'Ponle un nombre a tu rutina.';
    } else if (days.isEmpty) {
      problem = 'Elige al menos un día.';
    } else if (days.any((day) => (_items[day] ?? []).isEmpty)) {
      problem = 'Agrega al menos un ejercicio a cada día.';
    }
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    if (widget.hasPlan) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Reemplazar tu rutina'),
          content: const Text('Tu rutina actual quedará en el historial y esta empezará mañana. Lo ya registrado se conserva.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
            FilledButton(key: const Key('confirm-start'), onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Empezar esta')),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      await widget.api.post('/api/plans/start', {
        'source': 'propia',
        'name': name,
        'days': days,
        'sessions': [
          for (final day in days)
            {
              if (_label(day).text.trim().isNotEmpty) 'label': _label(day).text.trim(),
              'exercises': [for (final item in _items[day]!) item.toJson()],
            },
        ],
      });
      if (mounted) Navigator.pop(context, 'Tu rutina empezó. Tus sesiones ya están en tu agenda.');
    } on ApiException catch (error) {
      if (mounted) setState(() { _busy = false; _error = error.message; });
    }
  }

  /// Equilibrio de la semana: cuántos ejercicios trabajan cada grupo, qué grupo de fuerza falta y si hay días seguidos con el mismo grupo.
  List<Widget> _balance() {
    final days = _sortedDays;
    final counts = <String, int>{};
    for (final day in days) {
      for (final item in _items[day] ?? <_Item>[]) {
        counts[item.group] = (counts[item.group] ?? 0) + 1;
      }
    }
    if (counts.isEmpty) return const [];
    final missing = _mainGroups.where((group) => !counts.containsKey(group)).map((group) => muscleGroupLabels[group]!.toLowerCase()).toList();
    final warnings = recoveryWarnings({for (final day in days) day: (_items[day] ?? <_Item>[]).map((item) => item.group).toSet()});
    return [
      SectionCard(
        key: const Key('balance'),
        title: 'Equilibrio de tu semana',
        children: [
          GroupChips(muscleGroupLabels.keys.where(counts.containsKey), counts: counts),
          if (missing.isNotEmpty) HintLine('Aún no incluyes ejercicios de ${missing.join(', ')}. Una semana equilibrada trabaja piernas, empuje y tracción.', key: const Key('missing-groups')),
          for (final (index, warning) in warnings.indexed) HintLine(warning, key: Key('recovery-warning-$index'), icon: Icons.bedtime_outlined),
        ],
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final days = _sortedDays;
    return Scaffold(
      appBar: AppBar(title: const Text('Crear mi rutina')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            SectionCard(
              title: 'Tu rutina',
              children: [
                TextField(key: const Key('routine-name'), controller: _name, maxLength: 80, decoration: const InputDecoration(labelText: 'Nombre')),
                Text('Tu semana: toca los días en que entrenas; los demás son de descanso.', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                for (var day = 1; day <= 7; day++)
                  WeekDayRow(
                    key: Key('day-$day'),
                    day: day,
                    selected: _days.contains(day),
                    label: _days.contains(day) ? _sessionName(day) : null,
                    onTap: () => setState(() { _days.contains(day) ? _days.remove(day) : _days.add(day); _error = null; }),
                  ),
              ],
            ),
            ..._balance(),
            for (final day in days)
              SectionCard(
                title: '${dayNames[day - 1]} · ${_sessionName(day)}',
                children: [
                  TextField(
                    key: Key('session-label-$day'),
                    controller: _label(day),
                    maxLength: 40,
                    decoration: InputDecoration(labelText: 'Nombre de la sesión (opcional)', hintText: 'Por ejemplo, Piernas o Tren superior', isDense: true, helperText: 'Si lo dejas vacío: Sesión ${days.indexOf(day) + 1}'),
                    onChanged: (_) => setState(() {}),
                  ),
                  for (final (position, item) in (_items[day] ?? <_Item>[]).indexed)
                    ListTile(
                      key: Key('item-$day-$position'),
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(muscleGroupIcons[item.group]),
                      title: Text(item.name),
                      subtitle: Text(item.text),
                      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                        PopupMenuButton<String>(
                          key: Key('order-$day-$position'),
                          tooltip: 'Mover',
                          icon: const Icon(Icons.swap_vert),
                          onSelected: (value) => _move(day, position, value == 'up' ? -1 : 1),
                          itemBuilder: (context) => [
                            if (position > 0) const PopupMenuItem(value: 'up', child: Text('Subir')),
                            if (position < _items[day]!.length - 1) const PopupMenuItem(value: 'down', child: Text('Bajar')),
                          ],
                        ),
                        IconButton(key: Key('edit-$day-$position'), icon: const Icon(Icons.tune), tooltip: 'Ajustar series y repeticiones', onPressed: () => _edit(item)),
                        IconButton(key: Key('remove-$day-$position'), icon: const Icon(Icons.close), tooltip: 'Quitar', onPressed: () => setState(() => _items[day]!.remove(item))),
                      ]),
                    ),
                  TextButton.icon(key: Key('add-$day'), onPressed: () => _add(day), icon: const Icon(Icons.add), label: const Text('Agregar ejercicio')),
                ],
              ),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error!, key: const Key('builder-error'), style: TextStyle(color: Theme.of(context).colorScheme.error))),
            FilledButton(key: const Key('start-custom'), onPressed: _busy ? null : _start, child: Text(_busy ? 'Empezando…' : 'Empezar mi rutina')),
            const SizedBox(height: 8),
            const Text('Las rutinas son orientaciones generales y no reemplazan la evaluación de un profesional de la salud. Si sientes dolor o molestias, detente.', style: TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

/// Elegir un ejercicio: primero los sugeridos para el objetivo, luego el resto del catálogo aprobado, con búsqueda por nombre.
class _ExercisePicker extends StatefulWidget {
  const _ExercisePicker({required this.api, required this.hasProfile, required this.excluded});
  final ApiClient api;
  final bool hasProfile;
  final Set<String> excluded;

  @override
  State<_ExercisePicker> createState() => _ExercisePickerState();
}

class _ExercisePickerState extends State<_ExercisePicker> {
  String? _group;
  String _query = '';

  Future<Map<String, dynamic>> _load() async {
    if (widget.hasProfile) {
      try {
        return await widget.api.get('/api/exercises/suggestions') as Map<String, dynamic>;
      } on ApiException catch (error) {
        if (error.code != 'PROFILE_REQUIRED' && error.code != 'NO_APPROVED_RULES') rethrow;
      }
    }
    return await widget.api.get('/api/exercises') as Map<String, dynamic>;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Agregar ejercicio'),
      content: SizedBox(
        width: double.maxFinite,
        height: 460,
        child: Loader<Map<String, dynamic>>(
          load: _load,
          builder: (context, data, reload) {
            final query = _query.trim().toLowerCase();
            final exercises = (data['exercises'] as List).cast<Map<String, dynamic>>().where((exercise) =>
                !widget.excluded.contains(exercise['id']) && (_group == null || exercise['muscleGroup'] == _group) &&
                (query.isEmpty || (exercise['name'] as String).toLowerCase().contains(query))).toList();
            return ListView(
              children: [
                if (data['focus'] != null) Text('Sugeridos para ${objectiveLabels[data['objective']]!.toLowerCase()}, según las reglas aprobadas por el preparador.${data['lowImpactOnly'] == true ? ' Por tu IMC solo se muestran ejercicios de bajo impacto.' : ''}', key: const Key('picker-note'), style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 8),
                TextField(
                  key: const Key('picker-search'),
                  decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Buscar', isDense: true),
                  onChanged: (value) => setState(() => _query = value),
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    FilterChip(key: const Key('picker-group-all'), label: const Text('Todos'), selected: _group == null, onSelected: (_) => setState(() => _group = null)),
                    for (final entry in muscleGroupLabels.entries) ...[
                      const SizedBox(width: 6),
                      FilterChip(key: Key('picker-group-${entry.key}'), label: Text(entry.value), selected: _group == entry.key, onSelected: (_) => setState(() => _group = entry.key)),
                    ],
                  ]),
                ),
                if (exercises.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No hay más ejercicios con ese filtro.')),
                for (final exercise in exercises)
                  ListTile(
                    key: Key('pick-${exercise['code']}'),
                    leading: Icon(exercise['suggested'] == true ? Icons.star : muscleGroupIcons[exercise['muscleGroup']], size: 20),
                    title: Text(exercise['name'] as String),
                    subtitle: Text('${exercise['reason'] as String? ?? muscleGroupLabels[exercise['muscleGroup']]!}${exercise['highImpact'] == true ? ' · Alto impacto' : ''}'),
                    onTap: () => Navigator.pop(context, exercise),
                  ),
              ],
            );
          },
        ),
      ),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar'))],
    );
  }
}
