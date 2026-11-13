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
        final segments = SegmentedButton<_Section>(
          key: const Key('segments'),
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(value: _Section.recommended, label: Text('Para ti'), icon: Icon(Icons.star_outline)),
            ButtonSegment(value: _Section.all, label: Text('Todas')),
            ButtonSegment(value: _Section.exercises, label: Text('Ejercicios')),
          ],
          selected: {_section},
          onSelectionChanged: (value) => setState(() => _section = value.first),
        );
        final builder = OutlinedButton.icon(key: const Key('build-routine'), onPressed: () => _build(profile, hasPlan), icon: const Icon(Icons.edit_note), label: const Text('Crear mi propia rutina'));
        return PageList(
          children: [
            if (profile == null)
              Callout(
                icon: Icons.person_search_outlined,
                margin: const EdgeInsets.only(bottom: 16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Completa tu perfil', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 4),
                  const Text('Con tu objetivo, nivel, equipo y días te recomendamos las rutinas que mejor te calzan. Mientras tanto puedes explorar todo el catálogo.'),
                  const SizedBox(height: 10),
                  FilledButton.tonal(key: const Key('go-profile-routines'), onPressed: widget.onGoToProfile, child: const Text('Completar perfil')),
                ]),
              ),
            LayoutBuilder(builder: (context, constraints) {
              if (constraints.maxWidth < 720) {
                return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [builder, const SizedBox(height: 12), segments]);
              }
              return Row(children: [ConstrainedBox(constraints: const BoxConstraints(maxWidth: 460), child: segments), const Spacer(), builder]);
            }),
            const SizedBox(height: 20),
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
    final tokens = FitTokens.of(context);
    return [
      Text('Elegidas por un profesional para ${objectiveLabels[profile['objective']]!.toLowerCase()}, nivel ${levelLabels[profile['level']]!.toLowerCase()}, ${equipmentLabels[profile['equipment']]!.toLowerCase()}.', style: TextStyle(color: tokens.muted, fontSize: 13.5)),
      const SizedBox(height: 12),
      if (body != null) _BmiBanner(bmi: (body['bmi'] as num).toDouble(), label: body['label'] as String),
      for (final notice in notices)
        Callout(
          icon: notice['code'] == 'objective_adjusted' ? Icons.health_and_safety_outlined : Icons.info_outline,
          color: notice['code'] == 'objective_adjusted' ? tokens.streak : null,
          margin: const EdgeInsets.only(bottom: 8),
          child: Text(notice['text'] as String, key: Key('notice-${notice['code']}')),
        ),
      if (body == null)
        Align(alignment: Alignment.centerLeft, child: TextButton.icon(key: const Key('go-profile-body'), onPressed: widget.onGoToProfile, icon: const Icon(Icons.straighten, size: 18), label: const Text('Indicar mi estatura y peso'))),
      const SizedBox(height: 8),
      if (routines.length == 1)
        LayoutBuilder(builder: (context, constraints) => _RoutineCard(routine: routines.single, profileDays: profileDays, featured: true, split: constraints.maxWidth >= 760, onTap: () => _open(routines.single, profile, hasPlan)))
      else
        ResponsiveGrid(minItemWidth: 420, children: [for (final routine in routines) _RoutineCard(routine: routine, profileDays: profileDays, featured: true, onTap: () => _open(routine, profile, hasPlan))]),
      if (alternatives.isNotEmpty) ...[
        const SizedBox(height: 12),
        Text('Otras formas de organizar tu semana', key: const Key('alternatives-title'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.4)),
        const SizedBox(height: 2),
        Text('Las mismas condiciones de tu perfil, con otra división de los días.', style: TextStyle(color: tokens.muted, fontSize: 13.5)),
        const SizedBox(height: 12),
        ResponsiveGrid(minItemWidth: 360, children: [for (final routine in alternatives) _RoutineCard(routine: routine, profileDays: profileDays, onTap: () => _open(routine, profile, hasPlan))]),
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
      ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: TextField(
          key: const Key('routine-search'),
          decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Buscar rutina', isDense: true),
          onChanged: (value) => setState(() => _routineQuery = value),
        ),
      ),
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 8, children: [
        FilterChip(key: const Key('filter-all'), label: const Text('Todas'), selected: _objective == null, onSelected: (_) => setState(() => _objective = null)),
        for (final entry in objectiveLabels.entries)
          FilterChip(key: Key('filter-${entry.key}'), label: Text(entry.value), selected: _objective == entry.key, onSelected: (_) => setState(() => _objective = entry.key)),
      ]),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        FilterChip(key: const Key('split-all'), label: const Text('Cualquier división'), selected: _split == null, onSelected: (_) => setState(() => _split = null)),
        for (final entry in splitLabels.entries)
          FilterChip(key: Key('split-${entry.key}'), label: Text(entry.value), tooltip: splitDescriptions[entry.key], selected: _split == entry.key, onSelected: (_) => setState(() => _split = entry.key)),
      ]),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final entry in levelLabels.entries)
          FilterChip(key: Key('level-${entry.key}'), label: Text(entry.value), selected: _level == entry.key, onSelected: (selected) => setState(() => _level = selected ? entry.key : null)),
        for (final entry in equipmentLabels.entries)
          FilterChip(key: Key('equipment-${entry.key}'), label: Text(entry.value), selected: _equipment == entry.key, onSelected: (selected) => setState(() => _equipment = selected ? entry.key : null)),
      ]),
      const SizedBox(height: 12),
      Text('${shown.length} ${shown.length == 1 ? 'rutina' : 'rutinas'}', key: const Key('routines-count'), style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 12),
      ResponsiveGrid(minItemWidth: 360, children: [for (final routine in shown) _RoutineCard(routine: routine, profileDays: (profile?['days'] as List?)?.cast<int>(), onTap: () => _open(routine, profile, hasPlan))]),
    ];
  }

  List<Widget> _library(List<Map<String, dynamic>> exercises) {
    final query = _plain(_exerciseQuery.trim());
    final shown = exercises.where((exercise) =>
        (_group == null || exercise['muscleGroup'] == _group) &&
        (_exerciseEquipment == null || (exercise['requiresEquipment'] == true) == (_exerciseEquipment == 'con_equipo')) &&
        (query.isEmpty || _plain('${exercise['name']} ${exercise['description']}').contains(query))).toList();
    return [
      Text('Todos los ejercicios aprobados por el preparador físico. Pruébalos o úsalos para armar tu propia rutina.', style: TextStyle(fontSize: 13.5, color: FitTokens.of(context).muted)),
      const SizedBox(height: 12),
      ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: TextField(
          key: const Key('exercise-search'),
          decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Buscar ejercicio', isDense: true),
          onChanged: (value) => setState(() => _exerciseQuery = value),
        ),
      ),
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 8, children: [
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
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final entry in equipmentLabels.entries)
          FilterChip(key: Key('exercise-equipment-${entry.key}'), label: Text(entry.value), selected: _exerciseEquipment == entry.key, onSelected: (selected) => setState(() => _exerciseEquipment = selected ? entry.key : null)),
      ]),
      const SizedBox(height: 12),
      Text('${shown.length} ${shown.length == 1 ? 'ejercicio' : 'ejercicios'}', key: const Key('exercises-count'), style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 8),
      for (final exercise in shown) _ExerciseTile(exercise: exercise),
    ];
  }
}

