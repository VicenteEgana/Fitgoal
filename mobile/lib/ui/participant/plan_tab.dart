import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import 'session_screen.dart';

/// Mi rutina: la racha, el horario de la semana con la sesión de cada día o el descanso, la rutina vigente y el progreso
/// (RF004, RF007). En escritorio se ordena en dos columnas: la semana a la izquierda; la racha, la rutina y el progreso a
/// la derecha.
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

  /// Pasa a la versión nueva de la rutina recomendada, con los mismos días. La rutina no cambia sola: la persona lo decide.
  Future<void> _updateTemplate(BuildContext context, Map<String, dynamic> plan, Future<void> Function() reload) async {
    final update = plan['templateUpdate'] as Map<String, dynamic>;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Actualizar a la versión ${update['version']}'),
        content: const Text('La versión nueva empieza mañana, con tus mismos días. Las sesiones que ya registraste quedan en tu historial y tu racha no se corta.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Seguir con la mía')),
          FilledButton(key: const Key('confirm-template-update'), onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Actualizar')),
        ],
      ),
    );
    if (accepted != true) return;
    try {
      await api.post('/api/plans/start', {'source': 'recomendada', 'templateId': update['templateId'], 'days': plan['days']});
      await reload();
      if (context.mounted) showMessage(context, 'Listo: desde mañana sigues la versión ${update['version']}.');
    } on ApiException catch (error) {
      if (context.mounted) showMessage(context, error.message);
    }
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
        final noPlanCard = plan == null ? _NoPlanCard(needsProfile: profile == null, onGoToProfile: onGoToProfile, onGoToRoutines: onGoToRoutines) : null;
        final streakCard = hasHistory
            ? _StreakCard(
                streak: streak,
                todaySession: todaySession?['canRegister'] == true ? todaySession : null,
                onTrain: (session) => _train(context, session, weightsEnabled, reload),
              )
            : null;
        final unregisteredCard = unregistered.isEmpty
            ? null
            : _UnregisteredCard(
                sessions: unregistered,
                onRegister: (session) => _register(context, session, session['label'] as String, weightsEnabled, reload),
                onMove: (session) => _move(context, session['id'] as String, reload),
              );
        final weekCard = plan != null || hasHistory
            ? _WeekCard(
                api: api,
                initial: data['schedule'] as Map<String, dynamic>,
                onGoToRoutines: onGoToRoutines,
                onTrain: (session) => _train(context, session, weightsEnabled, reload),
                onRegister: (session) => _register(context, session, session['name'] as String, weightsEnabled, reload),
                onMove: (session) => _move(context, session['id'] as String, reload),
              )
            : null;
        final planCard = plan != null ? _PlanCard(plan: plan, profileChanged: profileChanged, onGoToRoutines: onGoToRoutines, onUpdate: () => _updateTemplate(context, plan, reload)) : null;
        final progressCard = _ProgressCard(progress: progress);
        return PageList(
          children: [
            BentoColumns(
              primary: [?noPlanCard, ?weekCard, ?unregisteredCard],
              secondary: [?streakCard, ?planCard, progressCard],
              narrow: [?noPlanCard, ?streakCard, ?weekCard, ?unregisteredCard, ?planCard, progressCard],
            ),
          ],
        );
      },
    );
  }
}

/// Sin rutina todavía: invita a elegir una recomendada o a completar el perfil.
class _NoPlanCard extends StatelessWidget {
  const _NoPlanCard({required this.needsProfile, required this.onGoToProfile, required this.onGoToRoutines});
  final bool needsProfile;
  final VoidCallback onGoToProfile;
  final VoidCallback onGoToRoutines;

