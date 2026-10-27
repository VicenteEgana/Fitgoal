import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import 'builder_screen.dart';
import 'routine_detail_screen.dart';

enum _Section { recommended, all, exercises }

/// Rutinas: recomendadas según el perfil, todo el catálogo aprobado y la biblioteca de ejercicios (RF004, RF005).
class RoutinesTab extends StatefulWidget {
  const RoutinesTab({super.key, required this.api, required this.onGoToProfile, required this.onStarted});
  final ApiClient api;
  final VoidCallback onGoToProfile;
  final void Function(String message) onStarted;

  @override
  State<RoutinesTab> createState() => _RoutinesTabState();
}

class _RoutinesTabState extends State<RoutinesTab> {
  _Section _section = _Section.recommended;
  String? _objective;
  String? _split;
  String? _level;
  String? _equipment;
  String? _group;
  String? _exerciseEquipment;
  String _routineQuery = '';
  String _exerciseQuery = '';

  Future<Map<String, dynamic>> _load() async {
    final results = await Future.wait([widget.api.get('/api/routines'), widget.api.get('/api/exercises'), widget.api.get('/api/plans/me')]);
    return {
      'profile': (results[0] as Map)['profile'],
      'body': (results[0] as Map)['body'],
      'notices': (results[0] as Map)['notices'],
      'routines': (results[0] as Map)['routines'],
      'exercises': (results[1] as Map)['exercises'],
      'hasPlan': (results[2] as Map)['plan'] != null,
    };
  }

  Future<void> _open(Map<String, dynamic> routine, Map<String, dynamic>? profile, bool hasPlan) async {
    final message = await Navigator.push<String>(context, MaterialPageRoute(builder: (_) => RoutineDetailScreen(api: widget.api, routine: routine, profile: profile, hasPlan: hasPlan)));
    if (message != null) widget.onStarted(message);
  }

  Future<void> _build(Map<String, dynamic>? profile, bool hasPlan) async {
    final message = await Navigator.push<String>(context, MaterialPageRoute(builder: (_) => BuilderScreen(api: widget.api, profile: profile, hasPlan: hasPlan)));
    if (message != null) widget.onStarted(message);
  }

  static String _plain(String text) => text.toLowerCase()
      .replaceAll('á', 'a').replaceAll('é', 'e').replaceAll('í', 'i').replaceAll('ó', 'o').replaceAll('ú', 'u').replaceAll('ñ', 'n');

