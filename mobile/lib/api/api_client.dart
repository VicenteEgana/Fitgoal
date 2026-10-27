import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;

import 'token_store.dart';

const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://127.0.0.1:3000',
);

/// Permite registrar cuentas de demostración (datos ficticios). Se activa solo en compilaciones de demostración.
const demoMode = bool.fromEnvironment('DEMO_MODE', defaultValue: false);

/// Versión de la política de datos que la app muestra; la API la compara con la vigente.
const policyVersion = 'politica-datos-2026-10-v1';

class ApiException implements Exception {
  ApiException(this.message, {this.code, this.status});
  final String message;
  final String? code;
  final int? status;

  bool get isNetwork => status == null;

  @override
  String toString() => message;
}

class SessionUser {
  const SessionUser({
    required this.id,
    required this.email,
    required this.role,
    required this.isFictitious,
  });
  factory SessionUser.fromJson(Map<String, dynamic> json) => SessionUser(
    id: json['id'] as String,
    email: json['email'] as String,
    role: json['role'] as String,
    isFictitious: json['isFictitious'] as bool? ?? false,
  );
  final String id;
  final String email;
  final String role;
  final bool isFictitious;
}

/// Cliente de la API REST: JWT de acceso, renovación con refresh token rotativo y errores tipificados.
class ApiClient {
  ApiClient({String? baseUrl, http.Client? client, TokenStore? tokens})
    : baseUrl = baseUrl ?? apiBaseUrl,
      _client = client ?? http.Client(),
      tokens = tokens ?? SecureTokenStore();

  final String baseUrl;
  final http.Client _client;
  final TokenStore tokens;
  SessionUser? user;
  String? _access;
  String? _refresh;
  Future<bool>? _refreshing;

  /// Se invoca cuando la sesión ya no se puede renovar.
  void Function()? onSessionExpired;

  static String newIntentId() {
    final random = Random.secure();
    String hex(int length) =>
        List.generate(length, (_) => random.nextInt(16).toRadixString(16)).join();
    return '${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}';
  }

  /// Recupera la sesión guardada; devuelve verdadero si sigue vigente.
  Future<bool> restore() async {
    final saved = await tokens.read();
    if (saved.refresh == null) return false;
    _access = saved.access;
    _refresh = saved.refresh;
    try {
      final me = await get('/api/auth/me') as Map<String, dynamic>;
      user = SessionUser.fromJson(me['user'] as Map<String, dynamic>);
      return true;
    } on ApiException {
      await _forget();
      return false;
    }
  }

  Future<void> registrationStarted(String intentId) async {
    try {
      await _send('POST', '/api/public/registration-started', body: {'intentId': intentId}, auth: false);
    } on ApiException {
      // La medición del registro nunca debe impedir que la persona se registre.
    }
  }

  Future<void> register({
    required String email,
    required String password,
    required Map<String, bool> consents,
    bool fictitious = false,
    String? intentId,
  }) async {
    final session = await _send('POST', '/api/auth/register', auth: false, body: {
      'email': email,
      'password': password,
      'policyVersion': policyVersion,
      'consents': consents,
      if (fictitious) 'fictitious': true,
      'intentId': ?intentId,
    });
    await _open(session as Map<String, dynamic>);
  }

  Future<void> login(String email, String password) async {
    final session = await _send('POST', '/api/auth/login', auth: false, body: {'email': email, 'password': password});
    await _open(session as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await _send('POST', '/api/auth/logout');
    } on ApiException {
      // Si no hay red, igual se olvida la sesión local.
    }
    await _forget();
  }

  Future<void> _open(Map<String, dynamic> session) async {
    _access = session['accessToken'] as String;
    _refresh = session['refreshToken'] as String;
    user = SessionUser.fromJson(session['user'] as Map<String, dynamic>);
    await tokens.write(access: _access!, refresh: _refresh!);
  }

  Future<void> _forget() async {
    _access = null;
    _refresh = null;
    user = null;
    await tokens.clear();
  }

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Map<String, dynamic>? body]) => _send('POST', path, body: body ?? {});
  Future<dynamic> put(String path, Map<String, dynamic> body) => _send('PUT', path, body: body);
  Future<dynamic> patch(String path, Map<String, dynamic> body) => _send('PATCH', path, body: body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  /// Renueva la sesión una sola vez aunque varias peticiones fallen a la vez.
  Future<bool> _renew() {
    final pending = _refreshing;
    if (pending != null) return pending;
    final fresh = _renewNow().whenComplete(() => _refreshing = null);
    _refreshing = fresh;
    return fresh;
  }

  Future<bool> _renewNow() async {
    try {
      final session = await _send('POST', '/api/auth/refresh', auth: false, body: {'refreshToken': _refresh}, retry: false);
      await _open(session as Map<String, dynamic>);
      return true;
    } on ApiException {
      return false;
    }
  }

  Future<dynamic> _send(String method, String path, {Map<String, dynamic>? body, bool auth = true, bool retry = true}) async {
    final request = http.Request(method, Uri.parse('$baseUrl$path'));
    request.headers['Content-Type'] = 'application/json';
    if (auth && _access != null) request.headers['Authorization'] = 'Bearer $_access';
    if (body != null) request.body = jsonEncode(body);
    http.Response response;
    try {
      final streamed = await _client.send(request).timeout(const Duration(seconds: 10));
      response = await http.Response.fromStream(streamed).timeout(const Duration(seconds: 10));
    } on TimeoutException {
      throw ApiException('La conexión tardó demasiado. Revisa tu Internet e intenta de nuevo.');
    } on http.ClientException {
      throw ApiException('No hay conexión con el servidor. FitGoal necesita Internet para guardar tus datos.');
    }
    if (response.statusCode == 401 && auth && retry && _refresh != null) {
      if (await _renew()) return _send(method, path, body: body, auth: auth, retry: false);
      await _forget();
      onSessionExpired?.call();
    }
    Object? decoded;
    if (response.body.isNotEmpty) {
      try {
        decoded = jsonDecode(utf8.decode(response.bodyBytes));
      } on FormatException {
        throw ApiException('La respuesta del servidor no es válida.', status: response.statusCode);
      }
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return decoded ?? <String, dynamic>{};
    final error = decoded is Map<String, dynamic> ? decoded['error'] as Map<String, dynamic>? : null;
    throw ApiException(
      error?['message'] as String? ?? 'No se pudo completar la operación.',
      code: error?['code'] as String?,
      status: response.statusCode,
    );
  }
}
