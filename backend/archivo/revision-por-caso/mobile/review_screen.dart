import 'dart:convert';

import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';

/// Revisión de un borrador: el profesional corrige indicaciones, aprueba o rechaza con motivo (RF006).
class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key, required this.api, required this.draftId});
  final ApiClient api;
  final String draftId;

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  late Future<Map<String, dynamic>> _future = _open();
  final Map<String, TextEditingController> _controllers = {};
  final Map<String, String> _original = {};
  bool _busy = false;

  Future<Map<String, dynamic>> _open() async {
    // Tomar el caso lo marca «en revisión» y es idempotente.
    await widget.api.post('/api/reviews/${widget.draftId}/claim');
    final result = await widget.api.get('/api/reviews/${widget.draftId}') as Map<String, dynamic>;
    final draft = result['draft'] as Map<String, dynamic>;
    final schedule = ((draft['content'] as Map)['schedule'] as List).cast<Map<String, dynamic>>();
    for (var d = 0; d < schedule.length; d++) {
      final exercises = (schedule[d]['exercises'] as List).cast<Map<String, dynamic>>();
      for (var e = 0; e < exercises.length; e++) {
        final value = exercises[e]['prescription'] as String;
        _original['$d.$e'] = value;
        _controllers['$d.$e'] = TextEditingController(text: value);
      }
    }
    return draft;
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  bool get _dirty => _controllers.entries.any((entry) => entry.value.text.trim() != _original[entry.key]);

  Map<String, dynamic> _corrected(Map<String, dynamic> content) {
    final copy = jsonDecode(jsonEncode(content)) as Map<String, dynamic>;
    final schedule = (copy['schedule'] as List).cast<Map<String, dynamic>>();
    for (var d = 0; d < schedule.length; d++) {
      final exercises = (schedule[d]['exercises'] as List).cast<Map<String, dynamic>>();
      for (var e = 0; e < exercises.length; e++) {
        exercises[e]['prescription'] = _controllers['$d.$e']!.text.trim();
      }
    }
    return copy;
  }

  Future<void> _decide(Map<String, dynamic> draft, String decision, {String? notes}) async {
    setState(() => _busy = true);
    try {
      await widget.api.post('/api/reviews/${widget.draftId}/decision', {
        'decision': decision,
        'notes': ?notes,
        if (decision == 'aprobado' && _dirty) 'correctedContent': _corrected(draft['content'] as Map<String, dynamic>),
      });
      if (!mounted) return;
      showMessage(context, decision == 'aprobado' ? 'Plan aprobado y publicado.' : 'Borrador rechazado.');
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (!mounted) return;
      showMessage(context, error.message);
      if (error.code == 'STALE_DRAFT' || error.code == 'INVALID_STATE') Navigator.pop(context, true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reject(Map<String, dynamic> draft) async {
    final notes = await askText(context, title: 'Rechazar el borrador', hint: 'Explica el motivo (obligatorio)', confirm: 'Rechazar');
    if (notes != null && mounted) await _decide(draft, 'rechazado', notes: notes);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        final draft = snapshot.data;
        return Scaffold(
          appBar: AppBar(title: const Text('Revisar borrador')),
          body: snapshot.connectionState != ConnectionState.done
              ? const Center(child: CircularProgressIndicator(key: Key('loading')))
              : snapshot.hasError
                  ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Text(errorText(snapshot.error!), textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      FilledButton(onPressed: () => setState(() => _future = _open()), child: const Text('Reintentar')),
                    ])))
                  : _body(context, draft!),
          bottomNavigationBar: draft == null
              ? null
              : SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Expanded(child: OutlinedButton(key: const Key('reject'), onPressed: _busy ? null : () => _reject(draft), child: const Text('Rechazar'))),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: ListenableBuilder(
                          listenable: Listenable.merge(_controllers.values.toList()),
                          builder: (context, _) => FilledButton(
                            key: const Key('approve'),
                            onPressed: _busy ? null : () => _decide(draft, 'aprobado'),
                            child: Text(_dirty ? 'Aprobar con correcciones' : 'Aprobar'),
                          ),
                        ),
                      ),
                    ]),
                  ),
                ),
        );
      },
    );
  }

  Widget _body(BuildContext context, Map<String, dynamic> draft) {
    final participant = draft['participant'] as Map<String, dynamic>;
    final reasons = (draft['selectionReasons'] as List).cast<Map<String, dynamic>>();
    final template = draft['template'] as Map<String, dynamic>?;
    final schedule = ((draft['content'] as Map)['schedule'] as List).cast<Map<String, dynamic>>();
    final canSwap = ((template?['allowedAdjustments'] as Map?)?['exerciseChanges'] ?? false) == true;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SectionCard(title: participant['label'] as String, children: [
          Text('${objectiveLabels[participant['objective']]} · ${levelLabels[participant['level']]} · ${equipmentLabels[participant['equipment']]}'),
          Text('${(participant['days'] as List).map((d) => dayNames[(d as int) - 1]).join(', ')} · ${participant['durationMinutes']} min · ${participant['age']} años'),
        ]),
        SectionCard(title: 'Por qué se eligió esta plantilla', children: [
          if (template != null) Text('${template['name']} (versión ${template['version']})', style: const TextStyle(fontWeight: FontWeight.w600)),
          for (final reason in reasons)
            Text('• ${reason['criterio']}: ${reason['valor'] ?? ''}${reason['resultado'] != null ? ' → ${reason['resultado']}' : ''}', style: const TextStyle(fontSize: 13)),
          const SizedBox(height: 4),
          Text(canSwap ? 'La plantilla permite cambiar ejercicios del catálogo.' : 'La plantilla solo permite corregir las indicaciones de cada ejercicio.', style: Theme.of(context).textTheme.bodySmall),
        ]),
        for (var d = 0; d < schedule.length; d++)
          SectionCard(
            title: '${schedule[d]['dayLabel']} · ${schedule[d]['label']}',
            children: [
              for (var e = 0; e < (schedule[d]['exercises'] as List).length; e++) ...[
                Text(((schedule[d]['exercises'] as List)[e] as Map)['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(((schedule[d]['exercises'] as List)[e] as Map)['description'] as String, style: Theme.of(context).textTheme.bodySmall),
                TextField(key: Key('prescription-$d-$e'), controller: _controllers['$d.$e'], maxLength: 200, decoration: const InputDecoration(labelText: 'Indicación del preparador')),
                const SizedBox(height: 8),
              ],
            ],
          ),
        Text(((draft['content'] as Map)['notice'] as String?) ?? '', style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