/// Un ejercicio de la biblioteca: ícono del grupo, nombre y etiquetas; al tocarlo muestra la descripción.
class _ExerciseTile extends StatelessWidget {
  const _ExerciseTile({required this.exercise});
  final Map<String, dynamic> exercise;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    return FitCard(
      margin: const EdgeInsets.only(bottom: 8),
      padding: EdgeInsets.zero,
      child: ExpansionTile(
        key: Key('exercise-${exercise['code']}'),
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: IconBadge(muscleGroupIcons[exercise['muscleGroup']] ?? Icons.fitness_center, size: 40),
        title: Text(exercise['name'] as String, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
          '${muscleGroupLabels[exercise['muscleGroup']]}${exercise['requiresEquipment'] == true ? ' · con equipo' : ' · sin equipo'}${exercise['highImpact'] == true ? ' · alto impacto' : ''}',
          style: TextStyle(fontSize: 12.5, color: tokens.muted),
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(exercise['description'] as String, style: const TextStyle(height: 1.4)),
          const SizedBox(height: 10),
          Pill('Indicación sugerida: ${exercise['defaultPrescription']}', icon: Icons.repeat_rounded),
          if (exercise['minLevel'] == 'con_experiencia') Padding(padding: const EdgeInsets.only(top: 8), child: Text('Para personas con experiencia.', style: Theme.of(context).textTheme.bodySmall)),
        ],
      ),
    );
  }
}

