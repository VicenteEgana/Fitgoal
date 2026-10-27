import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import 'session_screen.dart';

/// Mi rutina: la racha, el horario de la semana con la sesión de cada día o el descanso, la rutina vigente y el progreso
/// (RF004, RF007).
class PlanTab extends StatelessWidget {
  const PlanTab({super.key, required this.api, required this.onGoToProfile, required this.onGoToRoutines});
  final ApiClient api;
  final VoidCallback onGoToProfile;
  final VoidCallback onGoToRoutines;

  Future<Map<String, dynamic>> _load() async {
    final results = await Future.wait([
      api.get('/api/plans/me'),
      api.get('/api/sessions/me'),
      api.get('/api/progress/me'),
      api.get('/api/profiles/me'),
      api.get('/api/schedule/me'),
    ]);
    return {
      'plan': (results[0] as Map)['plan'],
      'sessions': (results[1] as Map)['sessions'],
      'today': (results[1] as Map)['today'],
      'progress': results[2],
      'profile': (results[3] as Map)['profile'],
      'schedule': results[4],
    };
  }

  Future<void> _register(BuildContext context, Map<String, dynamic> session, String title, bool weightsEnabled, Future<void> Function() reload) async {
    final message = await registerSession(context, api, sessionId: session['id'] as String, title: title, weightsEnabled: weightsEnabled);
    if (message == null) return;
    await reload();
    if (context.mounted) showMessage(context, message);
  }

  Future<void> _train(BuildContext context, Map<String, dynamic> session, bool weightsEnabled, Future<void> Function() reload) async {
    final message = await Navigator.push<String>(context, MaterialPageRoute(builder: (_) => SessionScreen(api: api, session: session, weightsEnabled: weightsEnabled)));
    if (message == null) return;
    await reload();
    if (context.mounted) showMessage(context, message);
  }

  /// Cambia la sesión de día y devuelve la nueva fecha (o null si la persona no la movió).
  Future<String?> _move(BuildContext context, String sessionId, Future<void> Function() reload) async {
    final moved = await moveSession(context, api, sessionId);
    if (moved == null) return null;
    await reload();
    if (context.mounted) showMessage(context, moved.message);
    return moved.date;
  }

  @override
  Widget build(BuildContext context) {
    return Loader<Map<String, dynamic>>(
      load: _load,
      keepPrevious: true,
      builder: (context, data, reload) {
        final plan = data['plan'] as Map<String, dynamic>?;
        final profile = data['profile'] as Map<String, dynamic>?;
        final progress = data['progress'] as Map<String, dynamic>;
        final today = data['today'] as String;
        final weightsEnabled = progress['weightsEnabled'] == true;
        final streak = progress['streak'] as Map<String, dynamic>?;
        final unregistered = (data['sessions'] as List).cast<Map<String, dynamic>>()
            .where((item) => item['planStatus'] == 'vigente' && item['completed'] != true && (item['plannedDate'] as String).compareTo(today) < 0)
            .toList();
        final profileChanged = plan != null && profile != null && (profile['version'] as int) > (plan['profileVersion'] as int);
        final hasHistory = streak != null && ((streak['best'] as int) > 0 || plan != null);
        // La sesión de hoy, si todavía se puede hacer: la tarjeta de la racha la ofrece arriba, sin tener que buscarla.
        final todayEntry = ((data['schedule'] as Map<String, dynamic>)['days'] as List).cast<Map<String, dynamic>>().where((day) => day['isToday'] == true).firstOrNull;
        final todaySession = todayEntry?['session'] as Map<String, dynamic>?;
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (plan == null)
              SectionCard(
                title: 'Tu rutina',
                children: [
                  const Text('Aún no tienes una rutina. Elige una recomendada y empieza mañana, o arma la tuya con los ejercicios del catálogo.', key: Key('no-plan')),
                  const SizedBox(height: 12),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    if (profile == null) FilledButton.tonal(key: const Key('go-profile'), onPressed: onGoToProfile, child: const Text('Completar perfil')),
                    FilledButton(key: const Key('go-routines'), onPressed: onGoToRoutines, child: const Text('Ver rutinas')),
                  ]),
                ],
              ),
            if (hasHistory)
              _StreakCard(
                streak: streak,
                todaySession: todaySession?['canRegister'] == true ? todaySession : null,
                onTrain: (session) => _train(context, session, weightsEnabled, reload),
              ),
            if (unregistered.isNotEmpty)
              SectionCard(
                title: 'Sin registrar',
                children: [
                  Text('¿La hiciste? Regístrala para que tu progreso refleje lo que hiciste. ¿No pudiste? Cámbiala a otro día.', style: Theme.of(context).textTheme.bodySmall),
                  for (final session in unregistered)
                    Padding(
                      key: Key('unregistered-${session['id']}'),
                      padding: const EdgeInsets.only(top: 12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Icon(Icons.radio_button_unchecked, size: 20, color: Theme.of(context).colorScheme.error),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(session['label'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(formatLongDate(session['plannedDate'] as String), style: Theme.of(context).textTheme.bodySmall),
                            ]),
                          ),
                        ]),
                        const SizedBox(height: 8),
                        Row(children: [
                          Expanded(
                            child: FilledButton.tonal(
                              key: Key('complete-${session['id']}'),
                              onPressed: () => _register(context, session, session['label'] as String, weightsEnabled, reload),
                              child: const Text('Registrar'),
                            ),
                          ),
                          if (session['canMove'] == true) ...[
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                key: Key('move-${session['id']}'),
                                onPressed: () => _move(context, session['id'] as String, reload),
                                icon: const Icon(Icons.event_repeat, size: 18),
                                label: const Text('Cambiar de día'),
                              ),
                            ),
                          ],
                        ]),
                      ]),
                    ),
                ],
              ),
            if (plan != null || hasHistory)
              _WeekCard(
                api: api,
                initial: data['schedule'] as Map<String, dynamic>,
                onGoToRoutines: onGoToRoutines,
                onTrain: (session) => _train(context, session, weightsEnabled, reload),
                onRegister: (session) => _register(context, session, session['name'] as String, weightsEnabled, reload),
                onMove: (session) => _move(context, session['id'] as String, reload),
              ),
            if (plan != null) _PlanCard(plan: plan, profileChanged: profileChanged, onGoToRoutines: onGoToRoutines),
            _ProgressCard(progress: progress),
          ],
        );
      },
    );
  }
}

