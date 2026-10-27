import 'package:flutter/material.dart';

import '../api/api_client.dart';

const objectiveLabels = {
  'bajar': 'Bajar de peso',
  'mantener': 'Mantener peso',
  'subir': 'Subir de peso',
};
const levelLabels = {
  'principiante': 'Principiante',
  'con_experiencia': 'Con experiencia',
};
const equipmentLabels = {'sin_equipo': 'Sin equipo', 'con_equipo': 'Con equipo'};
const bmiLabels = {'bajo_peso': 'bajo peso', 'normal': 'peso normal', 'sobrepeso': 'sobrepeso', 'obesidad': 'obesidad'};
const bmiCategoryLabels = {'general': 'General, bajo impacto', 'bajo_peso': 'IMC bajo peso', 'normal': 'IMC normal', 'sobrepeso': 'IMC sobrepeso', 'obesidad': 'IMC obesidad'};
const muscleGroupLabels = {'piernas': 'Piernas', 'empuje': 'Empuje', 'traccion': 'Tracción', 'core': 'Zona media (core)', 'cardio': 'Cardio', 'movilidad': 'Movilidad'};
/// Divisiones de la semana de las rutinas del catálogo.
const splitLabels = {'full_body': 'Full body', 'upper_lower': 'Upper/Lower', 'push_pull_legs': 'Push/Pull/Legs'};
const splitDescriptions = {
  'full_body': 'Cuerpo completo en cada sesión',
  'upper_lower': 'Tren superior e inferior en días distintos',
  'push_pull_legs': 'Empuje, tracción y piernas en días distintos',
};
const dietLabels = {'mediterranea': 'Mediterránea', 'alta_proteina': 'Alta en proteína', 'baja_carbohidratos': 'Baja en carbohidratos', 'vegetariana': 'Vegetariana'};
const foodCategoryLabels = {
  'proteinas': 'Proteínas', 'lacteos': 'Lácteos', 'cereales': 'Cereales y tubérculos', 'legumbres': 'Legumbres',
  'frutas': 'Frutas', 'verduras': 'Verduras', 'grasas': 'Grasas saludables',
};
const dayInitials = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const muscleGroupIcons = {
  'piernas': Icons.directions_walk, 'empuje': Icons.front_hand_outlined, 'traccion': Icons.rowing, 'core': Icons.accessibility_new,
  'cardio': Icons.favorite_border, 'movilidad': Icons.self_improvement,
};

/// Explicación breve de cada grupo: qué es, qué trabaja, ejemplos del catálogo, para qué sirve y un consejo de técnica.
const muscleGroupInfo = {
  'piernas': (
    summary: 'Ejercicios para la parte baja del cuerpo: agacharte y volver a subir, dar pasos o elevar la cadera.',
    muscles: 'Cuádriceps (frente del muslo), isquiotibiales (parte de atrás), glúteos y pantorrillas.',
    examples: 'Sentadilla, puente de glúteos, subida a un escalón, peso muerto rumano.',
    why: 'Son los músculos más grandes del cuerpo: te ayudan a subir escaleras, levantarte de una silla y cargar peso.',
    tip: 'Rodillas en la línea de los pies y espalda recta; baja solo hasta donde puedas sin dolor.',
  ),
  'empuje': (
    summary: 'Movimientos en que alejas un peso de tu cuerpo, o empujas el suelo o la pared para alejarte de ellos.',
    muscles: 'Pectorales, la parte delantera de los hombros y los tríceps (parte de atrás del brazo).',
    examples: 'Flexiones en pared o inclinadas, press de pecho y de hombros con mancuernas, fondos en silla.',
    why: 'Los usas al empujar una puerta, levantarte del suelo o poner algo en una repisa alta.',
    tip: 'Abdomen firme y hombros lejos de las orejas; en las flexiones, codos a unos 45° del cuerpo.',
  ),
  'traccion': (
    summary: 'Movimientos en que acercas un peso hacia ti, o tiras de algo fijo para acercarte.',
    muscles: 'Dorsales y la parte media de la espalda, la parte trasera de los hombros y los bíceps.',
    examples: 'Remo con banda elástica o con mancuerna, elevación de brazos en T, curl de bíceps.',
    why: 'Equilibran el trabajo de empuje y ayudan a la postura, porque llevan los hombros hacia atrás. Los usas al tirar de una puerta o levantar una bolsa.',
    tip: 'Junta primero los omóplatos y después dobla los brazos, sin balancear el cuerpo.',
  ),
  'core': (
    summary: 'Ejercicios que mantienen el tronco firme y estable mientras brazos y piernas se mueven.',
    muscles: 'Abdominales (recto y transverso), oblicuos, zona lumbar y glúteos.',
    examples: 'Plancha, plancha sobre rodillas, bicho muerto, elevación de rodillas de pie.',
    why: 'Protegen la columna al cargar peso y te dan estabilidad en los demás ejercicios y en el día a día.',
    tip: 'Respira de forma continua, sin aguantar el aire, y cuida el control antes que la cantidad.',
  ),
  'cardio': (
    summary: 'Actividad continua o por intervalos que acelera el corazón y la respiración.',
    muscles: 'Corazón y pulmones, junto con las piernas y el resto del cuerpo según el ejercicio.',
    examples: 'Caminata, marcha en el lugar, bicicleta estática, trote suave.',
    why: 'Mejora tu resistencia y la salud del corazón, y suma gasto de energía. La OMS recomienda a los adultos entre 150 y 300 minutos a la semana de actividad moderada.',
    tip: 'A intensidad moderada puedes hablar, pero no cantar. Aumenta el tiempo de a poco.',
  ),
  'movilidad': (
    summary: 'Movimientos suaves y estiramientos que mejoran cuánto se mueven tus articulaciones.',
    muscles: 'Cuello, hombros, columna, caderas y tobillos, con los músculos que los rodean.',
    examples: 'Movilidad de hombros, inclinación lateral del tronco, estiramiento de gemelos.',
    why: 'Preparan el cuerpo al calentar, lo sueltan al terminar y son una buena opción para los días de descanso.',
    tip: 'Muévete lento y sin dolor; si estiras sin moverte, mantén cada posición entre 10 y 30 segundos.',
  ),
};

