import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import 'builder_screen.dart';

/// Detalle de una rutina aprobada: su semana con días de entrenamiento y de descanso, las sesiones con sus ejercicios, y empezarla
/// al instante o usarla como base de una rutina propia.
class RoutineDetailScreen extends StatefulWidget {
  const RoutineDetailScreen({super.key, required this.api, required this.routine, required this.profile, required this.hasPlan});
  final ApiClient api;
  final Map<String, dynamic> routine;
  final Map<String, dynamic>? profile;
  final bool hasPlan;

  @override
  State<RoutineDetailScreen> createState() => _RoutineDetailScreenState();
}

class _RoutineDetailScreenState extends State<RoutineDetailScreen> {
  late final Set<int> _days = defaultDays((widget.profile?['days'] as List?)?.cast<int>(), _min, _max).toSet();
  bool _busy = false;

  int get _min => widget.routine['minDays'] as int;
  int get _max => widget.routine['maxDays'] as int;
  bool get _validDays => _days.length >= _min && _days.length <= _max;
  List<int> get _sortedDays => _days.toList()..sort();

  /// El día k elegido hace la sesión k de la rutina, en ciclo.
  Map<String, dynamic> _sessionFor(Map<String, dynamic> detail, int day) {
    final sessions = (detail['sessions'] as List).cast<Map<String, dynamic>>();
    return sessions[_sortedDays.indexOf(day) % sessions.length];
  }

  Set<String> _groups(Map<String, dynamic> session) => (session['exercises'] as List).map((exercise) => (exercise as Map)['muscleGroup'] as String).toSet();