/// Racha de días seguidos cumpliendo el plan: las sesiones registradas y los días de descanso suman. Si hoy toca entrenar,
/// ofrece empezar la sesión desde aquí.
class _StreakCard extends StatelessWidget {
  const _StreakCard({required this.streak, required this.todaySession, required this.onTrain});
  final Map<String, dynamic> streak;
  final Map<String, dynamic>? todaySession;
  final void Function(Map<String, dynamic> session) onTrain;

  String _message() {
    final current = streak['current'] as int;
    final milestone = streak['milestone'] as int?;
    final lastMissed = streak['lastMissedOn'] as String?;
    if (milestone != null) return '¡$milestone días seguidos! Llegaste a un nuevo hito.';
    return switch (streak['today']) {
      'pendiente' => 'Hoy te toca entrenar: registra tu sesión para sumar un día.',
      'hecho' => 'Listo por hoy: tu sesión ya está registrada.',
      'movida' => 'Moviste la sesión de hoy a otro día: hoy no suma ni corta tu racha.',
      'descanso' when current > 0 => 'Hoy descansas: el descanso también suma a tu racha.',
      'sin_rutina' when current > 0 => 'Tu rutina terminó: empieza otra hoy para no perder tu racha.',
      _ when current == 0 && lastMissed != null => 'Lo importante es no fallar dos veces seguidas: registra tu próxima sesión y tu racha vuelve a empezar.',
      _ when current == 0 => 'Tu racha empieza con tu primera sesión registrada.',
      _ => 'Sigue así: cada sesión registrada y cada descanso de tu rutina suman.',
    };
  }

