import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'settings.dart';
import 'ui/admin/admin_home.dart';
import 'ui/auth_screen.dart';
import 'ui/design.dart';
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

/// Tema de la app, claro u oscuro («Fresh Bio-Tech»): fondo obsidiana, tarjetas carbón con borde sutil y acento esmeralda
/// para la acción. Los botones miden al menos 48 px de alto y los campos se iluminan en esmeralda al enfocarlos. Los
/// colores de cada dato (racha, macros, descanso) están en [FitTokens].
ThemeData fitGoalTheme([Brightness brightness = Brightness.light]) {
  final dark = brightness == Brightness.dark;
  final tokens = dark ? FitTokens.dark : FitTokens.light;
  final seeded = ColorScheme.fromSeed(seedColor: const Color(0xFF10B981), brightness: brightness);
  final scheme = dark
      ? seeded.copyWith(
          primary: const Color(0xFF10B981), onPrimary: const Color(0xFF03150F),
          primaryContainer: const Color(0xFF064E3B), onPrimaryContainer: const Color(0xFFA7F3D0),
          secondary: const Color(0xFF34D399), onSecondary: const Color(0xFF03150F),
          secondaryContainer: const Color(0xFF16302A), onSecondaryContainer: const Color(0xFFD1FAE5),
          tertiary: const Color(0xFF38BDF8), onTertiary: const Color(0xFF041A26),
          tertiaryContainer: const Color(0xFF0C2D3F), onTertiaryContainer: const Color(0xFFBAE6FD),
          error: const Color(0xFFF87171), onError: const Color(0xFF2A0A0A),
          errorContainer: const Color(0xFF3B1517), onErrorContainer: const Color(0xFFFECACA),
          surface: tokens.background, onSurface: const Color(0xFFF4F4F5), onSurfaceVariant: tokens.muted,
          surfaceContainerLowest: const Color(0xFF060908), surfaceContainerLow: const Color(0xFF0E1312),
          surfaceContainer: tokens.card, surfaceContainerHigh: tokens.cardHigh, surfaceContainerHighest: const Color(0xFF232C2A),
          outline: const Color(0xFF5B6662), outlineVariant: const Color(0xFF243030),
          inverseSurface: const Color(0xFFE7ECEA), onInverseSurface: const Color(0xFF0B1211), inversePrimary: const Color(0xFF047857),
        )
      : seeded.copyWith(
          primary: const Color(0xFF047857), onPrimary: Colors.white,
          primaryContainer: const Color(0xFFD1FAE5), onPrimaryContainer: const Color(0xFF064E3B),
          secondary: const Color(0xFF059669), onSecondary: Colors.white,
          secondaryContainer: const Color(0xFFE1F2EB), onSecondaryContainer: const Color(0xFF064E3B),
          tertiary: const Color(0xFF0369A1), onTertiary: Colors.white,
          tertiaryContainer: const Color(0xFFE0F2FE), onTertiaryContainer: const Color(0xFF0C4A6E),
          error: const Color(0xFFDC2626), errorContainer: const Color(0xFFFEE2E2), onErrorContainer: const Color(0xFF7F1D1D),
          surface: tokens.background, onSurface: const Color(0xFF0B1211), onSurfaceVariant: tokens.muted,
          surfaceContainerLowest: Colors.white, surfaceContainerLow: const Color(0xFFF8FAF9),
          surfaceContainer: tokens.card, surfaceContainerHigh: tokens.cardHigh, surfaceContainerHighest: const Color(0xFFE2EAE7),
          outline: const Color(0xFF8A9995), outlineVariant: const Color(0xFFDCE4E1),
        );
  final rounded = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));
  final base = ThemeData(colorScheme: scheme, useMaterial3: true, brightness: brightness);
  final text = base.textTheme.apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface);
  final field = OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: tokens.border));
  // En escritorio los botones se elevan un poco al pasar el mouse.
  WidgetStateProperty<double> lift(double rest, double hover) =>
      WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.disabled) ? 0 : states.contains(WidgetState.hovered) ? hover : rest);
  return base.copyWith(
    extensions: [tokens],
    scaffoldBackgroundColor: tokens.background,
    canvasColor: tokens.background,
    hoverColor: scheme.onSurface.withValues(alpha: 0.04),
    appBarTheme: AppBarTheme(
      backgroundColor: tokens.background,
      foregroundColor: scheme.onSurface,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(color: scheme.onSurface, fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.6),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: tokens.card,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: tokens.border)),
    ),
    textTheme: text.copyWith(
      headlineLarge: text.headlineLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -1),
      headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.8),
      headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5),
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.3),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.1),
      titleSmall: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
      bodySmall: text.bodySmall?.copyWith(color: tokens.muted, height: 1.4),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        shape: rounded,
        textStyle: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: 0.1),
        shadowColor: const Color(0xFF10B981).withValues(alpha: 0.45),
      ).copyWith(elevation: lift(0, 6)),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 18),
        shape: rounded,
        foregroundColor: scheme.onSurface,
        side: BorderSide(color: tokens.borderStrong),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)), foregroundColor: tokens.accent, textStyle: const TextStyle(fontWeight: FontWeight.w600)),
    ),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(minimumSize: const Size(44, 44))),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF111817) : Colors.white,
      border: field,
      enabledBorder: field,
      focusedBorder: field.copyWith(borderSide: BorderSide(color: const Color(0xFF10B981).withValues(alpha: 0.8), width: 2)),
      errorBorder: field.copyWith(borderSide: BorderSide(color: scheme.error.withValues(alpha: 0.7))),
      focusedErrorBorder: field.copyWith(borderSide: BorderSide(color: scheme.error, width: 2)),
      labelStyle: TextStyle(color: tokens.muted),
      floatingLabelStyle: WidgetStateTextStyle.resolveWith((states) => TextStyle(color: states.contains(WidgetState.error) ? scheme.error : states.contains(WidgetState.focused) ? tokens.accent : tokens.muted, fontWeight: FontWeight.w600)),
      hintStyle: TextStyle(color: tokens.muted.withValues(alpha: 0.8)),
      prefixIconColor: tokens.muted,
      suffixStyle: TextStyle(color: tokens.muted, fontWeight: FontWeight.w600),
    ),
    chipTheme: ChipThemeData(
      shape: const StadiumBorder(),
      side: BorderSide(color: tokens.border),
      backgroundColor: tokens.cardHigh,
      selectedColor: scheme.primary.withValues(alpha: dark ? 0.22 : 0.14),
      checkmarkColor: tokens.accent,
      labelStyle: TextStyle(color: scheme.onSurface, fontWeight: FontWeight.w600, fontSize: 13),
      secondaryLabelStyle: TextStyle(color: tokens.accent, fontWeight: FontWeight.w700, fontSize: 13),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      iconTheme: IconThemeData(color: tokens.accent, size: 16),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
        shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
        side: WidgetStatePropertyAll(BorderSide(color: tokens.border)),
        backgroundColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? scheme.primary.withValues(alpha: dark ? 0.2 : 0.12) : tokens.card),
        foregroundColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? tokens.accent : tokens.muted),
        textStyle: const WidgetStatePropertyAll(TextStyle(fontWeight: FontWeight.w700)),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? Colors.white : (dark ? const Color(0xFF8B9592) : Colors.white)),
      trackColor: WidgetStateProperty.resolveWith((states) => states.contains(WidgetState.selected) ? const Color(0xFF10B981) : (dark ? const Color(0xFF26302E) : const Color(0xFFD4DDD9))),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: scheme.primary, linearTrackColor: dark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.07)),
    listTileTheme: ListTileThemeData(iconColor: tokens.muted, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
    expansionTileTheme: ExpansionTileThemeData(iconColor: tokens.accent, collapsedIconColor: tokens.muted, shape: const Border(), collapsedShape: const Border()),
    dividerTheme: DividerThemeData(color: tokens.border, space: 24),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: tokens.card,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: tokens.borderStrong,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: tokens.card,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: BorderSide(color: tokens.border)),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: tokens.cardHigh,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: tokens.border)),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(color: dark ? const Color(0xFF26302E) : const Color(0xFF0B1211), borderRadius: BorderRadius.circular(8)),
      textStyle: const TextStyle(color: Colors.white, fontSize: 12),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: tokens.glass,
      indicatorColor: scheme.primary.withValues(alpha: 0.2),
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(fontSize: 12, fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500)),
    ),
    navigationRailTheme: NavigationRailThemeData(backgroundColor: tokens.card, indicatorColor: scheme.primary.withValues(alpha: 0.2)),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: dark ? const Color(0xFF1C2624) : const Color(0xFF0B1211),
      contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14),
      actionTextColor: const Color(0xFF34D399),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    scrollbarTheme: ScrollbarThemeData(thumbColor: WidgetStatePropertyAll(tokens.borderStrong), radius: const Radius.circular(8), thickness: const WidgetStatePropertyAll(6)),
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
