import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Preferencias que se guardan en el dispositivo y no en el servidor (por ahora, el tema).
abstract class PreferenceStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
}

class SharedPreferenceStore implements PreferenceStore {
  @override
  Future<String?> read(String key) async => (await SharedPreferences.getInstance()).getString(key);

  @override
  Future<void> write(String key, String value) async => (await SharedPreferences.getInstance()).setString(key, value);
}

/// Almacén en memoria para pruebas.
class MemoryPreferenceStore implements PreferenceStore {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;
}

const themeModeLabels = {ThemeMode.system: 'Igual que el sistema', ThemeMode.light: 'Claro', ThemeMode.dark: 'Oscuro'};
const themeModeIcons = {ThemeMode.system: Icons.brightness_auto_outlined, ThemeMode.light: Icons.light_mode_outlined, ThemeMode.dark: Icons.dark_mode_outlined};

/// Tema elegido por la persona: el del sistema (por defecto), claro u oscuro. Se recuerda en este dispositivo.
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController([PreferenceStore? store]) : _store = store ?? MemoryPreferenceStore(), super(ThemeMode.system);
  final PreferenceStore _store;
  static const _key = 'fitgoal.theme';

  Future<void> load() async {
    try {
      final saved = await _store.read(_key);
      value = ThemeMode.values.firstWhere((mode) => mode.name == saved, orElse: () => ThemeMode.system);
    } catch (_) {
      // Sin almacenamiento disponible (por ejemplo, navegación privada) se usa el tema del sistema.
    }
  }

  Future<void> choose(ThemeMode mode) async {
    value = mode;
    try {
      await _store.write(_key, mode.name);
    } catch (_) {
      // El tema se aplica igual; solo no se recordará al volver a abrir la app.
    }
  }
}

/// Da acceso al tema desde cualquier pantalla, por ejemplo desde el menú de cuenta.
class AppSettings extends InheritedNotifier<ThemeController> {
  const AppSettings({super.key, required ThemeController theme, required super.child}) : super(notifier: theme);

  static ThemeController? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppSettings>()?.notifier;
}
