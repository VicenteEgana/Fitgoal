import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import '../privacy_policy.dart';

const _objectiveHelp = {
  'bajar': 'Rutinas con más gasto y, si lo autorizas, una pauta con déficit moderado.',
  'mantener': 'Mejorar tu condición física sin cambiar tu peso.',
  'subir': 'Ganar masa muscular y, si lo autorizas, una pauta con superávit.',
};
const _levelHelp = {
  'principiante': 'Estás empezando o vuelves después de un tiempo sin entrenar.',
  'con_experiencia': 'Entrenas con regularidad desde hace al menos 6 meses.',
};
const _equipmentHelp = {
  'sin_equipo': 'Entrenas en casa o al aire libre, con tu peso corporal.',
  'con_equipo': 'Tienes acceso a un gimnasio, mancuernas o máquinas.',
};
const _sexLabels = {'masculino': 'Masculino', 'femenino': 'Femenino'};
const _activityLabels = {
  'sedentario': 'Sedentario (poco o nada de ejercicio)',
  'ligero': 'Ligero (1 a 3 días por semana)',
  'moderado': 'Moderado (3 a 5 días por semana)',
  'intenso': 'Intenso (6 o 7 días por semana)',
};

enum _Step { objective, experience, availability, age, body, nutrition, summary }

