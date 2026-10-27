import 'package:flutter/material.dart';

import 'api_client.dart';

void main() => runApp(const FitGoalApp());

class FitGoalApp extends StatelessWidget {
  final ApiClient? api;
  const FitGoalApp({super.key, this.api});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'FitGoal · Demo',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff166b59)),
      useMaterial3: true,
      scaffoldBackgroundColor: const Color(0xfff5f8f7),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
    ),
    home: FitGoalHome(api: api),
  );
}

class FitGoalHome extends StatefulWidget {
  final ApiClient? api;
  const FitGoalHome({super.key, this.api});
  @override
  State<FitGoalHome> createState() => _FitGoalHomeState();
}

class _FitGoalHomeState extends State<FitGoalHome> {
  late final ApiClient _api;
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController(text: 'Persona demo');
  final _age = TextEditingController(text: '24');
  String _objective = 'mantener',
      _level = 'principiante',
      _equipment = 'sin_equipo';
  int _duration = 30;
  final Set<int> _days = {1, 3, 5};
  bool _busy = false, _connected = false;
  String? _message, _error;
  Map<String, dynamic>? _profile, _plan;

  @override
  void initState() {
    super.initState();
    _api = widget.api ?? ApiClient();
    _reconnect();
  }

  @override
  void dispose() {
    _name.dispose();
    _age.dispose();
    _api.close();
    super.dispose();
  }

  Map<String, dynamic>? _map(dynamic value) =>
      value is Map<String, dynamic> ? value : null;