  void _explain(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cómo funciona tu racha'),
        content: const Text(
          '• Suma un día cada vez que registras la sesión programada y cada día de descanso de tu rutina: descansar también es parte del plan.\n'
          '• Empieza con tu primera sesión registrada.\n'
          '• La sesión de hoy no corta la racha mientras el día no termine.\n'
          '• Comodín semanal: si una semana te falta registrar una sesión, la racha no se corta (ese día no suma). La segunda sesión sin registrar de la semana sí la corta.\n'
          '• Si la hiciste y olvidaste registrarla, regístrala después y cuenta.\n'
          '• Si no puedes entrenar un día, cambia la sesión a otro día libre (hasta una semana después): ese día no suma ni corta tu racha.\n'
          '• Tu adherencia no cambia: una sesión sin registrar siempre cuenta como no realizada.',
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Entendido'))],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final current = streak['current'] as int;
    final next = streak['nextMilestone'] as Map<String, dynamic>?;
    final freeze = streak['freeze'] as Map<String, dynamic>;
    return Card(
      key: const Key('streak-card'),
      color: scheme.primaryContainer,
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(color: scheme.surface.withValues(alpha: 0.5), shape: BoxShape.circle),
                child: Icon(Icons.local_fire_department, size: 36, color: current > 0 ? Colors.deepOrange : scheme.outline),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('$current', key: const Key('streak-count'), style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800, color: scheme.onPrimaryContainer, height: 1.1)),
                  Text(current == 1 ? 'día de racha' : 'días de racha', style: TextStyle(color: scheme.onPrimaryContainer)),
                ]),
              ),
            ]),
            const SizedBox(height: 6),
            Wrap(spacing: 16, runSpacing: 4, children: [
              Text('Récord: ${streak['best']} ${streak['best'] == 1 ? 'día' : 'días'}', key: const Key('streak-best'), style: TextStyle(fontWeight: FontWeight.w600, color: scheme.onPrimaryContainer)),
              Text.rich(
                TextSpan(children: [
                  WidgetSpan(alignment: PlaceholderAlignment.middle, child: Icon(Icons.ac_unit, size: 16, color: scheme.onPrimaryContainer)),
                  TextSpan(text: freeze['available'] == true ? ' Comodín disponible' : ' Comodín usado el ${formatDate(freeze['usedOn'] as String)}'),
                ]),
                key: const Key('streak-freeze'),
                style: TextStyle(color: scheme.onPrimaryContainer),
              ),
            ]),
            const SizedBox(height: 8),
            Text(_message(), key: const Key('streak-message'), style: TextStyle(color: scheme.onPrimaryContainer)),
            if (next != null) ...[
              const SizedBox(height: 8),
              LinearProgressIndicator(value: current / (next['days'] as int), minHeight: 6, borderRadius: BorderRadius.circular(3), backgroundColor: scheme.surface.withValues(alpha: 0.6)),
              const SizedBox(height: 4),
              Row(children: [
                Expanded(child: Text('Faltan ${next['remaining']} ${next['remaining'] == 1 ? 'día' : 'días'} para tu racha de ${next['days']}', key: const Key('streak-next'), style: TextStyle(fontSize: 12, color: scheme.onPrimaryContainer))),
                TextButton(key: const Key('streak-info'), onPressed: () => _explain(context), child: const Text('¿Cómo funciona?')),
              ]),
            ],
            if (todaySession case final session?) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  key: const Key('hero-start-session'),
                  onPressed: () => onTrain(session),
                  icon: const Icon(Icons.play_arrow),
                  label: Text('Empezar: ${session['name']}', overflow: TextOverflow.ellipsis),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Horario semanal: lunes a domingo con el estado de cada día; al tocar un día se ve su sesión o su descanso.
class _WeekCard extends StatefulWidget {
  const _WeekCard({required this.api, required this.initial, required this.onGoToRoutines, required this.onTrain, required this.onRegister, required this.onMove});
  final ApiClient api;
  final Map<String, dynamic> initial;
  final VoidCallback onGoToRoutines;
  final void Function(Map<String, dynamic> session) onTrain;
  final void Function(Map<String, dynamic> session) onRegister;
  final Future<String?> Function(Map<String, dynamic> session) onMove;

  @override
  State<_WeekCard> createState() => _WeekCardState();
}

class _WeekCardState extends State<_WeekCard> {
  late Map<String, dynamic> _week = widget.initial;
  late String _selected = _defaultDay(widget.initial);
  bool _loading = false;
  /// Tras mover una sesión, al llegar los datos nuevos se vuelve a mostrar la tarjeta (la lista pudo cambiar de alto).
  bool _reveal = false;

  static String _defaultDay(Map<String, dynamic> week) {
    final days = (week['days'] as List).cast<Map<String, dynamic>>();
    return (days.firstWhere((day) => day['isToday'] == true, orElse: () => days.first))['date'] as String;
  }

  bool _contains(Map<String, dynamic> week, String date) => (week['days'] as List).any((day) => day['date'] == date);

  /// Tras recargar «Mi rutina» (por ejemplo, al registrar o mover una sesión) se actualiza la semana que se está viendo,
  /// sin perder el día elegido.
  @override
  void didUpdateWidget(_WeekCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (identical(widget.initial, oldWidget.initial)) return;
    if (_reveal) {
      _reveal = false;
      _revealSoon();
    }
    if (_week['weekStart'] == widget.initial['weekStart']) {
      _week = widget.initial;
      if (!_contains(_week, _selected)) _selected = _defaultDay(_week);
    } else {
      _go(_week['weekStart'] as String, select: _selected);
    }
  }