/// Perfil guiado justo después de crear la cuenta (RF001, RF002, K1): objetivo, experiencia, disponibilidad, edad y, si la
/// persona quiere, estatura y peso, y sexo y actividad, cada uno con su consentimiento en el mismo paso en que se piden.
/// Los datos de salud son opcionales: quien los omite recibe rutinas generales de bajo impacto.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.api, required this.nutritionEnabled, required this.onFinished, required this.onSkipped});
  final ApiClient api;
  final bool nutritionEnabled;
  final VoidCallback onFinished;
  final VoidCallback onSkipped;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _age = TextEditingController();
  final _height = TextEditingController();
  final _weight = TextEditingController();
  _Step _step = _Step.objective;
  String? _objective;
  String _level = 'principiante';
  String _equipment = 'sin_equipo';
  final Set<int> _days = {};
  int _duration = 30;
  bool _bodyOn = false;
  bool _nutritionOn = false;
  String? _sex;
  String? _activity;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _age.dispose();
    _height.dispose();
    _weight.dispose();
    super.dispose();
  }

  bool get _hasBody => _bodyOn && _height.text.trim().isNotEmpty && _weight.text.trim().isNotEmpty;
  bool get _hasNutrition => _hasBody && _nutritionOn && _sex != null && _activity != null;

  /// Pasos en orden; el de calorías solo aparece si la persona dio estatura y peso y la alimentación está activa.
  List<_Step> get _steps => [
        _Step.objective, _Step.experience, _Step.availability, _Step.age, _Step.body,
        if (_hasBody && widget.nutritionEnabled) _Step.nutrition,
        _Step.summary,
      ];

  double? _number(TextEditingController controller) => double.tryParse(controller.text.trim().replaceAll(',', '.'));

  /// Revisa el paso actual; devuelve el mensaje que impide avanzar o null.
  String? _check() {
    switch (_step) {
      case _Step.objective:
        return _objective == null ? 'Elige tu objetivo.' : null;
      case _Step.availability:
        return _days.isEmpty ? 'Elige al menos un día.' : null;
      case _Step.age:
        final age = int.tryParse(_age.text.trim());
        return age != null && age >= 18 && age <= 120 ? null : 'Ingresa una edad entre 18 y 120 años: FitGoal es para personas adultas.';
      case _Step.body:
        if (!_bodyOn) return null;
        final height = _number(_height), weight = _number(_weight);
        if (height == null || height < 100 || height > 250) return 'La estatura debe estar entre 100 y 250 cm.';
        if (weight == null || weight < 30 || weight > 300) return 'El peso debe estar entre 30 y 300 kg.';
        return null;
      case _Step.nutrition:
        return _nutritionOn && (_sex == null || _activity == null) ? 'Indica tu sexo y tu nivel de actividad, o desactiva esta opción.' : null;
      case _Step.experience:
      case _Step.summary:
        return null;
    }
  }

  void _next() {
    final problem = _check();
    setState(() => _error = problem);
    if (problem != null) return;
    final steps = _steps;
    setState(() => _step = steps[steps.indexOf(_step) + 1]);
  }

  void _back() {
    final steps = _steps;
    setState(() {
      _error = null;
      _step = steps[steps.indexOf(_step) - 1];
    });
  }

  /// Registra los consentimientos que la persona activó en este recorrido y guarda la primera versión del perfil.
  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final current = {
        for (final item in ((await widget.api.get('/api/consents') as Map)['consents'] as List).cast<Map<String, dynamic>>()) item['purpose'] as String: item['granted'] as bool,
      };
      Future<void> consent(String purpose, bool wanted) async {
        if ((current[purpose] ?? false) == wanted) return;
        await widget.api.post('/api/consents', {'purpose': purpose, 'granted': wanted, 'policyVersion': policyVersion});
      }
      await consent('datos_corporales', _hasBody);
      if (_hasBody) await consent('datos_nutricionales', _hasNutrition);
      final intent = widget.api.registrationIntent;
      await widget.api.put('/api/profiles/me${intent == null ? '' : '?intent=$intent'}', {
        'age': int.parse(_age.text.trim()),
        'objective': _objective,
        'level': _level,
        'days': (_days.toList()..sort()),
        'durationMinutes': _duration,
        'equipment': _equipment,
        if (_hasBody) ...{'weightKg': _number(_weight), 'heightCm': _number(_height)},
        if (_hasNutrition) ...{'sexParam': _sex, 'activityLevel': _activity},
      });
      widget.onFinished();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _options(String group, Map<String, String> labels, Map<String, String> help, String? value, ValueChanged<String> onChanged) {
    return Column(children: [
      for (final entry in labels.entries)
        Card(
          key: Key('onb-$group-${entry.key}'),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: value == entry.key ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.outlineVariant, width: value == entry.key ? 2 : 1),
          ),
          child: ListTile(
            title: Text(entry.value, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(help[entry.key]!),
            trailing: Icon(value == entry.key ? Icons.check_circle : Icons.circle_outlined, color: value == entry.key ? Theme.of(context).colorScheme.primary : null),
            onTap: () => setState(() {
              onChanged(entry.key);
              _error = null;
            }),
          ),
        ),
    ]);
  }

  Widget _title(String title, String subtitle) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 6),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
        ]),
      );

  List<Widget> _content() {
    switch (_step) {
      case _Step.objective:
        return [
          _title('¿Cuál es tu objetivo?', 'Con él elegimos tus rutinas recomendadas. Puedes cambiarlo cuando quieras.'),
          _options('objective', objectiveLabels, _objectiveHelp, _objective, (value) => _objective = value),
        ];
      case _Step.experience:
        return [
          _title('Tu experiencia y tu equipo', 'Así las rutinas parten en el nivel adecuado y usan lo que tienes.'),
          _options('level', levelLabels, _levelHelp, _level, (value) => _level = value),
          const SizedBox(height: 12),
          _options('equipment', equipmentLabels, _equipmentHelp, _equipment, (value) => _equipment = value),
        ];
      case _Step.availability:
        return [
          _title('¿Cuándo puedes entrenar?', 'Elige tus días y cuánto tiempo tienes por sesión. Los demás días serán de descanso.'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (var day = 1; day <= 7; day++)
              FilterChip(
                key: Key('onb-day-$day'),
                label: Text(dayNames[day - 1]),
                selected: _days.contains(day),
                onSelected: (selected) => setState(() {
                  selected ? _days.add(day) : _days.remove(day);
                  _error = null;
                }),
              ),
          ]),
          const SizedBox(height: 20),
          Text('Minutos por sesión', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(spacing: 8, children: [
            for (final minutes in const [20, 30, 45, 60])
              ChoiceChip(key: Key('onb-duration-$minutes'), label: Text('$minutes min'), selected: _duration == minutes, onSelected: (_) => setState(() => _duration = minutes)),
          ]),
        ];
      case _Step.age:
        return [
          _title('¿Qué edad tienes?', 'FitGoal es para personas adultas.'),
          TextField(
            key: const Key('onb-age'),
            controller: _age,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Edad (años)', border: OutlineInputBorder()),
            onChanged: (_) => setState(() => _error = null),
          ),
        ];
      case _Step.body:
        return [
          _title('Tu estatura y tu peso', 'Es opcional. Es un dato de salud: con él calculamos tu IMC, solo como referencia, y afinamos las recomendaciones. Si no lo das, te recomendamos rutinas generales de bajo impacto.'),
          SwitchListTile(
            key: const Key('onb-consent-body'),
            contentPadding: EdgeInsets.zero,
            title: const Text('Usar mi estatura y peso para recomendarme rutinas'),
            subtitle: const Text('Se guardan cifrados. Puedes revocarlo cuando quieras en tu perfil y se borran.'),
            value: _bodyOn,
            onChanged: (value) => setState(() {
              _bodyOn = value;
              _error = null;
              if (!value) {
                _height.clear();
                _weight.clear();
              }
            }),
          ),
          if (_bodyOn) ...[
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: TextField(key: const Key('onb-height'), controller: _height, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Estatura (cm)', border: OutlineInputBorder()), onChanged: (_) => setState(() => _error = null))),
              const SizedBox(width: 12),
              Expanded(child: TextField(key: const Key('onb-weight'), controller: _weight, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Peso (kg)', border: OutlineInputBorder()), onChanged: (_) => setState(() => _error = null))),
            ]),
          ],
          Align(alignment: Alignment.centerLeft, child: TextButton(key: const Key('onb-policy'), onPressed: () => showPrivacyPolicy(context), child: const Text('Leer la política de datos'))),
        ];
      case _Step.nutrition:
        return [
          _title('Tus calorías', 'Es opcional. Con tu sexo y tu nivel de actividad estimamos tus calorías (Mifflin-St Jeor) y ajustamos los gramos de tu pauta a tu objetivo.'),
          SwitchListTile(
            key: const Key('onb-consent-nutrition'),
            contentPadding: EdgeInsets.zero,
            title: const Text('Usar mi sexo y nivel de actividad para calcular mis calorías'),
            subtitle: const Text('Se guardan cifrados. Puedes revocarlo cuando quieras y se borran.'),
            value: _nutritionOn,
            onChanged: (value) => setState(() {
              _nutritionOn = value;
              _error = null;
              if (!value) {
                _sex = null;
                _activity = null;
              }
            }),
          ),
          if (_nutritionOn) ...[
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              key: const Key('onb-sex'),
              initialValue: _sex,
              decoration: const InputDecoration(labelText: 'Sexo (parámetro de la fórmula)', border: OutlineInputBorder()),
              items: [for (final entry in _sexLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
              onChanged: (value) => setState(() => _sex = value),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              key: const Key('onb-activity'),
              initialValue: _activity,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Nivel de actividad', border: OutlineInputBorder()),
              items: [for (final entry in _activityLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value, overflow: TextOverflow.ellipsis))],
              onChanged: (value) => setState(() => _activity = value),
            ),
          ],
        ];
      case _Step.summary:
        final days = (_days.toList()..sort()).map((day) => dayNames[day - 1]).join(', ');
        Widget row(String label, String value) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(width: 130, child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600))),
                Expanded(child: Text(value)),
              ]),
            );
        return [
          _title('Revisa tu perfil', 'Con esto te mostramos las rutinas recomendadas. Puedes cambiar todo después en «Perfil».'),
          SectionCard(title: 'Resumen', children: [
            row('Objetivo', objectiveLabels[_objective]!),
            row('Experiencia', levelLabels[_level]!),
            row('Equipo', equipmentLabels[_equipment]!),
            row('Días', days),
            row('Por sesión', '$_duration minutos'),
            row('Edad', '${_age.text.trim()} años'),
            row('Estatura y peso', _hasBody ? '${_height.text.trim()} cm · ${_weight.text.trim()} kg' : 'No los diste: rutinas generales de bajo impacto'),
            if (widget.nutritionEnabled) row('Calorías', _hasNutrition ? '${_sexLabels[_sex]} · ${_activityLabels[_activity]}' : 'Sin calcular: verás porciones de referencia'),
          ]),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final steps = _steps;
    final index = steps.indexOf(_step);
    final optional = (_step == _Step.body && !_bodyOn) || (_step == _Step.nutrition && !_nutritionOn);
    return Scaffold(
      appBar: AppBar(
        title: Text('Paso ${index + 1} de ${steps.length}'),
        actions: [TextButton(key: const Key('onb-later'), onPressed: _busy ? null : widget.onSkipped, child: const Text('Más tarde'))],
      ),
      body: SafeArea(
        child: Column(children: [
          LinearProgressIndicator(key: const Key('onb-progress'), value: (index + 1) / steps.length),
          Expanded(
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 20, 16, 16), children: [
              ..._content(),
              if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, key: const Key('onb-error'), style: TextStyle(color: Theme.of(context).colorScheme.error))),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Row(children: [
              if (index > 0) ...[TextButton(key: const Key('onb-back'), onPressed: _busy ? null : _back, child: const Text('Atrás')), const SizedBox(width: 8)],
              Expanded(
                child: _step == _Step.summary
                    ? FilledButton(key: const Key('onb-save'), onPressed: _busy ? null : _save, child: Text(_busy ? 'Guardando…' : 'Guardar y ver mis rutinas', textAlign: TextAlign.center))
                    : FilledButton(key: const Key('onb-next'), onPressed: _next, child: Text(optional ? 'Omitir' : 'Siguiente')),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