  @override
  Widget build(BuildContext context) {
    return FitCard(
      hero: true,
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const IconBadge(Icons.rocket_launch_outlined, size: 48),
        const SizedBox(height: 16),
        Text('Tu rutina', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Aún no tienes una rutina. Elige una recomendada y empieza mañana, o arma la tuya con los ejercicios del catálogo.', key: Key('no-plan')),
        const SizedBox(height: 16),
        Wrap(spacing: 8, runSpacing: 8, children: [
          FilledButton.icon(key: const Key('go-routines'), onPressed: onGoToRoutines, icon: const Icon(Icons.explore, size: 18), label: const Text('Ver rutinas')),
          if (needsProfile) OutlinedButton(key: const Key('go-profile'), onPressed: onGoToProfile, child: const Text('Completar perfil')),
        ]),
      ]),
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
    final tokens = FitTokens.of(context);
    final current = streak['current'] as int;
    final next = streak['nextMilestone'] as Map<String, dynamic>?;
    final freeze = streak['freeze'] as Map<String, dynamic>;
    final freezeOn = freeze['available'] == true;
    final active = current > 0;
    final flame = active ? tokens.streak : tokens.muted;
    return FitCard(
        key: const Key('streak-card'),
        hero: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              _Flame(color: flame, active: active),
              const SizedBox(width: 16),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                    Text('$current', key: const Key('streak-count'), style: TextStyle(fontSize: 46, height: 1, fontWeight: FontWeight.w800, letterSpacing: -1.5, fontFeatures: tabularFigures, color: Theme.of(context).colorScheme.onSurface)),
                    const SizedBox(width: 8),
                    Flexible(child: Text(current == 1 ? 'día de racha' : 'días de racha', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: tokens.muted))),
                  ]),
                  const SizedBox(height: 10),
                  Wrap(spacing: 8, runSpacing: 6, children: [
                    _StreakPill(
                      color: tokens.streak,
                      icon: Icons.emoji_events_outlined,
                      child: Text('Récord: ${streak['best']} ${streak['best'] == 1 ? 'día' : 'días'}', key: const Key('streak-best')),
                    ),
                    _StreakPill(
                      color: freezeOn ? tokens.info : tokens.muted,
                      child: Text.rich(
                        TextSpan(children: [
                          WidgetSpan(alignment: PlaceholderAlignment.middle, child: Icon(freezeOn ? Icons.ac_unit : Icons.shield_outlined, size: 14, color: freezeOn ? tokens.info : tokens.muted)),
                          TextSpan(text: freezeOn ? ' Comodín disponible' : ' Comodín usado el ${formatDate(freeze['usedOn'] as String)}'),
                        ]),
                        key: const Key('streak-freeze'),
                      ),
                    ),
                  ]),
                ]),
              ),
            ]),
            const SizedBox(height: 14),
            Text(_message(), key: const Key('streak-message'), style: const TextStyle(fontSize: 14.5, height: 1.4)),
            if (next != null) ...[
              const SizedBox(height: 14),
              SegmentedProgress(value: current / (next['days'] as int), color: active ? tokens.streak : tokens.accent),
              const SizedBox(height: 4),
              Row(children: [
                Expanded(child: Text('Faltan ${next['remaining']} ${next['remaining'] == 1 ? 'día' : 'días'} para tu racha de ${next['days']}', key: const Key('streak-next'), style: TextStyle(fontSize: 12.5, color: tokens.muted))),
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
                  icon: const Icon(Icons.play_arrow_rounded),
                  label: Text('Empezar: ${session['name']}', overflow: TextOverflow.ellipsis),
                ),
              ),
            ],
          ],
        ),
    );
  }
}

/// Llama con brillo radial: naranja si hay racha, gris si todavía no.
class _Flame extends StatelessWidget {
  const _Flame({required this.color, required this.active});
  final Color color;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 68,
      height: 68,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: [color.withValues(alpha: active ? 0.38 : 0.16), color.withValues(alpha: 0.02)], stops: const [0.15, 1]),
        border: Border.all(color: color.withValues(alpha: active ? 0.45 : 0.2)),
        boxShadow: [if (active) BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 28, spreadRadius: -2)],
      ),
      child: Icon(Icons.local_fire_department_rounded, size: 38, color: color),
    );
  }
}