  /// Muestra la semana de `date`, con `select` (o hoy, o el lunes) como día elegido.
  Future<void> _go(String? date, {String? select}) async {
    if (date == null || _loading) return;
    setState(() => _loading = true);
    try {
      final week = await widget.api.get('/api/schedule/me?date=$date') as Map<String, dynamic>;
      if (mounted) setState(() { _week = week; _selected = select != null && _contains(week, select) ? select : _defaultDay(week); _loading = false; });
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _loading = false);
        showMessage(context, error.message);
      }
    }
  }

  void _show(String date) {
    if (_contains(_week, date)) {
      setState(() => _selected = date);
    } else {
      _go(date, select: date);
    }
  }

  void _revealSoon() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (mounted) Scrollable.ensureVisible(context, alignment: 0.05, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
  });

  /// Mueve la sesión y deja a la vista su nuevo día.
  Future<void> _move(Map<String, dynamic> session) async {
    final date = await widget.onMove(session);
    if (date == null || !mounted) return;
    _reveal = true;
    _show(date);
    _revealSoon();
  }

  @override
  Widget build(BuildContext context) {
    final days = (_week['days'] as List).cast<Map<String, dynamic>>();
    final selected = days.firstWhere((day) => day['date'] == _selected, orElse: () => days.first);
    final isCurrentWeek = days.any((day) => day['isToday'] == true);
    return SectionCard(
      title: 'Tu semana',
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton(key: const Key('week-previous'), tooltip: 'Semana anterior', onPressed: _week['previousWeek'] == null ? null : () => _go(_week['previousWeek'] as String), icon: const Icon(Icons.chevron_left)),
        IconButton(key: const Key('week-next'), tooltip: 'Semana siguiente', onPressed: _week['nextWeek'] == null ? null : () => _go(_week['nextWeek'] as String), icon: const Icon(Icons.chevron_right)),
      ]),
      children: [
        Row(children: [
          Text(formatWeekRange(_week['weekStart'] as String, _week['weekEnd'] as String), key: const Key('week-range'), style: Theme.of(context).textTheme.bodySmall),
          if (!isCurrentWeek) TextButton(key: const Key('week-today'), onPressed: () => _go(_week['today'] as String), child: const Text('Volver a hoy')),
          if (_loading) const Padding(padding: EdgeInsets.only(left: 8), child: SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          for (final day in days)
            Expanded(child: _DayCell(day: day, selected: day['date'] == _selected, onTap: () => setState(() => _selected = day['date'] as String))),
        ]),
        const Divider(height: 24),
        _DayDetail(
          day: selected,
          today: _week['today'] as String,
          restSuggestions: ((_week['restSuggestions'] as List?) ?? const []).cast<Map<String, dynamic>>(),
          onGoToRoutines: widget.onGoToRoutines,
          onTrain: widget.onTrain,
          onRegister: widget.onRegister,
          onMove: _move,
          onShowDay: _show,
        ),
      ],
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({required this.day, required this.selected, required this.onTap});
  final Map<String, dynamic> day;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final style = dayStatusStyle(context, day['status'] as String);
    final isToday = day['isToday'] == true;
    return Semantics(
      label: '${day['dayLabel']}: ${style.label}',
      selected: selected,
      child: InkWell(
        key: Key('day-cell-${day['date']}'),
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(color: selected ? scheme.secondaryContainer.withValues(alpha: 0.6) : null, borderRadius: BorderRadius.circular(12)),
          child: Column(children: [
            Text(dayInitials[(day['weekday'] as int) - 1], style: TextStyle(fontSize: 12, fontWeight: isToday ? FontWeight.w800 : FontWeight.w500, color: isToday ? scheme.primary : scheme.onSurfaceVariant)),
            const SizedBox(height: 4),
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: style.background,
                shape: BoxShape.circle,
                border: Border.all(color: isToday ? scheme.primary : Colors.transparent, width: 2),
              ),
              child: Icon(style.icon, size: 18, color: style.foreground),
            ),
            const SizedBox(height: 2),
            Text('${dayOfMonth(day['date'] as String)}', style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
          ]),
        ),
      ),
    );
  }
}

