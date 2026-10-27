import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://127.0.0.1:3000',
);

class ApiException implements Exception {
  final String message;
  final String? code;
  ApiException(this.message, [this.code]);
  @override
  String toString() => message;
}

/// Development-only session for the local demo.
class ApiClient {
  final String baseUrl;
  final http.Client client;
  String? _token;
  ApiClient({this.baseUrl = apiBaseUrl, http.Client? client})
    : client = client ?? http.Client();

  Future<void> login(String role) async {
    final result = await request(
      'POST',
      '/api/demo/login',
      body: {'role': role},
      authenticated: false,
    );
    _token = result['token'] as String?;
    if (_token == null) {
      throw ApiException('La API no entregó una sesión demo.');
    }
  }

  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) async {
    final request = http.Request(method, Uri.parse('$baseUrl$path'));
    request.headers['Content-Type'] = 'application/json';
    if (authenticated) {
      if (_token == null) {
        throw ApiException('Actualiza la conexión de la demo para continuar.');
      }
      request.headers['Authorization'] = 'Bearer $_token';
    }
    if (body != null) request.body = jsonEncode(body);
    try {
      final response = await client
          .send(request)
          .timeout(const Duration(seconds: 10));
      final bytes = await response.stream.toBytes().timeout(
        const Duration(seconds: 10),
      );
      final decoded = jsonDecode(utf8.decode(bytes));
      if (decoded is! Map<String, dynamic>) {
        throw ApiException('La API devolvió un formato inesperado.');
      }
      if (response.statusCode >= 400) {
        final error = decoded['error'];
        throw ApiException(
          error is Map
              ? (error['message']?.toString() ?? 'Error de servidor.')
              : 'Error de servidor.',
          error is Map ? error['code']?.toString() : null,
        );
      }
      return decoded;
    } on TimeoutException {
      throw ApiException(
        'La conexión tardó demasiado. Consulta el estado antes de repetir una acción.',
      );
    } on http.ClientException {
      throw ApiException(
        'No se pudo conectar a la API en $baseUrl. Comprueba que el backend esté iniciado.',
      );
    } on FormatException {
      throw ApiException('La respuesta de la API no es JSON válido.');
    }
  }

  void close() => client.close();
}

