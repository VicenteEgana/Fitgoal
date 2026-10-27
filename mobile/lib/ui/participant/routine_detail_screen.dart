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

  @override
  Widget build(BuildContext context) {
    final routine = widget.routine;
    return Scaffold(
      appBar: AppBar(title: Text(routine['name'] as String, overflow: TextOverflow.ellipsis)),
      body: SafeArea(
        child: Loader<Map<String, dynamic>>(
          load: () async => (await widget.api.get('/api/routines/${routine['id']}') as Map)['routine'] as Map<String, dynamic>,
          builder: (context, detail, reload) {
            final warnings = _validDays ? recoveryWarnings({for (final day in _sortedDays) day: _groups(_sessionFor(detail, day))}) : const <String>[];
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(detail['summary'] as String),
                const SizedBox(height: 6),
                Text('${splitLabels[detail['split']]}: ${splitDescriptions[detail['split']]!.toLowerCase()}', key: const Key('routine-split'), style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final text in [
                    '${detail['weeks']} semanas',
                    '${detail['sessionMinutes']} min por sesión',
                    levelLabels[detail['level']] ?? '',
                    equipmentLabels[detail['equipment']] ?? '',
                    bmiCategoryLabels[detail['bmiCategory']] ?? '',
                  ])
                    if (text.isNotEmpty) Chip(label: Text(text), visualDensity: VisualDensity.compact, materialTapTargetSize: MaterialTapTargetSize.shrinkWrap),
                ]),
                const SizedBox(height: 6),
                const Row(children: [Icon(Icons.verified, size: 16), SizedBox(width: 6), Expanded(child: Text('Rutina aprobada por un profesional'))]),
                const SizedBox(height: 12),
                SectionCard(
                  title: 'Tu semana',
                  children: [
                    Text(_min == _max ? 'Esta rutina se hace $_min días por semana; los demás son de descanso.' : 'Elige entre $_min y $_max días por semana; los demás son de descanso.'),
                    const SizedBox(height: 8),
                    for (var day = 1; day <= 7; day++)
                      WeekDayRow(
                        key: Key('day-$day'),
                        day: day,
                        selected: _days.contains(day),
                        label: _days.contains(day) && _validDays ? _sessionFor(detail, day)['label'] as String : null,
                        onTap: () => setState(() => _days.contains(day) ? _days.remove(day) : _days.add(day)),
                      ),
                    if (!_validDays) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Elige entre $_min y $_max días.', key: const Key('days-error'), style: TextStyle(color: Theme.of(context).colorScheme.error))),
                    for (final (index, warning) in warnings.indexed) HintLine(warning, key: Key('recovery-warning-$index'), icon: Icons.bedtime_outlined),
                  ],
                ),
                for (final session in (detail['sessions'] as List).cast<Map<String, dynamic>>())
                  SectionCard(
                    title: 'Sesión ${session['sessionNo']} · ${session['label']}',
                    children: [
                      GroupChips(_groups(session)),
                      const SizedBox(height: 4),
                      for (final (index, exercise) in (session['exercises'] as List).cast<Map<String, dynamic>>().indexed)
                        ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(radius: 14, child: Text('${index + 1}', style: const TextStyle(fontSize: 12))),
                          title: Text(exercise['name'] as String),
                          subtitle: Text('${exercise['prescription']} · ${muscleGroupLabels[exercise['muscleGroup']]}${exercise['highImpact'] == true ? ' · alto impacto' : ''}'),
                          onTap: () => showDialog<void>(
                            context: context,
                            builder: (dialogContext) => AlertDialog(
                              title: Text(exercise['name'] as String),
                              content: Text('${exercise['description']}\n\nIndicación: ${exercise['prescription']}'),
                              actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cerrar'))],
                            ),
                          ),
                        ),
                    ],
                  ),
                FilledButton(key: const Key('start-routine'), onPressed: _busy || !_validDays ? null : _start, child: Text(_busy ? 'Empezando…' : 'Empezar esta rutina')),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  key: const Key('customize-routine'),
                  onPressed: _busy || !_validDays ? null : () => _customize(detail),
                  icon: const Icon(Icons.tune),
                  label: const Text('Personalizarla como rutina propia'),
                ),
                const SizedBox(height: 8),
                const Text('Las rutinas son orientaciones generales y no reemplazan la evaluación de un profesional de la salud. Si sientes dolor o molestias, detente.', style: TextStyle(fontSize: 12)),
              ],
            );
          },
        ),
      ),
    );
  }
}