/// Lo que toca el día elegido: la sesión con sus ejercicios (y empezarla, registrarla o cambiarla de día), el descanso, el
/// aviso de que la sesión se movió a otro día o nada.
class _DayDetail extends StatelessWidget {
  const _DayDetail({
    required this.day, required this.today, required this.restSuggestions, required this.onGoToRoutines, required this.onTrain, required this.onRegister,
    required this.onMove, required this.onShowDay,
  });
  final Map<String, dynamic> day;
  final String today;
  final List<Map<String, dynamic>> restSuggestions;
  final VoidCallback onGoToRoutines;
  final void Function(Map<String, dynamic> session) onTrain;
  final void Function(Map<String, dynamic> session) onRegister;
  final void Function(Map<String, dynamic> session) onMove;
  final void Function(String date) onShowDay;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final status = day['status'] as String;
    final session = day['session'] as Map<String, dynamic>?;
    final heading = '${day['isToday'] == true ? 'Hoy · ' : ''}${formatLongDate(day['date'] as String)}';
    final style = dayStatusStyle(context, status);
    final canMove = session?['canMove'] == true;
    Widget moveButton(Map<String, dynamic> session) => OutlinedButton.icon(
      key: Key('day-move-${session['id']}'),
      onPressed: () => onMove(session),
      icon: const Icon(Icons.event_repeat, size: 18),
      label: const Text('Cambiar de día'),
    );
    return Column(
      key: Key('day-detail-${day['date']}'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(heading, key: const Key('day-heading'), style: Theme.of(context).textTheme.labelLarge?.copyWith(color: scheme.primary)),
        const SizedBox(height: 4),
        if (session != null) ...[
          Text(session['name'] as String, key: const Key('day-session-name'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          Text('${session['minutes']} min · ${(session['exercises'] as List).length} ejercicios', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 6),
          GroupChips((session['groups'] as List).cast<String>()),
          const SizedBox(height: 6),
          Row(children: [
            Icon(style.icon, size: 16, color: status == 'perdido' ? scheme.error : scheme.primary),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                switch (status) {
                  'hecho' => 'Realizada${session['note'] == null ? '' : ' · «${session['note']}»'}',
                  'comodin' => 'Sin registrar: la cubrió tu comodín semanal y tu racha sigue.',
                  'perdido' => canMove ? 'Sin registrar. Si no pudiste hacerla, cámbiala a otro día.' : 'Sin registrar.',
                  'pendiente' => 'Te toca hoy.',
                  _ => 'Programada.',
                },
                key: const Key('day-status'),
              ),
            ),
          ]),
          if (session['movedFrom'] case final String movedFrom)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(children: [
                Icon(Icons.event_repeat, size: 16, color: scheme.tertiary),
                const SizedBox(width: 6),
                Expanded(child: Text('Movida desde el ${formatLongDate(movedFrom)}', key: const Key('day-moved-from'), style: Theme.of(context).textTheme.bodySmall)),
              ]),
            ),
          for (final (index, exercise) in (session['exercises'] as List).cast<Map<String, dynamic>>().indexed)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(radius: 14, child: Text('${index + 1}', style: const TextStyle(fontSize: 12))),
              title: Text(exercise['name'] as String),
              subtitle: Text(exercise['prescription'] as String),
            ),
          if (session['canRegister'] == true) ...[
            const SizedBox(height: 8),
            if (day['isToday'] == true) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(key: const Key('start-session'), onPressed: () => onTrain(session), icon: const Icon(Icons.play_arrow), label: const Text('Empezar sesión')),
              ),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: TextButton(key: Key('day-register-${session['id']}'), onPressed: () => onRegister(session), child: const Text('Ya la hice'))),
                if (canMove) ...[const SizedBox(width: 8), Expanded(child: moveButton(session))],
              ]),
            ] else
              Row(children: [
                Expanded(child: FilledButton.tonal(key: Key('day-register-${session['id']}'), onPressed: () => onRegister(session), child: const Text('Registrar'))),
                if (canMove) ...[const SizedBox(width: 8), Expanded(child: moveButton(session))],
              ]),
          ] else if (canMove) ...[
            const SizedBox(height: 8),
            Align(alignment: Alignment.centerLeft, child: moveButton(session)),
          ],
        ] else if (status == 'movida') ...[
          Row(children: [
            Icon(Icons.event_repeat, color: scheme.tertiary),
            const SizedBox(width: 8),
            Text('Sesión movida', key: const Key('moved-day'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 4),
          Text(
            day['movedTo'] == null ? 'Cambiaste la sesión de este día a otro día.' : 'La cambiaste al ${formatLongDate(day['movedTo'] as String)}. Este día no suma ni corta tu racha.',
            key: const Key('moved-day-text'),
          ),
          if (day['movedTo'] case final String movedTo)
            TextButton.icon(key: const Key('show-moved-day'), onPressed: () => onShowDay(movedTo), icon: const Icon(Icons.arrow_forward, size: 18), label: const Text('Ver ese día')),
        ] else if (status == 'descanso') ...[
          Row(children: [
            Icon(Icons.bedtime_outlined, color: scheme.primary),
            const SizedBox(width: 8),
            Text('Día de descanso', key: const Key('rest-day'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 4),
          const Text('Descansar es parte del plan: entre sesiones tus músculos se recuperan y se adaptan. El descanso también suma a tu racha.'),
          if (restSuggestions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Si quieres moverte, algo suave y opcional: una caminata a ritmo cómodo o movilidad del catálogo aprobado.', style: Theme.of(context).textTheme.bodySmall),
            for (final item in restSuggestions)
              ListTile(dense: true, contentPadding: EdgeInsets.zero, leading: const Icon(Icons.self_improvement), title: Text(item['name'] as String), subtitle: Text(item['prescription'] as String)),
          ],
        ] else ...[
          const Text('Sin rutina este día.', key: Key('no-routine-day')),
          if ((day['date'] as String).compareTo(today) >= 0) TextButton(onPressed: onGoToRoutines, child: const Text('Ver rutinas')),
        ],
      ],
    );
  }
}

/// La rutina vigente: origen, duración, semana en curso y la semana tipo con sus días de descanso.
class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan, required this.profileChanged, required this.onGoToRoutines});
  final Map<String, dynamic> plan;
  final bool profileChanged;
  final VoidCallback onGoToRoutines;

  @override
  Widget build(BuildContext context) {
    final schedule = (plan['schedule'] as List).cast<Map<String, dynamic>>();
    final week = ((plan['week'] as List?) ?? const []).cast<Map<String, dynamic>>();
    final currentWeek = plan['currentWeek'] as int?;
    final weeks = plan['weeks'] as int;
    final template = plan['template'] as Map<String, dynamic>?;
    return SectionCard(
      title: 'Tu rutina',
      trailing: StatusChip(plan['source'] == 'recomendada' ? 'Recomendada' : 'Propia'),
      children: [
        Text(plan['name'] as String, key: const Key('plan-name'), style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Row(children: [
          const Icon(Icons.verified, size: 16),
          const SizedBox(width: 6),
          Expanded(
            child: Text(plan['source'] == 'recomendada'
                ? 'Rutina aprobada por un profesional${template == null ? '' : ' · versión ${template['version']}'}'
                : 'Armada por ti con ejercicios aprobados por un profesional'),
          ),
        ]),
        const SizedBox(height: 4),
        Text(
          [
            if (template?['split'] != null) splitLabels[template!['split']],
            '$weeks semanas',
            '${plan['sessionMinutes']} min por sesión',
            '${schedule.length} ${schedule.length == 1 ? 'día' : 'días'} de entrenamiento y ${7 - schedule.length} de descanso',
          ].join(' · '),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        if (currentWeek != null) ...[
          const SizedBox(height: 8),
          Text(
            currentWeek == 0 ? 'Empieza el ${formatDate(plan['startsOn'] as String)}' : currentWeek > weeks ? 'Terminó el ${formatDate(plan['endsOn'] as String)}: elige tu próxima rutina.' : 'Semana $currentWeek de $weeks · termina el ${formatDate(plan['endsOn'] as String)}',
            key: const Key('plan-week-progress'),
          ),
          const SizedBox(height: 4),
          LinearProgressIndicator(value: (currentWeek.clamp(0, weeks)) / weeks, minHeight: 6, borderRadius: BorderRadius.circular(3)),
        ],
        if (profileChanged) ...[
          const SizedBox(height: 8),
          const Text('Cambiaste tu perfil después de empezar esta rutina. Mira las recomendadas para tu perfil actual.', key: Key('profile-changed'), style: TextStyle(fontSize: 12)),
          TextButton(key: const Key('see-routines'), onPressed: onGoToRoutines, child: const Text('Ver rutinas recomendadas')),
        ],
        if (week.isNotEmpty)
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              key: const Key('plan-week'),
              tilePadding: EdgeInsets.zero,
              title: const Text('Semana tipo'),
              subtitle: const Text('Qué toca cada día, con tus días de descanso'),
              children: [
                for (final day in week)
                  if (day['type'] == 'descanso')
                    ListTile(
                      key: Key('week-day-${day['day']}'),
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.bedtime_outlined),
                      title: Text('${day['dayLabel']} · Descanso'),
                    )
                  else
                    ExpansionTile(
                      key: Key('week-day-${day['day']}'),
                      tilePadding: EdgeInsets.zero,
                      leading: const Icon(Icons.fitness_center),
                      title: Text('${day['dayLabel']} · ${day['label']}'),
                      children: [
                        for (final exercise in (schedule.firstWhere((item) => item['day'] == day['day'])['exercises'] as List).cast<Map<String, dynamic>>())
                          ListTile(dense: true, title: Text(exercise['name'] as String), subtitle: Text(exercise['prescription'] as String)),
                      ],
                    ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Adherencia por semana (K3), calendario de las últimas semanas y peso, si está habilitado.
class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.progress});
  final Map<String, dynamic> progress;

  @override
  Widget build(BuildContext context) {
    final calendar = ((progress['calendar'] as List?) ?? const []).cast<Map<String, dynamic>>();
    final today = progress['today'] as String;
    return SectionCard(
      title: 'Progreso',
      children: [
        if (progress['adherence'] == null)
          const Text('Todavía no hay sesiones vencidas para calcular tu adherencia.')
        else ...[
          Text('Adherencia: ${((progress['adherence'] as num) * 100).round()} %', key: const Key('adherence'), style: Theme.of(context).textTheme.titleMedium),
          Text('${progress['completed']} de ${progress['planned']} sesiones realizadas. Una sesión sin registro cuenta como no realizada.', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 8),
          for (final week in (progress['weeks'] as List).cast<Map<String, dynamic>>())
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                SizedBox(width: 92, child: Text('Sem. ${formatDate(week['weekStart'] as String)}', style: Theme.of(context).textTheme.bodySmall)),
                Expanded(child: LinearProgressIndicator(value: (week['completed'] as int) / (week['planned'] as int), minHeight: 6, borderRadius: BorderRadius.circular(3))),
                const SizedBox(width: 8),
                Text('${week['completed']}/${week['planned']}'),
              ]),
            ),
        ],
        if (calendar.any((day) => day['status'] != 'sin_rutina')) ...[
          const SizedBox(height: 8),
          Text('Últimas semanas', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 6),
          _Calendar(days: calendar, today: today),
        ],
        if ((progress['weights'] as List).isNotEmpty) ...[
          const Divider(),
          Text('Peso: ${(progress['weights'] as List).last['weightKg']} kg (${(progress['weights'] as List).length} registros)'),
        ],
      ],
    );
  }
}

