import 'dart:convert';

import 'package:fitgoal/api_client.dart';
import 'package:fitgoal/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

http.Response jsonResponse(Map<String, dynamic> body, [int status = 200]) =>
    http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'Content-Type': 'application/json; charset=utf-8'},
    );

class DemoApi {
  Map<String, dynamic>? profile, plan;
  final requests = <http.Request>[];
  bool failGenerate = false;
  void Function()? beforeGenerate;
  int planVersion = 0;

  ApiClient client() => ApiClient(
    client: MockClient((request) async {
      requests.add(request);
      switch (request.url.path) {
        case '/api/demo/login':
          return jsonResponse({'demo': true, 'token': 'demo', 'role': 'user'});
        case '/api/demo/state':
          return jsonResponse({
            'demo': true,
            'profile': profile,
            'plan': plan == null
                ? null
                : {
                    ...plan!,
                    'isFromCurrentProfile':
                        plan!['profileVersion'] == profile?['version'],
                  },
          });
        case '/api/profiles/me':
          if (request.method == 'GET') {
            return jsonResponse({'demo': true, 'profile': profile});
          }
          profile = {
            ...jsonDecode(request.body) as Map<String, dynamic>,
            'version': (profile?['version'] as int? ?? 0) + 1,
          };
          return jsonResponse({'demo': true, 'profile': profile});
        case '/api/plans/generate':
          beforeGenerate?.call();
          if (failGenerate) {
            return jsonResponse({
              'demo': true,
              'error': {'message': 'No se pudo generar la rutina.'},
            }, 500);
          }
          final expectedVersion = jsonDecode(request.body)['profileVersion'];
          if (expectedVersion != profile!['version']) {
            return jsonResponse({
              'demo': true,
              'error': {
                'message': 'El perfil cambió. Intenta generar nuevamente.',
              },
            }, 409);
          }
          if (plan?['profileVersion'] == profile!['version']) {
            return jsonResponse({'demo': true, 'plan': plan});
          }
          final days = (profile!['days'] as List).cast<int>();
          final exercises = [
            {
              'name': 'Sentadilla de ejemplo',
              'description': 'Descripción demostrativa del movimiento.',
            },
          ];
          plan = {
            'id': 'plan-${++planVersion}',
            'version': planVersion,
            'profileVersion': profile!['version'],
            'status': 'example',
            'demo': true,
            'title': 'Rutina de ejemplo · ${profile!['objective']}',
            'objective': profile!['objective'],
            'level': profile!['level'],
            'equipment': profile!['equipment'],
            'days': days,
            'durationMinutes': profile!['durationMinutes'],
            'exercises': exercises,
            'sessions': days
                .map(
                  (day) => {
                    'day': day,
                    'dayLabel': const [
                      'Lunes',
                      'Martes',
                      'Miércoles',
                      'Jueves',
                      'Viernes',
                      'Sábado',
                      'Domingo',
                    ][day - 1],
                    'routineId': 'example-a',
                    'title': 'Sesión ejemplo',
                    'focus': 'Fuerza de ejemplo',
                    'exercises': exercises,
                  },
                )
                .toList(),
            'isFromCurrentProfile': true,
          };
          return jsonResponse({'demo': true, 'plan': plan}, 201);
        default:
          return jsonResponse({}, 404);
      }
    }),
  );

  List<http.Request> get writes => requests
      .where((r) => r.url.path != '/api/demo/login' && r.method != 'GET')
      .toList();
}