  @override
  Widget build(BuildContext context) {
    return Loader<Map<String, dynamic>>(
      load: _load,
      builder: (context, data, reload) {
        final profile = data['profile'] as Map<String, dynamic>?;
        final hasPlan = data['hasPlan'] as bool;
        final body = data['body'] as Map<String, dynamic>?;
        final notices = ((data['notices'] as List?) ?? const []).cast<Map<String, dynamic>>();
        final routines = (data['routines'] as List).cast<Map<String, dynamic>>();
        final exercises = (data['exercises'] as List).cast<Map<String, dynamic>>();
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (profile == null)
              SectionCard(
                title: 'Completa tu perfil',
                children: [
                  const Text('Con tu objetivo, nivel, equipo y días te recomendamos las rutinas que mejor te calzan. Mientras tanto puedes explorar todo el catálogo.'),
                  const SizedBox(height: 8),
                  FilledButton.tonal(key: const Key('go-profile-routines'), onPressed: widget.onGoToProfile, child: const Text('Completar perfil')),
                ],
              ),
            OutlinedButton.icon(key: const Key('build-routine'), onPressed: () => _build(profile, hasPlan), icon: const Icon(Icons.edit_note), label: const Text('Crear mi propia rutina')),
            const SizedBox(height: 12),
            SegmentedButton<_Section>(
              key: const Key('segments'),
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: _Section.recommended, label: Text('Para ti'), icon: Icon(Icons.star_outline)),
                ButtonSegment(value: _Section.all, label: Text('Todas')),
                ButtonSegment(value: _Section.exercises, label: Text('Ejercicios')),
              ],
              selected: {_section},
              onSelectionChanged: (value) => setState(() => _section = value.first),
            ),
            const SizedBox(height: 12),
            ...switch (_section) {
              _Section.recommended => _recommended(
                routines.where((routine) => routine['recommended'] == true).toList(),
                routines.where((routine) => routine['alternative'] == true).toList(),
                profile,
                hasPlan,
                body,
                notices,
              ),
              _Section.all => _all(routines, profile, hasPlan),
              _Section.exercises => _library(exercises),
            },
          ],
        );
      },
    );
  }

  List<Widget> _recommended(
    List<Map<String, dynamic>> routines,
    List<Map<String, dynamic>> alternatives,
    Map<String, dynamic>? profile,
    bool hasPlan,
    Map<String, dynamic>? body,
    List<Map<String, dynamic>> notices,
  ) {
    if (profile == null) return const [Text('Completa tu perfil para ver las rutinas recomendadas.', key: Key('no-recommended'))];
    if (routines.isEmpty) return const [Text('Todavía no hay una rutina recomendada para tu perfil. Explora todas las rutinas.', key: Key('no-recommended'))];
    final profileDays = (profile['days'] as List?)?.cast<int>();
    return [
      Text('Elegidas por un profesional para ${objectiveLabels[profile['objective']]!.toLowerCase()}, nivel ${levelLabels[profile['level']]!.toLowerCase()}, ${equipmentLabels[profile['equipment']]!.toLowerCase()}.', style: Theme.of(context).textTheme.bodySmall),
      if (body != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Tu IMC: ${(body['bmi'] as num).toStringAsFixed(1).replaceAll('.', ',')} (${body['label']})', key: const Key('bmi-line'), style: const TextStyle(fontWeight: FontWeight.w600))),
      for (final notice in notices)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Padding(padding: EdgeInsets.only(top: 2, right: 6), child: Icon(Icons.info_outline, size: 16)),
            Expanded(child: Text(notice['text'] as String, key: Key('notice-${notice['code']}'), style: Theme.of(context).textTheme.bodySmall)),
          ]),
        ),
      if (body == null)
        Align(alignment: Alignment.centerLeft, child: TextButton(key: const Key('go-profile-body'), onPressed: widget.onGoToProfile, child: const Text('Indicar mi estatura y peso'))),
      const SizedBox(height: 8),
      for (final routine in routines) _RoutineCard(routine: routine, profileDays: profileDays, featured: true, onTap: () => _open(routine, profile, hasPlan)),
      if (alternatives.isNotEmpty) ...[
        const SizedBox(height: 8),
        Text('Otras formas de organizar tu semana', key: const Key('alternatives-title'), style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        Text('Las mismas condiciones de tu perfil, con otra división de los días.', style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 4),
        for (final routine in alternatives) _RoutineCard(routine: routine, profileDays: profileDays, onTap: () => _open(routine, profile, hasPlan)),
      ],
    ];
  }

  List<Widget> _all(List<Map<String, dynamic>> routines, Map<String, dynamic>? profile, bool hasPlan) {
    final query = _plain(_routineQuery.trim());
    final shown = routines.where((routine) =>
        (_objective == null || routine['objective'] == _objective) && (_split == null || routine['split'] == _split) &&
        (_level == null || routine['level'] == _level) && (_equipment == null || routine['equipment'] == _equipment) &&
        (query.isEmpty || _plain('${routine['name']} ${routine['summary']}').contains(query))).toList();
    return [
      TextField(
        key: const Key('routine-search'),
        decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Buscar rutina', isDense: true),
        onChanged: (value) => setState(() => _routineQuery = value),
      ),
      const SizedBox(height: 8),
      Wrap(spacing: 8, children: [
        FilterChip(key: const Key('filter-all'), label: const Text('Todas'), selected: _objective == null, onSelected: (_) => setState(() => _objective = null)),
        for (final entry in objectiveLabels.entries)
          FilterChip(key: Key('filter-${entry.key}'), label: Text(entry.value), selected: _objective == entry.key, onSelected: (_) => setState(() => _objective = entry.key)),
      ]),
      const SizedBox(height: 4),
      Wrap(spacing: 8, children: [
        FilterChip(key: const Key('split-all'), label: const Text('Cualquier división'), selected: _split == null, onSelected: (_) => setState(() => _split = null)),
        for (final entry in splitLabels.entries)
          FilterChip(key: Key('split-${entry.key}'), label: Text(entry.value), tooltip: splitDescriptions[entry.key], selected: _split == entry.key, onSelected: (_) => setState(() => _split = entry.key)),
      ]),
      const SizedBox(height: 4),
      Wrap(spacing: 8, children: [
        for (final entry in levelLabels.entries)
          FilterChip(key: Key('level-${entry.key}'), label: Text(entry.value), selected: _level == entry.key, onSelected: (selected) => setState(() => _level = selected ? entry.key : null)),
        for (final entry in equipmentLabels.entries)
          FilterChip(key: Key('equipment-${entry.key}'), label: Text(entry.value), selected: _equipment == entry.key, onSelected: (selected) => setState(() => _equipment = selected ? entry.key : null)),
      ]),
      Text('${shown.length} ${shown.length == 1 ? 'rutina' : 'rutinas'}', key: const Key('routines-count'), style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 8),
      for (final routine in shown) _RoutineCard(routine: routine, profileDays: (profile?['days'] as List?)?.cast<int>(), onTap: () => _open(routine, profile, hasPlan)),
    ];
  }

  List<Widget> _library(List<Map<String, dynamic>> exercises) {
    final query = _plain(_exerciseQuery.trim());
    final shown = exercises.where((exercise) =>
        (_group == null || exercise['muscleGroup'] == _group) &&
        (_exerciseEquipment == null || (exercise['requiresEquipment'] == true) == (_exerciseEquipment == 'con_equipo')) &&
        (query.isEmpty || _plain('${exercise['name']} ${exercise['description']}').contains(query))).toList();
    return [
      const Text('Todos los ejercicios aprobados por el preparador físico. Pruébalos o úsalos para armar tu propia rutina.', style: TextStyle(fontSize: 12)),
      const SizedBox(height: 8),
      TextField(
        key: const Key('exercise-search'),
        decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Buscar ejercicio', isDense: true),
        onChanged: (value) => setState(() => _exerciseQuery = value),
      ),
      const SizedBox(height: 8),
      Wrap(spacing: 8, children: [
        FilterChip(key: const Key('group-all'), label: const Text('Todos'), selected: _group == null, onSelected: (_) => setState(() => _group = null)),
        for (final entry in muscleGroupLabels.entries)
          FilterChip(key: Key('group-${entry.key}'), avatar: Icon(muscleGroupIcons[entry.key], size: 16), label: Text(entry.value), selected: _group == entry.key, onSelected: (_) => setState(() => _group = entry.key)),
      ]),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          key: const Key('group-guide'),
          onPressed: () => _group == null ? showMuscleGroupGuide(context) : showMuscleGroupInfo(context, _group!),
          icon: const Icon(Icons.help_outline, size: 18),
          label: Text(_group == null ? '¿Qué trabaja cada grupo?' : '¿Qué es ${muscleGroupLabels[_group]!.toLowerCase()}?'),
        ),
      ),
      const SizedBox(height: 4),
      Wrap(spacing: 8, children: [
        for (final entry in equipmentLabels.entries)
          FilterChip(key: Key('exercise-equipment-${entry.key}'), label: Text(entry.value), selected: _exerciseEquipment == entry.key, onSelected: (selected) => setState(() => _exerciseEquipment = selected ? entry.key : null)),
      ]),
      Text('${shown.length} ${shown.length == 1 ? 'ejercicio' : 'ejercicios'}', key: const Key('exercises-count'), style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 4),
      for (final exercise in shown)
        Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ExpansionTile(
            key: Key('exercise-${exercise['code']}'),
            shape: const Border(),
            leading: CircleAvatar(backgroundColor: Theme.of(context).colorScheme.primaryContainer, child: Icon(muscleGroupIcons[exercise['muscleGroup']], color: Theme.of(context).colorScheme.onPrimaryContainer)),
            title: Text(exercise['name'] as String),
            subtitle: Text('${muscleGroupLabels[exercise['muscleGroup']]}${exercise['requiresEquipment'] == true ? ' · con equipo' : ' · sin equipo'}${exercise['highImpact'] == true ? ' · alto impacto' : ''}'),
            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            expandedCrossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(exercise['description'] as String),
              const SizedBox(height: 4),
              Text('Indicación sugerida: ${exercise['defaultPrescription']}', style: Theme.of(context).textTheme.bodySmall),
              if (exercise['minLevel'] == 'con_experiencia') Text('Para personas con experiencia.', style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
    ];
  }
}