/// Calendario de cinco semanas (lunes a domingo), al estilo de Hevy: un cuadro por día con su estado.
class _Calendar extends StatelessWidget {
  const _Calendar({required this.days, required this.today});
  final List<Map<String, dynamic>> days;
  final String today;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final weeks = [for (var start = 0; start + 7 <= days.length; start += 7) days.sublist(start, start + 7)];
    return Column(
      key: const Key('calendar'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [for (final initial in dayInitials) Expanded(child: Center(child: Text(initial, style: Theme.of(context).textTheme.labelSmall)))]),
        for (final week in weeks)
          Row(children: [
            for (final day in week)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(2),
                  child: Tooltip(
                    message: '${formatDate(day['date'] as String)}: ${dayStatusStyle(context, day['status'] as String).label}',
                    child: AspectRatio(
                      aspectRatio: 1.6,
                      child: Container(
                        decoration: BoxDecoration(
                          color: (day['date'] as String).compareTo(today) > 0 ? scheme.surfaceContainer : dayStatusStyle(context, day['status'] as String).background,
                          borderRadius: BorderRadius.circular(6),
                          border: day['date'] == today ? Border.all(color: scheme.primary, width: 2) : Border.all(color: scheme.outlineVariant.withValues(alpha: 0.5)),
                        ),
                        child: Icon(dayStatusStyle(context, day['status'] as String).icon, size: 12, color: (day['date'] as String).compareTo(today) > 0 ? scheme.outline : dayStatusStyle(context, day['status'] as String).foreground),
                      ),
                    ),
                  ),
                ),
              ),
          ]),
        const SizedBox(height: 6),
        Wrap(spacing: 12, runSpacing: 4, children: [
          for (final status in ['hecho', 'descanso', 'comodin', 'perdido', if (days.any((day) => day['status'] == 'movida')) 'movida'])
            Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(dayStatusStyle(context, status).icon, size: 14, color: scheme.onSurfaceVariant),
              const SizedBox(width: 4),
              Text(const {'hecho': 'Realizada', 'descanso': 'Descanso', 'comodin': 'Comodín', 'perdido': 'Sin registrar', 'movida': 'Movida'}[status]!, style: Theme.of(context).textTheme.labelSmall),
            ]),
        ]),
      ],
    );
  }
}

