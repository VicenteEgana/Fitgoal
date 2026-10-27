import 'dart:convert';

import 'package:fitgoal/api/api_client.dart';
import 'package:fitgoal/api/token_store.dart';
import 'package:http/http.dart';
import 'package:http/testing.dart';

class FakeResponse {
  FakeResponse(this.status, this.body);
  final int status;
  final Object? body;
}

typedef Handler = Object? Function(Request request, Map<String, dynamic>? body);

/// Servidor falso sobre MockClient: registra cada llamada y responde según la ruta.
class FakeServer {
  final Map<String, Handler> routes = {};
  final List<({String method, String path, Map<String, dynamic>? body})> calls = [];

  late final MockClient client = MockClient((request) async {
    final key = '${request.method} ${request.url.path}';
    final decoded = request.body.isEmpty ? null : jsonDecode(request.body) as Map<String, dynamic>;
    calls.add((method: request.method, path: request.url.path, body: decoded));
    final handler = routes[key];
    const headers = {'content-type': 'application/json; charset=utf-8'};
    if (handler == null) {
      return Response(jsonEncode({'error': {'code': 'NOT_FOUND', 'message': 'Ruta sin definir en la prueba: $key'}}), 404, headers: headers);
    }
    final result = handler(request, decoded);
    if (result is FakeResponse) return Response(jsonEncode(result.body), result.status, headers: headers);
    return Response(jsonEncode(result ?? {}), 200, headers: headers);
  });

  void on(String method, String path, Handler handler) => routes['$method $path'] = handler;
  void get(String path, Object? body) => on('GET', path, (_, _) => body);
  Iterable<({String method, String path, Map<String, dynamic>? body})> calledTo(String method, String path) => calls.where((call) => call.method == method && call.path == path);

  ApiClient api({TokenStore? tokens}) => ApiClient(baseUrl: 'http://test', client: client, tokens: tokens ?? MemoryTokenStore());
}

Map<String, dynamic> session(String role, {bool fictitious = false, String access = 'access-1', String refresh = 'refresh-1'}) => {
  'accessToken': access,
  'refreshToken': refresh,
  'expiresInSeconds': 900,
  'user': {'id': 'u-1', 'email': '$role@prueba.cl', 'role': role, 'isFictitious': fictitious},
};

Map<String, dynamic> error(String code, String message) => {'error': {'code': code, 'message': message}};
