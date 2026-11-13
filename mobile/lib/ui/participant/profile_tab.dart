import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import '../privacy_policy.dart';

const _sexLabels = {'masculino': 'Masculino', 'femenino': 'Femenino'};
const _activityLabels = {
  'sedentario': 'Sedentario (poco o nada de ejercicio)',
  'ligero': 'Ligero (1 a 3 días por semana)',
  'moderado': 'Moderado (3 a 5 días por semana)',
  'intenso': 'Intenso (6 o 7 días por semana)',
};

/// Perfil, objetivo y disponibilidad (RF001, RF002). Cada cambio crea una versión nueva.
class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Loader<Map<String, dynamic>>(
      load: () async {
        final profile = await api.get('/api/profiles/me') as Map<String, dynamic>;
        final consents = await api.get('/api/consents') as Map<String, dynamic>;
        return {'profile': profile['profile'], 'consents': consents['consents']};
      },
      builder: (context, data, reload) => ProfileForm(
        api: api,
        profile: data['profile'] as Map<String, dynamic>?,
        consents: {for (final item in (data['consents'] as List).cast<Map<String, dynamic>>()) item['purpose'] as String: item['granted'] as bool},
        onSaved: reload,
      ),
    );
  }
}

class ProfileForm extends StatefulWidget {
  const ProfileForm({super.key, required this.api, required this.profile, required this.consents, required this.onSaved});
  final ApiClient api;
  final Map<String, dynamic>? profile;
  final Map<String, bool> consents;
  final Future<void> Function() onSaved;

  @override
  State<ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends State<ProfileForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _age;
  late final TextEditingController _weight;
  late final TextEditingController _height;
  late String _objective;
  late String _level;
  late String _equipment;
  late int _duration;
  late Set<int> _days;
  String? _sex;
  String? _activity;
  String? _daysError;
  bool _busy = false;
  late Map<String, bool> _consents;
  /// Cómo estaba el formulario la última vez que se guardó, para avisar si hay cambios sin guardar.
  late String _saved;

  String _snapshot() => [_age.text, _weight.text, _height.text, _objective, _level, _equipment, _duration, (_days.toList()..sort()).join(','), _sex, _activity].join('|');

  bool get _dirty => _snapshot() != _saved;

  @override
  void initState() {
    super.initState();
    final profile = widget.profile;
    _age = TextEditingController(text: profile == null ? '' : '${profile['age']}');
    _weight = TextEditingController(text: profile?['weightKg'] == null ? '' : '${profile!['weightKg']}');
    _height = TextEditingController(text: profile?['heightCm'] == null ? '' : '${profile!['heightCm']}');
    _objective = profile?['objective'] as String? ?? 'bajar';
    _level = profile?['level'] as String? ?? 'principiante';
    _equipment = profile?['equipment'] as String? ?? 'sin_equipo';
    _duration = profile?['durationMinutes'] as int? ?? 30;
    _days = {...((profile?['days'] as List?)?.cast<int>() ?? <int>[])};
    _sex = profile?['sexParam'] as String?;
    _activity = profile?['activityLevel'] as String?;
    _consents = {...widget.consents};
    _saved = _snapshot();
  }

  @override
  void dispose() {
    _age.dispose();
    _weight.dispose();
    _height.dispose();
    super.dispose();
  }

  static String _formatBmi(Object? bmi) => (bmi as num).toStringAsFixed(1).replaceAll('.', ',');

  String? _validateAge(String? value) {
    final age = int.tryParse((value ?? '').trim());
    return age != null && age >= 18 && age <= 120 ? null : 'Ingresa una edad entre 18 y 120 años: FitGoal es para personas adultas.';
  }

  bool get _bodyOn => _consents['datos_corporales'] ?? false;
  bool get _nutritionOn => _bodyOn && (_consents['datos_nutricionales'] ?? false);

  /// La estatura y el peso son opcionales, pero van juntos: si se informa uno, se informa el otro.
  String? _validateBody(String? value, double min, double max, String message) {
    if (!_bodyOn) return null;
    if ((value ?? '').trim().isEmpty && _weight.text.trim().isEmpty && _height.text.trim().isEmpty) return null;
    final number = double.tryParse((value ?? '').replaceAll(',', '.'));
    return number != null && number >= min && number <= max ? null : message;
  }