class _StreakPill extends StatelessWidget {
  const _StreakPill({required this.color, required this.child, this.icon});
  final Color color;
  final Widget child;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999), border: Border.all(color: color.withValues(alpha: 0.3))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 14, color: color), const SizedBox(width: 5)],
        Flexible(child: DefaultTextStyle.merge(style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: color), child: child)),
      ]),
    );
  }
}

/// Sesiones vencidas sin registrar: registrarlas o cambiarlas de día.
class _UnregisteredCard extends StatelessWidget {
  const _UnregisteredCard({required this.sessions, required this.onRegister, required this.onMove});
  final List<Map<String, dynamic>> sessions;
  final void Function(Map<String, dynamic> session) onRegister;
  final void Function(Map<String, dynamic> session) onMove;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    return SectionCard(
      title: 'Sin registrar',
      icon: Icons.pending_actions_outlined,
      iconColor: tokens.danger,
      children: [
        Text('¿La hiciste? Regístrala para que tu progreso refleje lo que hiciste. ¿No pudiste? Cámbiala a otro día.', style: Theme.of(context).textTheme.bodySmall),
        for (final session in sessions)
          Container(
            key: Key('unregistered-${session['id']}'),
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: tokens.cardHigh, borderRadius: BorderRadius.circular(14), border: Border.all(color: tokens.border)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(width: 8, height: 8, decoration: BoxDecoration(color: tokens.danger, shape: BoxShape.circle, boxShadow: [BoxShadow(color: tokens.danger.withValues(alpha: 0.6), blurRadius: 6)])),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(session['label'] as String, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text(formatLongDate(session['plannedDate'] as String), style: Theme.of(context).textTheme.bodySmall),
                  ]),
                ),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: FilledButton.tonal(
                    key: Key('complete-${session['id']}'),
                    onPressed: () => onRegister(session),
                    child: const Text('Registrar'),
                  ),
                ),
                if (session['canMove'] == true) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      key: Key('move-${session['id']}'),
                      onPressed: () => onMove(session),
                      icon: const Icon(Icons.event_repeat, size: 18),
                      label: const Text('Cambiar de día'),
                    ),
                  ),
                ],
              ]),
            ]),
          ),
      ],
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
    final tokens = FitTokens.of(context);
    return SectionCard(
      title: 'Tu semana',
      icon: Icons.calendar_month_outlined,
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton(key: const Key('week-previous'), tooltip: 'Semana anterior', onPressed: _week['previousWeek'] == null ? null : () => _go(_week['previousWeek'] as String), icon: const Icon(Icons.chevron_left)),
        IconButton(key: const Key('week-next'), tooltip: 'Semana siguiente', onPressed: _week['nextWeek'] == null ? null : () => _go(_week['nextWeek'] as String), icon: const Icon(Icons.chevron_right)),
      ]),
      children: [
        Row(children: [
          Text(formatWeekRange(_week['weekStart'] as String, _week['weekEnd'] as String), key: const Key('week-range'), style: TextStyle(color: tokens.muted, fontWeight: FontWeight.w600, fontSize: 13)),
          if (!isCurrentWeek) TextButton(key: const Key('week-today'), onPressed: () => _go(_week['today'] as String), child: const Text('Volver a hoy')),
          if (_loading) const Padding(padding: EdgeInsets.only(left: 8), child: SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          for (final day in days)
            Expanded(child: _DayCell(day: day, selected: day['date'] == _selected, onTap: () => setState(() => _selected = day['date'] as String))),
        ]),
        const SizedBox(height: 16),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          layoutBuilder: (current, previous) => Stack(alignment: Alignment.topLeft, children: [...previous, ?current]),
          child: _DayDetail(
            key: ValueKey('detail-${selected['date']}-${selected['status']}'),
            day: selected,
            today: _week['today'] as String,
            restSuggestions: ((_week['restSuggestions'] as List?) ?? const []).cast<Map<String, dynamic>>(),
            onGoToRoutines: widget.onGoToRoutines,
            onTrain: widget.onTrain,
            onRegister: widget.onRegister,
            onMove: _move,
            onShowDay: _show,
          ),
        ),
      ],
    );
  }
}