class _RoutineCard extends StatelessWidget {
  const _RoutineCard({required this.routine, required this.onTap, this.profileDays, this.featured = false});
  final Map<String, dynamic> routine;
  final VoidCallback onTap;
  final List<int>? profileDays;
  final bool featured;

  static String _daysText(Map<String, dynamic> routine) =>
      routine['minDays'] == routine['maxDays'] ? '${routine['minDays']} días/semana' : '${routine['minDays']} a ${routine['maxDays']} días/semana';

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final reasons = (routine['reasons'] as List).cast<String>();
    final notes = ((routine['fit'] as Map)['notes'] as List).cast<String>();
    final labels = ((routine['sessionLabels'] as List?) ?? const []).cast<String>();
    final days = defaultDays(profileDays, routine['minDays'] as int, routine['maxDays'] as int);
    return Card(
      color: featured ? scheme.primaryContainer.withValues(alpha: 0.45) : null,
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        key: Key('routine-${routine['id']}'),
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(child: Text(routine['name'] as String, style: const TextStyle(fontWeight: FontWeight.w700))),
                if (routine['recommended'] == true) const StatusChip('Recomendada'),
              ]),
              const SizedBox(height: 4),
              Text(routine['summary'] as String),
              const SizedBox(height: 6),
              Text(
                '${splitLabels[routine['split']]} · ${routine['sessionsCount']} sesiones · ${_daysText(routine)} · ${routine['sessionMinutes']} min · ${routine['weeks']} semanas · ${bmiCategoryLabels[routine['bmiCategory']]}',
                key: Key('routine-meta-${routine['id']}'),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (labels.isNotEmpty) ...[
                const SizedBox(height: 8),
                WeekPreview(
                  key: Key('routine-week-${routine['id']}'),
                  trainingDays: days,
                  labels: {for (final (index, day) in days.indexed) day: labels[index % labels.length]},
                ),
              ],
              if (reasons.isNotEmpty) const SizedBox(height: 6),
              for (final reason in reasons) Text('• $reason', style: Theme.of(context).textTheme.bodySmall),
              for (final note in notes) Text('⚠ $note', style: TextStyle(fontSize: 12, color: scheme.error)),
              if (featured)
                Align(alignment: Alignment.centerRight, child: Text('Ver rutina y elegir días ›', style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w600))),
            ],
          ),
        ),
      ),
    );
  }
}