/// IMC con una barra de rangos (bajo peso, normal, sobrepeso y obesidad) y un marcador en el valor de la persona.
class _BmiBanner extends StatelessWidget {
  const _BmiBanner({required this.bmi, required this.label});
  final double bmi;
  final String label;

  static const _min = 15.0;
  static const _max = 40.0;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final scheme = Theme.of(context).colorScheme;
    // Tramos de la escala: hasta 18,5; 18,5 a 25; 25 a 30; 30 en adelante.
    final zones = [(flex: 35, color: tokens.info), (flex: 65, color: scheme.primary), (flex: 50, color: tokens.streak), (flex: 100, color: tokens.danger)];
    final position = ((bmi - _min) / (_max - _min)).clamp(0.0, 1.0);
    final healthy = bmi >= 18.5 && bmi < 25;
    return FitCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        IconBadge(Icons.monitor_weight_outlined, color: healthy ? tokens.accent : tokens.streak, size: 42),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text('Tu IMC: ${bmi.toStringAsFixed(1).replaceAll('.', ',')} ($label)', key: const Key('bmi-line'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, fontFeatures: tabularFigures))),
              const SizedBox(width: 6),
              Tooltip(
                message: 'El IMC es solo una referencia: no distingue músculo de grasa. Rango saludable: 18,5 a 24,9.',
                child: Icon(Icons.info_outline, size: 16, color: tokens.muted),
              ),
            ]),
            const SizedBox(height: 10),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: LayoutBuilder(builder: (context, constraints) {
                final width = constraints.maxWidth;
                return SizedBox(
                  height: 14,
                  child: Stack(clipBehavior: Clip.none, children: [
                    Positioned(
                      left: 0,
                      right: 0,
                      top: 4,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: Row(children: [for (final zone in zones) Expanded(flex: zone.flex, child: Container(height: 6, color: zone.color.withValues(alpha: 0.6)))]),
                      ),
                    ),
                    Positioned(
                      left: (position * width - 7).clamp(0.0, width - 14),
                      top: 0,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: tokens.card, width: 3), boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 4)]),
                      ),
                    ),
                  ]),
                );
              }),
            ),
            const SizedBox(height: 6),
            Text('Rango saludable: 18,5 a 24,9', style: TextStyle(fontSize: 11.5, color: tokens.muted)),
          ]),
        ),
      ]),
    );
  }
}

class _RoutineCard extends StatelessWidget {
  const _RoutineCard({required this.routine, required this.onTap, this.profileDays, this.featured = false, this.split = false});
  final Map<String, dynamic> routine;
  final VoidCallback onTap;
  final List<int>? profileDays;
  final bool featured;
  /// En dos columnas: datos de la rutina a la izquierda; semana, motivos y botón a la derecha.
  final bool split;

  static String _daysText(Map<String, dynamic> routine) =>
      routine['minDays'] == routine['maxDays'] ? '${routine['minDays']} días/semana' : '${routine['minDays']} a ${routine['maxDays']} días/semana';

