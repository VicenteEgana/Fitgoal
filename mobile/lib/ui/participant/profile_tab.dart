import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';

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
      if (mounted) showMessage(context, 'Perfil guardado (versión $version). Tu rutina actual no cambia: mira las recomendadas para tu perfil.');
      await widget.onSaved();
    } on ApiException catch (error) {
      if (mounted) showMessage(context, error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleConsent(String purpose, bool value) async {
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

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            title: widget.profile == null ? 'Tu perfil' : 'Tu perfil (versión ${widget.profile!['version']})',
            children: [
              TextFormField(
                key: const Key('age'),
                controller: _age,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Edad', border: OutlineInputBorder()),
                validator: _validateAge,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: const Key('objective'),
                initialValue: _objective,
                decoration: const InputDecoration(labelText: 'Objetivo', border: OutlineInputBorder()),
                items: [for (final entry in objectiveLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
                onChanged: (value) => setState(() => _objective = value!),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: const Key('level'),
                initialValue: _level,
                decoration: const InputDecoration(labelText: 'Nivel de experiencia', border: OutlineInputBorder()),
                items: [for (final entry in levelLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
                onChanged: (value) => setState(() => _level = value!),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: const Key('equipment'),
                initialValue: _equipment,
                decoration: const InputDecoration(labelText: 'Equipamiento', border: OutlineInputBorder()),
                items: [for (final entry in equipmentLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
                onChanged: (value) => setState(() => _equipment = value!),
              ),
              const SizedBox(height: 4),
              SwitchListTile(
                key: const Key('consent-body-data'),
                contentPadding: EdgeInsets.zero,
                title: const Text('Usar mi estatura y peso para recomendarme rutinas'),
                subtitle: const Text('Es un dato de salud y es opcional. Con él calculamos tu IMC y afinamos las recomendaciones. Puedes revocarlo cuando quieras y se borra.'),
                value: _bodyOn,
                onChanged: (value) => _toggleConsent('datos_corporales', value),
              ),
              if (_bodyOn) ...[
                Row(children: [
                  Expanded(child: TextFormField(key: const Key('height'), controller: _height, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Estatura (cm)', border: OutlineInputBorder()), validator: (value) => _validateBody(value, 100, 250, 'Entre 100 y 250 cm.'))),
                  const SizedBox(width: 12),
                  Expanded(child: TextFormField(key: const Key('weight'), controller: _weight, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Peso (kg)', border: OutlineInputBorder()), validator: (value) => _validateBody(value, 30, 300, 'Entre 30 y 300 kg.'))),
                ]),
                if (widget.profile?['bmi'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text('Tu IMC: ${_formatBmi(widget.profile!['bmi'])} · ${bmiLabels[widget.profile!['bmiCategory']]}. Es solo una referencia: no distingue músculo de grasa.', key: const Key('bmi-text'), style: Theme.of(context).textTheme.bodySmall),
                  ),
              ],
              const SizedBox(height: 16),
              Text('Días disponibles', style: Theme.of(context).textTheme.titleSmall),
              Wrap(
                spacing: 8,
                children: [
                  for (var day = 1; day <= 7; day++)
                    FilterChip(
                      key: Key('day-$day'),
                      label: Text(dayInitials[day - 1]),
                      tooltip: dayNames[day - 1],
                      selected: _days.contains(day),
                      onSelected: (selected) => setState(() {
                        selected ? _days.add(day) : _days.remove(day);
                        _daysError = null;
                      }),
                    ),
                ],
              ),
              if (_daysError != null) Text(_daysError!, key: const Key('days-error'), style: TextStyle(color: Theme.of(context).colorScheme.error)),
              const SizedBox(height: 16),
              Text('Minutos por sesión', style: Theme.of(context).textTheme.titleSmall),
              Wrap(
                spacing: 8,
                children: [
                  for (final minutes in const [20, 30, 45, 60])
                    ChoiceChip(key: Key('duration-$minutes'), label: Text('$minutes'), selected: _duration == minutes, onSelected: (_) => setState(() => _duration = minutes)),
                ],
              ),
            ],
          ),
          if (_bodyOn)
            SectionCard(
              title: 'Datos para tu pauta de alimentación',
              children: [
                SwitchListTile(
                  key: const Key('consent-nutrition'),
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Usar mi sexo y nivel de actividad para calcular mis calorías'),
                  subtitle: const Text('Es opcional. Con tu estatura y peso estimamos tus calorías (Mifflin-St Jeor) y ajustamos los gramos de tu pauta a tu objetivo. Puedes revocarlo cuando quieras y se borran.'),
                  value: _consents['datos_nutricionales'] ?? false,
                  onChanged: (value) => _toggleConsent('datos_nutricionales', value),
                ),
                if (_nutritionOn) ...[
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  key: const Key('sex'),
                  initialValue: _sex,
                  decoration: const InputDecoration(labelText: 'Sexo (parámetro de la fórmula)', border: OutlineInputBorder()),
                  items: [for (final entry in _sexLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
                  onChanged: (value) => setState(() => _sex = value),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  key: const Key('activity'),
                  initialValue: _activity,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Nivel de actividad', border: OutlineInputBorder()),
                  items: [for (final entry in _activityLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value, overflow: TextOverflow.ellipsis))],
                  onChanged: (value) => setState(() => _activity = value),
                ),
                if (widget.profile?['weightKg'] != null && widget.profile?['sexParam'] != null) Align(alignment: Alignment.centerLeft, child: TextButton(key: const Key('estimate'), onPressed: _showEstimate, child: const Text('Ver mis calorías'))),
                ],
              ],
            ),
          FilledButton(key: const Key('save-profile'), onPressed: _busy ? null : _save, child: Text(_busy ? 'Guardando…' : 'Guardar perfil')),
          const SizedBox(height: 16),
          SectionCard(
            title: 'Tus consentimientos',
            children: [
              SwitchListTile(
                key: const Key('consent-progress'),
                contentPadding: EdgeInsets.zero,
                title: const Text('Registrar mi progreso, incluido el peso'),
                value: _consents['seguimiento_progreso'] ?? false,
                onChanged: (value) => _toggleConsent('seguimiento_progreso', value),
              ),
              SwitchListTile(
                key: const Key('consent-reminders'),
                contentPadding: EdgeInsets.zero,
                title: const Text('Recordatorios de sesiones pendientes'),
                value: _consents['recordatorios'] ?? false,
                onChanged: (value) => _toggleConsent('recordatorios', value),
              ),
              Text('Política de datos vigente: $policyVersion', style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ],
      ),
    );
  }
}
