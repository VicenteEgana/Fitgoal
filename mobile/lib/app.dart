import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'ui/admin/admin_home.dart';
import 'ui/auth_screen.dart';
import 'ui/participant/participant_home.dart';
import 'ui/professional/catalog_screen.dart';
import 'ui/professional/nutrition_catalog_screen.dart';

class FitGoalApp extends StatelessWidget {
  const FitGoalApp({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FitGoal',
      debugShowCheckedModeBanner: false,
      theme: fitGoalTheme(),
      home: AppRoot(api: api),
    );
  }
}

/// Tema de la app: Material 3 con el verde azulado de FitGoal, tarjetas suaves y botones cómodos de tocar (48 px de alto).
ThemeData fitGoalTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E));
  final rounded = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: scheme.surfaceContainerLowest,
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surfaceContainerLowest,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: TextStyle(color: scheme.onSurface, fontSize: 20, fontWeight: FontWeight.w700),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: scheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.6))),
    ),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(0, 48), shape: rounded)),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48), shape: rounded)),
    inputDecorationTheme: InputDecorationTheme(border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
    chipTheme: const ChipThemeData(shape: StadiumBorder()),
    navigationBarTheme: NavigationBarThemeData(backgroundColor: scheme.surfaceContainer, indicatorColor: scheme.primaryContainer),
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