/// Hoja inferior con la explicación de un grupo muscular.
Future<void> showMuscleGroupInfo(BuildContext context, String group) => showModalBottomSheet<void>(
  context: context,
  showDragHandle: true,
  isScrollControlled: true,
  builder: (sheetContext) => SafeArea(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(24, 0, 24, 24), child: MuscleGroupInfo(group))),
);

/// Hoja inferior con todos los grupos musculares, uno tras otro.
Future<void> showMuscleGroupGuide(BuildContext context) => showModalBottomSheet<void>(
  context: context,
  showDragHandle: true,
  isScrollControlled: true,
  builder: (sheetContext) => DraggableScrollableSheet(
    expand: false,
    initialChildSize: 0.75,
    maxChildSize: 0.95,
    builder: (context, controller) => ListView(
      key: const Key('group-guide-sheet'),
      controller: controller,
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
      children: [
        for (final (index, group) in muscleGroupLabels.keys.indexed) ...[
          if (index > 0) const Divider(height: 32),
          MuscleGroupInfo(group),
        ],
      ],
    ),
  ),
);

class MuscleGroupInfo extends StatelessWidget {
  const MuscleGroupInfo(this.group, {super.key});
  final String group;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final info = muscleGroupInfo[group];
    return Column(
      key: Key('group-info-$group'),
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(children: [
          CircleAvatar(backgroundColor: scheme.primaryContainer, child: Icon(muscleGroupIcons[group], color: scheme.onPrimaryContainer)),
          const SizedBox(width: 12),
          Expanded(child: Text(muscleGroupLabels[group] ?? group, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
        ]),
        if (info != null) ...[
          const SizedBox(height: 12),
          Text(info.summary),
          for (final (icon, title, body) in [
            (Icons.accessibility_new, 'Qué trabaja', info.muscles),
            (Icons.fitness_center, 'Ejemplos', info.examples),
            (Icons.favorite_border, 'Para qué te sirve', info.why),
            (Icons.lightbulb_outline, 'Consejo', info.tip),
          ])
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(icon, size: 18, color: scheme.primary),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: text.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
                  Text(body, style: text.bodyMedium),
                ])),
              ]),
            ),
        ],
      ],
    );
  }
}

/// Grupos de fuerza que necesitan un día de recuperación entre sesiones que los trabajan.
const _strengthGroups = ['piernas', 'empuje', 'traccion'];

