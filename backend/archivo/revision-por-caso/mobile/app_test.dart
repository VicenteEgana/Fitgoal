import 'package:fitgoal/api/api_client.dart';
import 'package:fitgoal/api/token_store.dart';
import 'package:fitgoal/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' show ClientException;
import 'package:http/testing.dart';

import 'fake_server.dart';

Map<String, dynamic> profile({int version = 1, bool nutrition = false}) => {
  'id': 'p-1', 'version': version, 'age': 30, 'objective': 'bajar', 'level': 'principiante', 'days': [1, 3, 5],
  'durationMinutes': 30, 'equipment': 'sin_equipo', 'sexParam': nutrition ? 'masculino' : null, 'weightKg': nutrition ? 80 : null,
  'heightCm': nutrition ? 180 : null, 'activityLevel': nutrition ? 'moderado' : null, 'isFictitious': nutrition,
};

Map<String, dynamic> planContent() => {
  'title': 'Bajar de peso · [Demo] plantilla', 'notice': 'Borrador generado por el sistema.',
  'schedule': [
    {'day': 1, 'dayLabel': 'Lunes', 'sessionNo': 1, 'label': 'Sesión 1', 'exercises': [
      {'code': 'sentarse-y-levantarse', 'name': 'Sentarse y levantarse', 'description': 'Ejemplo general.', 'prescription': '2 series de 8'},
    ]},
    {'day': 3, 'dayLabel': 'Miércoles', 'sessionNo': 2, 'label': 'Sesión 2', 'exercises': [
      {'code': 'caminata', 'name': 'Caminata', 'description': 'Actividad cotidiana.', 'prescription': '10 minutos'},
    ]},
  ],
};

/// Rutas que usa la pestaña «Plan» del participante.
void planRoutes(FakeServer server, {Object? request, Object? plan, List<Object> sessions = const [], Object? profileData, Map<String, dynamic>? progress}) {
  server.get('/api/drafts/me/status', {'request': request});
  server.get('/api/plans/me', {'plan': plan});
  server.get('/api/sessions/me', {'today': '2026-11-10', 'sessions': sessions});
  server.get('/api/progress/me', progress ?? {'today': '2026-11-10', 'planned': 0, 'completed': 0, 'adherence': null, 'weeks': [], 'weightsEnabled': false, 'weights': []});
  server.get('/api/profiles/me', {'profile': profileData});
}

Future<void> pumpApp(WidgetTester tester, FakeServer server, {TokenStore? tokens, Size size = const Size(420, 900)}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(FitGoalApp(api: server.api(tokens: tokens)));
  await tester.pumpAndSettle();
}