Future<void> openDemo(
  WidgetTester tester,
  DemoApi api, {
  Size size = const Size(900, 1800),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(FitGoalApp(api: api.client()));
  await tester.pumpAndSettle();
}

Future<void> press(WidgetTester tester, String label) async {
  final button = find.text(label);
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pumpAndSettle();
}

Future<void> selectOption(WidgetTester tester, int index, String label) async {
  final dropdown = find.byType(DropdownButtonFormField<String>).at(index);
  await tester.ensureVisible(dropdown);
  await tester.tap(dropdown);
  await tester.pumpAndSettle();
  await tester.tap(find.text(label).last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Inicia sin roles, revisión ni rutina generada', (tester) async {
    await openDemo(tester, DemoApi());
    expect(find.text('Perfil ficticio'), findsOneWidget);
    expect(
      find.text(
        'Todavía no hay una rutina de ejemplo. Completa el perfil y pulsa Generar.',
      ),
      findsOneWidget,
    );
    expect(find.text('Preparador demo'), findsNothing);
    expect(find.text('Aprobar en demo'), findsNothing);
    expect(find.text('Enviar a revisión'), findsNothing);
    expect(find.byType(TextFormField), findsNWidgets(2));
  });

  testWidgets(
    'Generar guarda todos los datos y muestra siete sesiones al instante',
    (tester) async {
      final api = DemoApi();
      await openDemo(tester, api);
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'Ejemplo flexible',
      );
      await tester.enterText(find.byType(TextFormField).at(1), '41');
      await selectOption(tester, 0, 'Subir de peso');
      await selectOption(tester, 1, 'Intermedio');
      await selectOption(tester, 2, 'Con equipo');
      await tester.tap(find.byType(DropdownButtonFormField<int>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('60 minutos').last);
      await tester.pumpAndSettle();
      for (final day in ['Mar', 'Jue', 'Sáb', 'Dom']) {
        await tester.tap(find.widgetWithText(FilterChip, day));
        await tester.pumpAndSettle();
      }
      await press(tester, 'Generar rutina de ejemplo');
      expect(api.writes.map((r) => r.method), ['PUT', 'POST']);
      expect(jsonDecode(api.writes.first.body), {
        'name': 'Ejemplo flexible',
        'age': 41,
        'objective': 'subir',
        'level': 'intermedio',
        'days': [1, 2, 3, 4, 5, 6, 7],
        'durationMinutes': 60,
        'equipment': 'con_equipo',
      });
      expect(jsonDecode(api.writes.last.body), {'profileVersion': 1});
      expect(find.text('Rutina v1 · perfil v1'), findsOneWidget);
      for (final day in [
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
        'Domingo',
      ]) {
        expect(find.text('$day · Sesión ejemplo'), findsOneWidget);
      }
      expect(find.text('Sentadilla de ejemplo'), findsNWidgets(7));
      expect(find.text('Aprobar en demo'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Un cambio avisa y genera otra versión; sin cambios reutiliza el ejemplo',
    (tester) async {
      final api = DemoApi();
      await openDemo(tester, api);
      await press(tester, 'Generar rutina de ejemplo');
      await tester.enterText(find.byType(TextFormField).at(1), '35');
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Hay cambios en el formulario. Genera una rutina de ejemplo para usar los datos nuevos.',
        ),
        findsOneWidget,
      );
      expect(
        find.text(
          'La rutina visible corresponde a los datos guardados anteriormente y todavía no refleja los cambios del formulario.',
        ),
        findsOneWidget,
      );
      await press(tester, 'Generar rutina de ejemplo');
      expect(api.profile!['age'], 35);
      expect(api.writes.map((r) => r.method), ['PUT', 'POST', 'PUT', 'POST']);
      expect(find.text('Rutina v2 · perfil v2'), findsOneWidget);
      await press(tester, 'Generar rutina de ejemplo');
      expect(api.writes.map((r) => r.method), [
        'PUT',
        'POST',
        'PUT',
        'POST',
        'POST',
      ]);
      expect(api.profile!['version'], 2);
      expect(api.planVersion, 2);
      expect(find.text('Rutina v2 · perfil v2'), findsOneWidget);
    },
  );

  testWidgets(
    'Guardar un cambio conserva visible la rutina de la versión anterior',
    (tester) async {
      final api = DemoApi();
      await openDemo(tester, api);
      await press(tester, 'Generar rutina de ejemplo');
      await selectOption(tester, 0, 'Bajar de peso');
      await press(tester, 'Guardar perfil');
      expect(api.profile!['version'], 2);
      expect(find.text('Rutina v1 · perfil v1'), findsOneWidget);
      expect(
        find.text(
          'Esta rutina corresponde a una versión anterior del perfil. Genera otro ejemplo para usar los datos actuales.',
        ),
        findsOneWidget,
      );
      expect(find.text('Sentadilla de ejemplo'), findsNWidgets(3));
    },
  );

  testWidgets('Datos inválidos y cero días no hacen escrituras', (
    tester,
  ) async {
    final api = DemoApi();
    await openDemo(tester, api);
    await tester.enterText(find.byType(TextFormField).at(1), '17.5');
    await press(tester, 'Generar rutina de ejemplo');
    expect(find.text('Usa una edad entera entre 18 y 120.'), findsOneWidget);
    expect(api.writes, isEmpty);
    await tester.enterText(find.byType(TextFormField).at(1), '30');
    for (final day in ['Lun', 'Mié', 'Vie']) {
      await tester.tap(find.widgetWithText(FilterChip, day));
      await tester.pumpAndSettle();
    }
    await press(tester, 'Generar rutina de ejemplo');
    expect(find.text('Selecciona al menos un día.'), findsOneWidget);
    expect(api.writes, isEmpty);
    await tester.tap(find.widgetWithText(FilterChip, 'Lun'));
    await tester.enterText(find.byType(TextFormField).at(0), ' ');
    await press(tester, 'Generar rutina de ejemplo');
    expect(find.text('Escribe un nombre ficticio.'), findsOneWidget);
    expect(api.writes, isEmpty);
  });

  testWidgets('Si generar falla conserva el guardado y permite reintentar', (
    tester,
  ) async {
    final api = DemoApi()..failGenerate = true;
    await openDemo(tester, api);
    await press(tester, 'Generar rutina de ejemplo');
    expect(find.text('No se pudo generar la rutina.'), findsOneWidget);
    expect(find.text('Perfil guardado · versión 1'), findsOneWidget);
    api.failGenerate = false;
    await press(tester, 'Generar rutina de ejemplo');
    expect(api.writes.map((r) => r.method), ['PUT', 'POST', 'POST']);
    expect(find.text('Rutina v1 · perfil v1'), findsOneWidget);
  });

  testWidgets('Una edición remota no reemplaza los datos del formulario', (
    tester,
  ) async {
    final api = DemoApi();
    await openDemo(tester, api);
    await press(tester, 'Guardar perfil');
    api.profile = {
      ...api.profile!,
      'age': 55,
      'objective': 'bajar',
      'version': 2,
    };
    await press(tester, 'Generar rutina de ejemplo');
    expect(api.profile!['age'], 24);
    expect(api.profile!['objective'], 'mantener');
    expect(api.profile!['version'], 3);
    expect(jsonDecode(api.writes.last.body), {'profileVersion': 3});
    expect(find.text('Rutina v1 · perfil v3'), findsOneWidget);
  });

  testWidgets(
    'Una carrera conserva el formulario y se resuelve al reintentar',
    (tester) async {
      final api = DemoApi();
      await openDemo(tester, api);
      api.beforeGenerate = () {
        api.profile = {...api.profile!, 'age': 55, 'version': 2};
        api.beforeGenerate = null;
      };
      await tester.enterText(find.byType(TextFormField).at(1), '43');
      await press(tester, 'Generar rutina de ejemplo');
      expect(
        find.text('El perfil cambió. Intenta generar nuevamente.'),
        findsOneWidget,
      );
      expect(api.plan, isNull);
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).at(1))
            .controller!
            .text,
        '43',
      );
      await press(tester, 'Generar rutina de ejemplo');
      expect(api.profile!['age'], 43);
      expect(find.text('Rutina v1 · perfil v3'), findsOneWidget);
    },
  );

  testWidgets('A 360 px formulario y sesiones no desbordan', (tester) async {
    final api = DemoApi();
    await openDemo(tester, api, size: const Size(360, 1400));
    await press(tester, 'Generar rutina de ejemplo');
    expect(find.text('Rutina v1 · perfil v1'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