  Future<void> _start() async {
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
    setState(() => _busy = true);
    try {
      await widget.api.post('/api/plans/start', {'source': 'recomendada', 'templateId': widget.routine['id'], 'days': _sortedDays});
      if (mounted) Navigator.pop(context, 'Tu rutina empezó. Tus sesiones ya están en tu agenda.');
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _busy = false);
        showMessage(context, error.message);
      }
    }
  }

  /// Abre el armado de una rutina propia con estas sesiones en los días elegidos, para cambiar ejercicios o días.
  Future<void> _customize(Map<String, dynamic> detail) async {
    final seed = BuilderSeed(
      name: '${splitLabels[detail['split']]} personalizada',
      sessions: {
        for (final day in _sortedDays)
          day: (
            label: _sessionFor(detail, day)['label'] as String,
            exercises: [
              for (final exercise in (_sessionFor(detail, day)['exercises'] as List).cast<Map<String, dynamic>>())
                if (exercise['id'] != null) (id: exercise['id'] as String, name: exercise['name'] as String, group: exercise['muscleGroup'] as String, defaultPrescription: exercise['defaultPrescription'] as String? ?? exercise['prescription'] as String),
            ],
          ),
      },
    );
    final message = await Navigator.push<String>(context, MaterialPageRoute(builder: (_) => BuilderScreen(api: widget.api, profile: widget.profile, hasPlan: widget.hasPlan, seed: seed)));
    if (message != null && mounted) Navigator.pop(context, message);
  }

  void _showExercise(Map<String, dynamic> exercise) => showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(exercise['name'] as String),
      content: Text('${exercise['description']}\n\nIndicación: ${exercise['prescription']}'),
      actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cerrar'))],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final routine = widget.routine;
    final tokens = FitTokens.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(routineTitle(routine['name'] as String), overflow: TextOverflow.ellipsis)),
      body: SafeArea(
        child: Loader<Map<String, dynamic>>(
          load: () async => (await widget.api.get('/api/routines/${routine['id']}') as Map)['routine'] as Map<String, dynamic>,
          builder: (context, detail, reload) {
            final warnings = _validDays ? recoveryWarnings({for (final day in _sortedDays) day: _groups(_sessionFor(detail, day))}) : const <String>[];
            final header = FitCard(
              hero: true,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(Icons.verified_rounded, size: 18, color: tokens.accent),
                  const SizedBox(width: 6),
                  Expanded(child: Text('Rutina aprobada por un profesional', style: TextStyle(color: tokens.accent, fontWeight: FontWeight.w700, fontSize: 13))),
                ]),
                const SizedBox(height: 10),
                Text(routineTitle(detail['name'] as String? ?? routine['name'] as String), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('${splitLabels[detail['split']]}: ${splitDescriptions[detail['split']]!.toLowerCase()}', key: const Key('routine-split'), style: TextStyle(fontWeight: FontWeight.w600, color: tokens.muted)),
                const SizedBox(height: 12),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  if (objectiveLabels[detail['objective']] case final objective?) Pill(objective, icon: Icons.track_changes, color: tokens.accent),
                  if (levelLabels[detail['level']] case final level?) Pill(level, icon: Icons.bolt_rounded, color: tokens.carbs),
                  if (equipmentLabels[detail['equipment']] case final equipment?) Pill(equipment, icon: detail['equipment'] == 'con_equipo' ? Icons.fitness_center : Icons.accessibility_new, color: tokens.protein),
                  Pill('${detail['sessionMinutes']} min por sesión', icon: Icons.timer_outlined),
                  Pill('${detail['weeks']} semanas', icon: Icons.date_range_outlined),
                  if (bmiCategoryLabels[detail['bmiCategory']] case final bmi?) Pill(bmi, icon: Icons.monitor_weight_outlined),
                ]),
                const SizedBox(height: 12),
                Text(detail['summary'] as String, style: const TextStyle(height: 1.45)),
              ]),
            );
            final week = SectionCard(
              title: 'Tu semana',
              icon: Icons.calendar_month_outlined,
              children: [
                Text(_min == _max ? 'Esta rutina se hace $_min días por semana; los demás son de descanso.' : 'Elige entre $_min y $_max días por semana; los demás son de descanso.', style: TextStyle(color: tokens.muted, fontSize: 13.5)),
                const SizedBox(height: 12),
                for (var day = 1; day <= 7; day++)
                  WeekDayRow(
                    key: Key('day-$day'),
                    day: day,
                    selected: _days.contains(day),
                    label: _days.contains(day) && _validDays ? _sessionFor(detail, day)['label'] as String : null,
                    onTap: () => setState(() => _days.contains(day) ? _days.remove(day) : _days.add(day)),
                  ),
                if (!_validDays) Callout(icon: Icons.error_outline, color: Theme.of(context).colorScheme.error, child: Text('Elige entre $_min y $_max días.', key: const Key('days-error'))),
                for (final (index, warning) in warnings.indexed) HintLine(warning, key: Key('recovery-warning-$index'), icon: Icons.bedtime_outlined),
              ],
            );
            final actions = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              FilledButton(key: const Key('start-routine'), onPressed: _busy || !_validDays ? null : _start, child: Text(_busy ? 'Empezando…' : 'Empezar esta rutina')),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                key: const Key('customize-routine'),
                onPressed: _busy || !_validDays ? null : () => _customize(detail),
                icon: const Icon(Icons.tune),
                label: const Text('Personalizarla como rutina propia'),
              ),
              const SizedBox(height: 12),
              Text('Las rutinas son orientaciones generales y no reemplazan la evaluación de un profesional de la salud. Si sientes dolor o molestias, detente.', style: Theme.of(context).textTheme.bodySmall),
            ]);
            final sessions = [
              for (final session in (detail['sessions'] as List).cast<Map<String, dynamic>>())
                SectionCard(
                  title: 'Sesión ${session['sessionNo']} · ${session['label']}',
                  icon: Icons.fitness_center,
                  children: [
                    GroupChips(_groups(session)),
                    const SizedBox(height: 12),
                    for (final (index, exercise) in (session['exercises'] as List).cast<Map<String, dynamic>>().indexed)
                      ExerciseItem(
                        index: index,
                        name: exercise['name'] as String,
                        prescription: '${exercise['prescription']} · ${muscleGroupLabels[exercise['muscleGroup']]}${exercise['highImpact'] == true ? ' · alto impacto' : ''}',
                        onTap: () => _showExercise(exercise),
                        trailing: Icon(Icons.chevron_right, color: tokens.muted),
                      ),
                  ],
                ),
            ];
            return PageList(
              children: [
                const SizedBox(height: 8),
                header,
                BentoColumns(
                  primaryFlex: 5,
                  secondaryFlex: 7,
                  primary: [week, actions],
                  secondary: sessions,
                  narrow: [week, ...sessions, actions],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