/// Un día de la semana como «píldora de calendario»: inicial arriba, número al centro y el estado abajo. Hoy brilla.
class _DayCell extends StatefulWidget {
  const _DayCell({required this.day, required this.selected, required this.onTap});
  final Map<String, dynamic> day;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_DayCell> createState() => _DayCellState();
}

class _DayCellState extends State<_DayCell> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final tokens = FitTokens.of(context);
    final day = widget.day;
    final selected = widget.selected;
    final style = dayStatusStyle(context, day['status'] as String);
    final isToday = day['isToday'] == true;
    final radius = BorderRadius.circular(16);
    return Semantics(
      label: '${day['dayLabel']}: ${style.label}',
      selected: selected,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2.5),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            color: selected ? tokens.cardHigh : isToday ? scheme.primary.withValues(alpha: 0.08) : _hover ? scheme.onSurface.withValues(alpha: 0.04) : Colors.transparent,
            borderRadius: radius,
            border: Border.all(color: isToday ? scheme.primary.withValues(alpha: 0.85) : selected ? tokens.borderStrong : tokens.border, width: isToday ? 1.5 : 1),
            boxShadow: [if (isToday) BoxShadow(color: scheme.primary.withValues(alpha: 0.28), blurRadius: 16, spreadRadius: -2)],
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              key: Key('day-cell-${day['date']}'),
              borderRadius: radius,
              onTap: widget.onTap,
              onHover: (value) => setState(() => _hover = value),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Column(children: [
                  Text(dayInitials[(day['weekday'] as int) - 1], style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5, color: isToday ? tokens.accent : tokens.muted)),
                  const SizedBox(height: 2),
                  Text('${dayOfMonth(day['date'] as String)}', style: TextStyle(fontSize: 19, height: 1.25, fontWeight: FontWeight.w800, fontFeatures: tabularFigures, color: selected || isToday ? scheme.onSurface : scheme.onSurface.withValues(alpha: 0.8))),
                  const SizedBox(height: 6),
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(color: style.background, shape: BoxShape.circle),
                    child: Icon(style.icon, size: 14, color: style.foreground),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Lo que toca el día elegido: la sesión con sus ejercicios (y empezarla, registrarla o cambiarla de día), el descanso, el
/// aviso de que la sesión se movió a otro día o nada.
class _DayDetail extends StatelessWidget {
  const _DayDetail({
    super.key, required this.day, required this.today, required this.restSuggestions, required this.onGoToRoutines, required this.onTrain, required this.onRegister,
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
    final tokens = FitTokens.of(context);
    final status = day['status'] as String;
    final session = day['session'] as Map<String, dynamic>?;
    final heading = '${day['isToday'] == true ? 'Hoy · ' : ''}${formatLongDate(day['date'] as String)}';
    final style = dayStatusStyle(context, status);
    final canMove = session?['canMove'] == true;
    final titleStyle = Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.4);
    Widget moveButton(Map<String, dynamic> session) => OutlinedButton.icon(
      key: Key('day-move-${session['id']}'),
      onPressed: () => onMove(session),
      icon: const Icon(Icons.event_repeat, size: 18),
      label: const Text('Cambiar de día'),
    );
    return Container(
      key: Key('day-detail-${day['date']}'),
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.onSurface.withValues(alpha: Theme.of(context).brightness == Brightness.dark ? 0.02 : 0.015),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(heading, key: const Key('day-heading'), style: TextStyle(color: tokens.accent, fontWeight: FontWeight.w700, fontSize: 13, letterSpacing: 0.2)),
          const SizedBox(height: 6),
          if (session != null) ...[
            Text(session['name'] as String, key: const Key('day-session-name'), style: titleStyle),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              Pill('${session['minutes']} min', icon: Icons.timer_outlined),
              Pill('${(session['exercises'] as List).length} ejercicios', icon: Icons.format_list_numbered),
            ]),
            const SizedBox(height: 10),
            GroupChips((session['groups'] as List).cast<String>()),
            const SizedBox(height: 10),
            Row(children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(color: style.background, shape: BoxShape.circle),
                child: Icon(style.icon, size: 13, color: style.foreground),
              ),
              const SizedBox(width: 8),
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
                  style: TextStyle(fontWeight: FontWeight.w600, color: status == 'perdido' ? tokens.danger : null),
                ),
              ),
            ]),
            if (session['movedFrom'] case final String movedFrom)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(children: [
                  Icon(Icons.event_repeat, size: 16, color: tokens.info),
                  const SizedBox(width: 8),
                  Expanded(child: Text('Movida desde el ${formatLongDate(movedFrom)}', key: const Key('day-moved-from'), style: Theme.of(context).textTheme.bodySmall)),
                ]),
              ),
            const SizedBox(height: 14),
            for (final (index, exercise) in (session['exercises'] as List).cast<Map<String, dynamic>>().indexed)
              ExerciseItem(index: index, name: exercise['name'] as String, prescription: exercise['prescription'] as String),
            if (session['canRegister'] == true) ...[
              const SizedBox(height: 6),
              if (day['isToday'] == true) ...[
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(key: const Key('start-session'), onPressed: () => onTrain(session), icon: const Icon(Icons.play_arrow_rounded), label: const Text('Empezar sesión')),
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
              const SizedBox(height: 6),
              Align(alignment: Alignment.centerLeft, child: moveButton(session)),
            ],
          ] else if (status == 'movida') ...[
            Row(children: [
              IconBadge(Icons.event_repeat, color: tokens.info, size: 36),
              const SizedBox(width: 12),
              Expanded(child: Text('Sesión movida', key: const Key('moved-day'), style: titleStyle)),
            ]),
            const SizedBox(height: 8),
            Text(
              day['movedTo'] == null ? 'Cambiaste la sesión de este día a otro día.' : 'La cambiaste al ${formatLongDate(day['movedTo'] as String)}. Este día no suma ni corta tu racha.',
              key: const Key('moved-day-text'),
            ),
            if (day['movedTo'] case final String movedTo)
              TextButton.icon(key: const Key('show-moved-day'), onPressed: () => onShowDay(movedTo), icon: const Icon(Icons.arrow_forward, size: 18), label: const Text('Ver ese día')),
          ] else if (status == 'descanso') ...[
            Row(children: [
              IconBadge(Icons.bedtime_outlined, color: tokens.rest, size: 36),
              const SizedBox(width: 12),
              Expanded(child: Text('Día de descanso', key: const Key('rest-day'), style: titleStyle)),
            ]),
            const SizedBox(height: 8),
            const Text('Descansar es parte del plan: entre sesiones tus músculos se recuperan y se adaptan. El descanso también suma a tu racha.', style: TextStyle(height: 1.4)),
            if (restSuggestions.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text('Si quieres moverte, algo suave y opcional: una caminata a ritmo cómodo o movilidad del catálogo aprobado.', style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 10),
              ResponsiveGrid(
                minItemWidth: 260,
                spacing: 8,
                children: [
                  for (final item in restSuggestions)
                    ExerciseItem(index: null, icon: Icons.self_improvement, color: tokens.rest, name: item['name'] as String, prescription: item['prescription'] as String),
                ],
              ),
            ],
          ] else ...[
            EmptyState(
              icon: Icons.event_available_outlined,
              color: tokens.muted,
              title: 'Día libre',
              message: const Text('Sin rutina este día.', key: Key('no-routine-day')),
              action: (day['date'] as String).compareTo(today) >= 0 ? TextButton(onPressed: onGoToRoutines, child: const Text('Ver rutinas')) : null,
            ),
          ],
        ],
      ),
    );
  }
}