  Future<void> _save() async {
    final valid = _formKey.currentState!.validate();
    setState(() => _daysError = _days.isEmpty ? 'Elige al menos un día.' : null);
    if (!valid || _days.isEmpty) return;
    final body = _bodyOn && _weight.text.trim().isNotEmpty && _height.text.trim().isNotEmpty;
    final nutrition = _nutritionOn && (_sex != null || _activity != null);
    if (nutrition && (_sex == null || _activity == null || !body)) {
      showMessage(context, 'Para calcular tus calorías informa sexo, estatura, peso y actividad completos, o ninguno.');
      return;
    }
    setState(() => _busy = true);
    try {
      final result = await widget.api.put('/api/profiles/me', {
        'age': int.parse(_age.text.trim()),
        'objective': _objective,
        'level': _level,
        'days': (_days.toList()..sort()),
        'durationMinutes': _duration,
        'equipment': _equipment,
        if (body) ...{
          'weightKg': double.parse(_weight.text.replaceAll(',', '.')),
          'heightCm': double.parse(_height.text.replaceAll(',', '.')),
        },
        if (nutrition) ...{'sexParam': _sex, 'activityLevel': _activity},
      }) as Map<String, dynamic>;
      final version = (result['profile'] as Map)['version'];
      if (mounted) setState(() => _saved = _snapshot());
      if (mounted) showMessage(context, 'Perfil guardado (versión $version). Tu rutina actual no cambia: mira las recomendadas para tu perfil.');
      await widget.onSaved();
    } on ApiException catch (error) {
      if (mounted) showMessage(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Revocar estas finalidades borra datos y no se puede deshacer: se pide confirmar.
  Future<bool> _confirmRevoke(String purpose) async {
    if (purpose != 'datos_corporales' && purpose != 'seguimiento_progreso') return true;
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('¿Revocar este consentimiento?'),
        content: Text(purpose == 'datos_corporales' ? 'Borraremos tu estatura, tu peso, tu sexo, tu nivel de actividad y tu historial de peso. No se puede deshacer.' : 'Borraremos tu historial de peso. No se puede deshacer.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
          FilledButton(key: const Key('confirm-revoke'), onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Revocar y borrar')),
        ],
      ),
    );
    return ok ?? false;
  }

  Future<void> _toggleConsent(String purpose, bool value) async {
    if (!value && !await _confirmRevoke(purpose)) return;
    try {
      await widget.api.post('/api/consents', {'purpose': purpose, 'granted': value, 'policyVersion': policyVersion});
      setState(() {
        _consents[purpose] = value;
        if (purpose == 'datos_corporales' && !value) {
          _weight.clear();
          _height.clear();
          _sex = null;
          _activity = null;
        }
        if (purpose == 'datos_nutricionales' && !value) {
          _sex = null;
          _activity = null;
        }
      });
    } on ApiException catch (error) {
      if (mounted) showMessage(context, error.message);
    }
  }

  Future<void> _showEstimate() async {
    try {
      final result = await widget.api.get('/api/estimates/energy') as Map<String, dynamic>;
      final estimate = result['estimate'] as Map<String, dynamic>;
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Tus calorías estimadas'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${(estimate['formula'] as Map)['name']} · versión ${(estimate['formula'] as Map)['version']}'),
              const SizedBox(height: 8),
              Text('Gasto en reposo: ${estimate['restingEnergyKcal']} kcal/día', key: const Key('estimate-value'), style: const TextStyle(fontWeight: FontWeight.w700)),
              if (estimate['maintenanceKcal'] != null) Text('Mantenimiento: ${formatNumber(estimate['maintenanceKcal'] as num)} kcal/día'),
              if (estimate['targetKcal'] != null) Text('Tu pauta (${estimate['objectiveLabel']}): ${formatNumber(estimate['targetKcal'] as num)} kcal/día', key: const Key('estimate-target'), style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text(estimate['adjustments'] as String, style: const TextStyle(fontSize: 12)),
              const SizedBox(height: 8),
              Text(estimate['notice'] as String, style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic)),
            ],
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cerrar'))],
        ),
      );
    } on ApiException catch (error) {
      if (mounted) showMessage(context, error.message);
    }
  }

  /// IMC con los valores escritos, como referencia mientras se edita (el oficial lo calcula el servidor al guardar).
  double? get _liveBmi {
    final weight = double.tryParse(_weight.text.replaceAll(',', '.'));
    final height = double.tryParse(_height.text.replaceAll(',', '.'));
    if (weight == null || height == null || height < 100 || height > 250 || weight < 30 || weight > 300) return null;
    return weight / ((height / 100) * (height / 100));
  }

  Widget _consentTile(Widget tile) {
    final tokens = FitTokens.of(context);
    // Un Material propio para que el interruptor muestre su efecto al tocarlo sobre el fondo de la tarjeta.
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Material(
        color: tokens.cardHigh,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: tokens.border)),
        clipBehavior: Clip.antiAlias,
        child: Padding(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2), child: tile),
      ),
    );
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(top: 18, bottom: 8),
    child: Text(text, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
  );

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final scheme = Theme.of(context).colorScheme;
    final age = TextFormField(
      key: const Key('age'),
      controller: _age,
      keyboardType: TextInputType.number,
      decoration: const InputDecoration(labelText: 'Edad', suffixText: 'años', prefixIcon: Icon(Icons.cake_outlined), errorMaxLines: 3),
      validator: _validateAge,
    );
    final height = TextFormField(key: const Key('height'), controller: _height, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Estatura', suffixText: 'cm', prefixIcon: Icon(Icons.height), errorMaxLines: 2), validator: (value) => _validateBody(value, 100, 250, 'Entre 100 y 250 cm.'));
    final weight = TextFormField(key: const Key('weight'), controller: _weight, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Peso', suffixText: 'kg', prefixIcon: Icon(Icons.monitor_weight_outlined), errorMaxLines: 2), validator: (value) => _validateBody(value, 30, 300, 'Entre 30 y 300 kg.'));
    final objective = DropdownButtonFormField<String>(
      key: const Key('objective'),
      initialValue: _objective,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Objetivo', prefixIcon: Icon(Icons.flag_outlined)),
      items: [for (final entry in objectiveLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
      onChanged: (value) => setState(() => _objective = value!),
    );
    final level = DropdownButtonFormField<String>(
      key: const Key('level'),
      initialValue: _level,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Nivel de experiencia', prefixIcon: Icon(Icons.bolt_outlined)),
      items: [for (final entry in levelLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
      onChanged: (value) => setState(() => _level = value!),
    );
    final equipment = DropdownButtonFormField<String>(
      key: const Key('equipment'),
      initialValue: _equipment,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Equipamiento', prefixIcon: Icon(Icons.fitness_center)),
      items: [for (final entry in equipmentLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
      onChanged: (value) => setState(() => _equipment = value!),
    );
    final profileCard = SectionCard(
      title: widget.profile == null ? 'Tu perfil' : 'Tu perfil (versión ${widget.profile!['version']})',
      icon: Icons.person_outline,
      children: [
        // Edad y objetivo juntos en pantallas anchas; uno bajo el otro en el teléfono.
        LayoutBuilder(builder: (context, constraints) => constraints.maxWidth >= 480
            ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(flex: 2, child: age), const SizedBox(width: 10), Expanded(flex: 3, child: objective)])
            : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [age, const SizedBox(height: 12), objective])),
        const SizedBox(height: 12),
        LayoutBuilder(builder: (context, constraints) => constraints.maxWidth >= 480
            ? Row(children: [Expanded(child: level), const SizedBox(width: 10), Expanded(child: equipment)])
            : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [level, const SizedBox(height: 12), equipment])),
        _label('Días disponibles'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (var day = 1; day <= 7; day++)
              FilterChip(
                key: Key('day-$day'),
                label: Text(dayInitials[day - 1]),
                tooltip: dayNames[day - 1],
                showCheckmark: false,
                selected: _days.contains(day),
                onSelected: (selected) => setState(() {
                  selected ? _days.add(day) : _days.remove(day);
                  _daysError = null;
                }),
              ),
          ],
        ),
        if (_daysError != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(_daysError!, key: const Key('days-error'), style: TextStyle(color: scheme.error))),
        _label('Minutos por sesión'),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final minutes in const [20, 30, 45, 60])
              ChoiceChip(key: Key('duration-$minutes'), avatar: const Icon(Icons.timer_outlined, size: 16), showCheckmark: false, label: Text('$minutes min'), selected: _duration == minutes, onSelected: (_) => setState(() => _duration = minutes)),
          ],
        ),
        // Dato de salud opcional: el permiso va junto a los campos que habilita.
        _label('Estatura y peso (opcional)'),
        _consentTile(SwitchListTile(
          key: const Key('consent-body-data'),
          contentPadding: EdgeInsets.zero,
          title: const Text('Usar mi estatura y peso para recomendarme rutinas', style: TextStyle(fontWeight: FontWeight.w600)),
          subtitle: const Text('Es un dato de salud y es opcional. Con él calculamos tu IMC y afinamos las recomendaciones. Puedes revocarlo cuando quieras y se borra, junto con tu historial de peso.'),
          value: _bodyOn,
          onChanged: (value) => _toggleConsent('datos_corporales', value),
        )),
        if (_bodyOn) ...[
          const SizedBox(height: 14),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: height), const SizedBox(width: 10), Expanded(child: weight)]),
          const SizedBox(height: 10),
          Wrap(crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, runSpacing: 6, children: [
            // Al escribir, solo se redibuja esta etiqueta (no todo el formulario).
            ListenableBuilder(
              listenable: Listenable.merge([_weight, _height]),
              builder: (context, _) {
                final bmi = _liveBmi;
                final bmiColor = bmi == null ? tokens.muted : bmi < 18.5 ? tokens.info : bmi < 25 ? tokens.accent : bmi < 30 ? tokens.streak : tokens.danger;
                return Pill(
                  bmi == null ? 'IMC: completa estatura y peso' : 'IMC con estos datos: ${bmi.toStringAsFixed(1).replaceAll('.', ',')}',
                  icon: Icons.speed,
                  color: bmiColor,
                  strong: true,
                );
              },
            ),
            if (widget.profile?['bmi'] != null)
              Text('Tu IMC: ${_formatBmi(widget.profile!['bmi'])} · ${bmiLabels[widget.profile!['bmiCategory']]}. Es solo una referencia: no distingue músculo de grasa.', key: const Key('bmi-text'), style: Theme.of(context).textTheme.bodySmall),
          ]),
        ],
      ],
    );
    final nutritionCard = _bodyOn
        ? SectionCard(
            title: 'Datos para tu pauta de alimentación',
            icon: Icons.restaurant_menu,
            iconColor: tokens.carbs,
            children: [
              _consentTile(SwitchListTile(
                key: const Key('consent-nutrition'),
                contentPadding: EdgeInsets.zero,
                title: const Text('Usar mi sexo y nivel de actividad para calcular mis calorías', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('Es opcional. Con tu estatura y peso estimamos tus calorías (Mifflin-St Jeor) y ajustamos los gramos de tu pauta a tu objetivo. Puedes revocarlo cuando quieras y se borran.'),
                value: _consents['datos_nutricionales'] ?? false,
                onChanged: (value) => _toggleConsent('datos_nutricionales', value),
              )),
              if (_nutritionOn) ...[
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  key: const Key('sex'),
                  initialValue: _sex,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Sexo (parámetro de la fórmula)', prefixIcon: Icon(Icons.wc)),
                  items: [for (final entry in _sexLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
                  onChanged: (value) => setState(() => _sex = value),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  key: const Key('activity'),
                  initialValue: _activity,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Nivel de actividad', prefixIcon: Icon(Icons.directions_run)),
                  items: [for (final entry in _activityLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value, overflow: TextOverflow.ellipsis))],
                  onChanged: (value) => setState(() => _activity = value),
                ),
                if (widget.profile?['weightKg'] != null && widget.profile?['sexParam'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Align(alignment: Alignment.centerLeft, child: TextButton.icon(key: const Key('estimate'), onPressed: _showEstimate, icon: const Icon(Icons.local_fire_department_outlined, size: 18), label: const Text('Ver mis calorías'))),
                  ),
              ],
            ],
          )
        : null;
    final saveBar = ListenableBuilder(listenable: Listenable.merge([_age, _weight, _height]), builder: (context, _) {
      final dirty = _dirty;
      return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: dirty ? scheme.primary.withValues(alpha: 0.45) : tokens.border),
        boxShadow: [if (dirty) BoxShadow(color: scheme.primary.withValues(alpha: 0.18), blurRadius: 24, offset: const Offset(0, 8))],
      ),
      child: Row(children: [
        Icon(dirty ? Icons.edit_note : Icons.check_circle_outline, size: 20, color: dirty ? tokens.streak : tokens.accent),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            dirty ? 'Tienes cambios sin guardar' : widget.profile == null ? 'Completa tus datos y guarda tu perfil' : 'Tu perfil está al día',
            style: TextStyle(fontWeight: FontWeight.w600, color: dirty ? null : tokens.muted),
          ),
        ),
        const SizedBox(width: 8),
        FilledButton.icon(
          key: const Key('save-profile'),
          onPressed: _busy ? null : _save,
          icon: _busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.save_outlined, size: 18),
          label: Text(_busy ? 'Guardando…' : 'Guardar perfil'),
        ),
      ]),
    );
    });
    final consentsCard = SectionCard(
      title: 'Tus consentimientos',
      icon: Icons.verified_user_outlined,
      iconColor: tokens.info,
      children: [
        _consentTile(SwitchListTile(
          key: const Key('consent-progress'),
          contentPadding: EdgeInsets.zero,
          title: const Text('Registrar mi progreso, incluido el peso', style: TextStyle(fontWeight: FontWeight.w600)),
          subtitle: const Text('Si lo revocas, se borra tu historial de peso.'),
          value: _consents['seguimiento_progreso'] ?? false,
          onChanged: (value) => _toggleConsent('seguimiento_progreso', value),
        )),
        _consentTile(SwitchListTile(
          key: const Key('consent-reminders'),
          contentPadding: EdgeInsets.zero,
          title: const Text('Recordatorios de sesiones pendientes', style: TextStyle(fontWeight: FontWeight.w600)),
          value: _consents['recordatorios'] ?? false,
          onChanged: (value) => _toggleConsent('recordatorios', value),
        )),
        _consentTile(SwitchListTile(
          key: const Key('consent-pilot'),
          contentPadding: EdgeInsets.zero,
          title: const Text('Participar en la evaluación del piloto', style: TextStyle(fontWeight: FontWeight.w600)),
          subtitle: const Text('Usamos tus datos de uso, sin tu nombre ni correo, para evaluar la aplicación. Si lo revocas, sales del piloto y se borran.'),
          value: _consents['evaluacion_piloto'] ?? false,
          onChanged: (value) => _toggleConsent('evaluacion_piloto', value),
        )),
        const SizedBox(height: 12),
        Text('Política de datos vigente: $policyVersion', style: Theme.of(context).textTheme.bodySmall),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(key: const Key('policy-link'), onPressed: () => showPrivacyPolicy(context), icon: const Icon(Icons.description_outlined, size: 18), label: const Text('Leer la política de datos')),
        ),
      ],
    );
    // La barra de guardar queda fija abajo, siempre a mano; el contenido se desplaza por encima de ella.
    return Form(
      key: _formKey,
      child: Column(children: [
        Expanded(
          child: PageList(
            maxWidth: 896,
            children: [
              BentoColumns(
                primaryFlex: 1,
                secondaryFlex: 1,
                breakpoint: 840,
                primary: [profileCard],
                secondary: [?nutritionCard, consentsCard],
              ),
            ],
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(color: tokens.background, border: Border(top: BorderSide(color: tokens.border))),
          child: LayoutBuilder(builder: (context, constraints) {
            final gutter = constraints.maxWidth >= kShellBreakpoint ? 32.0 : 12.0;
            final side = ((constraints.maxWidth - 896) / 2).clamp(gutter, double.infinity);
            return Padding(padding: EdgeInsets.fromLTRB(side, 10, side, 10), child: saveBar);
          }),
        ),
      ]),
    );
  }
}
