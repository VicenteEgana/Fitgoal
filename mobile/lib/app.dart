import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'settings.dart';
import 'ui/admin/admin_home.dart';
import 'ui/auth_screen.dart';
import 'ui/participant/participant_home.dart';
import 'ui/professional/catalog_screen.dart';
import 'ui/professional/nutrition_catalog_screen.dart';

class FitGoalApp extends StatelessWidget {
  FitGoalApp({super.key, required this.api, ThemeController? theme}) : theme = theme ?? ThemeController();
  final ApiClient api;
  final ThemeController theme;

  @override
  Widget build(BuildContext context) {
    return AppSettings(
      theme: theme,
      child: ValueListenableBuilder<ThemeMode>(
        valueListenable: theme,
        builder: (context, mode, _) => MaterialApp(
          title: 'FitGoal',
          debugShowCheckedModeBanner: false,
          theme: fitGoalTheme(Brightness.light),
          darkTheme: fitGoalTheme(Brightness.dark),
          themeMode: mode,
          home: AppRoot(api: api),
        ),
      ),
    );
  }
}

/// Tema de la app, claro u oscuro: Material 3 con el verde azulado de FitGoal, tarjetas suaves y botones cómodos de tocar
/// (48 px de alto). En el modo oscuro el fondo es casi negro y las tarjetas se separan por tono, no por sombra.
ThemeData fitGoalTheme([Brightness brightness = Brightness.light]) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E), brightness: brightness);
  final rounded = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
  final background = dark ? scheme.surface : scheme.surfaceContainerLowest;
  final base = ThemeData(colorScheme: scheme, useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: background,
    appBarTheme: AppBarTheme(
      backgroundColor: background,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(color: scheme.onSurface, fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.2),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: dark ? scheme.surfaceContainer : scheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: scheme.outlineVariant.withValues(alpha: dark ? 0.35 : 0.6))),
    ),
    textTheme: base.textTheme.copyWith(
      headlineMedium: base.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5),
      titleLarge: base.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
    ),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(0, 48), shape: rounded, textStyle: const TextStyle(fontWeight: FontWeight.w600))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48), shape: rounded, side: BorderSide(color: scheme.outlineVariant))),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(shape: rounded)),
    inputDecorationTheme: InputDecorationTheme(border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
    chipTheme: const ChipThemeData(shape: StadiumBorder()),
    listTileTheme: ListTileThemeData(iconColor: scheme.onSurfaceVariant),
    dividerTheme: DividerThemeData(color: scheme.outlineVariant.withValues(alpha: dark ? 0.4 : 0.7)),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: scheme.surfaceContainerLow, showDragHandle: true),
    dialogTheme: DialogThemeData(backgroundColor: scheme.surfaceContainerHigh),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? scheme.surfaceContainerLow : scheme.surfaceContainer,
      indicatorColor: scheme.primaryContainer,
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(fontSize: 12, fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500)),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}

enum _Phase { loading, signedOut, signedIn }

/// Decide qué pantalla mostrar según la sesión y el rol.
class AppRoot extends StatefulWidget {
  const AppRoot({super.key, required this.api});
  final ApiClient api;

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  _Phase _phase = _Phase.loading;
  String? _notice;

  @override
  void initState() {
    super.initState();
    widget.api.onSessionExpired = () {
      if (mounted) {
        setState(() {
          _phase = _Phase.signedOut;
          _notice = 'Tu sesión expiró. Inicia sesión de nuevo.';
        });
      }
    };
    _restore();
  }

  Future<void> _restore() async {
    final restored = await widget.api.restore();
    if (mounted) setState(() => _phase = restored ? _Phase.signedIn : _Phase.signedOut);
  }

  Future<void> _logout() async {
    await widget.api.logout();
    if (mounted) {
      setState(() {
        _phase = _Phase.signedOut;
        _notice = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    switch (_phase) {
      case _Phase.loading:
        return const Scaffold(body: Center(child: CircularProgressIndicator(key: Key('boot'))));
      case _Phase.signedOut:
        return AuthScreen(api: widget.api, notice: _notice, onAuthenticated: () => setState(() {
          _phase = _Phase.signedIn;
          _notice = null;
        }));
      case _Phase.signedIn:
        final api = widget.api;
        // Si la sesión se cerró mientras se reconstruía la pantalla, se vuelve al inicio de sesión.
        if (api.user == null) return AuthScreen(api: api, notice: _notice, onAuthenticated: () => setState(() => _phase = _Phase.signedIn));
        return switch (api.user!.role) {
          'trainer' => CatalogScreen(key: const ValueKey('trainer'), api: api, onLogout: _logout),
          'nutritionist' => NutritionistHome(key: const ValueKey('nutritionist'), api: api, onLogout: _logout),
          'admin' => AdminHome(key: const ValueKey('admin'), api: api, onLogout: _logout),
          _ => ParticipantHome(key: const ValueKey('participant'), api: api, onLogout: _logout),
        };
    }
  }
}