  Future<void> _refresh() async {
    final data = await _api.request('GET', '/api/demo/state');
    _profile = _map(data['profile']);
    _plan = _map(data['plan']);
    final profile = _profile;
    if (profile != null) {
      _name.text = profile['name']?.toString() ?? 'Persona demo';
      _age.text = profile['age']?.toString() ?? '24';
      _objective = profile['objective']?.toString() ?? 'mantener';
      _level = profile['level']?.toString() ?? 'principiante';
      _equipment = profile['equipment']?.toString() ?? 'sin_equipo';
      _duration = profile['durationMinutes'] as int? ?? 30;
      _days
        ..clear()
        ..addAll((profile['days'] as List? ?? []).whereType<int>());
    }
  }

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });
    try {
      await action();
      if (mounted) {
        setState(() {
          _message = success;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  void _reconnect() => _run(() async {
    await _api.login('user');
    _connected = true;
    await _refresh();
  });

  Map<String, dynamic> _profileInput() => {
    'name': _name.text.trim(),
    'age': int.parse(_age.text.trim()),
    'objective': _objective,
    'level': _level,
    'days': _days.toList()..sort(),
    'durationMinutes': _duration,
    'equipment': _equipment,
  };

  bool get _profileMatchesInputs {
    final profile = _profile;
    if (profile == null) return false;
    final savedDays = (profile['days'] as List? ?? []).whereType<int>().toSet();
    return profile['name'] == _name.text.trim() &&
        profile['age'] == int.tryParse(_age.text.trim()) &&
        profile['objective'] == _objective &&
        profile['level'] == _level &&
        profile['equipment'] == _equipment &&
        profile['durationMinutes'] == _duration &&
        savedDays.length == _days.length &&
        savedDays.containsAll(_days);
  }

  bool _validateProfileInput() {
    final valid = _form.currentState?.validate() ?? false;
    setState(() {
      _error = _days.isEmpty ? 'Selecciona al menos un día.' : null;
      _message = null;
    });
    return valid && _days.isNotEmpty;
  }

  Future<void> _saveCurrentInputs() async {
    final current = await _api.request('GET', '/api/profiles/me');
    _profile = _map(current['profile']);
    if (!_profileMatchesInputs) {
      final saved = await _api.request(
        'PUT',
        '/api/profiles/me',
        body: _profileInput(),
      );
      _profile = _map(saved['profile']);
    }
    if (_plan != null) {
      _plan = {
        ..._plan!,
        'isFromCurrentProfile':
            _plan!['profileVersion'] == _profile?['version'],
      };
    }
  }

  void _save() {
    if (!_validateProfileInput()) return;
    _run(() async {
      await _saveCurrentInputs();
      await _refresh();
    }, success: 'Perfil guardado. Puedes generar una rutina de ejemplo.');
  }

  void _generate() {
    if (!_validateProfileInput()) return;
    _run(
      () async {
        await _saveCurrentInputs();
        await _api.request(
          'POST',
          '/api/plans/generate',
          body: {'profileVersion': _profile!['version']},
        );
        await _refresh();
      },
      success: 'Rutina de ejemplo lista. Consulta las sesiones de tus días seleccionados.',
    );
  }

  Widget _section(String title, List<Widget> children) => Card(
    margin: const EdgeInsets.only(bottom: 18),
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    ),
  );

  Widget _select(
    String label,
    String value,
    Map<String, String> choices,
    ValueChanged<String> changed,
  ) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: DropdownButtonFormField<String>(
      key: ValueKey('$label:$value'),
      initialValue: value,
      decoration: InputDecoration(labelText: label),
      items: choices.entries
          .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
          .toList(),
      onChanged: _busy
          ? null
          : (v) {
              if (v != null) {
                setState(() {
                  changed(v);
                });
              }
            },
    ),
  );

  Widget _profilePanel() => _section('Perfil ficticio', [
    Text(
      _profile == null
          ? 'Todavía no se guardó un perfil.'
          : 'Perfil guardado · versión ${_profile!['version']}',
    ),
    const SizedBox(height: 16),
    Form(
      key: _form,
      child: Column(
        children: [
          TextFormField(
            controller: _name,
            enabled: !_busy,
            maxLength: 60,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'Nombre ficticio'),
            validator: (v) => (v?.trim().isEmpty ?? true)
                ? 'Escribe un nombre ficticio.'
                : null,
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _age,
            enabled: !_busy,
            onChanged: (_) => setState(() {}),
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Edad del ejemplo'),
            validator: (v) {
              final age = int.tryParse(v?.trim() ?? '');
              return age == null || age < 18 || age > 120
                  ? 'Usa una edad entera entre 18 y 120.'
                  : null;
            },
          ),
          const SizedBox(height: 14),
          _select('Objetivo', _objective, const {
            'bajar': 'Bajar de peso',
            'mantener': 'Mantener peso',
            'subir': 'Subir de peso',
          }, (v) => _objective = v),
          _select('Nivel', _level, const {
            'principiante': 'Principiante',
            'intermedio': 'Intermedio',
          }, (v) => _level = v),
          _select('Equipo', _equipment, const {
            'sin_equipo': 'Sin equipo',
            'con_equipo': 'Con equipo',
          }, (v) => _equipment = v),
          DropdownButtonFormField<int>(
            key: ValueKey(_duration),
            initialValue: _duration,
            decoration: const InputDecoration(
              labelText: 'Duración de la sesión',
            ),
            items: [20, 30, 45, 60]
                .map(
                  (v) => DropdownMenuItem(value: v, child: Text('$v minutos')),
                )
                .toList(),
            onChanged: _busy
                ? null
                : (v) {
                    if (v != null) {
                      setState(() {
                        _duration = v;
                      });
                    }
                  },
          ),
        ],
      ),
    ),
    const SizedBox(height: 14),
    const Text('Días disponibles'),
    Wrap(
      spacing: 8,
      runSpacing: 6,
      children: List.generate(
        7,
        (i) => FilterChip(
          label: Text(
            const ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][i],
          ),
          selected: _days.contains(i + 1),
          onSelected: _busy
              ? null
              : (selected) => setState(() {
                  if (selected) {
                    _days.add(i + 1);
                  } else {
                    _days.remove(i + 1);
                  }
                }),
        ),
      ),
    ),
    const SizedBox(height: 16),
    Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        FilledButton(
          onPressed: _busy || !_connected ? null : _generate,
          child: const Text('Generar rutina de ejemplo'),
        ),
        OutlinedButton(
          onPressed: _busy || !_connected ? null : _save,
          child: const Text('Guardar perfil'),
        ),
      ],
    ),
    const SizedBox(height: 12),
    const Text(
      'Generar guarda automáticamente los datos nuevos o modificados y muestra una sesión de ejemplo por día seleccionado.',
    ),
    if (_profile != null && !_profileMatchesInputs)
      const Padding(
        padding: EdgeInsets.only(top: 12),
        child: Text(
          'Hay cambios en el formulario. Genera una rutina de ejemplo para usar los datos nuevos.',
        ),
      ),
  ]);

  Widget _exercises(dynamic value) {
    final exercises = (value as List? ?? []).whereType<Map>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ...exercises.map(
          (exercise) => Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  exercise['name']?.toString() ?? 'Ejercicio de ejemplo',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(exercise['description']?.toString() ?? ''),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _planPanel() {
    final plan = _plan;
    final sessions = (plan?['sessions'] as List? ?? [])
        .whereType<Map>()
        .toList();
    return _section('Mi rutina de ejemplo', [
      if (plan == null)
        const Text(
          'Todavía no hay una rutina de ejemplo. Completa el perfil y pulsa Generar.',
        )
      else ...[
        const Chip(label: Text('Rutina de ejemplo')),
        Text(
          plan['title']?.toString() ?? 'Rutina de ejemplo',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 6),
        Text('Rutina v${plan['version']} · perfil v${plan['profileVersion']}'),
        Text(
          'Tiempo disponible por sesión: ${plan['durationMinutes']} minutos',
        ),
        if (plan['isFromCurrentProfile'] == false)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'Esta rutina corresponde a una versión anterior del perfil. Genera otro ejemplo para usar los datos actuales.',
            ),
          )
        else if (!_profileMatchesInputs)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'La rutina visible corresponde a los datos guardados anteriormente y todavía no refleja los cambios del formulario.',
            ),
          ),
        const SizedBox(height: 16),
        ...sessions.map(
          (session) => Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${session['dayLabel']?.toString() ?? 'Día'} · ${session['title']?.toString() ?? 'Sesión de ejemplo'}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (session['focus'] != null) Text(session['focus'].toString()),
                const Divider(height: 24),
                _exercises(session['exercises']),
              ],
            ),
          ),
        ),
        if (sessions.isEmpty) _exercises(plan['exercises']),
        const Text(
          'Ejemplos de contenido para la demostración del proyecto. No son una evaluación individual ni garantizan resultados.',
        ),
      ],
    ]);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('FitGoal'),
      actions: [
        IconButton(
          onPressed: _busy ? null : _reconnect,
          icon: const Icon(Icons.refresh),
          tooltip: 'Actualizar desde la API',
        ),
      ],
    ),
    body: SingleChildScrollView(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 820),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Perfil y rutinas de ejemplo',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Demostración con datos ficticios. No ingresar datos personales ni de salud.',
                ),
                const SizedBox(height: 14),
                if (_busy) const LinearProgressIndicator(),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Semantics(
                      liveRegion: true,
                      child: Text(
                        _error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  ),
                if (_message != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Semantics(liveRegion: true, child: Text(_message!)),
                  ),
                const SizedBox(height: 12),
                _profilePanel(),
                _planPanel(),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