/// Días de entrenamiento al empezar una rutina: los del perfil, limitados al máximo y completados hasta el mínimo con días
/// separados (lunes, miércoles, viernes…) para dejar descanso entre sesiones.
List<int> defaultDays(List<int>? profileDays, int min, int max) {
  final chosen = ((profileDays ?? const <int>[]).toList()..sort()).take(max).toList();
  for (final day in const [1, 3, 5, 2, 4, 6, 7]) {
    if (chosen.length >= min) break;
    if (!chosen.contains(day)) chosen.add(day);
  }
  return chosen..sort();
}

/// Series de una indicación («3 series de 12 repeticiones» → 3; «2 repeticiones de 30 segundos» → 2; «10 minutos…» → 1).
int setsIn(String prescription) {
  final match = RegExp(r'^(\d+)\s+(series?\b|repeticiones de \d+ segundos)').firstMatch(prescription.trim());
  final value = match == null ? 1 : int.parse(match.group(1)!);
  return value.clamp(1, 10);
}

/// Avisos de recuperación de la semana: el mismo grupo de fuerza dos días seguidos (se recomienda al menos un día entre
/// sesiones que trabajan los mismos músculos) o ningún día de descanso.
List<String> recoveryWarnings(Map<int, Set<String>> groupsByDay) {
  final days = groupsByDay.keys.toList()..sort();
  final warnings = <String>[];
  if (days.length == 7) warnings.add('No tienes días de descanso: te recomendamos al menos uno por semana para recuperarte.');
  for (final day in days) {
    final next = day == 7 ? 1 : day + 1;
    if (!groupsByDay.containsKey(next)) continue; // el domingo se compara con el lunes de la semana siguiente
    final shared = _strengthGroups.where((group) => groupsByDay[day]!.contains(group) && groupsByDay[next]!.contains(group)).toList();
    if (shared.isEmpty) continue;
    final names = shared.map((group) => muscleGroupLabels[group]!.toLowerCase()).join(', ');
    warnings.add('${dayNames[day - 1]} y ${dayNames[next - 1].toLowerCase()} trabajas $names dos días seguidos: deja al menos un día entre sesiones que trabajan los mismos músculos.');
  }
  return warnings;
}

/// Cómo se ve cada estado de un día del horario.
({IconData icon, Color background, Color foreground, String label}) dayStatusStyle(BuildContext context, String status) {
  final scheme = Theme.of(context).colorScheme;
  return switch (status) {
    'hecho' => (icon: Icons.check, background: scheme.primary, foreground: scheme.onPrimary, label: 'Sesión realizada'),
    'descanso' => (icon: Icons.bedtime_outlined, background: scheme.surfaceContainerHighest, foreground: scheme.onSurfaceVariant, label: 'Descanso'),
    'pendiente' => (icon: Icons.fitness_center, background: scheme.primaryContainer, foreground: scheme.onPrimaryContainer, label: 'Te toca hoy'),
    'programada' => (icon: Icons.fitness_center, background: scheme.secondaryContainer, foreground: scheme.onSecondaryContainer, label: 'Sesión programada'),
    'comodin' => (icon: Icons.ac_unit, background: scheme.tertiaryContainer, foreground: scheme.onTertiaryContainer, label: 'Sin registrar: la cubrió el comodín'),
    'perdido' => (icon: Icons.close, background: scheme.errorContainer, foreground: scheme.onErrorContainer, label: 'Sin registrar'),
    _ => (icon: Icons.remove, background: Colors.transparent, foreground: scheme.outline, label: 'Sin rutina'),
  };
}

/// Grupos musculares como botones con ícono: tocarlos explica brevemente de qué se trata cada uno.
class GroupChips extends StatelessWidget {
  const GroupChips(this.groups, {super.key, this.counts});
  final Iterable<String> groups;
  /// Cuántos ejercicios trabajan cada grupo, si se quiere mostrar junto al nombre.
  final Map<String, int>? counts;

  @override
  Widget build(BuildContext context) {
    return Wrap(spacing: 6, runSpacing: 6, children: [
      for (final group in groups)
        ActionChip(
          key: Key('group-chip-$group'),
          avatar: Icon(muscleGroupIcons[group], size: 16),
          label: Row(mainAxisSize: MainAxisSize.min, children: [
            Text('${muscleGroupLabels[group] ?? group}${counts?[group] == null ? '' : ': ${counts![group]}'}'),
            const SizedBox(width: 4),
            Icon(Icons.info_outline, size: 14, color: Theme.of(context).colorScheme.primary),
          ]),
          tooltip: '¿Qué es ${(muscleGroupLabels[group] ?? group).toLowerCase()}?',
          onPressed: () => showMuscleGroupInfo(context, group),
          visualDensity: VisualDensity.compact,
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          labelStyle: Theme.of(context).textTheme.labelSmall,
        ),
    ]);
  }
}