/// Desplaza hasta el elemento y lo toca, como lo haría una persona con la pantalla.
Future<void> press(WidgetTester tester, Finder finder) async {
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

void main() {
  group('Acceso y registro (RF001, RF009)', () {
    testWidgets('inicia sesión y muestra el plan del participante', (tester) async {
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user'));
      planRoutes(server);
      await pumpApp(tester, server);
      expect(find.byKey(const Key('submit')), findsOneWidget);
      await signIn(tester);
      expect(find.text('Mi plan'), findsOneWidget);
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
      expect(find.text('Mi plan'), findsOneWidget);
      expect(server.calledTo('POST', '/api/auth/login'), hasLength(1));
    });

    testWidgets('muestra el error de la API sin guardar nada si las credenciales son inválidas', (tester) async {
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => FakeResponse(401, error('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.')));
      await pumpApp(tester, server);
      await signIn(tester);
      expect(find.text('Correo o contraseña incorrectos.'), findsOneWidget);
      expect(find.text('Mi plan'), findsNothing);
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
      await press(tester, find.byKey(const Key('consent-reminders')));
      await press(tester, find.byKey(const Key('submit')));
      await tester.pumpAndSettle();
      final body = server.calledTo('POST', '/api/auth/register').single.body!;
      expect(body['policyVersion'], 'politica-datos-2026-10-v1');
      expect(body['consents'], {'registro_cuenta': true, 'perfil_entrenamiento': true, 'recordatorios': true});
      expect(body['intentId'], hasLength(36));
      expect(find.text('Mi plan'), findsOneWidget);
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
      expect(find.text('Mi plan'), findsOneWidget);
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
  });

  group('Plan, sesiones y progreso del participante (RF004, RF006, RF007)', () {
    Future<FakeServer> signedIn(WidgetTester tester, void Function(FakeServer) setup, {bool fictitious = false}) async {
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user', fictitious: fictitious));
      setup(server);
      await pumpApp(tester, server);
      await signIn(tester);
      return server;
    }

    testWidgets('sin perfil invita a completarlo y no ofrece solicitar la rutina', (tester) async {
      await signedIn(tester, planRoutes);
      expect(find.text('Aún no tienes un plan aprobado.'), findsOneWidget);
      expect(find.byKey(const Key('go-profile')), findsOneWidget);
      expect(find.byKey(const Key('request-routine')), findsNothing);
    });

    testWidgets('solicitar la rutina envía la solicitud y muestra solo el estado, nunca el contenido del borrador', (tester) async {
      var request = false;
      final server = await signedIn(tester, (server) {
        planRoutes(server, profileData: profile());
        server.on('GET', '/api/drafts/me/status', (_, _) => {'request': request ? {'id': 'd-1', 'status': 'borrador', 'message': 'En revisión: un profesional revisará tu rutina', 'profileVersion': 1} : null});
        server.on('POST', '/api/drafts', (_, _) { request = true; return FakeResponse(201, {'draft': {'id': 'd-1', 'status': 'borrador'}}); });
      });
      expect(find.byKey(const Key('request-routine')), findsOneWidget);
      await press(tester, find.byKey(const Key('request-routine')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/drafts').single.body, {'kind': 'rutina'});
      expect(find.byKey(const Key('request-message')), findsOneWidget);
      expect(find.textContaining('En revisión'), findsWidgets);
      expect(find.byKey(const Key('request-routine')), findsNothing);
      expect(find.text('Aún no tienes un plan aprobado.'), findsOneWidget);
      expect(find.text('Sentarse y levantarse'), findsNothing);
    });

    testWidgets('muestra el plan aprobado con sus ejercicios y permite registrar una sesión vencida', (tester) async {
      final server = await signedIn(tester, (server) {
        planRoutes(
          server,
          request: {'id': 'd-1', 'status': 'aprobado', 'message': 'Aprobada: ya puedes consultar tu plan', 'profileVersion': 1},
          plan: {'id': 'pl-1', 'version': 1, 'content': planContent()},
          profileData: profile(),
          sessions: [
            {'id': 's-1', 'label': 'Lunes · Sesión 1', 'plannedDate': '2026-11-09', 'completed': false, 'planStatus': 'vigente'},
            {'id': 's-2', 'label': 'Miércoles · Sesión 2', 'plannedDate': '2026-11-11', 'completed': false, 'planStatus': 'vigente'},
          ],
          progress: {'today': '2026-11-10', 'planned': 1, 'completed': 0, 'adherence': 0.0, 'weeks': [{'weekStart': '2026-11-09', 'planned': 1, 'completed': 0}], 'weightsEnabled': false, 'weights': []},
        );
        server.on('POST', '/api/sessions/s-1/complete', (_, _) => {'session': {'id': 's-1'}, 'weightRejected': null});
      });
      expect(find.text('Aprobado por un profesional'), findsOneWidget);
      expect(find.text('Versión 1'), findsOneWidget);
      expect(find.byKey(const Key('complete-s-1')), findsOneWidget);
      expect(find.byKey(const Key('complete-s-2')), findsNothing, reason: 'una sesión futura no se registra');
      expect(find.byKey(const Key('request-routine')), findsNothing, reason: 'el plan vigente corresponde a la versión actual del perfil');
      await press(tester, find.byKey(const Key('complete-s-1')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('session-note')), 'Sin molestias');
      await press(tester, find.byKey(const Key('session-save')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/sessions/s-1/complete').single.body, {'note': 'Sin molestias'});
      await tester.scrollUntilVisible(find.byKey(const Key('adherence')), 300, scrollable: find.byType(Scrollable).first);
      expect(find.text('Adherencia: 0 %'), findsOneWidget);
    });

    testWidgets('si el perfil cambió después de la aprobación ofrece solicitar una rutina nueva', (tester) async {
      await signedIn(tester, (server) => planRoutes(
        server,
        request: {'id': 'd-1', 'status': 'aprobado', 'message': 'Aprobada', 'profileVersion': 1},
        plan: {'id': 'pl-1', 'version': 1, 'content': planContent()},
        profileData: profile(version: 2),
      ));
      expect(find.byKey(const Key('request-routine')), findsOneWidget);
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
      expect(find.text('Aún no tienes un plan aprobado.'), findsOneWidget);
    });
  });

  group('Perfil (RF001, RF002)', () {
    Future<FakeServer> openProfile(WidgetTester tester, {bool fictitious = false, Map<String, dynamic>? existing}) async {
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('user', fictitious: fictitious))
        ..get('/api/consents', {'policyVersion': 'politica-datos-2026-10-v1', 'consents': [{'purpose': 'recordatorios', 'granted': true}, {'purpose': 'seguimiento_progreso', 'granted': false}]});
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
      server.on('PUT', '/api/profiles/me', (_, _) => {'profile': profile(), 'draftsSuperseded': 1});
      await tester.enterText(find.byKey(const Key('age')), '30');
      await press(tester, find.byKey(const Key('day-5')));
      await press(tester, find.byKey(const Key('day-1')));
      await press(tester, find.byKey(const Key('duration-45')));
      await press(tester, find.byKey(const Key('save-profile')));
      await tester.pumpAndSettle();
      final body = server.calls.firstWhere((call) => call.method == 'PUT').body!;
      expect(body, {'age': 30, 'objective': 'bajar', 'level': 'principiante', 'days': [1, 5], 'durationMinutes': 45, 'equipment': 'sin_equipo'});
      expect(find.textContaining('Tu solicitud anterior quedó reemplazada'), findsOneWidget);
    });

    testWidgets('los datos de la estimación energética solo aparecen en cuentas ficticias', (tester) async {
      await openProfile(tester);
      expect(find.byKey(const Key('weight')), findsNothing);
      expect(find.byKey(const Key('sex')), findsNothing);
    });

    testWidgets('en una cuenta ficticia se pide el conjunto completo y se muestra la estimación con su aviso', (tester) async {
      final server = await openProfile(tester, fictitious: true, existing: profile(nutrition: true));
      expect(find.byKey(const Key('weight')), findsOneWidget);
      server.get('/api/estimates/energy', {'estimate': {
        'formula': {'name': 'Mifflin-St Jeor', 'version': 1}, 'restingEnergyKcal': 1780, 'maintenanceKcal': null,
        'adjustments': 'Bloqueado: requiere reglas aprobadas por una nutricionista.', 'notice': 'No sustituye una evaluación profesional.',
      }});
      await tester.ensureVisible(find.byKey(const Key('estimate')));
      await press(tester, find.byKey(const Key('estimate')));
      await tester.pumpAndSettle();
      expect(find.text('Gasto en reposo: 1780 kcal/día'), findsOneWidget);
      expect(find.textContaining('No sustituye una evaluación profesional'), findsOneWidget);
    });

    testWidgets('revocar un consentimiento llama a la API con la versión de la política', (tester) async {
      final server = await openProfile(tester);
      server.on('POST', '/api/consents', (_, _) => FakeResponse(201, {}));
      await tester.ensureVisible(find.byKey(const Key('consent-reminders')));
      await press(tester, find.byKey(const Key('consent-reminders')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/consents').single.body, {'purpose': 'recordatorios', 'granted': false, 'policyVersion': 'politica-datos-2026-10-v1'});
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
      server.on('GET', '/api/notifications/me', (_, _) => {'unread': read ? 0 : 1, 'notifications': [{'id': 'n-1', 'type': 'plan_publicado', 'message': 'Tu rutina fue aprobada. Ya puedes consultarla.', 'createdAt': '2026-11-02T15:00:00.000Z', 'read': read}]});
      server.on('POST', '/api/notifications/n-1/read', (_, _) { read = true; return FakeResponse(204, null); });
      await pumpApp(tester, server);
      await signIn(tester);
      await tester.tap(find.text('Avisos'));
      await tester.pumpAndSettle();
      expect(find.text('1 sin leer'), findsOneWidget);
      await tester.tap(find.text('Tu rutina fue aprobada. Ya puedes consultarla.'));
      await tester.pumpAndSettle();
      expect(find.text('0 sin leer'), findsOneWidget);
    });
  });

  group('Revisión profesional del preparador físico (RF006)', () {
    Map<String, dynamic> draft() => {
      'id': 'd-1', 'kind': 'rutina', 'version': 1, 'status': 'en_revision',
      'participant': {'label': 'Participante abc12345', 'objective': 'bajar', 'level': 'principiante', 'equipment': 'sin_equipo', 'days': [1, 3], 'durationMinutes': 30, 'age': 30},
      'content': planContent(),
      'selectionReasons': [{'criterio': 'objetivo', 'valor': 'bajar'}, {'criterio': 'plantilla', 'valor': 'demo v1', 'resultado': 'seleccionada'}],
      'template': {'code': 'demo', 'version': 1, 'name': '[Demo] plantilla', 'allowedAdjustments': {'exerciseChanges': false}},
    };

    Future<FakeServer> openReview(WidgetTester tester) async {
      var queue = [{'id': 'd-1', 'status': 'borrador', 'participant': draft()['participant']}];
      final server = FakeServer()
        ..on('POST', '/api/auth/login', (_, _) => session('trainer'))
        ..on('GET', '/api/reviews/queue', (_, _) => {'queue': queue})
        ..on('POST', '/api/reviews/d-1/claim', (_, _) => {'draft': {'id': 'd-1', 'status': 'en_revision'}})
        ..on('GET', '/api/reviews/d-1', (_, _) => {'draft': draft()})
        ..on('POST', '/api/reviews/d-1/decision', (_, _) { queue = []; return {'result': {'status': 'aprobado'}}; });
      await pumpApp(tester, server);
      await signIn(tester, email: 'preparador@prueba.cl');
      expect(find.text('Casos para revisar'), findsOneWidget);
      await press(tester, find.byKey(const Key('case-d-1')));
      await tester.pumpAndSettle();
      return server;
    }

    testWidgets('la cola lista los casos asignados y al abrir uno se toma el caso y se explica la selección', (tester) async {
      final server = await openReview(tester);
      expect(server.calledTo('POST', '/api/reviews/d-1/claim'), hasLength(1));
      expect(find.text('Participante abc12345'), findsOneWidget);
      expect(find.textContaining('plantilla: demo v1 → seleccionada'), findsOneWidget);
      expect(find.text('Aprobar'), findsOneWidget);
    });

    testWidgets('aprobar sin cambios envía solo la decisión', (tester) async {
      final server = await openReview(tester);
      await press(tester, find.byKey(const Key('approve')));
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/reviews/d-1/decision').single.body, {'decision': 'aprobado'});
      expect(find.byKey(const Key('empty-queue')), findsOneWidget, reason: 'vuelve a la cola, ya sin el caso');
    });

    testWidgets('corregir una indicación cambia el botón y envía el contenido corregido', (tester) async {
      final server = await openReview(tester);
      await tester.enterText(find.byKey(const Key('prescription-0-0')), '3 series de 6');
      await tester.pump();
      expect(find.text('Aprobar con correcciones'), findsOneWidget);
      await press(tester, find.byKey(const Key('approve')));
      await tester.pumpAndSettle();
      final body = server.calledTo('POST', '/api/reviews/d-1/decision').single.body!;
      expect(body['decision'], 'aprobado');
      final corrected = body['correctedContent'] as Map<String, dynamic>;
      expect((((corrected['schedule'] as List).first as Map)['exercises'] as List).first['prescription'], '3 series de 6');
      expect((((corrected['schedule'] as List).last as Map)['exercises'] as List).first['prescription'], '10 minutos');
    });

    testWidgets('rechazar exige el motivo y lo envía a la API', (tester) async {
      final server = await openReview(tester);
      await press(tester, find.byKey(const Key('reject')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Rechazar').last);
      await tester.pumpAndSettle();
      expect(find.text('Este campo es obligatorio.'), findsOneWidget);
      expect(server.calledTo('POST', '/api/reviews/d-1/decision'), isEmpty);
      await tester.enterText(find.byKey(const Key('ask-text')), 'Falta evaluar una molestia.');
      await tester.tap(find.text('Rechazar').last);
      await tester.pumpAndSettle();
      expect(server.calledTo('POST', '/api/reviews/d-1/decision').single.body, {'decision': 'rechazado', 'notes': 'Falta evaluar una molestia.'});
    });

    testWidgets('si el participante cambió su perfil, informa y vuelve a la cola', (tester) async {
      final server = await openReview(tester);
      server.on('POST', '/api/reviews/d-1/decision', (_, _) => FakeResponse(409, error('STALE_DRAFT', 'El participante cambió su perfil: este borrador quedó reemplazado.')));
      await press(tester, find.byKey(const Key('approve')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('approve')), findsNothing);
      expect(find.text('Casos para revisar'), findsOneWidget);
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
          'K5': {'numerator': 2, 'denominator': 2, 'value': 1, 'personalMenusWithoutNutritionist': 0, 'description': 'Planes aprobados.'},
          'K6': {'description': 'Se mide con k6.'}, 'K7': {'description': 'Se mide con el sondeo.'},
        }});
      await pumpApp(tester, server);
      await signIn(tester, email: 'admin@prueba.cl');
      await tester.tap(find.text('Indicadores'));
      await tester.pumpAndSettle();
      expect(find.text('75 %  (3 de 4)'), findsOneWidget);
      expect(find.text('Sin mediciones'), findsNWidgets(2));
      expect(find.textContaining('Minutas personales sin nutricionista: 0'), findsOneWidget);
    });

    testWidgets('la nutricionista ve que su módulo se habilita al incorporarla', (tester) async {
      final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('nutritionist'));
      await pumpApp(tester, server);
      await signIn(tester, email: 'nutri@prueba.cl');
      expect(find.byKey(const Key('nutrition-pending')), findsOneWidget);
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

  testWidgets('a 360 px de ancho el plan del participante no desborda', (tester) async {
    final server = FakeServer()..on('POST', '/api/auth/login', (_, _) => session('user'));
    planRoutes(
      server,
      request: {'id': 'd-1', 'status': 'aprobado', 'message': 'Aprobada: ya puedes consultar tu plan', 'profileVersion': 1},
      plan: {'id': 'pl-1', 'version': 1, 'content': planContent()},
      profileData: profile(),
      sessions: [{'id': 's-1', 'label': 'Lunes · Sesión 1', 'plannedDate': '2026-11-09', 'completed': false, 'planStatus': 'vigente'}],
      progress: {'today': '2026-11-10', 'planned': 1, 'completed': 0, 'adherence': 0.0, 'weeks': [{'weekStart': '2026-11-09', 'planned': 1, 'completed': 0}], 'weightsEnabled': false, 'weights': []},
    );
    await pumpApp(tester, server, size: const Size(360, 780));
    await signIn(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('Aprobado por un profesional'), findsOneWidget);
  });
}