/// La rutina vigente: nombre, origen, atributos, semana en curso y la semana tipo con sus días de descanso.
class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan, required this.profileChanged, required this.onGoToRoutines, required this.onUpdate});
  final Map<String, dynamic> plan;
  final bool profileChanged;
  final VoidCallback onGoToRoutines;
  final VoidCallback onUpdate;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final schedule = (plan['schedule'] as List).cast<Map<String, dynamic>>();
    final week = ((plan['week'] as List?) ?? const []).cast<Map<String, dynamic>>();
    final currentWeek = plan['currentWeek'] as int?;
    final weeks = plan['weeks'] as int;
    final template = plan['template'] as Map<String, dynamic>?;
    final update = plan['templateUpdate'] as Map<String, dynamic>?;
    return SectionCard(
      title: 'Tu rutina',
      icon: Icons.assignment_outlined,
      trailing: StatusChip(plan['source'] == 'recomendada' ? 'Recomendada' : 'Propia', icon: plan['source'] == 'recomendada' ? Icons.star_rounded : Icons.edit_note),
      children: [
        Text(routineTitle(plan['name'] as String), key: const Key('plan-name'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.4)),
        const SizedBox(height: 6),
        Row(children: [
          Icon(Icons.verified_rounded, size: 16, color: tokens.accent),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              plan['source'] == 'recomendada'
                  ? 'Rutina aprobada por un profesional${template == null ? '' : ' · versión ${template['version']}'}'
                  : 'Armada por ti con ejercicios aprobados por un profesional',
              style: TextStyle(fontSize: 13, color: tokens.muted),
            ),
          ),
        ]),
        const SizedBox(height: 12),
        Wrap(spacing: 6, runSpacing: 6, children: [
          if (template?['split'] != null) Pill(splitLabels[template!['split']]!, icon: Icons.view_week_outlined),
          Pill('$weeks semanas', icon: Icons.date_range_outlined),
          Pill('${plan['sessionMinutes']} min por sesión', icon: Icons.timer_outlined),
          Pill('${schedule.length} ${schedule.length == 1 ? 'día' : 'días'}/sem', icon: Icons.fitness_center),
          Pill('${7 - schedule.length} de descanso', icon: Icons.bedtime_outlined, color: tokens.rest),
        ]),
        if (currentWeek != null) ...[
          const SizedBox(height: 16),
          Text(
            currentWeek == 0 ? 'Empieza el ${formatDate(plan['startsOn'] as String)}' : currentWeek > weeks ? 'Terminó el ${formatDate(plan['endsOn'] as String)}: elige tu próxima rutina.' : 'Semana $currentWeek de $weeks · termina el ${formatDate(plan['endsOn'] as String)}',
            key: const Key('plan-week-progress'),
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
          ),
          const SizedBox(height: 8),
          SegmentedProgress(value: (currentWeek.clamp(0, weeks)) / weeks, segments: weeks.clamp(1, 12), height: 6),
        ],
        if (update != null)
          Callout(
            key: const Key('template-update'),
            icon: Icons.new_releases_outlined,
            margin: const EdgeInsets.only(top: 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                update['kind'] == 'retirada'
                    ? 'El preparador dejó de ofrecer esta rutina. Puedes terminarla o elegir otra.'
                    : update['fitsDays'] == true
                        ? 'El preparador publicó la versión ${update['version']} de esta rutina. La tuya sigue igual hasta que decidas actualizarla.'
                        : 'El preparador publicó la versión ${update['version']}, que se hace entre ${update['minDays']} y ${update['maxDays']} días por semana. Elígela en Rutinas para ajustar tus días.',
              ),
              const SizedBox(height: 8),
              if (update['kind'] == 'nueva_version' && update['fitsDays'] == true)
                FilledButton.tonal(key: const Key('update-template'), onPressed: onUpdate, child: Text('Actualizar a la versión ${update['version']}'))
              else
                TextButton(key: const Key('update-see-routines'), onPressed: onGoToRoutines, child: const Text('Ver rutinas')),
            ]),
          ),
        if (profileChanged)
          Callout(
            icon: Icons.tune,
            color: tokens.streak,
            margin: const EdgeInsets.only(top: 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Cambiaste tu perfil después de empezar esta rutina. Mira las recomendadas para tu perfil actual.', key: Key('profile-changed')),
              TextButton(key: const Key('see-routines'), onPressed: onGoToRoutines, child: const Text('Ver rutinas recomendadas')),
            ]),
          ),
        if (week.isNotEmpty) ...[
          const SizedBox(height: 8),
          ExpansionTile(
            key: const Key('plan-week'),
            tilePadding: EdgeInsets.zero,
            title: const Text('Semana tipo', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text('Qué toca cada día, con tus días de descanso', style: TextStyle(fontSize: 12.5, color: tokens.muted)),
            children: [
              for (final day in week)
                if (day['type'] == 'descanso')
                  ListTile(
                    key: Key('week-day-${day['day']}'),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.bedtime_outlined, color: tokens.rest),
                    title: Text('${day['dayLabel']} · Descanso', style: TextStyle(color: tokens.muted)),
                  )
                else
                  ExpansionTile(
                    key: Key('week-day-${day['day']}'),
                    tilePadding: EdgeInsets.zero,
                    leading: Icon(Icons.fitness_center, color: tokens.accent),
                    title: Text('${day['dayLabel']} · ${day['label']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    children: [
                      for (final exercise in (schedule.firstWhere((item) => item['day'] == day['day'])['exercises'] as List).cast<Map<String, dynamic>>())
                        ListTile(dense: true, title: Text(exercise['name'] as String), subtitle: Text(exercise['prescription'] as String)),
                    ],
                  ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Adherencia por semana (K3), calendario de adherencia de las últimas semanas y peso, si está habilitado.
class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.progress});
  final Map<String, dynamic> progress;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final calendar = ((progress['calendar'] as List?) ?? const []).cast<Map<String, dynamic>>();
    final today = progress['today'] as String;
    final adherence = progress['adherence'] as num?;
    final hasCalendar = calendar.any((day) => day['status'] != 'sin_rutina');
    return SectionCard(
      title: 'Progreso',
      icon: Icons.insights_outlined,
      children: [
        if (adherence == null)
          EmptyState(
            icon: Icons.local_fire_department_outlined,
            title: 'Tu progreso empieza a contar pronto',
            message: const Text('Todavía no hay sesiones vencidas para calcular tu adherencia.'),
          )
        else ...[
          Row(children: [
            SizedBox(
              width: 64,
              height: 64,
              child: Stack(fit: StackFit.expand, children: [
                CircularProgressIndicator(value: adherence.toDouble().clamp(0, 1), strokeWidth: 7, strokeCap: StrokeCap.round, backgroundColor: tokens.border),
                Center(child: Icon(Icons.check_rounded, color: tokens.accent)),
              ]),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Adherencia: ${(adherence * 100).round()} %', key: const Key('adherence'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.4, fontFeatures: tabularFigures)),
                const SizedBox(height: 2),
                Text('${progress['completed']} de ${progress['planned']} sesiones realizadas. Una sesión sin registro cuenta como no realizada.', style: Theme.of(context).textTheme.bodySmall),
              ]),
            ),
          ]),
          const SizedBox(height: 14),
          for (final week in (progress['weeks'] as List).cast<Map<String, dynamic>>())
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                SizedBox(width: 92, child: Text('Sem. ${formatDate(week['weekStart'] as String)}', style: Theme.of(context).textTheme.bodySmall)),
                Expanded(child: MeterBar(value: (week['completed'] as int) / (week['planned'] as int), color: Theme.of(context).colorScheme.primary)),
                const SizedBox(width: 10),
                Text('${week['completed']}/${week['planned']}', style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: tabularFigures)),
              ]),
            ),
        ],
        if (hasCalendar) ...[
          const SizedBox(height: 10),
          Text('Últimas semanas', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 10),
          _Calendar(days: calendar, today: today),
        ],
        if ((progress['weights'] as List).isNotEmpty) ...[
          const Divider(height: 28),
          Row(children: [
            IconBadge(Icons.monitor_weight_outlined, color: tokens.protein, size: 34),
            const SizedBox(width: 12),
            Expanded(child: Text('Peso: ${(progress['weights'] as List).last['weightKg']} kg (${(progress['weights'] as List).length} registros)', style: const TextStyle(fontWeight: FontWeight.w600))),
          ]),
        ],
      ],
    );
  }
}