/// Un día de la semana al elegir los días de una rutina: tocarlo lo vuelve de entrenamiento (con el nombre de su sesión) o de descanso.
class WeekDayRow extends StatelessWidget {
  const WeekDayRow({super.key, required this.day, required this.selected, required this.label, required this.onTap});
  final int day;
  final bool selected;
  final String? label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      selected: selected,
      label: '${dayNames[day - 1]}: ${selected ? 'entrenamiento' : 'descanso'}',
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
          child: Row(children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: selected ? scheme.primary : scheme.surfaceContainerHighest,
              child: Text(dayInitials[day - 1], style: TextStyle(fontWeight: FontWeight.w700, color: selected ? scheme.onPrimary : scheme.onSurfaceVariant)),
            ),
            const SizedBox(width: 12),
            SizedBox(width: 84, child: Text(dayNames[day - 1], style: const TextStyle(fontWeight: FontWeight.w600))),
            Expanded(
              child: selected
                  ? Text(label ?? 'Entrenamiento', key: Key('day-plan-$day'), overflow: TextOverflow.ellipsis)
                  : Row(children: [
                      Icon(Icons.bedtime_outlined, size: 16, color: scheme.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Text('Descanso', key: Key('day-rest-$day'), style: TextStyle(color: scheme.onSurfaceVariant)),
                    ]),
            ),
            Icon(selected ? Icons.check_circle : Icons.add_circle_outline, color: selected ? scheme.primary : scheme.outline),
          ]),
        ),
      ),
    );
  }
}

/// Avisos con ícono (recuperación, equilibrio de grupos musculares).
class HintLine extends StatelessWidget {
  const HintLine(this.text, {super.key, this.icon = Icons.info_outline});
  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: Theme.of(context).colorScheme.tertiary),
        const SizedBox(width: 6),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.bodySmall)),
      ]),
    );
  }
}

/// Vista previa de la semana: los días de entrenamiento resaltados y los de descanso atenuados.
class WeekPreview extends StatelessWidget {
  const WeekPreview({super.key, required this.trainingDays, this.labels = const {}});
  final Iterable<int> trainingDays;
  final Map<int, String> labels;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(children: [
      for (var day = 1; day <= 7; day++)
        Padding(
          padding: const EdgeInsets.only(right: 4),
          child: Tooltip(
            message: '${dayNames[day - 1]}: ${trainingDays.contains(day) ? labels[day] ?? 'entrenamiento' : 'descanso'}',
            child: CircleAvatar(
              radius: 12,
              backgroundColor: trainingDays.contains(day) ? scheme.primary : scheme.surfaceContainerHighest,
              child: Text(dayInitials[day - 1], style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: trainingDays.contains(day) ? scheme.onPrimary : scheme.onSurfaceVariant)),
            ),
          ),
        ),
    ]);
  }
}

/// 2200 → «2.200»; 1.55 → «1,55».
String formatNumber(num value) {
  final text = value is int || value == value.roundToDouble() ? value.round().toString() : value.toString();
  final parts = text.split('.');
  final whole = parts[0].replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (match) => '${match[1]}.');
  return parts.length > 1 ? '$whole,${parts[1]}' : whole;
}
const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const _weekdays = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const _months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

DateTime _day(String iso) => DateTime.parse('${iso.substring(0, 10)}T00:00:00Z');

/// «2026-11-04» → «mié 4 nov».
String formatDate(String iso) {
  final date = _day(iso);
  return '${_weekdays[date.weekday - 1]} ${date.day} ${_months[date.month - 1]}';
}

/// «2026-11-04» → «miércoles 4 nov».
String formatLongDate(String iso) {
  final date = _day(iso);
  return '${dayNames[date.weekday - 1].toLowerCase()} ${date.day} ${_months[date.month - 1]}';
}

/// Día del mes: «2026-11-04» → 4.
int dayOfMonth(String iso) => _day(iso).day;

