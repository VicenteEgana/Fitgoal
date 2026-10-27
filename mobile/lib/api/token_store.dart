import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Guarda los tokens de sesión. En Android usa el almacenamiento seguro del sistema (Keystore).
abstract class TokenStore {
  Future<({String? access, String? refresh})> read();
  Future<void> write({required String access, required String refresh});
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _storage;
  static const _access = 'fitgoal.access';
  static const _refresh = 'fitgoal.refresh';

  @override
  Future<({String? access, String? refresh})> read() async => (
    access: await _storage.read(key: _access),
    refresh: await _storage.read(key: _refresh),
  );

  @override
  Future<void> write({required String access, required String refresh}) async {
    await _storage.write(key: _access, value: access);
    await _storage.write(key: _refresh, value: refresh);
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _access);
    await _storage.delete(key: _refresh);
  }
}

/// Almacén en memoria para pruebas.
class MemoryTokenStore implements TokenStore {
  String? access;
  String? refresh;

  @override
  Future<({String? access, String? refresh})> read() async =>
      (access: access, refresh: refresh);

  @override
  Future<void> write({required String access, required String refresh}) async {
    this.access = access;
    this.refresh = refresh;
  }

  @override
  Future<void> clear() async {
    access = null;
    refresh = null;
  }
}