/// Calendario de adherencia de cinco semanas (lunes a domingo), al estilo de GitHub o Strava: un cuadro pequeño por día
/// con el color de su estado.
class _Calendar extends StatelessWidget {
  const _Calendar({required this.days, required this.today});
  final List<Map<String, dynamic>> days;
  final String today;

  static const _legend = {'hecho': 'Realizada', 'descanso': 'Descanso', 'comodin': 'Comodín', 'perdido': 'Sin registrar', 'movida': 'Movida'};

  Color _color(BuildContext context, String status, bool future) {
    final tokens = FitTokens.of(context);
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final empty = dark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.05);
    if (future) return empty;
    return switch (status) {
      'hecho' => scheme.primary,
      'descanso' => tokens.rest.withValues(alpha: 0.45),
      'comodin' => tokens.info.withValues(alpha: 0.55),
      'perdido' => tokens.danger.withValues(alpha: 0.55),
      'movida' => tokens.muted.withValues(alpha: 0.35),
      'pendiente' || 'programada' => scheme.primary.withValues(alpha: 0.25),
      _ => empty,
    };
  }

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final scheme = Theme.of(context).colorScheme;
    final weeks = [for (var start = 0; start + 7 <= days.length; start += 7) days.sublist(start, start + 7)];
    const cell = 26.0;
    const gap = 5.0;
    return Column(
      key: const Key('calendar'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          for (final initial in dayInitials)
            Container(width: cell, margin: const EdgeInsets.only(right: gap), alignment: Alignment.center, child: Text(initial, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: tokens.muted))),
        ]),
        const SizedBox(height: 4),
        for (final week in weeks)
          Padding(
            padding: const EdgeInsets.only(bottom: gap),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              for (final day in week)
                Padding(
                  padding: const EdgeInsets.only(right: gap),
                  child: Tooltip(
                    message: '${formatDate(day['date'] as String)}: ${dayStatusStyle(context, day['status'] as String).label}',
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      width: cell,
                      height: cell,
                      decoration: BoxDecoration(
                        color: _color(context, day['status'] as String, (day['date'] as String).compareTo(today) > 0),
                        borderRadius: BorderRadius.circular(7),
                        border: day['date'] == today ? Border.all(color: tokens.accent, width: 2) : null,
                        boxShadow: [if (day['status'] == 'hecho') BoxShadow(color: scheme.primary.withValues(alpha: 0.35), blurRadius: 8)],
                      ),
                    ),
                  ),
                ),
            ]),
          ),
        const SizedBox(height: 8),
        Wrap(spacing: 14, runSpacing: 6, children: [
          for (final status in ['hecho', 'descanso', 'comodin', 'perdido', if (days.any((day) => day['status'] == 'movida')) 'movida'])
            Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 11, height: 11, decoration: BoxDecoration(color: _color(context, status, false), borderRadius: BorderRadius.circular(3))),
              const SizedBox(width: 6),
              Text(_legend[status]!, style: TextStyle(fontSize: 12, color: tokens.muted)),
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