/// Rango de una semana: «2 – 8 nov» o «30 nov – 6 dic».
String formatWeekRange(String start, String end) {
  final from = _day(start);
  final to = _day(end);
  return from.month == to.month ? '${from.day} – ${to.day} ${_months[to.month - 1]}' : '${from.day} ${_months[from.month - 1]} – ${to.day} ${_months[to.month - 1]}';
}

String formatDateTime(String iso) {
  final date = DateTime.parse(iso).toLocal();
  final minutes = date.minute.toString().padLeft(2, '0');
  return '${date.day} ${_months[date.month - 1]} ${date.year}, ${date.hour}:$minutes';
}

String errorText(Object error) => error is ApiException ? error.message : 'Ocurrió un error inesperado. Intenta de nuevo.';

void showMessage(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}

/// Carga datos de la API con reintento y «tirar para actualizar».
class Loader<T> extends StatefulWidget {
  const Loader({super.key, required this.load, required this.builder});
  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, Future<void> Function() reload) builder;

  @override
  State<Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<Loader<T>> {
  late Future<T> _future = widget.load();

  Future<void> _reload() async {
    final next = widget.load();
    setState(() {
      _future = next;
    });
    try {
      await next;
    } catch (_) {
      // El error se muestra en la vista.
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator(key: Key('loading')));
        }
        if (snapshot.hasError) {
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 48),
              Icon(Icons.cloud_off, size: 48, color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 12),
              Text(errorText(snapshot.error!), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              Center(child: FilledButton.icon(onPressed: _reload, icon: const Icon(Icons.refresh), label: const Text('Reintentar'))),
            ],
          );
        }
        return RefreshIndicator(onRefresh: _reload, child: widget.builder(context, snapshot.data as T, _reload));
      },
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, required this.children, this.trailing});
  final String title;
  final List<Widget> children;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
                ?trailing,
              ],
            ),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.text, {super.key, this.color});
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final base = color ?? Theme.of(context).colorScheme.primary;
    return Chip(
      label: Text(text),
      visualDensity: VisualDensity.compact,
      side: BorderSide(color: base),
      backgroundColor: base.withValues(alpha: 0.1),
      labelStyle: TextStyle(color: base, fontWeight: FontWeight.w600),
    );
  }
}

Future<String?> askText(
  BuildContext context, {
  required String title,
  required String hint,
  bool required = true,
  int maxLength = 500,
  String confirm = 'Enviar',
}) {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (dialogContext) {
      String? error;
      return StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(title),
          content: TextField(
            key: const Key('ask-text'),
            controller: controller,
            maxLength: maxLength,
            maxLines: 4,
            decoration: InputDecoration(hintText: hint, errorText: error),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancelar')),
            FilledButton(
              onPressed: () {
                final text = controller.text.trim();
                if (required && text.isEmpty) {
                  setState(() => error = 'Este campo es obligatorio.');
                  return;
                }
                Navigator.pop(dialogContext, text);
              },
              child: Text(confirm),
            ),
          ],
        ),
      );
    },
  );
}

/// Menú de cuenta: cambio de contraseña y cierre de sesión.
class AccountMenu extends StatelessWidget {
  const AccountMenu({super.key, required this.api, required this.onLogout});
  final ApiClient api;
  final Future<void> Function() onLogout;

  Future<void> _changePassword(BuildContext context) async {
    final current = TextEditingController();
    final next = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cambiar contraseña'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: current, obscureText: true, decoration: const InputDecoration(labelText: 'Contraseña actual')),
            TextField(controller: next, obscureText: true, decoration: const InputDecoration(labelText: 'Contraseña nueva (mínimo 10 caracteres)')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Cambiar')),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await api.post('/api/auth/change-password', {'currentPassword': current.text, 'newPassword': next.text});
      if (context.mounted) showMessage(context, 'Contraseña cambiada. Inicia sesión de nuevo.');
      await onLogout();
    } on ApiException catch (error) {
      if (context.mounted) showMessage(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      key: const Key('account-menu'),
      icon: const Icon(Icons.account_circle_outlined),
      tooltip: api.user?.email ?? 'Cuenta',
      onSelected: (value) {
        if (value == 'password') _changePassword(context);
        if (value == 'logout') onLogout();
      },
      itemBuilder: (context) => [
        PopupMenuItem(enabled: false, child: Text(api.user?.email ?? '')),
        const PopupMenuItem(value: 'password', child: Text('Cambiar contraseña')),
        const PopupMenuItem(value: 'logout', child: Text('Cerrar sesión')),
      ],
    );
  }
}