  static const _objectiveIcons = {'bajar': Icons.trending_down, 'mantener': Icons.track_changes, 'subir': Icons.trending_up};

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final reasons = (routine['reasons'] as List).cast<String>();
    final notes = ((routine['fit'] as Map)['notes'] as List).cast<String>();
    final labels = ((routine['sessionLabels'] as List?) ?? const []).cast<String>();
    final days = defaultDays(profileDays, routine['minDays'] as int, routine['maxDays'] as int);
    final title = routineTitle(routine['name'] as String);
    final splitLabel = splitLabels[routine['split']];
    // Si el título ya es la división (por ejemplo «Full body»), no se repite en la línea de datos.
    final meta = [
      if (splitLabel != null && routineTitle(splitLabel) != title) splitLabel,
      '${routine['sessionsCount']} sesiones',
      _daysText(routine),
    ].join(' · ');
    final info = <Widget>[
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: TextStyle(fontSize: featured ? 24 : 20, fontWeight: FontWeight.w800, letterSpacing: -0.6, height: 1.15)),
                const SizedBox(height: 4),
                Text(meta, key: Key('routine-meta-${routine['id']}'), style: TextStyle(fontSize: 13, color: tokens.muted, fontWeight: FontWeight.w600)),
              ]),
            ),
            if (routine['recommended'] == true) ...[const SizedBox(width: 8), const StatusChip('Recomendada', icon: Icons.star_rounded)],
          ]),
          const SizedBox(height: 12),
          Wrap(spacing: 6, runSpacing: 6, children: [
            if (objectiveLabels[routine['objective']] case final objective?) Pill(objective, icon: _objectiveIcons[routine['objective']] ?? Icons.flag_outlined, color: tokens.accent),
            if (levelLabels[routine['level']] case final level?) Pill(level, icon: Icons.bolt_rounded, color: tokens.carbs),
            if (equipmentLabels[routine['equipment']] case final equipment?) Pill(equipment, icon: routine['equipment'] == 'con_equipo' ? Icons.fitness_center : Icons.accessibility_new, color: tokens.protein),
            Pill('${routine['sessionMinutes']} min', icon: Icons.timer_outlined),
            Pill('${routine['weeks']} semanas', icon: Icons.date_range_outlined),
            if (bmiCategoryLabels[routine['bmiCategory']] case final bmi?) Pill(bmi, icon: Icons.monitor_weight_outlined),
          ]),
          const SizedBox(height: 10),
          Text(routine['summary'] as String, style: TextStyle(fontSize: 13.5, height: 1.4, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.85))),
    ];
    final plan = <Widget>[
          if (labels.isNotEmpty) ...[
            if (!split) const SizedBox(height: 12),
            WeekPreview(
              key: Key('routine-week-${routine['id']}'),
              trainingDays: days,
              labels: {for (final (index, day) in days.indexed) day: labels[index % labels.length]},
            ),
          ],
          if (reasons.isNotEmpty) const SizedBox(height: 10),
          for (final reason in reasons)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(top: 1), child: Icon(Icons.check_circle_rounded, size: 15, color: tokens.accent)),
                const SizedBox(width: 8),
                Expanded(child: Text(reason, style: Theme.of(context).textTheme.bodySmall)),
              ]),
            ),
          for (final note in notes) Callout(icon: Icons.warning_amber_rounded, color: tokens.streak, child: Text(note)),
          if (featured) ...[
            const SizedBox(height: 12),
            Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              Flexible(child: Text('Ver rutina y elegir días', textAlign: TextAlign.end, style: TextStyle(color: tokens.accent, fontWeight: FontWeight.w700))),
              const SizedBox(width: 4),
              Icon(Icons.arrow_forward_rounded, size: 18, color: tokens.accent),
            ]),
          ],
    ];
    return FitCard(
      hero: featured,
      inkKey: Key('routine-${routine['id']}'),
      onTap: onTap,
      padding: EdgeInsets.all(split ? 24 : 20),
      child: split
          ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(flex: 6, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: info)),
              const SizedBox(width: 32),
              Expanded(flex: 5, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: plan)),
            ])
          : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [...info, ...plan]),
    );
  }
}
