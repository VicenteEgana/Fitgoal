import 'package:fitgoal/api/api_client.dart';
import 'package:fitgoal/api/token_store.dart';
import 'package:fitgoal/app.dart';
import 'package:fitgoal/settings.dart';
import 'package:fitgoal/ui/common.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' show ClientException;
import 'package:http/testing.dart';

import 'fake_server.dart';

Map<String, dynamic> profile({int version = 1, bool nutrition = false, double? weight, double? height, double? bmi, String? category, List<int> days = const [1, 3, 5]}) => {
  'id': 'p-1', 'version': version, 'age': 30, 'objective': 'bajar', 'level': 'principiante', 'days': days,
  'durationMinutes': 30, 'equipment': 'sin_equipo', 'weightKg': nutrition ? 80 : weight, 'heightCm': nutrition ? 180 : height,
  'bmi': nutrition ? 24.7 : bmi, 'bmiCategory': nutrition ? 'normal' : category,
  'sexParam': nutrition ? 'masculino' : null, 'activityLevel': nutrition ? 'moderado' : null, 'isFictitious': nutrition,
};

Map<String, dynamic> planData({String source = 'recomendada', int profileVersion = 1}) => {
  'id': 'pl-1', 'version': 1, 'source': source, 'weeks': 4, 'sessionMinutes': 30, 'days': [1, 3], 'status': 'vigente', 'profileVersion': profileVersion, 'rulesVersion': 1,
  'startsOn': '2026-11-03', 'endsOn': '2026-11-30', 'currentWeek': 2, 'restDays': [2, 4, 5, 6, 7],
  'week': [
    for (var day = 1; day <= 7; day++)
      day == 1 || day == 3
          ? {'day': day, 'dayLabel': _dayLabels[day - 1], 'type': 'entrenamiento', 'sessionNo': day == 1 ? 1 : 2, 'label': source == 'recomendada' ? (day == 1 ? 'Cuerpo completo A' : 'Cuerpo completo B') : 'Sesión ${day == 1 ? 1 : 2}'}
          : {'day': day, 'dayLabel': _dayLabels[day - 1], 'type': 'descanso', 'sessionNo': null, 'label': 'Descanso'},
  ],
  'name': source == 'recomendada' ? 'Bajar de peso · principiante · sin equipo · IMC normal' : 'Mi rutina de martes',
  'template': source == 'recomendada' ? {'code': 'demo-bajar', 'version': 1, 'name': 'Bajar de peso', 'split': 'full_body'} : null,
  'schedule': [
    {'day': 1, 'dayLabel': 'Lunes', 'sessionNo': 1, 'label': source == 'recomendada' ? 'Cuerpo completo A' : 'Sesión 1', 'exercises': [
      {'code': 'sentarse-y-levantarse', 'name': 'Sentarse y levantarse', 'description': 'Ejemplo general.', 'muscleGroup': 'piernas', 'requiresEquipment': false, 'prescription': '2 series de 8 repeticiones'},
    ]},
    {'day': 3, 'dayLabel': 'Miércoles', 'sessionNo': 2, 'label': source == 'recomendada' ? 'Cuerpo completo B' : 'Sesión 2', 'exercises': [
      {'code': 'caminata', 'name': 'Caminata', 'description': 'Actividad cotidiana.', 'muscleGroup': 'cardio', 'requiresEquipment': false, 'prescription': '10 minutos a ritmo cómodo'},
    ]},
  ],
};

const _sessionLabels = {
  'full_body': ['Cuerpo completo A', 'Cuerpo completo B', 'Cuerpo completo C'],
  'upper_lower': ['Tren superior A', 'Tren inferior A', 'Tren superior B', 'Tren inferior B'],
  'push_pull_legs': ['Empuje: pecho, hombros y tríceps', 'Tracción: espalda y bíceps', 'Piernas y zona media'],
};
const _splitDays = {'full_body': [2, 3], 'upper_lower': [4, 4], 'push_pull_legs': [3, 6]};

Map<String, dynamic> routineData({String id = 't-1', bool recommended = true, bool alternative = false, String split = 'full_body', String category = 'normal', String objective = 'bajar', bool fits = true}) => {
  'id': id, 'code': 'demo-$id', 'version': 1, 'name': 'Rutina $id · ${objective == 'bajar' ? 'bajar' : objective}', 'summary': 'Demostración para $objective.',
  'objective': objective, 'level': 'principiante', 'equipment': 'sin_equipo', 'bmiCategory': category, 'split': split, 'sessionLabels': _sessionLabels[split],
  'minDays': _splitDays[split]![0], 'maxDays': _splitDays[split]![1], 'sessionMinutes': 30, 'weeks': 4,
  'status': 'approved', 'sessionsCount': _sessionLabels[split]!.length, 'recommended': recommended, 'alternative': alternative,
  'reasons': recommended
      ? ['Coincide con tu objetivo: bajar de peso.', 'Es para nivel principiante y sin equipo.', 'Si estás empezando, conviene trabajar todo el cuerpo (full body) en cada sesión, 2 o 3 días por semana.']
      : alternative ? ['Para tu mismo objetivo, nivel, equipo e IMC, organizada en otra división.'] : <String>[],
  'fit': {'ok': fits, 'notes': fits ? <String>[] : ['Se hace al menos 2 días por semana y tu perfil tiene 1; puedes elegir otros días al iniciarla.']},
};

Map<String, dynamic> exerciseData(String code, String name, String group, {bool suggested = false, String? reason, bool equipment = false, bool highImpact = false}) => {
  'id': 'e-$code', 'code': code, 'name': name, 'description': 'Descripción de $name.', 'muscleGroup': group, 'minLevel': 'principiante',
  'requiresEquipment': equipment, 'highImpact': highImpact, 'defaultPrescription': '2 series de 8 repeticiones', 'status': 'approved', 'suggested': suggested, 'reason': reason,
};

const _diets = ['mediterranea', 'alta_proteina', 'baja_carbohidratos', 'vegetariana'];

Map<String, dynamic> mealItem(String code, String name, num grams, {String? household, num protein = 5, num carbs = 10, num fat = 3}) =>
    {'code': code, 'name': name, 'category': 'proteinas', 'grams': grams, 'household': household, 'kcal': 90, 'protein': protein, 'carbs': carbs, 'fat': fat};

List<Map<String, dynamic>> _positioned(List<Map<String, dynamic>> items) => [for (final (index, item) in items.indexed) {...item, 'position': index + 1}];

Map<String, dynamic> mealDay(int dayNo, String dayLabel, {num kcal = 2000, List<Map<String, dynamic>>? lunch}) => {
  'dayNo': dayNo, 'dayLabel': dayLabel, 'totals': {'kcal': kcal, 'protein': 110, 'carbs': 230, 'fat': 75, 'percent': {'protein': 21, 'carbs': 46, 'fat': 33}},
  'meals': [
    {'meal': 'desayuno', 'label': 'Desayuno', 'totals': {'kcal': 420, 'protein': 20, 'carbs': 45, 'fat': 15}, 'items': _positioned([mealItem('pan-integral', 'Pan integral de molde', 60, household: '≈ 2 rebanadas'), mealItem('palta', 'Palta Hass', 50, household: '≈ ¼ unidad')])},
    {'meal': 'almuerzo', 'label': 'Almuerzo', 'totals': {'kcal': 650, 'protein': 45, 'carbs': 70, 'fat': 18}, 'items': _positioned(lunch ?? [mealItem('pechuga-de-pollo', 'Pechuga de pollo a la plancha', 150), mealItem('arroz-blanco', 'Arroz blanco cocido', 130, household: '≈ ¾ taza')])},
  ],
};

Map<String, dynamic> mealPlanSummary(String diet) => {
  'id': 'mp-$diet', 'code': 'pauta-$diet', 'version': 1, 'name': diet, 'summary': 'Resumen de la dieta $diet.', 'diet': diet, 'referenceKcal': 2000, 'status': 'approved',
  'average': {'kcal': 2000, 'protein': 110, 'carbs': 230, 'fat': 75, 'percent': {'protein': diet == 'alta_proteina' ? 36 : 21, 'carbs': 46, 'fat': 33}},
};

/// Rutas de la pestaña «Alimentación»: pautas aprobadas y el detalle de cada una.
void nutritionRoutes(FakeServer server, {Map<String, dynamic>? target, List<Map<String, dynamic>> notices = const [], int kcal = 2000}) {
  server.get('/api/meal-plans', {
    'objective': 'bajar', 'objectiveLabel': 'déficit', 'target': target, 'notices': notices,
    'disclaimer': 'Pauta general aprobada por una nutricionista: no reemplaza una evaluación individual.',
    'plans': [for (final diet in _diets) mealPlanSummary(diet)],
  });
  for (final diet in _diets) {
    server.get('/api/meal-plans/mp-$diet', {
      'plan': mealPlanSummary(diet), 'personalized': target != null, 'kcal': kcal, 'target': target, 'notices': notices, 'disclaimer': 'x',
      'days': [
        mealDay(1, 'Lunes', kcal: kcal, lunch: diet == 'vegetariana' ? [mealItem('lentejas', 'Lentejas cocidas', 250, household: '≈ 1¼ tazas')] : null),
        mealDay(2, 'Martes', kcal: kcal + 10, lunch: [mealItem('merluza', 'Merluza al horno', 120)]),
      ],
    });
  }
}

const _dayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

Map<String, dynamic> sessionOfDay(String id, String name, {bool completed = false, bool canRegister = false, List<Map<String, dynamic>>? exercises}) => {
  'id': id, 'sessionNo': 1, 'name': name, 'label': name, 'minutes': 30, 'completed': completed, 'completedAt': null, 'note': null, 'planStatus': 'vigente', 'canRegister': canRegister,
  'groups': ['piernas', 'cardio'],
  'exercises': exercises ?? [
    {'code': 'sentarse-y-levantarse', 'name': 'Sentarse y levantarse', 'description': 'Ejemplo general.', 'muscleGroup': 'piernas', 'requiresEquipment': false, 'prescription': '2 series de 8 repeticiones'},
    {'code': 'caminata', 'name': 'Caminata', 'description': 'Actividad cotidiana.', 'muscleGroup': 'cardio', 'requiresEquipment': false, 'prescription': '10 minutos a ritmo cómodo'},
  ],
};

/// Horario de la semana del 9 al 15 de noviembre (hoy, martes 10): `days` reemplaza el estado y la sesión de algunos días.
Map<String, dynamic> weekData({Map<int, (String, Map<String, dynamic>?)> days = const {}, String fallback = 'sin_rutina', String? previousWeek, String? nextWeek, bool plan = false}) => {
  'today': '2026-11-10', 'weekStart': '2026-11-09', 'weekEnd': '2026-11-15', 'previousWeek': previousWeek, 'nextWeek': nextWeek,
  'plan': plan ? {'id': 'pl-1', 'name': 'Rutina', 'startsOn': '2026-11-03', 'endsOn': '2026-11-30'} : null,
  'days': [
    for (var day = 1; day <= 7; day++)
      {
        'date': '2026-11-${(8 + day).toString().padLeft(2, '0')}', 'weekday': day, 'dayLabel': _dayLabels[day - 1], 'isToday': day == 2,
        'status': days[day]?.$1 ?? fallback, 'session': days[day]?.$2,
      },
  ],
  'restSuggestions': [{'code': 'movilidad-de-hombros', 'name': 'Movilidad de hombros', 'description': 'Círculos suaves.', 'prescription': '10 círculos hacia cada lado'}],
};

/// Semana con rutina: el lunes 9 quedó sin registrar (lo cubrió el comodín), hoy martes descansa y el miércoles 11 está programado.
Map<String, dynamic> planWeek() => weekData(plan: true, fallback: 'descanso', previousWeek: '2026-11-02', nextWeek: '2026-11-16', days: {
  1: ('comodin', sessionOfDay('s-1', 'Cuerpo completo A', canRegister: true)),
  3: ('programada', sessionOfDay('s-2', 'Cuerpo completo B', exercises: [
    {'code': 'caminata', 'name': 'Caminata', 'description': 'Actividad cotidiana.', 'muscleGroup': 'cardio', 'requiresEquipment': false, 'prescription': '10 minutos a ritmo cómodo'},
  ])),
});

Map<String, dynamic> streakData({int current = 0, int best = 0, String today = 'sin_rutina', bool freeze = true, int? milestone, String? lastMissedOn}) => {
  'current': current, 'best': best, 'since': null, 'today': today, 'atRisk': today == 'pendiente', 'milestone': milestone,
  'nextMilestone': {'days': current < 3 ? 3 : current < 7 ? 7 : 14, 'remaining': (current < 3 ? 3 : current < 7 ? 7 : 14) - current},
  'freeze': freeze ? {'available': true, 'usedOn': null} : {'available': false, 'usedOn': '2026-11-09'}, 'lastMissedOn': lastMissedOn,
};

Map<String, dynamic> progressData({double? adherence, int planned = 0, int completed = 0, Map<String, dynamic>? streak, List<Map<String, dynamic>> weeks = const []}) => {
  'today': '2026-11-10', 'planned': planned, 'completed': completed, 'adherence': adherence, 'weeks': weeks,
  'streak': streak ?? streakData(),
  'calendar': [
    for (var index = 0; index < 35; index++)
      {'date': DateTime.utc(2026, 10, 12).add(Duration(days: index)).toIso8601String().substring(0, 10), 'status': streak == null ? 'sin_rutina' : index < 22 ? 'sin_rutina' : index.isEven ? 'hecho' : 'descanso'},
  ],
  'weightsEnabled': false, 'weights': [],
};

/// Rutas que usa la pestaña «Mi rutina» del participante.
void planRoutes(FakeServer server, {Object? plan, List<Object> sessions = const [], Object? profileData, Map<String, dynamic>? progress, Map<String, dynamic>? schedule}) {
  server.get('/api/plans/me', {'plan': plan});
  server.get('/api/sessions/me', {'today': '2026-11-10', 'sessions': sessions});
  server.get('/api/progress/me', progress ?? progressData());
  server.get('/api/profiles/me', {'profile': profileData});
  server.get('/api/schedule/me', schedule ?? (plan == null ? weekData() : planWeek()));
}