/// Cambia una sesión que no se pudo (o no se podrá) hacer a otro día libre: muestra los días posibles, de hoy a una semana
/// después, y al confirmar la mueve. Devuelve la nueva fecha y el mensaje para la persona, o null si no la movió.
Future<({String date, String message})?> moveSession(BuildContext context, ApiClient api, String sessionId) async {
  final chosen = await showModalBottomSheet<({String date, String name})>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _MoveSessionSheet(api: api, sessionId: sessionId),
  );
  if (chosen == null || !context.mounted) return null;
  try {
    await api.post('/api/sessions/$sessionId/move', {'date': chosen.date});
    return (date: chosen.date, message: '«${chosen.name}» quedó para el ${formatLongDate(chosen.date)}.');
  } on ApiException catch (error) {
    if (context.mounted) showMessage(context, error.message);
    return null;
  }
}

class _MoveSessionSheet extends StatefulWidget {
  const _MoveSessionSheet({required this.api, required this.sessionId});
  final ApiClient api;
  final String sessionId;

  @override
  State<_MoveSessionSheet> createState() => _MoveSessionSheetState();
}

class _MoveSessionSheetState extends State<_MoveSessionSheet> {
  late final Future<Map<String, dynamic>> _options = widget.api.get('/api/sessions/${widget.sessionId}/move-options').then((value) => value as Map<String, dynamic>);
  String? _selected;

