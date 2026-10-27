import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';

/// Pide la nota (y el peso, si está habilitado) y registra la sesión como realizada (RF007). Devuelve el mensaje para la
/// persona, o null si canceló o hubo un error que ya se mostró.
Future<String?> registerSession(BuildContext context, ApiClient api, {required String sessionId, required String title, required bool weightsEnabled}) async {
  final noteController = TextEditingController();
  final weightController = TextEditingController();
  final ok = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text('Registrar $title'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(key: const Key('session-note'), controller: noteController, maxLength: 200, decoration: const InputDecoration(labelText: 'Nota (opcional)', hintText: '¿Cómo te sentiste?')),
          if (weightsEnabled)
            TextField(
              key: const Key('session-weight'),
              controller: weightController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Peso en kg (opcional)'),
            ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
        FilledButton(key: const Key('session-save'), onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Marcar como realizada')),
      ],
    ),
  );
  if (ok != true || !context.mounted) return null;
  final weight = double.tryParse(weightController.text.replaceAll(',', '.'));
  try {
    final result = await api.post('/api/sessions/$sessionId/complete', {
      if (noteController.text.trim().isNotEmpty) 'note': noteController.text.trim(),
      'weightKg': ?weight,
    }) as Map<String, dynamic>;
    return result['weightRejected'] as String? ?? 'Sesión registrada. ¡Bien hecho!';
  } on ApiException catch (error) {
    if (context.mounted) showMessage(context, error.message);
    return null;
  }
}

/// Modo sesión: los ejercicios del día con sus series para ir marcando, un temporizador de descanso entre series y el registro
/// al terminar. Las series marcadas no se guardan: solo se registra la sesión realizada (minimización de datos).
class SessionScreen extends StatefulWidget {
  const SessionScreen({super.key, required this.api, required this.session, required this.weightsEnabled});
  final ApiClient api;
  final Map<String, dynamic> session;
  final bool weightsEnabled;

  @override
  State<SessionScreen> createState() => _SessionScreenState();
}

class _SessionScreenState extends State<SessionScreen> {
  static const _restOptions = [30, 60, 90, 120];
  final Map<int, Set<int>> _done = {};
  int _restSeconds = 60;
  int? _remaining;
  Timer? _timer;
  bool _busy = false;

  List<Map<String, dynamic>> get _exercises => (widget.session['exercises'] as List).cast<Map<String, dynamic>>();
  int get _totalSets => _exercises.fold(0, (sum, exercise) => sum + setsIn(exercise['prescription'] as String));
  int get _doneSets => _done.values.fold(0, (sum, sets) => sum + sets.length);

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _toggle(int exercise, int set) {
    final sets = _done.putIfAbsent(exercise, () => <int>{});
    setState(() => sets.contains(set) ? sets.remove(set) : sets.add(set));
    if (_doneSets >= _totalSets) {
      _stopRest(); // terminó todas las series: no hace falta descansar
    } else if (sets.contains(set)) {
      _startRest(_restSeconds);
    }
  }

  void _startRest(int seconds) {
    _timer?.cancel();
    setState(() => _remaining = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _remaining = (_remaining ?? 1) - 1);
      if ((_remaining ?? 0) <= 0) _stopRest();
    });
  }

  void _stopRest() {
    _timer?.cancel();
    _timer = null;
    if (mounted) setState(() => _remaining = null);
  }

  Future<void> _finish() async {
    _stopRest();
    setState(() => _busy = true);
    final message = await registerSession(context, widget.api, sessionId: widget.session['id'] as String, title: widget.session['name'] as String, weightsEnabled: widget.weightsEnabled);
    if (!mounted) return;
    if (message == null) {
      setState(() => _busy = false);
    } else {
      Navigator.pop(context, message);
    }
  }

  String _clock(int seconds) => '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final session = widget.session;
    final total = _totalSets;
    return Scaffold(
      appBar: AppBar(
        title: Text(session['name'] as String, overflow: TextOverflow.ellipsis),
        actions: [
          PopupMenuButton<int>(
            key: const Key('rest-options'),
            icon: const Icon(Icons.timer_outlined),
            tooltip: 'Descanso entre series',
            initialValue: _restSeconds,
            onSelected: (value) => setState(() => _restSeconds = value),
            itemBuilder: (context) => [for (final value in _restOptions) PopupMenuItem(value: value, child: Text('Descanso de ${_clock(value)}'))],
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          children: [
            Text('${session['minutes']} min · ${_exercises.length} ejercicios · descanso entre series de ${_clock(_restSeconds)}', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: LinearProgressIndicator(key: const Key('session-progress'), value: total == 0 ? 0 : _doneSets / total, minHeight: 8, borderRadius: BorderRadius.circular(4))),
              const SizedBox(width: 12),
              Text('$_doneSets/$total series', key: const Key('session-sets')),
            ]),
            const SizedBox(height: 12),
            for (final (index, exercise) in _exercises.indexed)
              Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        CircleAvatar(radius: 16, backgroundColor: scheme.primaryContainer, child: Icon(muscleGroupIcons[exercise['muscleGroup']], size: 18, color: scheme.onPrimaryContainer)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${index + 1}. ${exercise['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                            Text(exercise['prescription'] as String, style: Theme.of(context).textTheme.bodySmall),
                          ]),
                        ),
                        if ((_done[index]?.length ?? 0) == setsIn(exercise['prescription'] as String)) Icon(Icons.check_circle, color: scheme.primary),
                      ]),
                      Theme(
                        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                        child: ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          dense: true,
                          title: const Text('Cómo hacerlo', style: TextStyle(fontSize: 13)),
                          expandedAlignment: Alignment.centerLeft,
                          children: [Text(exercise['description'] as String? ?? '')],
                        ),
                      ),
                      Wrap(spacing: 6, runSpacing: 6, children: [
                        for (var set = 0; set < setsIn(exercise['prescription'] as String); set++)
                          FilterChip(
                            key: Key('set-$index-$set'),
                            label: Text(setsIn(exercise['prescription'] as String) == 1 ? 'Hecho' : 'Serie ${set + 1}'),
                            selected: _done[index]?.contains(set) ?? false,
                            onSelected: (_) => _toggle(index, set),
                          ),
                      ]),
                    ],
                  ),
                ),
              ),
            const Text('Si sientes dolor o molestias, detente. Puedes terminar aunque no hayas marcado todas las series.', style: TextStyle(fontSize: 12)),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_remaining != null)
                Container(
                  key: const Key('rest-timer'),
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: scheme.tertiaryContainer, borderRadius: BorderRadius.circular(12)),
                  child: Row(children: [
                    Icon(Icons.timer, color: scheme.onTertiaryContainer),
                    const SizedBox(width: 8),
                    Expanded(child: Text('Descanso: ${_clock(_remaining!)}', key: const Key('rest-remaining'), style: TextStyle(fontWeight: FontWeight.w700, color: scheme.onTertiaryContainer))),
                    TextButton(key: const Key('rest-add'), onPressed: () => setState(() => _remaining = _remaining! + 15), child: const Text('+15 s')),
                    TextButton(key: const Key('rest-skip'), onPressed: _stopRest, child: const Text('Saltar')),
                  ]),
                ),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  key: const Key('finish-session'),
                  onPressed: _busy ? null : _finish,
                  icon: const Icon(Icons.flag),
                  label: Text(_busy ? 'Registrando…' : 'Terminar y registrar'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