/// Desplaza la lista principal hasta que el elemento sea visible.
Future<void> reveal(WidgetTester tester, Finder finder, {double delta = 300}) async {
  await tester.scrollUntilVisible(finder, delta, scrollable: find.byType(Scrollable).first);
  await tester.pumpAndSettle();
}

/// Rutas que usa la pestaña «Rutinas»: catálogo aprobado, biblioteca y rutina vigente.
void routinesRoutes(FakeServer server, {List<Map<String, dynamic>> routines = const [], List<Map<String, dynamic>> exercises = const [], Map<String, dynamic>? profileData, Map<String, dynamic>? body, List<Map<String, dynamic>> notices = const []}) {
  server.get('/api/routines', {
    'rulesVersion': 1,
    'profile': profileData == null ? null : {'objective': 'bajar', 'level': 'principiante', 'equipment': 'sin_equipo', 'days': profileData['days'], 'durationMinutes': 30},
    'body': body,
    'notices': notices,
    'routines': routines,
  });
  server.get('/api/exercises', {'groups': ['piernas', 'empuje', 'traccion', 'core', 'cardio', 'movilidad'], 'exercises': exercises});
}

Future<void> pumpApp(WidgetTester tester, FakeServer server, {TokenStore? tokens, ThemeController? theme, Size size = const Size(420, 900)}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(FitGoalApp(api: server.api(tokens: tokens), theme: theme));
  await tester.pumpAndSettle();
}