  Widget _option(BuildContext context, Map<String, dynamic> option) {
    final scheme = Theme.of(context).colorScheme;
    final date = option['date'] as String;
    final selected = date == _selected;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        key: Key('move-option-$date'),
        selected: selected,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: selected ? scheme.primary : scheme.outlineVariant)),
        tileColor: selected ? scheme.primaryContainer.withValues(alpha: 0.5) : null,
        leading: CircleAvatar(
          backgroundColor: selected ? scheme.primary : scheme.surfaceContainerHighest,
          child: Text('${dayOfMonth(date)}', style: TextStyle(fontWeight: FontWeight.w700, color: selected ? scheme.onPrimary : scheme.onSurfaceVariant)),
        ),
        title: Text('${option['isToday'] == true ? 'Hoy · ' : ''}${formatLongDate(date)}', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(option['nextToSession'] == true ? 'Queda junto a otra sesión: sin descanso entre ambas.' : 'Con descanso antes y después.'),
        trailing: selected ? Icon(Icons.check_circle, color: scheme.primary) : null,
        onTap: () => setState(() => _selected = date),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: FutureBuilder<Map<String, dynamic>>(
        future: _options,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const SizedBox(height: 200, child: Center(child: CircularProgressIndicator()));
          if (snapshot.hasError) {
            return Padding(padding: const EdgeInsets.fromLTRB(24, 0, 24, 32), child: Text(errorText(snapshot.error!), key: const Key('move-error')));
          }
          final data = snapshot.data!;
          final name = data['name'] as String;
          final planned = (data['session'] as Map<String, dynamic>)['plannedDate'] as String;
          final options = (data['options'] as List).cast<Map<String, dynamic>>();
          return ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.85),
            child: ListView(
              key: const Key('move-sheet'),
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              children: [
                Text('Cambiar de día', style: text.titleLarge),
                const SizedBox(height: 4),
                Text('$name · programada el ${formatLongDate(planned)}', style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)),
                const SizedBox(height: 12),
                Text('Elige un día libre. El día original queda como «movida»: no suma ni corta tu racha.', style: text.bodySmall),
                const SizedBox(height: 12),
                if (options.isEmpty)
                  const Text('No hay días libres en la próxima semana. Si la hiciste, regístrala.', key: Key('move-no-options'))
                else
                  for (final option in options) _option(context, option),
                const SizedBox(height: 8),
                FilledButton(
                  key: const Key('move-confirm'),
                  onPressed: _selected == null ? null : () => Navigator.pop(context, (date: _selected!, name: name)),
                  child: Text(_selected == null ? 'Elige un día' : 'Cambiar al ${formatLongDate(_selected!)}'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