/// Desplaza hasta el elemento y lo toca, como lo haría una persona con la pantalla.
Future<void> press(WidgetTester tester, Finder finder) async {
  if (finder.evaluate().isEmpty) await tester.scrollUntilVisible(finder, 300, scrollable: find.byType(Scrollable).first);
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

Future<void> signIn(WidgetTester tester, {String email = 'a@prueba.cl'}) async {
  await tester.enterText(find.byKey(const Key('email')), email);
  await tester.enterText(find.byKey(const Key('password')), 'Clave-de-prueba-2026');
  await press(tester, find.byKey(const Key('submit')));
  await tester.pumpAndSettle();
}

/// Elige un ejercicio en el selector (un diálogo con su propia lista desplazable).
Future<void> pick(WidgetTester tester, String code) async {
  final finder = find.byKey(Key('pick-$code'));
  if (finder.evaluate().isEmpty || tester.getRect(finder).bottom > 640) {
    await tester.scrollUntilVisible(finder, 120, scrollable: find.descendant(of: find.byType(AlertDialog), matching: find.byType(Scrollable)).first);
  }
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> goToRoutines(WidgetTester tester) async {
  await tester.tap(find.byIcon(Icons.explore_outlined));
  await tester.pumpAndSettle();
}

void main() {
  group('Acceso y registro (RF001, RF009)', () {
    testWidgets('inicia sesión y muestra el plan del participante', (tester) async {
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user'));
      planRoutes(server);
      await pumpApp(tester, server);
      expect(find.byKey(const Key('submit')), findsOneWidget);
      await signIn(tester);
      expect(find.byKey(const Key('no-plan')), findsOneWidget);
      expect(server.calledTo('POST', '/api/auth/login').single.body, {'email': 'a@prueba.cl', 'password': 'Clave-de-prueba-2026'});
    });

    testWidgets('la tecla Enter en la contraseña envía el inicio de sesión una sola vez', (tester) async {
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user'));
      planRoutes(server);
      await pumpApp(tester, server);
      await tester.enterText(find.byKey(const Key('email')), 'a@prueba.cl');
      await tester.enterText(find.byKey(const Key('password')), 'Clave-de-prueba-2026');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('no-plan')), findsOneWidget);
      expect(server.calledTo('POST', '/api/auth/login'), hasLength(1));
    });

    testWidgets('muestra el error de la API sin guardar nada si las credenciales son inválidas', (tester) async {
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => FakeResponse(401, error('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.')));
      await pumpApp(tester, server);
      await signIn(tester);
      expect(find.text('Correo o contraseña incorrectos.'), findsOneWidget);
      expect(find.byKey(const Key('no-plan')), findsNothing);
    });

    testWidgets('el registro exige aceptar los consentimientos obligatorios y envía la versión de la política', (tester) async {
      final server = FakeServer()
        ..on('POST', '/api/public/registration-started', (_, _) => {})
        ..on('POST', '/api/auth/register', (_, _) => FakeResponse(201, session('user')));
      planRoutes(server);
      await pumpApp(tester, server);
      await press(tester, find.byKey(const Key('switch-mode')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/public/registration-started'), hasLength(1));
      await tester.enterText(find.byKey(const Key('email')), 'nueva@prueba.cl');
      await tester.enterText(find.byKey(const Key('password')), 'Clave-de-prueba-2026');
      await press(tester, find.byKey(const Key('submit')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('auth-error')), findsOneWidget);
      expect(server.calledTo('POST', '/api/auth/register'), isEmpty);

      await press(tester, find.byKey(const Key('consent-account')));
      await press(tester, find.byKey(const Key('consent-profile')));
      await press(tester, find.byKey(const Key('consent-body-data')));
      await press(tester, find.byKey(const Key('consent-reminders')));
      await press(tester, find.byKey(const Key('submit')));
      await tester.pumpAndSettle();
      final body = server.calledTo('POST', '/api/auth/register').single.body!;
      expect(body['policyVersion'], 'politica-datos-2026-10-v1');
      expect(body['consents'], {'registro_cuenta': true, 'perfil_entrenamiento': true, 'datos_corporales': true, 'recordatorios': true});
      expect(body['intentId'], hasLength(36));
      expect(find.byKey(const Key('no-plan')), findsOneWidget);
    });

    testWidgets('rechaza correos y contraseñas inválidos antes de llamar a la API', (tester) async {
      final server = FakeServer();
      await pumpApp(tester, server);
      await press(tester, find.byKey(const Key('switch-mode')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('email')), 'no-es-correo');
      await tester.enterText(find.byKey(const Key('password')), 'corta');
      await press(tester, find.byKey(const Key('submit')));
      await tester.pumpAndSettle();
      expect(find.text('Ingresa un correo válido.'), findsOneWidget);
      expect(find.text('La contraseña debe tener al menos 10 caracteres.'), findsOneWidget);
      expect(server.calls.where((call) => call.path == '/api/auth/register'), isEmpty);
    });

    testWidgets('restaura la sesión guardada y entra directo al plan', (tester) async {
      final good = FakeServer()..get('/api/auth/me', {'user': session('user')['user']});
      planRoutes(good);
      await pumpApp(tester, good, tokens: MemoryTokenStore()..access = 'a'..refresh = 'r');
      expect(find.byKey(const Key('no-plan')), findsOneWidget);
    });

    testWidgets('si la sesión guardada ya no es válida, vuelve al inicio de sesión y olvida los tokens', (tester) async {
      final bad = FakeServer()
        ..on('GET', '/api/auth/me', (_, _) => FakeResponse(401, error('UNAUTHORIZED', 'expiró')))
        ..on('POST', '/api/auth/refresh', (_, _) => FakeResponse(401, error('UNAUTHORIZED', 'expiró')));
      final tokens = MemoryTokenStore()..access = 'a'..refresh = 'r';
      await pumpApp(tester, bad, tokens: tokens);
      expect(find.byKey(const Key('submit')), findsOneWidget);
      expect(tokens.refresh, isNull, reason: 'se olvidan los tokens vencidos');
    });

    testWidgets('cerrar sesión llama a la API y borra los tokens', (tester) async {
      final tokens = MemoryTokenStore();
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('user'))
        ..on('POST', '/api/auth/logout', (_, _) => FakeResponse(204, null));
      planRoutes(server);
      await pumpApp(tester, server, tokens: tokens);
      await signIn(tester);
      expect(tokens.refresh, 'refresh-1');
      await press(tester, find.byKey(const Key('account-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/auth/logout'), hasLength(1));
      expect(tokens.refresh, isNull);
      expect(find.byKey(const Key('submit')), findsOneWidget);
    });

    testWidgets('el tema se elige en el menú de cuenta (sistema, claro u oscuro) y se recuerda en el dispositivo', (tester) async {
      final store = MemoryPreferenceStore();
      final theme = ThemeController(store);
      await theme.load();
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user'));
      planRoutes(server);
      await pumpApp(tester, server, theme: theme);
      await signIn(tester);
      MaterialApp app() => tester.widget<MaterialApp>(find.byType(MaterialApp));
      expect(app().themeMode, ThemeMode.system, reason: 'por defecto sigue el tema del sistema');
      expect(app().darkTheme?.brightness, Brightness.dark);

      await tester.tap(find.byKey(const Key('account-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('theme-dark')));
      await tester.pumpAndSettle();
      expect(app().themeMode, ThemeMode.dark);
      expect(Theme.of(tester.element(find.byKey(const Key('no-plan')))).brightness, Brightness.dark, reason: 'las pantallas usan el tema oscuro');
      expect(store.values['fitgoal.theme'], 'dark');

      final restored = ThemeController(store);
      await restored.load();
      expect(restored.value, ThemeMode.dark, reason: 'al volver a abrir la app se usa el tema elegido');
      await tester.tap(find.byKey(const Key('account-menu')));
      await tester.pumpAndSettle();
      expect(find.descendant(of: find.byKey(const Key('theme-dark')), matching: find.byIcon(Icons.check)), findsOneWidget, reason: 'marca el tema elegido');
      await tester.tap(find.byKey(const Key('theme-light')));
      await tester.pumpAndSettle();
      expect(app().themeMode, ThemeMode.light);
    });
  });

  Future<FakeServer> signedIn(WidgetTester tester, void Function(FakeServer) setup, {bool fictitious = false}) async {
    final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user', fictitious: fictitious));
    setup(server);
    await pumpApp(tester, server);
    await signIn(tester);
    return server;
  }

  group('Mi rutina del participante (RF004, RF006, RF007)', () {
    testWidgets('sin rutina invita a ver rutinas y, sin perfil, a completarlo', (tester) async {
      await signedIn(tester, planRoutes);
      expect(find.byKey(const Key('no-plan')), findsOneWidget);
      expect(find.byKey(const Key('go-profile')), findsOneWidget);
      expect(find.byKey(const Key('go-routines')), findsOneWidget);
    });

    testWidgets('con perfil y sin rutina solo ofrece ver las rutinas', (tester) async {
      await signedIn(tester, (server) => planRoutes(server, profileData: profile()));
      expect(find.byKey(const Key('go-profile')), findsNothing);
      expect(find.byKey(const Key('go-routines')), findsOneWidget);
    });

    testWidgets('muestra la racha, la semana con el descanso de hoy y la sesión de cada día, y permite registrar una sesión vencida', (tester) async {
      final server = await signedIn(tester, (server) {
        planRoutes(
          server,
          plan: planData(),
          profileData: profile(),
          sessions: [
            {'id': 's-1', 'label': 'Lunes · Cuerpo completo A', 'plannedDate': '2026-11-09', 'completed': false, 'planStatus': 'vigente'},
            {'id': 's-2', 'label': 'Miércoles · Cuerpo completo B', 'plannedDate': '2026-11-11', 'completed': false, 'planStatus': 'vigente'},
          ],
          progress: progressData(adherence: 0.5, planned: 2, completed: 1, streak: streakData(current: 4, best: 9, today: 'descanso', freeze: false), weeks: [{'weekStart': '2026-11-09', 'planned': 1, 'completed': 0}]),
        );
        server.on('POST', '/api/sessions/s-1/complete', (_, _) => {'session': {'id': 's-1'}, 'weightRejected': null});
      });
      expect(find.text('4'), findsOneWidget);
      expect(find.text('Récord: 9 días'), findsOneWidget);
      expect(find.textContaining('Comodín usado el lun 9 nov', findRichText: true), findsOneWidget);
      expect(find.text('Hoy descansas: el descanso también suma a tu racha.'), findsOneWidget);
      expect(find.text('Faltan 3 días para tu racha de 7'), findsOneWidget);

      expect(find.text('9 – 15 nov'), findsOneWidget);
      expect(find.text('Hoy · martes 10 nov'), findsOneWidget, reason: 'se abre en el día de hoy');
      expect(find.byKey(const Key('rest-day')), findsOneWidget);
      expect(find.text('Movilidad de hombros'), findsOneWidget, reason: 'el descanso sugiere movilidad aprobada, opcional');

      await tester.tap(find.byKey(const Key('day-cell-2026-11-11')));
      await tester.pumpAndSettle();
      expect(find.text('Cuerpo completo B'), findsOneWidget);
      expect(find.text('Programada.'), findsOneWidget);
      expect(find.byKey(const Key('start-session')), findsNothing, reason: 'una sesión futura no se empieza ni se registra');

      await tester.tap(find.byKey(const Key('day-cell-2026-11-09')));
      await tester.pumpAndSettle();
      expect(find.text('Sin registrar: la cubrió tu comodín semanal y tu racha sigue.'), findsOneWidget);
      expect(find.text('Sentarse y levantarse'), findsOneWidget);
      expect(find.text('2 series de 8 repeticiones'), findsOneWidget);
      expect(find.byKey(const Key('day-register-s-1')), findsOneWidget);

      await reveal(tester, find.byKey(const Key('complete-s-1')));
      expect(find.byKey(const Key('complete-s-2')), findsNothing, reason: 'una sesión futura no queda pendiente de registrar');
      await press(tester, find.byKey(const Key('complete-s-1')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('session-note')), 'Sin molestias');
      await press(tester, find.byKey(const Key('session-save')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/sessions/s-1/complete').single.body, {'note': 'Sin molestias'});
      expect(find.text('Sesión registrada. ¡Bien hecho!'), findsOneWidget);

      await reveal(tester, find.byKey(const Key('plan-name')));
      expect(find.text('Recomendada'), findsOneWidget);
      expect(find.text('Rutina aprobada por un profesional · versión 1'), findsOneWidget);
      expect(find.text('Semana 2 de 4 · termina el lun 30 nov'), findsOneWidget);
      expect(find.byKey(const Key('profile-changed')), findsNothing);
      await press(tester, find.byKey(const Key('plan-week')));
      await tester.pumpAndSettle();
      expect(find.text('Martes · Descanso'), findsOneWidget, reason: 'la semana tipo muestra los días de descanso');
      expect(find.byKey(const Key('week-day-1')), findsOneWidget);
      await reveal(tester, find.byKey(const Key('adherence')));
      expect(find.text('Adherencia: 50 %'), findsOneWidget);
      await reveal(tester, find.byKey(const Key('calendar')));
      expect(find.byKey(const Key('calendar')), findsOneWidget);
    });

    testWidgets('navega entre semanas del horario y vuelve a la actual', (tester) async {
      final server = await signedIn(tester, (server) => planRoutes(server, plan: planData(), profileData: profile(), progress: progressData(streak: streakData(current: 2, best: 2, today: 'descanso'))));
      final next = {
        ...weekData(plan: true, fallback: 'descanso', previousWeek: '2026-11-09'),
        'weekStart': '2026-11-16', 'weekEnd': '2026-11-22',
        'days': [
          for (var day = 1; day <= 7; day++)
            {'date': '2026-11-${15 + day}', 'weekday': day, 'dayLabel': _dayLabels[day - 1], 'isToday': false, 'status': day == 1 ? 'programada' : 'descanso', 'session': day == 1 ? sessionOfDay('s-9', 'Cuerpo completo A') : null},
        ],
      };
      server.on('GET', '/api/schedule/me', (request, _) => request.url.queryParameters['date'] == '2026-11-16' ? next : weekData(plan: true, fallback: 'descanso', previousWeek: '2026-11-02', nextWeek: '2026-11-16'));
      await tester.tap(find.byKey(const Key('week-next')));
      await tester.pumpAndSettle();
      expect(find.text('16 – 22 nov'), findsOneWidget);
      expect(find.text('lunes 16 nov'), findsOneWidget, reason: 'en otra semana se abre su primer día');
      expect(find.text('Cuerpo completo A'), findsOneWidget);
      await tester.tap(find.byKey(const Key('week-today')));
      await tester.pumpAndSettle();
      expect(find.text('9 – 15 nov'), findsOneWidget);
      expect(server.calls.where((call) => call.path == '/api/schedule/me').length, 3);
    });

    testWidgets('si hoy toca entrenar, el modo sesión marca las series, cuenta el descanso y registra al terminar', (tester) async {
      final server = await signedIn(tester, (server) {
        planRoutes(
          server,
          plan: planData(),
          profileData: profile(),
          progress: progressData(streak: streakData(current: 5, best: 5, today: 'pendiente')),
          schedule: weekData(plan: true, fallback: 'descanso', days: {2: ('pendiente', sessionOfDay('s-3', 'Cuerpo completo A', canRegister: true))}),
        );
        server.on('POST', '/api/sessions/s-3/complete', (_, _) => {'session': {'id': 's-3'}, 'weightRejected': null});
      });
      expect(find.text('Hoy te toca entrenar: registra tu sesión para sumar un día.'), findsOneWidget);
      expect(find.text('Te toca hoy.'), findsOneWidget);
      await press(tester, find.byKey(const Key('start-session')));
      await tester.pumpAndSettle();
      expect(find.text('0/3 series'), findsOneWidget, reason: '2 series de sentadillas y 1 bloque de caminata');

      await tester.tap(find.byKey(const Key('set-0-0')));
      await tester.pump();
      expect(find.text('Descanso: 1:00'), findsOneWidget);
      await tester.pump(const Duration(seconds: 5));
      expect(find.text('Descanso: 0:55'), findsOneWidget);
      await tester.tap(find.byKey(const Key('rest-add')));
      await tester.pump();
      expect(find.text('Descanso: 1:10'), findsOneWidget);
      await tester.tap(find.byKey(const Key('rest-skip')));
      await tester.pump();
      expect(find.byKey(const Key('rest-timer')), findsNothing);

      await tester.tap(find.byKey(const Key('set-0-1')));
      await tester.pump();
      await tester.ensureVisible(find.byKey(const Key('set-1-0')));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.byKey(const Key('set-1-0')));
      await tester.pumpAndSettle();
      expect(find.text('3/3 series'), findsOneWidget);
      expect(find.byKey(const Key('rest-timer')), findsNothing, reason: 'al terminar todas las series no hay descanso');

      await tester.tap(find.byKey(const Key('finish-session')));
      await tester.pumpAndSettle();
      expect(find.text('Registrar Cuerpo completo A'), findsOneWidget);
      await tester.tap(find.byKey(const Key('session-save')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/sessions/s-3/complete').single.body, <String, dynamic>{});
      expect(find.text('Sesión registrada. ¡Bien hecho!'), findsOneWidget);
      expect(find.byKey(const Key('week-range')), findsOneWidget, reason: 'vuelve a «Mi rutina», donde estaba');
    });

    testWidgets('si hoy toca entrenar, la tarjeta de la racha ofrece empezar la sesión sin buscarla', (tester) async {
      await signedIn(tester, (server) => planRoutes(
        server,
        plan: planData(),
        profileData: profile(),
        progress: progressData(streak: streakData(current: 5, best: 5, today: 'pendiente')),
        schedule: weekData(plan: true, fallback: 'descanso', days: {2: ('pendiente', sessionOfDay('s-3', 'Cuerpo completo A', canRegister: true))}),
      ));
      expect(find.text('Empezar: Cuerpo completo A'), findsOneWidget);
      await tester.tap(find.byKey(const Key('hero-start-session')));
      await tester.pumpAndSettle();
      expect(find.text('0/3 series'), findsOneWidget, reason: 'abre el modo sesión');
    });

    testWidgets('una sesión que no se pudo hacer se cambia a un día libre y el día original queda como «movida»', (tester) async {
      Map<String, dynamic>? schedule = weekData(plan: true, fallback: 'descanso', previousWeek: '2026-11-02', nextWeek: '2026-11-16', days: {
        1: ('perdido', {...sessionOfDay('s-1', 'Cuerpo completo A', canRegister: true), 'canMove': true}),
        3: ('programada', {...sessionOfDay('s-2', 'Cuerpo completo B'), 'canMove': true}),
      });
      final server = await signedIn(tester, (server) {
        planRoutes(
          server,
          plan: planData(),
          profileData: profile(),
          sessions: [{'id': 's-1', 'label': 'Lunes · Cuerpo completo A', 'plannedDate': '2026-11-09', 'completed': false, 'planStatus': 'vigente', 'canMove': true}],
          progress: progressData(streak: streakData(current: 3, best: 3, today: 'descanso')),
        );
        server.on('GET', '/api/schedule/me', (_, _) => schedule);
        server.get('/api/sessions/s-1/move-options', {
          'session': {'id': 's-1', 'plannedDate': '2026-11-09', 'canMove': true}, 'name': 'Cuerpo completo A',
          'options': [
            {'date': '2026-11-10', 'dayLabel': 'Martes', 'isToday': true, 'nextToSession': true},
            {'date': '2026-11-12', 'dayLabel': 'Jueves', 'isToday': false, 'nextToSession': true},
            {'date': '2026-11-14', 'dayLabel': 'Sábado', 'isToday': false, 'nextToSession': false},
          ],
        });
        server.on('POST', '/api/sessions/s-1/move', (_, body) {
          // Tras moverla, el lunes queda como «movida» y la sesión aparece el sábado.
          schedule = weekData(plan: true, fallback: 'descanso', previousWeek: '2026-11-02', nextWeek: '2026-11-16', days: {
            1: ('movida', null),
            3: ('programada', {...sessionOfDay('s-2', 'Cuerpo completo B'), 'canMove': true}),
            6: ('programada', {...sessionOfDay('s-1', 'Cuerpo completo A'), 'canMove': true, 'movedFrom': '2026-11-09'}),
          });
          (schedule!['days'] as List)[0]['movedTo'] = '2026-11-14';
          return {'session': {'id': 's-1', 'plannedDate': body!['date'], 'movedFrom': '2026-11-09'}};
        });
      });

      expect(find.byKey(const Key('move-s-1')), findsOneWidget, reason: 'la lista «Sin registrar» ofrece cambiarla de día');
      await tester.tap(find.byKey(const Key('day-cell-2026-11-11')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('day-move-s-2')), findsOneWidget, reason: 'una sesión futura también se puede cambiar de día');
      await tester.tap(find.byKey(const Key('day-cell-2026-11-09')));
      await tester.pumpAndSettle();
      expect(find.text('Sin registrar. Si no pudiste hacerla, cámbiala a otro día.'), findsOneWidget);

      await press(tester, find.byKey(const Key('day-move-s-1')));
      await tester.pumpAndSettle();
      expect(find.text('Cuerpo completo A · programada el lunes 9 nov'), findsOneWidget);
      expect(find.text('Hoy · martes 10 nov'), findsOneWidget, reason: 'hoy aparece como opción');
      expect(find.text('Con descanso antes y después.'), findsOneWidget);
      expect(find.text('Queda junto a otra sesión: sin descanso entre ambas.'), findsNWidgets(2));
      expect(tester.widget<FilledButton>(find.byKey(const Key('move-confirm'))).onPressed, isNull, reason: 'primero hay que elegir un día');
      await tester.tap(find.byKey(const Key('move-option-2026-11-14')));
      await tester.pumpAndSettle();
      expect(find.text('Cambiar al sábado 14 nov'), findsOneWidget);
      await tester.tap(find.byKey(const Key('move-confirm')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/sessions/s-1/move').single.body, {'date': '2026-11-14'});
      expect(find.text('«Cuerpo completo A» quedó para el sábado 14 nov.'), findsOneWidget);

      expect(find.text('Movida desde el lunes 9 nov'), findsOneWidget, reason: 'la semana queda a la vista en el nuevo día de la sesión');
      expect(find.byKey(const Key('day-move-s-1')), findsOneWidget, reason: 'se puede volver a cambiar');
      await tester.tap(find.byKey(const Key('day-cell-2026-11-09')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('moved-day')), findsOneWidget, reason: 'el lunes ahora figura como «movida»');
      expect(find.text('La cambiaste al sábado 14 nov. Este día no suma ni corta tu racha.'), findsOneWidget);
      await tester.tap(find.byKey(const Key('show-moved-day')));
      await tester.pumpAndSettle();
      expect(find.text('Movida desde el lunes 9 nov'), findsOneWidget);
    });

    testWidgets('la racha explica sus reglas y, tras cortarse, anima a no fallar dos veces seguidas', (tester) async {
      await signedIn(tester, (server) => planRoutes(server, plan: planData(), profileData: profile(), progress: progressData(streak: streakData(current: 0, best: 12, today: 'descanso', lastMissedOn: '2026-11-09'))));
      expect(find.text('0'), findsOneWidget);
      expect(find.textContaining('no fallar dos veces seguidas'), findsOneWidget);
      await tester.tap(find.byKey(const Key('streak-info')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Comodín semanal'), findsOneWidget);
      expect(find.textContaining('descansar también es parte del plan'), findsOneWidget);
    });

    testWidgets('una rutina propia se identifica como armada por la persona con ejercicios aprobados', (tester) async {
      await signedIn(tester, (server) => planRoutes(server, plan: planData(source: 'propia'), profileData: profile()));
      await reveal(tester, find.byKey(const Key('plan-name')));
      expect(find.text('Propia'), findsOneWidget);
      expect(find.text('Armada por ti con ejercicios aprobados por un profesional'), findsOneWidget);
    });

    testWidgets('si el perfil cambió después de empezar la rutina lo avisa y lleva a las recomendadas', (tester) async {
      await signedIn(tester, (server) {
        planRoutes(server, plan: planData(), profileData: profile(version: 2));
        routinesRoutes(server, routines: [routineData()], profileData: profile(version: 2));
      });
      await reveal(tester, find.byKey(const Key('profile-changed')));
      expect(find.byKey(const Key('profile-changed')), findsOneWidget);
      await press(tester, find.byKey(const Key('see-routines')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('build-routine')), findsOneWidget);
    });

    testWidgets('un error de red se informa con la opción de reintentar y no finge que algo se guardó', (tester) async {
      var online = false;
      await signedIn(tester, (server) {
        planRoutes(server);
        server.on('GET', '/api/plans/me', (_, _) => online ? {'plan': null} : FakeResponse(503, error('INTERNAL_ERROR', 'No se pudo completar la operación.')));
      });
      expect(find.text('No se pudo completar la operación.'), findsOneWidget);
      online = true;
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('no-plan')), findsOneWidget);
    });
  });

  group('Rutinas recomendadas y biblioteca de ejercicios (RF004, RF005)', () {
    final library = [
      exerciseData('caminata', 'Caminata', 'cardio'),
      exerciseData('plancha', 'Plancha', 'core'),
      exerciseData('mini-sentadillas', 'Mini sentadillas', 'piernas'),
      exerciseData('curl', 'Curl de bíceps', 'traccion', equipment: true),
    ];

    Future<FakeServer> openRoutines(WidgetTester tester, {List<Map<String, dynamic>>? routines, Map<String, dynamic>? profileData, Object? plan, Map<String, dynamic>? body, List<Map<String, dynamic>> notices = const []}) async {
      final server = await signedIn(tester, (server) {
        planRoutes(server, plan: plan, profileData: profileData);
        routinesRoutes(server, routines: routines ?? [routineData(), routineData(id: 't-2', category: 'sobrepeso'), routineData(id: 't-3', recommended: false, objective: 'subir')], exercises: library, profileData: profileData, body: body, notices: notices);
        server.get('/api/routines/t-1', {'routine': {
          ...routineData(), 'sessions': [
            {'sessionNo': 1, 'label': 'Cuerpo completo A', 'exercises': [{'id': 'e-caminata', 'code': 'caminata', 'name': 'Caminata', 'description': 'x', 'muscleGroup': 'cardio', 'requiresEquipment': false, 'prescription': '10 minutos a ritmo cómodo', 'defaultPrescription': '10 minutos a ritmo cómodo'}]},
            {'sessionNo': 2, 'label': 'Cuerpo completo B', 'exercises': [{'id': 'e-plancha', 'code': 'plancha', 'name': 'Plancha', 'description': 'x', 'muscleGroup': 'core', 'requiresEquipment': false, 'prescription': '3 series de 20 segundos', 'defaultPrescription': '3 series de 20 segundos'}]},
          ],
        }});
        server.on('POST', '/api/plans/start', (_, _) => FakeResponse(201, {'plan': {'id': 'pl-1', 'version': 1, 'sessionsScheduled': 12}}));
      });
      await goToRoutines(tester);
      return server;
    }

    testWidgets('«Para ti» muestra solo las rutinas recomendadas con sus motivos', (tester) async {
      await openRoutines(tester, profileData: profile());
      expect(find.byKey(const Key('routine-t-1')), findsOneWidget);
      expect(find.byKey(const Key('routine-t-2')), findsOneWidget);
      expect(find.byKey(const Key('routine-t-3')), findsNothing, reason: 'no corresponde al perfil');
      expect(find.text('Recomendada'), findsNWidgets(2));
      expect(find.textContaining('Coincide con tu objetivo'), findsNWidgets(2));
      expect(find.textContaining('Elegidas por un profesional para bajar de peso'), findsOneWidget);
      expect(find.textContaining('Si estás empezando, conviene trabajar todo el cuerpo (full body)'), findsNWidgets(2), reason: 'el motivo de la división');
      expect(find.byKey(const Key('alternatives-title')), findsNothing, reason: 'sin alternativas no hay sección');
    });

    testWidgets('«Para ti» muestra después las otras divisiones para el mismo perfil', (tester) async {
      await openRoutines(tester, profileData: profile(), routines: [
        routineData(),
        routineData(id: 't-4', recommended: false, alternative: true, split: 'upper_lower'),
        routineData(id: 't-5', recommended: false, alternative: true, split: 'push_pull_legs'),
        routineData(id: 't-3', recommended: false, objective: 'subir'),
      ]);
      expect(find.text('Recomendada'), findsOneWidget);
      expect(find.textContaining('Full body · 3 sesiones · 2 a 3 días/semana'), findsOneWidget);
      final title = find.byKey(const Key('alternatives-title'));
      await tester.scrollUntilVisible(title, 300, scrollable: find.byType(Scrollable).first);
      expect(find.text('Otras formas de organizar tu semana'), findsOneWidget);
      await tester.scrollUntilVisible(find.byKey(const Key('routine-t-5')), 300, scrollable: find.byType(Scrollable).first);
      expect(find.textContaining('Upper/Lower · 4 sesiones · 4 días/semana'), findsOneWidget);
      expect(find.textContaining('Push/Pull/Legs · 3 sesiones · 3 a 6 días/semana'), findsOneWidget);
      expect(find.textContaining('organizada en otra división'), findsNWidgets(2));
      expect(find.byKey(const Key('routine-t-3')), findsNothing, reason: 'otro objetivo no es alternativa');
    });

    testWidgets('«Para ti» muestra el IMC y los avisos de las reglas de seguridad aprobadas', (tester) async {
      await openRoutines(
        tester,
        profileData: profile(weight: 50, height: 170, bmi: 17.3, category: 'bajo_peso'),
        body: {'bmi': 17.3, 'category': 'bajo_peso', 'label': 'bajo peso'},
        notices: [
          {'code': 'objective_adjusted', 'text': 'Con tu IMC (17.3, bajo peso) no recomendamos rutinas para bajar de peso: te mostramos rutinas para subir de peso. Consulta a un profesional de la salud.'},
          {'code': 'bmi_reference', 'text': 'El IMC es solo una referencia: no distingue músculo de grasa ni reemplaza una evaluación profesional.'},
        ],
      );
      expect(find.byKey(const Key('bmi-line')), findsOneWidget);
      expect(find.text('Tu IMC: 17,3 (bajo peso)'), findsOneWidget);
      expect(find.textContaining('no recomendamos rutinas para bajar de peso'), findsOneWidget);
      expect(find.textContaining('no distingue músculo de grasa'), findsOneWidget);
      expect(find.byKey(const Key('go-profile-body')), findsNothing, reason: 'ya informó su estatura y peso');
    });

    testWidgets('sin estatura ni peso invita a indicarlos para afinar las recomendaciones', (tester) async {
      final server = await openRoutines(
        tester,
        profileData: profile(),
        notices: [{'code': 'body_data_missing', 'text': 'Sin tu estatura y peso te mostramos rutinas generales de bajo impacto.'}],
      );
      server.get('/api/consents', {'policyVersion': 'politica-datos-2026-10-v1', 'consents': []});
      expect(find.byKey(const Key('notice-body_data_missing')), findsOneWidget);
      await press(tester, find.byKey(const Key('go-profile-body')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('age')), findsOneWidget, reason: 'lleva al perfil');
    });

    testWidgets('sin perfil invita a completarlo y no marca ninguna como recomendada', (tester) async {
      await openRoutines(tester, routines: [routineData(recommended: false)]);
      expect(find.byKey(const Key('go-profile-routines')), findsOneWidget);
      expect(find.byKey(const Key('no-recommended')), findsOneWidget);
      expect(find.byKey(const Key('routine-t-1')), findsNothing);
    });

    testWidgets('sin coincidencias para el perfil invita a explorar todas las rutinas', (tester) async {
      await openRoutines(tester, routines: [routineData(recommended: false)], profileData: profile());
      expect(find.textContaining('Todavía no hay una rutina recomendada'), findsOneWidget);
    });

    testWidgets('«Todas» permite explorar el catálogo y filtrar por objetivo', (tester) async {
      await openRoutines(tester, profileData: profile());
      await tester.tap(find.text('Todas'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.byKey(const Key('routine-t-3')), 300, scrollable: find.byType(Scrollable).first);
      expect(find.byKey(const Key('routine-t-3')), findsOneWidget);
      await tester.scrollUntilVisible(find.byKey(const Key('filter-subir')), -300, scrollable: find.byType(Scrollable).first);
      await press(tester, find.byKey(const Key('filter-subir')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('routine-t-3')), findsOneWidget);
      expect(find.byKey(const Key('routine-t-1')), findsNothing);
      await press(tester, find.byKey(const Key('filter-all')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('routine-t-1')), findsOneWidget);
    });

    testWidgets('«Todas» filtra también por división: full body, upper/lower o push/pull/legs', (tester) async {
      await openRoutines(tester, profileData: profile(), routines: [
        routineData(),
        routineData(id: 't-4', recommended: false, alternative: true, split: 'upper_lower'),
        routineData(id: 't-5', recommended: false, alternative: true, split: 'push_pull_legs'),
      ]);
      await tester.tap(find.text('Todas'));
      await tester.pumpAndSettle();
      expect(find.text('3 rutinas'), findsOneWidget);
      await press(tester, find.byKey(const Key('split-push_pull_legs')));
      await tester.pumpAndSettle();
      expect(find.text('1 rutina'), findsOneWidget);
      expect(find.byKey(const Key('routine-t-5')), findsOneWidget);
      expect(find.byKey(const Key('routine-t-1')), findsNothing);
      await press(tester, find.byKey(const Key('split-upper_lower')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('routine-t-4')), findsOneWidget);
      expect(find.byKey(const Key('routine-t-5')), findsNothing);
      await press(tester, find.byKey(const Key('split-all')));
      await tester.pumpAndSettle();
      expect(find.text('3 rutinas'), findsOneWidget);
    });

    testWidgets('«Ejercicios» lista la biblioteca aprobada y se filtra por grupo', (tester) async {
      await openRoutines(tester, profileData: profile());
      await tester.tap(find.text('Ejercicios'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('exercise-caminata')), findsOneWidget);
      await reveal(tester, find.byKey(const Key('exercise-curl')));
      expect(find.byKey(const Key('exercise-curl')), findsOneWidget);
      await press(tester, find.byKey(const Key('group-core')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('exercise-plancha')), findsOneWidget);
      expect(find.byKey(const Key('exercise-caminata')), findsNothing);
      await tester.tap(find.byKey(const Key('exercise-plancha')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Indicación sugerida: 2 series de 8 repeticiones'), findsOneWidget);
    });

    testWidgets('los grupos musculares son botones que explican brevemente de qué se trata cada uno', (tester) async {
      await openRoutines(tester, profileData: profile());
      await press(tester, find.byKey(const Key('routine-t-1')));
      await tester.pumpAndSettle();
      final core = find.byKey(const Key('group-chip-core'));
      await reveal(tester, core);
      await tester.tap(core);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('group-info-core')), findsOneWidget);
      expect(find.text('Ejercicios que mantienen el tronco firme y estable mientras brazos y piernas se mueven.'), findsOneWidget);
      expect(find.text('Abdominales (recto y transverso), oblicuos, zona lumbar y glúteos.'), findsOneWidget);
      expect(find.text('Consejo'), findsOneWidget);
      await tester.tapAt(const Offset(20, 20));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('group-info-core')), findsNothing);
    });

    testWidgets('en «Ejercicios» explica todos los grupos o el grupo filtrado', (tester) async {
      await openRoutines(tester, profileData: profile());
      await tester.tap(find.text('Ejercicios'));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('group-guide')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('group-guide-sheet')), findsOneWidget);
      expect(find.byKey(const Key('group-info-piernas')), findsOneWidget);
      expect(find.byKey(const Key('group-info-empuje')), findsOneWidget);
      await tester.tapAt(const Offset(20, 20));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('group-traccion')));
      await tester.pumpAndSettle();
      expect(find.text('¿Qué es tracción?'), findsOneWidget);
      await press(tester, find.byKey(const Key('group-guide')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('group-info-traccion')), findsOneWidget);
      expect(find.byKey(const Key('group-info-piernas')), findsNothing);
      expect(find.textContaining('Equilibran el trabajo de empuje'), findsOneWidget);
    });

    testWidgets('avisa cuando la rutina pide más días de los que indica el perfil, sin impedir verla', (tester) async {
      await openRoutines(tester, routines: [routineData(fits: false)], profileData: profile(days: const [1]));
      expect(find.textContaining('al menos 2 días por semana'), findsOneWidget);
      expect(find.byKey(const Key('routine-t-1')), findsOneWidget);
    });

    testWidgets('empezar una rutina recomendada envía los días elegidos y vuelve a «Mi rutina» con el aviso', (tester) async {
      final server = await openRoutines(tester, profileData: profile());
      await press(tester, find.byKey(const Key('routine-t-1')));
      await tester.pumpAndSettle();
      expect(find.text('Rutina aprobada por un profesional'), findsOneWidget);
      expect(find.text('Full body: cuerpo completo en cada sesión'), findsOneWidget);
      String dayText(String key) => tester.widget<Text>(find.byKey(Key(key))).data!;
      expect(dayText('day-plan-1'), 'Cuerpo completo A');
      expect(dayText('day-plan-3'), 'Cuerpo completo B');
      expect(dayText('day-plan-5'), 'Cuerpo completo A', reason: 'las sesiones se repiten en ciclo');
      expect(find.byKey(const Key('day-rest-2')), findsOneWidget, reason: 'los días no elegidos son de descanso');
      expect(find.byKey(const Key('day-rest-7')), findsOneWidget);
      await reveal(tester, find.text('3 series de 20 segundos · Zona media (core)'));
      expect(find.text('Sesión 2 · Cuerpo completo B'), findsOneWidget);
      await press(tester, find.byKey(const Key('start-routine')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/plans/start').single.body, {'source': 'recomendada', 'templateId': 't-1', 'days': [1, 3, 5]});
      expect(find.byKey(const Key('plan-name')).evaluate().isNotEmpty || find.byKey(const Key('no-plan')).evaluate().isNotEmpty, isTrue, reason: 'vuelve a la pestaña «Mi rutina»');
      expect(find.text('Tu rutina empezó. Tus sesiones ya están en tu agenda.'), findsOneWidget);
    });

    testWidgets('con una rutina vigente pide confirmar antes de reemplazarla', (tester) async {
      final server = await openRoutines(tester, profileData: profile(), plan: planData());
      await press(tester, find.byKey(const Key('routine-t-1')));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('start-routine')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/plans/start'), isEmpty, reason: 'todavía no se confirmó');
      await tester.tap(find.byKey(const Key('confirm-start')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/plans/start'), hasLength(1));
    });

    testWidgets('no deja empezar con menos o más días de los que contempla la rutina', (tester) async {
      final server = await openRoutines(tester, profileData: profile(days: const [1]));
      await press(tester, find.byKey(const Key('routine-t-1')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('days-error')), findsNothing, reason: 'se completan los días hasta el mínimo');
      await press(tester, find.byKey(const Key('day-3')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('days-error')), findsOneWidget);
      expect(tester.widget<FilledButton>(find.byKey(const Key('start-routine'))).onPressed, isNull);
      expect(server.calledTo('POST', '/api/plans/start'), isEmpty);
    });

    testWidgets('un error al empezar se informa y la persona sigue en el detalle', (tester) async {
      final server = await openRoutines(tester, profileData: profile());
      server.on('POST', '/api/plans/start', (_, _) => FakeResponse(409, error('TEMPLATE_NOT_AVAILABLE', 'Esa rutina ya no está disponible. Elige otra de la lista.')));
      await press(tester, find.byKey(const Key('routine-t-1')));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('start-routine')));
      await tester.pumpAndSettle();
      expect(find.text('Esa rutina ya no está disponible. Elige otra de la lista.'), findsOneWidget);
      expect(find.byKey(const Key('start-routine')), findsOneWidget);
    });
    testWidgets('avisa cuando dos días seguidos trabajan los mismos músculos y deja de avisar al separarlos', (tester) async {
      final server = await openRoutines(tester, profileData: profile(days: const [1, 2]));
      final legs = {'id': 'e-sentadilla', 'code': 'sentadilla', 'name': 'Sentadilla', 'description': 'x', 'muscleGroup': 'piernas', 'requiresEquipment': false, 'prescription': '3 series de 12 repeticiones', 'defaultPrescription': '3 series de 12 repeticiones'};
      server.get('/api/routines/t-1', {'routine': {
        ...routineData(), 'sessions': [
          {'sessionNo': 1, 'label': 'Cuerpo completo A', 'exercises': [legs]},
          {'sessionNo': 2, 'label': 'Cuerpo completo B', 'exercises': [legs]},
        ],
      }});
      await press(tester, find.byKey(const Key('routine-t-1')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Lunes y martes trabajas piernas dos días seguidos'), findsOneWidget);
      await press(tester, find.byKey(const Key('day-2')));
      await press(tester, find.byKey(const Key('day-4')));
      await tester.pumpAndSettle();
      expect(find.textContaining('dos días seguidos'), findsNothing);
    });

    testWidgets('una rutina recomendada se puede personalizar como rutina propia, con sus sesiones en los días elegidos', (tester) async {
      final server = await openRoutines(tester, profileData: profile());
      server.on('POST', '/api/plans/start', (_, _) => FakeResponse(201, {'plan': {'id': 'pl-3', 'version': 1, 'sessionsScheduled': 12}}));
      await press(tester, find.byKey(const Key('routine-t-1')));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('customize-routine')));
      await tester.pumpAndSettle();
      expect(find.text('Crear mi rutina'), findsOneWidget);
      expect(tester.widget<TextField>(find.byKey(const Key('routine-name'))).controller!.text, 'Full body personalizada');
      await reveal(tester, find.text('Lunes · Cuerpo completo A'));
      expect(find.text('Lunes · Cuerpo completo A'), findsOneWidget);
      await press(tester, find.byKey(const Key('start-custom')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/plans/start').single.body, {
        'source': 'propia', 'name': 'Full body personalizada', 'days': [1, 3, 5],
        'sessions': [
          {'label': 'Cuerpo completo A', 'exercises': [{'exerciseId': 'e-caminata'}]},
          {'label': 'Cuerpo completo B', 'exercises': [{'exerciseId': 'e-plancha'}]},
          {'label': 'Cuerpo completo A', 'exercises': [{'exerciseId': 'e-caminata'}]},
        ],
      });
      expect(find.text('Tu rutina empezó. Tus sesiones ya están en tu agenda.'), findsOneWidget);
    });

    testWidgets('«Todas» busca por nombre y filtra por nivel y equipo; «Ejercicios» busca y filtra por equipo', (tester) async {
      await openRoutines(tester, profileData: profile(), routines: [routineData(), routineData(id: 't-3', recommended: false, objective: 'subir')]);
      await tester.tap(find.text('Todas'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('routine-search')), 'SUBIR');
      await tester.pumpAndSettle();
      expect(find.text('1 rutina'), findsOneWidget);
      expect(find.byKey(const Key('routine-t-3')), findsOneWidget);
      await tester.enterText(find.byKey(const Key('routine-search')), '');
      await press(tester, find.byKey(const Key('level-con_experiencia')));
      await tester.pumpAndSettle();
      expect(find.text('0 rutinas'), findsOneWidget);
      await press(tester, find.byKey(const Key('level-con_experiencia')));
      await tester.pumpAndSettle();
      expect(find.text('2 rutinas'), findsOneWidget);

      await reveal(tester, find.text('Ejercicios'), delta: -300);
      await tester.tap(find.text('Ejercicios'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('exercise-search')), 'sentad');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('exercise-mini-sentadillas')), findsOneWidget);
      expect(find.byKey(const Key('exercise-caminata')), findsNothing);
      await tester.enterText(find.byKey(const Key('exercise-search')), '');
      await press(tester, find.byKey(const Key('exercise-equipment-con_equipo')));
      await tester.pumpAndSettle();
      expect(find.text('1 ejercicio'), findsOneWidget);
      expect(find.byKey(const Key('exercise-curl')), findsOneWidget);
    });

    testWidgets('cada rutina muestra su semana: días de entrenamiento según el perfil y días de descanso', (tester) async {
      await openRoutines(tester, profileData: profile());
      expect(find.byKey(const Key('routine-week-t-1')), findsOneWidget);
      expect(find.byTooltip('Lunes: Cuerpo completo A'), findsWidgets);
      expect(find.byTooltip('Martes: descanso'), findsWidgets);
    });

  });

  group('Armar una rutina propia (RF005)', () {
    Future<FakeServer> openBuilder(WidgetTester tester, {bool suggestions = true}) async {
      final server = await signedIn(tester, (server) {
        planRoutes(server, profileData: profile());
        routinesRoutes(server, exercises: [exerciseData('caminata', 'Caminata', 'cardio'), exerciseData('plancha', 'Plancha', 'core')], profileData: profile());
        if (suggestions) {
          server.get('/api/exercises/suggestions', {'rulesVersion': 1, 'objective': 'bajar', 'focus': ['cardio', 'piernas', 'core'], 'exercises': [
            exerciseData('caminata', 'Caminata', 'cardio', suggested: true, reason: 'Sugerido para bajar de peso: trabaja el sistema cardiovascular.'),
            exerciseData('plancha', 'Plancha', 'core', suggested: true, reason: 'Sugerido para bajar de peso: trabaja la zona media (core).'),
            exerciseData('estiramiento', 'Estiramiento', 'movilidad', reason: 'Disponible para tu nivel y equipo.'),
          ]});
        } else {
          server.on('GET', '/api/exercises/suggestions', (_, _) => FakeResponse(409, error('NO_APPROVED_RULES', 'Aún no hay reglas de recomendación aprobadas por el preparador físico.')));
        }
        server.on('POST', '/api/plans/start', (_, _) => FakeResponse(201, {'plan': {'id': 'pl-2', 'version': 1, 'sessionsScheduled': 8}}));
      });
      await goToRoutines(tester);
      await press(tester, find.byKey(const Key('build-routine')));
      await tester.pumpAndSettle();
      return server;
    }

    testWidgets('elige nombre, días y ejercicios sugeridos, ajusta las series y empieza al instante', (tester) async {
      final server = await openBuilder(tester);
      await tester.enterText(find.byKey(const Key('routine-name')), 'Mi rutina');
      await press(tester, find.byKey(const Key('day-2')));
      await press(tester, find.byKey(const Key('day-4')));
      await tester.pumpAndSettle();
      expect(find.text('Martes · Sesión 1'), findsOneWidget);
      expect(find.text('Jueves · Sesión 2'), findsOneWidget);

      await press(tester, find.byKey(const Key('add-2')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Sugeridos para bajar de peso'), findsOneWidget);
      expect(find.text('Sugerido para bajar de peso: trabaja el sistema cardiovascular.'), findsOneWidget);
      await pick(tester, 'caminata');
      expect(find.text('Sugerida: 2 series de 8 repeticiones'), findsOneWidget);

      await press(tester, find.byKey(const Key('edit-2-0')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('sets-field')), '3');
      await tester.enterText(find.byKey(const Key('amount-field')), '12');
      await tester.tap(find.byKey(const Key('save-prescription')));
      await tester.pumpAndSettle();
      expect(find.text('3 series de 12 repeticiones'), findsOneWidget);

      await press(tester, find.byKey(const Key('add-4')));
      await tester.pumpAndSettle();
      await pick(tester, 'plancha');
      await press(tester, find.byKey(const Key('start-custom')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/plans/start').single.body, {
        'source': 'propia', 'name': 'Mi rutina', 'days': [2, 4],
        'sessions': [
          {'exercises': [{'exerciseId': 'e-caminata', 'sets': 3, 'reps': 12}]},
          {'exercises': [{'exerciseId': 'e-plancha'}]},
        ],
      });
      expect(find.text('Tu rutina empezó. Tus sesiones ya están en tu agenda.'), findsOneWidget);
    });

    testWidgets('los segundos se envían como tales y «usar la sugerida» quita el ajuste', (tester) async {
      final server = await openBuilder(tester);
      await tester.enterText(find.byKey(const Key('routine-name')), 'Plancha diaria');
      await press(tester, find.byKey(const Key('day-1')));
      await press(tester, find.byKey(const Key('add-1')));
      await tester.pumpAndSettle();
      await pick(tester, 'plancha');
      await press(tester, find.byKey(const Key('edit-1-0')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('unit-seconds')));
      await tester.enterText(find.byKey(const Key('sets-field')), '2');
      await tester.enterText(find.byKey(const Key('amount-field')), '30');
      await tester.tap(find.byKey(const Key('save-prescription')));
      await tester.pumpAndSettle();
      expect(find.text('2 series de 30 segundos'), findsOneWidget);
      await press(tester, find.byKey(const Key('edit-1-0')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('use-default')));
      await tester.pumpAndSettle();
      expect(find.text('Sugerida: 2 series de 8 repeticiones'), findsOneWidget);
      await press(tester, find.byKey(const Key('edit-1-0')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('unit-seconds')));
      await tester.enterText(find.byKey(const Key('sets-field')), '4');
      await tester.enterText(find.byKey(const Key('amount-field')), '45');
      await tester.tap(find.byKey(const Key('save-prescription')));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('start-custom')));
      await tester.pumpAndSettle();
      expect(((server.calledTo('POST', '/api/plans/start').single.body!['sessions'] as List).single as Map)['exercises'], [{'exerciseId': 'e-plancha', 'sets': 4, 'seconds': 45}]);
    });

    testWidgets('limita las series y repeticiones a valores seguros antes de guardar el ajuste', (tester) async {
      await openBuilder(tester);
      await tester.enterText(find.byKey(const Key('routine-name')), 'X');
      await press(tester, find.byKey(const Key('day-1')));
      await press(tester, find.byKey(const Key('add-1')));
      await tester.pumpAndSettle();
      await pick(tester, 'caminata');
      await press(tester, find.byKey(const Key('edit-1-0')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('sets-field')), '9');
      await tester.enterText(find.byKey(const Key('amount-field')), '10');
      await tester.tap(find.byKey(const Key('save-prescription')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('edit-error')), findsOneWidget);
      expect(find.byKey(const Key('save-prescription')), findsOneWidget, reason: 'el diálogo sigue abierto hasta que los valores sean válidos');
    });

    testWidgets('pide nombre, al menos un día y un ejercicio por día antes de enviar', (tester) async {
      final server = await openBuilder(tester);
      await press(tester, find.byKey(const Key('start-custom')));
      await tester.pumpAndSettle();
      expect(find.text('Ponle un nombre a tu rutina.'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('routine-name')), 'Mi rutina');
      await press(tester, find.byKey(const Key('start-custom')));
      await tester.pumpAndSettle();
      expect(find.text('Elige al menos un día.'), findsOneWidget);
      await press(tester, find.byKey(const Key('day-2')));
      await press(tester, find.byKey(const Key('start-custom')));
      await tester.pumpAndSettle();
      expect(find.text('Agrega al menos un ejercicio a cada día.'), findsOneWidget);
      expect(server.calledTo('POST', '/api/plans/start'), isEmpty);
    });

    testWidgets('un ejercicio ya agregado a un día no se ofrece de nuevo y se puede quitar', (tester) async {
      await openBuilder(tester);
      await press(tester, find.byKey(const Key('day-2')));
      await press(tester, find.byKey(const Key('add-2')));
      await tester.pumpAndSettle();
      await pick(tester, 'caminata');
      await press(tester, find.byKey(const Key('add-2')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pick-caminata')), findsNothing);
      expect(find.byKey(const Key('pick-plancha')), findsOneWidget);
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('remove-2-0')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('item-2-0')), findsNothing);
    });

    testWidgets('sin reglas aprobadas el selector ofrece igualmente la biblioteca aprobada', (tester) async {
      await openBuilder(tester, suggestions: false);
      await press(tester, find.byKey(const Key('day-2')));
      await press(tester, find.byKey(const Key('add-2')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Sugeridos para'), findsNothing);
      expect(find.byKey(const Key('pick-caminata')), findsOneWidget);
    });
    testWidgets('nombra cada sesión, ordena los ejercicios y muestra el equilibrio de grupos de la semana', (tester) async {
      final server = await openBuilder(tester);
      await tester.enterText(find.byKey(const Key('routine-name')), 'Mi semana');
      await press(tester, find.byKey(const Key('day-1')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('day-rest-2')), findsOneWidget, reason: 'los días no elegidos son de descanso');
      await press(tester, find.byKey(const Key('add-1')));
      await tester.pumpAndSettle();
      await pick(tester, 'caminata');
      await press(tester, find.byKey(const Key('add-1')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('picker-search')), 'plan');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('pick-estiramiento')), findsNothing, reason: 'la búsqueda filtra por nombre');
      await pick(tester, 'plancha');
      expect(find.textContaining('Aún no incluyes ejercicios de piernas, empuje, tracción'), findsOneWidget);
      expect(find.text('Cardio: 1'), findsOneWidget);

      await press(tester, find.byKey(const Key('order-1-0')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Bajar'));
      await tester.pumpAndSettle();
      expect(find.descendant(of: find.byKey(const Key('item-1-0')), matching: find.text('Plancha')), findsOneWidget);

      await tester.enterText(find.byKey(const Key('session-label-1')), 'Cardio y core');
      await tester.pumpAndSettle();
      expect(find.text('Lunes · Cardio y core'), findsOneWidget);
      await press(tester, find.byKey(const Key('start-custom')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/plans/start').single.body, {
        'source': 'propia', 'name': 'Mi semana', 'days': [1],
        'sessions': [{'label': 'Cardio y core', 'exercises': [{'exerciseId': 'e-plancha'}, {'exerciseId': 'e-caminata'}]}],
      });
    });

  });

  group('Perfil (RF001, RF002)', () {
    Future<FakeServer> openProfile(WidgetTester tester, {bool fictitious = false, Map<String, dynamic>? existing, bool bodyConsent = false, bool nutritionConsent = false}) async {
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('user', fictitious: fictitious))
        ..get('/api/consents', {'policyVersion': 'politica-datos-2026-10-v1', 'consents': [
          {'purpose': 'recordatorios', 'granted': true}, {'purpose': 'seguimiento_progreso', 'granted': false},
          {'purpose': 'datos_corporales', 'granted': bodyConsent}, {'purpose': 'datos_nutricionales', 'granted': nutritionConsent},
        ]});
      planRoutes(server, profileData: existing);
      server.get('/api/profiles/me', {'profile': existing});
      await pumpApp(tester, server);
      await signIn(tester);
      await tester.tap(find.text('Perfil'));
      await tester.pumpAndSettle();
      return server;
    }

    testWidgets('valida edad adulta y días antes de guardar; no escribe nada si hay errores', (tester) async {
      final server = await openProfile(tester);
      await tester.enterText(find.byKey(const Key('age')), '17');
      await press(tester, find.byKey(const Key('save-profile')));
      await tester.pumpAndSettle();
      expect(find.textContaining('entre 18 y 120'), findsOneWidget);
      expect(find.byKey(const Key('days-error')), findsOneWidget);
      expect(server.calls.where((call) => call.method == 'PUT'), isEmpty);
    });

    testWidgets('guarda el perfil con los días ordenados y avisa que se creó una versión nueva', (tester) async {
      final server = await openProfile(tester);
      server.on('PUT', '/api/profiles/me', (_, _) => {'profile': profile()});
      await tester.enterText(find.byKey(const Key('age')), '30');
      await press(tester, find.byKey(const Key('day-5')));
      await press(tester, find.byKey(const Key('day-1')));
      await press(tester, find.byKey(const Key('duration-45')));
      await press(tester, find.byKey(const Key('save-profile')));
      await tester.pumpAndSettle();
      final body = server.calls.firstWhere((call) => call.method == 'PUT').body!;
      expect(body, {'age': 30, 'objective': 'bajar', 'level': 'principiante', 'days': [1, 5], 'durationMinutes': 45, 'equipment': 'sin_equipo'});
      expect(find.textContaining('Tu rutina actual no cambia'), findsOneWidget);
    });

    testWidgets('el sexo y la actividad se piden solo con su consentimiento específico, también en cuentas reales', (tester) async {
      final server = await openProfile(tester, bodyConsent: true);
      server.on('POST', '/api/consents', (_, _) => FakeResponse(201, {}));
      expect(find.byKey(const Key('weight')), findsOneWidget, reason: 'la estatura y el peso son datos normales del perfil');
      expect(find.byKey(const Key('sex')), findsNothing);
      await press(tester, find.byKey(const Key('consent-nutrition')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/consents').single.body, {'purpose': 'datos_nutricionales', 'granted': true, 'policyVersion': 'politica-datos-2026-10-v1'});
      await tester.scrollUntilVisible(find.byKey(const Key('activity')), 300, scrollable: find.byType(Scrollable).first);
      expect(find.byKey(const Key('sex')), findsOneWidget);
    });

    testWidgets('con los datos nutricionales se muestran el mantenimiento y las calorías de la pauta', (tester) async {
      final server = await openProfile(tester, existing: profile(nutrition: true), bodyConsent: true, nutritionConsent: true);
      server.get('/api/estimates/energy', {'estimate': {
        'formula': {'name': 'Mifflin-St Jeor', 'version': 1}, 'restingEnergyKcal': 1780, 'maintenanceKcal': 2759, 'targetKcal': 2200, 'objectiveLabel': 'déficit',
        'adjustments': 'Factor de actividad 1,55 y déficit (-20 %) según las reglas nutricionales aprobadas v1.', 'notice': 'Es una estimación de referencia: no sustituye una evaluación profesional.',
      }});
      await press(tester, find.byKey(const Key('estimate')));
      await tester.pumpAndSettle();
      expect(find.text('Gasto en reposo: 1780 kcal/día'), findsOneWidget);
      expect(find.text('Mantenimiento: 2.759 kcal/día'), findsOneWidget);
      expect(find.text('Tu pauta (déficit): 2.200 kcal/día'), findsOneWidget);
      expect(find.textContaining('no sustituye una evaluación profesional'), findsOneWidget);
    });

    testWidgets('revocar un consentimiento llama a la API con la versión de la política', (tester) async {
      final server = await openProfile(tester);
      server.on('POST', '/api/consents', (_, _) => FakeResponse(201, {}));
      await press(tester, find.byKey(const Key('consent-reminders')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/consents').single.body, {'purpose': 'recordatorios', 'granted': false, 'policyVersion': 'politica-datos-2026-10-v1'});
    });
  });

  group('Estatura y peso con consentimiento específico: IMC (RF001, RF009)', () {
    Future<FakeServer> openProfile(WidgetTester tester, {required bool granted, Map<String, dynamic>? existing}) async {
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('user'))
        ..get('/api/consents', {'policyVersion': 'politica-datos-2026-10-v1', 'consents': [{'purpose': 'datos_corporales', 'granted': granted}, {'purpose': 'recordatorios', 'granted': true}]});
      planRoutes(server, profileData: existing ?? profile());
      await pumpApp(tester, server);
      await signIn(tester);
      await tester.tap(find.text('Perfil'));
      await tester.pumpAndSettle();
      return server;
    }

    testWidgets('sin consentimiento no se piden la estatura ni el peso y se puede otorgar desde el perfil', (tester) async {
      final server = await openProfile(tester, granted: false);
      server.on('POST', '/api/consents', (_, _) => FakeResponse(201, {}));
      expect(find.byKey(const Key('weight')), findsNothing);
      await press(tester, find.byKey(const Key('consent-body-data')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/consents').single.body, {'purpose': 'datos_corporales', 'granted': true, 'policyVersion': 'politica-datos-2026-10-v1'});
      expect(find.byKey(const Key('weight')), findsOneWidget);
      expect(find.byKey(const Key('height')), findsOneWidget);
    });

    testWidgets('con consentimiento la estatura y el peso viajan en el perfil y se muestra el IMC calculado', (tester) async {
      final server = await openProfile(tester, granted: true, existing: profile(weight: 70, height: 175, bmi: 22.9, category: 'normal'));
      server.on('PUT', '/api/profiles/me', (_, _) => {'profile': profile(version: 2, weight: 65, height: 170, bmi: 22.5, category: 'normal')});
      expect(find.text('Tu IMC: 22,9 · peso normal. Es solo una referencia: no distingue músculo de grasa.'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('height')), '170');
      await tester.enterText(find.byKey(const Key('weight')), '65,5');
      await press(tester, find.byKey(const Key('save-profile')));
      await tester.pumpAndSettle();
      final body = server.calledTo('PUT', '/api/profiles/me').single.body!;
      expect([body['heightCm'], body['weightKg']], [170, 65.5]);
      expect(body.containsKey('sexParam'), isFalse);
      expect(find.textContaining('Tu rutina actual no cambia'), findsOneWidget);
    });

    testWidgets('la estatura y el peso van juntos y dentro de rangos humanos; si falla, no se escribe nada', (tester) async {
      final server = await openProfile(tester, granted: true);
      Future<void> saveAndGoUp() async {
        await press(tester, find.byKey(const Key('save-profile')));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(find.byKey(const Key('height')), -300, scrollable: find.byType(Scrollable).first);
      }
      await tester.enterText(find.byKey(const Key('age')), '30');
      await press(tester, find.byKey(const Key('day-1')));
      await tester.enterText(find.byKey(const Key('weight')), '70');
      await saveAndGoUp();
      expect(find.text('Entre 100 y 250 cm.'), findsOneWidget, reason: 'falta la estatura');
      await tester.enterText(find.byKey(const Key('height')), '90');
      await saveAndGoUp();
      expect(find.text('Entre 100 y 250 cm.'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('height')), '170');
      await tester.enterText(find.byKey(const Key('weight')), '20');
      await saveAndGoUp();
      expect(find.text('Entre 30 y 300 kg.'), findsOneWidget);
      expect(server.calls.where((call) => call.method == 'PUT'), isEmpty);
    });

    testWidgets('al revocar el consentimiento los campos se vacían y no se envían', (tester) async {
      final server = await openProfile(tester, granted: true, existing: profile(weight: 70, height: 175, bmi: 22.9, category: 'normal'));
      server.on('POST', '/api/consents', (_, _) => FakeResponse(201, {}));
      server.on('PUT', '/api/profiles/me', (_, _) => {'profile': profile(version: 2)});
      expect(find.byKey(const Key('weight')), findsOneWidget);
      await press(tester, find.byKey(const Key('consent-body-data')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/consents').single.body!['granted'], false);
      expect(find.byKey(const Key('weight')), findsNothing);
      await press(tester, find.byKey(const Key('save-profile')));
      await tester.pumpAndSettle();
      final body = server.calledTo('PUT', '/api/profiles/me').single.body!;
      expect(body.containsKey('weightKg') || body.containsKey('heightCm'), isFalse);
    });
  });

  group('Mis datos (RF009) y avisos (RF008)', () {
    testWidgets('solicitar un derecho muestra el comprobante y la solicitud queda listada', (tester) async {
      final requests = <Map<String, dynamic>>[];
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user'));
      planRoutes(server);
      server.on('GET', '/api/data-requests/me', (_, _) => {'requests': requests});
      server.on('POST', '/api/data-requests', (_, body) {
        final request = {'id': 'r-1', 'type': body!['type'], 'status': 'recibida', 'receiptCode': 'DR-20261102-ABC123', 'dueAt': '2026-12-02T15:00:00.000Z'};
        requests.add(request);
        return FakeResponse(201, {'request': request});
      });
      await pumpApp(tester, server);
      await signIn(tester);
      await tester.tap(find.text('Mis datos'));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('right-acceso')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/data-requests').single.body, {'type': 'acceso'});
      expect(find.textContaining('DR-20261102-ABC123'), findsWidgets);
    });

    testWidgets('la eliminación pide confirmación antes de enviar la solicitud', (tester) async {
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user'));
      planRoutes(server);
      server.get('/api/data-requests/me', {'requests': []});
      server.on('POST', '/api/data-requests', (_, body) => FakeResponse(201, {'request': {'id': 'r-2', 'type': 'eliminacion', 'receiptCode': 'DR-X', 'status': 'recibida', 'dueAt': '2026-12-02T15:00:00.000Z'}}));
      await pumpApp(tester, server);
      await signIn(tester);
      await tester.tap(find.text('Mis datos'));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('right-eliminacion')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/data-requests'), isEmpty);
      await press(tester, find.byKey(const Key('confirm-erase')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/data-requests').single.body, {'type': 'eliminacion'});
    });

    testWidgets('los avisos se listan y se marcan como leídos al tocarlos', (tester) async {
      var read = false;
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user'));
      planRoutes(server);
      server.on('GET', '/api/notifications/me', (_, _) => {'unread': read ? 0 : 1, 'notifications': [{'id': 'n-1', 'type': 'solicitud_derechos', 'message': 'Tu solicitud sobre datos personales fue resuelta.', 'createdAt': '2026-11-02T15:00:00.000Z', 'read': read}]});
      server.on('POST', '/api/notifications/n-1/read', (_, _) { read = true; return FakeResponse(204, null); });
      await pumpApp(tester, server);
      await signIn(tester);
      await tester.tap(find.byKey(const Key('open-notifications')));
      await tester.pumpAndSettle();
      expect(find.text('1 sin leer'), findsOneWidget);
      await tester.tap(find.text('Tu solicitud sobre datos personales fue resuelta.'));
      await tester.pumpAndSettle();
      expect(find.text('0 sin leer'), findsOneWidget);
    });
  });

  group('Catálogo del preparador físico: aprueba una vez, para todas las personas (RF005)', () {
    Map<String, dynamic> template(String id, String status, {String name = 'Bajar de peso · principiante · sin equipo · 60 a 80 kg'}) => {
      'id': id, 'code': 'demo-$id', 'version': status == 'draft' ? 2 : 1, 'name': name, 'summary': 'Demostración.', 'objective': 'bajar', 'level': 'principiante', 'equipment': 'sin_equipo',
      'bmiCategory': 'normal', 'split': 'full_body', 'sessionLabels': ['Cuerpo completo A'], 'minDays': 2, 'maxDays': 3, 'sessionMinutes': 30, 'weeks': 4, 'status': status,
    };

    Future<FakeServer> openCatalog(WidgetTester tester, {List<Map<String, dynamic>>? exercises, List<Map<String, dynamic>>? rules}) async {
      var templates = [template('t-2', 'approved', name: 'Mantener peso'), template('t-1', 'draft')];
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('trainer'))
        ..on('GET', '/api/catalog/templates', (_, _) => {'templates': templates})
        ..on('GET', '/api/catalog/templates/t-1', (_, _) => {'template': {
          ...templates.firstWhere((item) => item['id'] == 't-1'), 'sessions': [
            {'sessionNo': 1, 'label': 'Cuerpo completo A', 'exercises': [{'code': 'caminata', 'name': 'Caminata', 'prescription': '10 minutos', 'status': 'approved'}]},
          ],
        }})
        ..on('POST', '/api/catalog/templates/t-1/approve', (_, _) { templates = [template('t-2', 'approved', name: 'Mantener peso'), template('t-1', 'approved')]; return {'template': {'id': 't-1', 'status': 'approved'}}; })
        ..get('/api/catalog/exercises', {'exercises': exercises ?? [exerciseData('caminata', 'Caminata', 'cardio'), {...exerciseData('zancada', 'Zancada lateral', 'piernas'), 'status': 'draft'}]})
        ..get('/api/catalog/rules', {'rules': rules ?? [
          {'id': 'r-2', 'domain': 'entrenamiento', 'version': 2, 'status': 'draft', 'changeNote': 'Más movilidad al inicio'},
          {'id': 'r-1', 'domain': 'entrenamiento', 'version': 1, 'status': 'approved', 'changeNote': null},
          {'id': 'n-1', 'domain': 'nutricion', 'version': 1, 'status': 'approved', 'changeNote': null},
        ]});
      await pumpApp(tester, server);
      await signIn(tester, email: 'preparador@prueba.cl');
      return server;
    }

    testWidgets('lista primero las rutinas pendientes y permite revisarlas y aprobarlas', (tester) async {
      final server = await openCatalog(tester);
      expect(find.text('Catálogo'), findsOneWidget);
      expect(find.text('1 rutina espera tu aprobación.'), findsOneWidget);
      final draftPosition = tester.getTopLeft(find.byKey(const Key('template-t-1'))).dy;
      final approvedPosition = tester.getTopLeft(find.byKey(const Key('template-t-2'))).dy;
      expect(draftPosition, lessThan(approvedPosition), reason: 'los borradores van primero');
      await press(tester, find.byKey(const Key('template-t-1')));
      await tester.pumpAndSettle();
      expect(find.text('Caminata'), findsOneWidget);
      expect(find.text('10 minutos'), findsOneWidget);
      expect(find.text('Sesión 1 · Cuerpo completo A'), findsOneWidget);
      expect(find.textContaining('Full body · Principiante'), findsOneWidget);
      await press(tester, find.byKey(const Key('approve-template')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/catalog/templates/t-1/approve'), hasLength(1));
      expect(find.text('No hay rutinas pendientes de aprobación.'), findsOneWidget, reason: 'vuelve a la lista actualizada');
    });

    testWidgets('si falta aprobar un ejercicio de la rutina, informa el motivo y la rutina sigue en borrador', (tester) async {
      final server = await openCatalog(tester);
      server.on('POST', '/api/catalog/templates/t-1/approve', (_, _) => FakeResponse(409, error('EXERCISES_NOT_APPROVED', 'Aprueba antes estos ejercicios: zancada-lateral.')));
      await press(tester, find.byKey(const Key('template-t-1')));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('approve-template')));
      await tester.pumpAndSettle();
      expect(find.text('Aprueba antes estos ejercicios: zancada-lateral.'), findsOneWidget);
      expect(find.byKey(const Key('approve-template')), findsOneWidget);
    });

    testWidgets('ejercicios: aprueba un borrador y retira uno aprobado', (tester) async {
      final server = await openCatalog(tester);
      server.on('POST', '/api/catalog/exercises/e-zancada/approve', (_, _) => {'exercise': {'status': 'approved'}});
      server.on('POST', '/api/catalog/exercises/e-caminata/retire', (_, _) => {'exercise': {'status': 'retired'}});
      await tester.tap(find.text('Ejercicios'));
      await tester.pumpAndSettle();
      await press(tester, find.byKey(const Key('approve-exercise-e-zancada')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/catalog/exercises/e-zancada/approve'), hasLength(1));
      await press(tester, find.byKey(const Key('retire-exercise-e-caminata')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/catalog/exercises/e-caminata/retire'), hasLength(1));
    });

    testWidgets('ejercicios: crea un borrador con grupo, nivel e indicación sugerida', (tester) async {
      final server = await openCatalog(tester);
      server.on('POST', '/api/catalog/exercises', (_, _) => FakeResponse(201, {'exercise': {'id': 'x', 'status': 'draft'}}));
      await tester.tap(find.text('Ejercicios'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('new-exercise')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('exercise-name')), 'Puente de glúteos');
      await tester.enterText(find.byKey(const Key('exercise-code')), 'puente-de-gluteos');
      await tester.enterText(find.byKey(const Key('exercise-description')), 'Elevar la cadera desde el suelo.');
      await tester.enterText(find.byKey(const Key('exercise-prescription')), '2 series de 10 repeticiones');
      await tester.tap(find.byKey(const Key('save-exercise')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/catalog/exercises').single.body, {
        'code': 'puente-de-gluteos', 'name': 'Puente de glúteos', 'description': 'Elevar la cadera desde el suelo.',
        'muscleGroup': 'piernas', 'minLevel': 'principiante', 'requiresEquipment': false, 'highImpact': false, 'defaultPrescription': '2 series de 10 repeticiones',
      });
      expect(find.textContaining('Ejercicio guardado como borrador'), findsOneWidget);
    });

    testWidgets('reglas: muestra solo las de entrenamiento y aprueba una versión en borrador', (tester) async {
      final server = await openCatalog(tester);
      server.on('POST', '/api/catalog/rules/r-2/approve', (_, _) => {'rules': {'status': 'approved'}});
      await tester.tap(find.text('Reglas'));
      await tester.pumpAndSettle();
      expect(find.text('Reglas de entrenamiento · versión 2'), findsOneWidget);
      expect(find.text('Reglas de entrenamiento · versión 1'), findsOneWidget);
      expect(find.textContaining('nutricion'), findsNothing);
      await press(tester, find.byKey(const Key('approve-rules-r-2')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/catalog/rules/r-2/approve'), hasLength(1));
    });
  });

  group('Administración y otros roles', () {
    testWidgets('administración lista las solicitudes de derechos y las resuelve', (tester) async {
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('admin'))
        ..get('/api/admin/data-requests', {'requests': [{'id': 'r-1', 'type': 'acceso', 'receiptCode': 'DR-1', 'email': 'a@prueba.cl', 'dueAt': '2026-12-02T15:00:00.000Z', 'extensionApplied': false}]})
        ..on('POST', '/api/admin/data-requests/r-1/resolve', (_, _) => {'request': {}});
      await pumpApp(tester, server);
      await signIn(tester, email: 'admin@prueba.cl');
      expect(find.textContaining('acceso · DR-1'), findsOneWidget);
      await press(tester, find.byKey(const Key('actions-r-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Resolver'));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/admin/data-requests/r-1/resolve').single.body, {'outcome': 'resuelta'});
    });

    testWidgets('los indicadores muestran numerador y denominador, o «Sin mediciones»', (tester) async {
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('admin'))
        ..get('/api/admin/data-requests', {'requests': []})
        ..get('/api/admin/kpis', {'note': 'Cifras de la cohorte.', 'kpis': {
          'K1': {'numerator': 0, 'denominator': 0, 'value': null, 'description': 'Registros rápidos.'},
          'K2': {'numerator': 0, 'denominator': 0, 'value': null, 'description': 'Retención.'},
          'K3': {'numerator': 3, 'denominator': 4, 'value': 0.75, 'description': 'Adherencia.'},
          'K5': {'numerator': 2, 'denominator': 2, 'value': 1, 'description': 'Rutinas con contenido aprobado.'},
          'K6': {'description': 'Se mide con k6.'}, 'K7': {'description': 'Se mide con el sondeo.'},
        }});
      await pumpApp(tester, server);
      await signIn(tester, email: 'admin@prueba.cl');
      await tester.tap(find.text('Indicadores'));
      await tester.pumpAndSettle();
      expect(find.text('75 %  (3 de 4)'), findsOneWidget);
      expect(find.text('Sin mediciones'), findsNWidgets(2));
    });

  });

  group('Alimentación: pautas de 7 días según el objetivo y la dieta (RF005)', () {
    Future<FakeServer> openNutrition(WidgetTester tester, {Map<String, dynamic>? target, List<Map<String, dynamic>> notices = const [], int kcal = 2000}) async {
      final server = await signedIn(tester, (server) {
        planRoutes(server, profileData: profile());
        nutritionRoutes(server, target: target, notices: notices, kcal: kcal);
        server.get('/api/consents', {'policyVersion': 'politica-datos-2026-10-v1', 'consents': []});
      });
      await tester.tap(find.byIcon(Icons.restaurant_menu_outlined));
      await tester.pumpAndSettle();
      return server;
    }

    testWidgets('sin datos muestra porciones de referencia, las cuatro dietas e invita a completar el perfil', (tester) async {
      await openNutrition(tester, notices: [{'code': 'nutrition_data_missing', 'text': 'Para ajustar los gramos a tus calorías indica tu estatura, peso, sexo y nivel de actividad.'}]);
      expect(find.text('Alimentación'), findsWidgets);
      expect(find.text('Porciones de referencia: 2.000 kcal al día'), findsOneWidget);
      expect(find.textContaining('Tu objetivo es déficit'), findsOneWidget);
      expect(find.byKey(const Key('nutrition-notice-nutrition_data_missing')), findsOneWidget);
      for (final diet in ['mediterranea', 'alta_proteina', 'baja_carbohidratos', 'vegetariana']) {
        expect(find.byKey(Key('diet-$diet')), findsOneWidget);
      }
      await press(tester, find.byKey(const Key('go-profile-nutrition')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('age')), findsOneWidget, reason: 'lleva al perfil');
    });

    testWidgets('con datos muestra las calorías del objetivo y, por día, cada comida con gramos y medidas caseras', (tester) async {
      await openNutrition(tester, kcal: 2200, target: {'label': 'déficit', 'targetKcal': 2200, 'maintenanceKcal': 2759, 'activityFactor': 1.55, 'adjustmentPercent': -20, 'rulesVersion': 1, 'notices': []});
      expect(find.text('Déficit: 2.200 kcal al día'), findsOneWidget);
      expect(find.textContaining('Mantenimiento estimado: 2.759 kcal (Mifflin-St Jeor × 1,55) · -20 %'), findsOneWidget);
      expect(find.text('Proteínas 21 % · Carbohidratos 46 % · Grasas 33 % de la energía'), findsOneWidget);
      await press(tester, find.byKey(const Key('meal-day-1')));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.byKey(const Key('meal-item-almuerzo-pechuga-de-pollo')), 300, scrollable: find.byType(Scrollable).first);
      expect(find.text('150 g'), findsOneWidget);
      expect(find.text('130 g\n≈ ¾ taza'), findsOneWidget);
      expect(find.text('Lunes: 2.200 kcal · P 110 g · C 230 g · G 75 g'), findsOneWidget);
      await tester.scrollUntilVisible(find.byKey(const Key('meal-day-2')), -300, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.byKey(const Key('meal-day-2')));
      await tester.pumpAndSettle();
      expect(find.text('Martes: 2.210 kcal · P 110 g · C 230 g · G 75 g'), findsOneWidget);
      await tester.scrollUntilVisible(find.byKey(const Key('meal-item-almuerzo-merluza')), 300, scrollable: find.byType(Scrollable).first);
      expect(find.text('Merluza al horno'), findsOneWidget);
    });

    testWidgets('cambiar de dieta carga su pauta', (tester) async {
      final server = await openNutrition(tester);
      await press(tester, find.byKey(const Key('diet-vegetariana')));
      await tester.pumpAndSettle();
      expect(server.calledTo('GET', '/api/meal-plans/mp-vegetariana'), hasLength(1));
      expect(find.text('Resumen de la dieta vegetariana.'), findsOneWidget);
      await tester.tap(find.byKey(const Key('meal-day-1')));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.byKey(const Key('meal-item-almuerzo-lentejas')), 300, scrollable: find.byType(Scrollable).first);
      expect(find.text('250 g\n≈ 1¼ tazas'), findsOneWidget);
    });

    testWidgets('si falta un alimento lo cambia por un equivalente aprobado, en una comida o en toda la semana, y puede volver a la pauta original', (tester) async {
      final server = await openNutrition(tester);
      Map<String, dynamic> detail({required int swaps, List<Map<String, dynamic>>? lunch}) => {
        'plan': mealPlanSummary('mediterranea'), 'personalized': false, 'kcal': 2000, 'target': null, 'notices': [], 'disclaimer': 'x', 'swaps': swaps, 'changed': 2,
        'days': [mealDay(1, 'Lunes', lunch: lunch), mealDay(2, 'Martes', kcal: 2010, lunch: [mealItem('merluza', 'Merluza al horno', 120)])],
      };
      server
        ..on('GET', '/api/meal-plans/mp-mediterranea/alternatives', (request, _) => {
          'item': {'dayNo': 1, 'dayLabel': 'Lunes', 'meal': 'almuerzo', 'mealLabel': 'Almuerzo', 'position': int.parse(request.url.queryParameters['position']!), 'category': 'proteinas',
            'current': {'code': 'pechuga-de-pollo', 'name': 'Pechuga de pollo a la plancha', 'grams': 150, 'household': null, 'kcal': 248, 'protein': 47, 'carbs': 0, 'fat': 5}, 'original': null},
          'sameFoodCount': 2,
          'alternatives': [
            {'code': 'merluza', 'name': 'Merluza al horno', 'grams': 235, 'household': null, 'kcal': 247, 'protein': 54, 'carbs': 0, 'fat': 3, 'usual': true},
            {'code': 'huevo', 'name': 'Huevo', 'grams': 150, 'household': '≈ 3 unidades', 'kcal': 233, 'protein': 19, 'carbs': 2, 'fat': 16, 'usual': false},
          ],
        })
        ..on('PUT', '/api/meal-plans/mp-mediterranea/swaps', (_, _) => detail(swaps: 2, lunch: [
          {...mealItem('merluza', 'Merluza al horno', 235), 'swappedFrom': {'code': 'pechuga-de-pollo', 'name': 'Pechuga de pollo a la plancha'}},
          mealItem('arroz-blanco', 'Arroz blanco cocido', 130, household: '≈ ¾ taza'),
        ]))
        ..on('DELETE', '/api/meal-plans/mp-mediterranea/swaps', (_, _) => detail(swaps: 0));
      await press(tester, find.byKey(const Key('meal-day-1')));
      await tester.pumpAndSettle();
      expect(find.textContaining('¿No tienes un alimento?'), findsOneWidget);
      await reveal(tester, find.byKey(const Key('meal-swap-almuerzo-1')));
      await tester.tap(find.byKey(const Key('meal-swap-almuerzo-1')));
      await tester.pumpAndSettle();
      expect(find.text('Cambiar Pechuga de pollo a la plancha'), findsOneWidget);
      expect(find.textContaining('del grupo proteínas'), findsOneWidget);
      expect(find.textContaining('Habitual en esta comida · 235 g'), findsOneWidget);
      expect(find.textContaining('150 g (≈ 3 unidades)'), findsOneWidget);
      await tester.tap(find.byKey(const Key('swap-whole-week')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('swap-option-merluza')));
      await tester.pumpAndSettle();
      expect(server.calledTo('PUT', '/api/meal-plans/mp-mediterranea/swaps').single.body, {'dayNo': 1, 'meal': 'almuerzo', 'position': 1, 'food': 'merluza', 'wholeWeek': true});
      expect(find.text('Merluza al horno en vez de pechuga de pollo a la plancha en 2 comidas.'), findsOneWidget);
      expect(find.byKey(const Key('swap-sheet')), findsNothing, reason: 'la hoja se cierra');
      await reveal(tester, find.byKey(const Key('meal-swapped-almuerzo-1')));
      expect(find.text('En vez de pechuga de pollo a la plancha'), findsOneWidget);
      await reveal(tester, find.byKey(const Key('undo-swaps')));
      expect(find.text('Cambiaste 2 alimentos de esta pauta.'), findsOneWidget);
      await tester.tap(find.byKey(const Key('undo-swaps')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('confirm-undo-swaps')));
      await tester.pumpAndSettle();
      expect(server.calledTo('DELETE', '/api/meal-plans/mp-mediterranea/swaps'), hasLength(1));
      expect(find.byKey(const Key('meal-swapped-almuerzo-1')), findsNothing);
      expect(find.byKey(const Key('undo-swaps')), findsNothing);
      expect(find.text('Volviste a la pauta original.'), findsOneWidget);
    });
  });

  group('Catálogo de la nutricionista: aprueba una vez, para todas las personas (RF005)', () {
    Future<FakeServer> openNutritionCatalog(WidgetTester tester) async {
      var status = 'draft';
      Map<String, dynamic> plan() => {...mealPlanSummary('mediterranea'), 'version': 2, 'name': 'Mediterránea', 'status': status};
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('nutritionist'))
        ..on('GET', '/api/catalog/meal-plans', (_, _) => {'mealPlans': [plan(), {...mealPlanSummary('vegetariana'), 'name': 'Vegetariana'}]})
        ..on('GET', '/api/catalog/meal-plans/mp-mediterranea', (_, _) => {'mealPlan': {
          ...plan(), 'pendingFoods': status == 'draft' ? ['mote'] : <String>[], 'weekAverage': {'kcal': 2000, 'percent': {'protein': 21, 'carbs': 46, 'fat': 33}},
          'days': [mealDay(1, 'Lunes')],
        }})
        ..on('POST', '/api/catalog/meal-plans/mp-mediterranea/approve', (_, _) { status = 'approved'; return {'mealPlan': {'id': 'mp-mediterranea', 'status': 'approved'}}; })
        ..get('/api/catalog/foods', {'foods': [
          {'id': 'f-1', 'code': 'mote', 'name': 'Mote de trigo cocido', 'category': 'cereales', 'kcal100g': 110, 'protein100g': 3.5, 'carbs100g': 23, 'fat100g': 0.6, 'unitName': 'taza', 'unitGrams': 160, 'status': 'draft'},
          {'id': 'f-2', 'code': 'arroz-blanco', 'name': 'Arroz blanco cocido', 'category': 'cereales', 'kcal100g': 130, 'protein100g': 2.7, 'carbs100g': 28.2, 'fat100g': 0.3, 'unitName': null, 'unitGrams': null, 'status': 'approved'},
        ]})
        ..get('/api/catalog/rules', {'rules': [
          {'id': 'n-1', 'domain': 'nutricion', 'version': 1, 'status': 'approved', 'changeNote': 'Reglas nutricionales de demostración'},
          {'id': 'r-1', 'domain': 'entrenamiento', 'version': 1, 'status': 'approved', 'changeNote': null},
        ]});
      await pumpApp(tester, server);
      await signIn(tester, email: 'nutricionista@prueba.cl');
      return server;
    }

    testWidgets('revisa una pauta en borrador, ve los alimentos pendientes y la aprueba', (tester) async {
      final server = await openNutritionCatalog(tester);
      expect(find.text('Catálogo nutricional'), findsOneWidget);
      expect(find.text('1 pauta espera tu aprobación.'), findsOneWidget);
      await press(tester, find.byKey(const Key('meal-plan-mp-mediterranea')));
      await tester.pumpAndSettle();
      expect(find.text('Alimentos sin aprobar: mote'), findsOneWidget);
      expect(find.textContaining('proteínas 21 %, carbohidratos 46 %, grasas 33 %'), findsOneWidget);
      await tester.tap(find.byKey(const Key('review-day-1')));
      await tester.pumpAndSettle();
      expect(find.text('Pechuga de pollo a la plancha: 150 g'), findsOneWidget);
      await press(tester, find.byKey(const Key('approve-meal-plan')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/catalog/meal-plans/mp-mediterranea/approve'), hasLength(1));
      expect(find.text('No hay pautas pendientes de aprobación.'), findsOneWidget);
    });

    testWidgets('los alimentos muestran su composición por 100 g y se aprueban; las reglas son solo las nutricionales', (tester) async {
      final server = await openNutritionCatalog(tester);
      server.on('POST', '/api/catalog/foods/f-1/approve', (_, _) => {'food': {'id': 'f-1', 'status': 'approved'}});
      await tester.tap(find.text('Alimentos'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Cereales y tubérculos · por 100 g: 110 kcal · P 3,5 · C 23 · G 0,6'), findsOneWidget);
      expect(find.textContaining('1 taza = 160 g'), findsOneWidget);
      await tester.tap(find.byKey(const Key('approve-food-f-1')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/catalog/foods/f-1/approve'), hasLength(1));
      await tester.tap(find.text('Reglas'));
      await tester.pumpAndSettle();
      expect(find.text('Reglas nutricionales · versión 1'), findsOneWidget);
      expect(find.textContaining('Reglas de entrenamiento'), findsNothing);
    });

    testWidgets('crea un alimento en borrador con su composición y medida casera', (tester) async {
      final server = await openNutritionCatalog(tester);
      server.on('POST', '/api/catalog/foods', (_, _) => FakeResponse(201, {'food': {'id': 'f-3', 'status': 'draft'}}));
      await tester.tap(find.text('Alimentos'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('new-food')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('food-name')), 'Porotos granados');
      await tester.enterText(find.byKey(const Key('food-code')), 'porotos-granados');
      await tester.enterText(find.byKey(const Key('food-kcal')), '120');
      await tester.enterText(find.byKey(const Key('food-protein')), '7,5');
      await tester.enterText(find.byKey(const Key('food-carbs')), '21');
      await tester.enterText(find.byKey(const Key('food-fat')), '0,8');
      await tester.enterText(find.byKey(const Key('food-unit-name')), 'taza');
      await tester.enterText(find.byKey(const Key('food-unit-grams')), '200');
      await tester.tap(find.byKey(const Key('save-food')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/catalog/foods').single.body, {
        'code': 'porotos-granados', 'name': 'Porotos granados', 'category': 'cereales', 'kcal100g': 120.0, 'protein100g': 7.5, 'carbs100g': 21.0, 'fat100g': 0.8, 'unitName': 'taza', 'unitGrams': 200.0,
      });
      expect(find.textContaining('Alimento guardado como borrador'), findsOneWidget);
    });
  });

  group('Horario y recuperación (cálculos de la interfaz)', () {
    test('cuenta las series de cada indicación para el modo sesión', () {
      expect(setsIn('2 series de 8 repeticiones'), 2);
      expect(setsIn('3 series de 20 segundos'), 3);
      expect(setsIn('1 serie de 1 repetición'), 1);
      expect(setsIn('2 repeticiones de 30 segundos por pierna'), 2);
      expect(setsIn('10 minutos a ritmo cómodo'), 1);
      expect(setsIn('5 repeticiones hacia cada lado'), 1);
    });

    test('los días por defecto respetan el perfil y completan con días separados', () {
      expect(defaultDays(const [1, 3, 5], 2, 3), [1, 3, 5]);
      expect(defaultDays(const [1, 2, 3, 4, 5, 6], 4, 4), [1, 2, 3, 4]);
      expect(defaultDays(const [2], 3, 6), [1, 2, 3]);
      expect(defaultDays(null, 2, 3), [1, 3]);
    });

    test('avisa del mismo grupo de fuerza en días seguidos (también de domingo a lunes) y de una semana sin descanso', () {
      expect(recoveryWarnings({1: {'piernas'}, 3: {'piernas'}}), isEmpty);
      expect(recoveryWarnings({1: {'piernas', 'core'}, 2: {'empuje', 'core'}}), isEmpty, reason: 'la zona media no exige un día entre sesiones');
      expect(recoveryWarnings({1: {'piernas'}, 2: {'piernas', 'empuje'}}).single, contains('Lunes y martes trabajas piernas'));
      expect(recoveryWarnings({7: {'traccion'}, 1: {'traccion'}}).single, contains('Domingo y lunes trabajas tracción'));
      final everyDay = recoveryWarnings({for (var day = 1; day <= 7; day++) day: {'cardio'}});
      expect(everyDay.single, contains('No tienes días de descanso'));
    });
  });

  group('Cliente de la API', () {
    test('ante un 401 renueva la sesión y reintenta la petición con el token nuevo', () async {
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('user', access: 'viejo', refresh: 'refresh-viejo'))
        ..on('GET', '/api/profiles/me', (request, _) => request.headers['Authorization'] == 'Bearer nuevo' ? {'profile': null} : FakeResponse(401, error('UNAUTHORIZED', 'expiró')))
        ..on('POST', '/api/auth/refresh', (_, _) => session('user', access: 'nuevo', refresh: 'refresh-nuevo'));
      final tokens = MemoryTokenStore();
      final api = server.api(tokens: tokens);
      await api.login('a@b.cl', 'clave');
      final results = await Future.wait([api.get('/api/profiles/me'), api.get('/api/profiles/me')]);
      expect(results, hasLength(2));
      expect(tokens.refresh, 'refresh-nuevo');
      expect(server.calledTo('POST', '/api/auth/refresh'), isNotEmpty);
    });

    test('si la renovación falla se olvidan los tokens y se avisa que la sesión expiró', () async {
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('user'))
        ..on('GET', '/api/profiles/me', (_, _) => FakeResponse(401, error('UNAUTHORIZED', 'expiró')))
        ..on('POST', '/api/auth/refresh', (_, _) => FakeResponse(401, error('UNAUTHORIZED', 'expiró')));
      final tokens = MemoryTokenStore();
      final api = server.api(tokens: tokens);
      var expired = false;
      api.onSessionExpired = () => expired = true;
      await api.login('a@b.cl', 'clave');
      await expectLater(api.get('/api/profiles/me'), throwsA(isA<ApiException>()));
      expect(expired, isTrue);
      expect(tokens.refresh, isNull);
      expect(api.user, isNull);
    });

    test('un fallo de red se informa como tal y no finge que algo se guardó', () async {
      final api = ApiClient(baseUrl: 'http://test', client: MockClient((_) async => throw ClientException('sin red')), tokens: MemoryTokenStore());
      final failure = await api.put('/api/profiles/me', {'age': 30}).then<ApiException?>((_) => null, onError: (Object e) => e as ApiException);
      expect(failure, isNotNull);
      expect(failure!.isNetwork, isTrue);
      expect(failure.message, contains('No hay conexión'));
    });
  });

  testWidgets('a 360 px de ancho la rutina del participante no desborda', (tester) async {
    final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user'));
    planRoutes(
      server,
      plan: planData(),
      profileData: profile(version: 2),
      sessions: [{'id': 's-1', 'label': 'Lunes · Sesión 1', 'plannedDate': '2026-11-09', 'completed': false, 'planStatus': 'vigente'}],
      progress: progressData(adherence: 0, planned: 1, streak: streakData(current: 12, best: 30, today: 'pendiente', freeze: false), weeks: [{'weekStart': '2026-11-09', 'planned': 1, 'completed': 0}]),
      schedule: weekData(plan: true, fallback: 'descanso', previousWeek: '2026-11-02', nextWeek: '2026-11-16', days: {
        1: ('comodin', sessionOfDay('s-1', 'Empuje: pecho, hombros y tríceps', canRegister: true)),
        2: ('pendiente', sessionOfDay('s-2', 'Tracción: espalda y bíceps', canRegister: true)),
      }),
    );
    routinesRoutes(server, routines: [routineData(), routineData(id: 't-2', fits: false)], exercises: [exerciseData('caminata', 'Caminata', 'cardio')], profileData: profile(version: 2));
    server.get('/api/routines/t-1', {'routine': {...routineData(), 'sessions': [
      {'sessionNo': 1, 'label': 'Cuerpo completo A', 'exercises': [{'id': 'e-caminata', 'code': 'caminata', 'name': 'Caminata', 'description': 'x', 'muscleGroup': 'cardio', 'requiresEquipment': false, 'prescription': '10 minutos a ritmo cómodo', 'defaultPrescription': '10 minutos a ritmo cómodo'}]},
    ]}});
    await pumpApp(tester, server, size: const Size(360, 780));
    await signIn(tester);
    expect(tester.takeException(), isNull);
    expect(find.byKey(const Key('streak-card')), findsOneWidget);
    await press(tester, find.byKey(const Key('start-session')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('set-0-0')));
    await tester.pump();
    expect(tester.takeException(), isNull, reason: 'el modo sesión con el temporizador cabe en 360 px');
    await tester.tap(find.byKey(const Key('rest-skip')));
    await tester.pumpAndSettle();
    await tester.pageBack();
    await tester.pumpAndSettle();
    await reveal(tester, find.text('Rutina aprobada por un profesional · versión 1'));
    expect(tester.takeException(), isNull);
    await goToRoutines(tester);
    expect(tester.takeException(), isNull);
    expect(find.byKey(const Key('routine-t-1')), findsOneWidget);
    await press(tester, find.byKey(const Key('routine-t-1')));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'el detalle con la semana y sus descansos cabe en 360 px');
    await tester.pageBack();
    await tester.pumpAndSettle();
    nutritionRoutes(server, target: {'label': 'superávit', 'targetKcal': 3050, 'maintenanceKcal': 2759, 'activityFactor': 1.55, 'adjustmentPercent': 10, 'rulesVersion': 1, 'notices': []}, kcal: 3050);
    await tester.tap(find.byIcon(Icons.restaurant_menu_outlined));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Superávit: 3.050 kcal al día'), findsOneWidget);
  });
}
