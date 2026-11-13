import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import '../notifications_view.dart';
import 'my_data_tab.dart';
import 'nutrition_tab.dart';
import 'onboarding_screen.dart';
import 'plan_tab.dart';
import 'profile_tab.dart';
import 'routines_tab.dart';

/// Un módulo de la app del participante: cómo se ve en la navegación y en el encabezado.
typedef _Destination = ({IconData icon, IconData selectedIcon, String label, String title, String subtitle, double maxWidth});

class ParticipantHome extends StatefulWidget {
  const ParticipantHome({super.key, required this.api, required this.onLogout});
  final ApiClient api;
  final Future<void> Function() onLogout;

  @override
  State<ParticipantHome> createState() => _ParticipantHomeState();
}

class _ParticipantHomeState extends State<ParticipantHome> {
  int _index = 0;
  // La alimentación (RF005) se puede apagar en el servidor; mientras no se sabe, se muestra.
  bool _nutrition = true;

  @override
  void initState() {
    super.initState();
    _loadFeatures();
  }

  Future<void> _loadFeatures() async {
    try {
      final data = await widget.api.get('/api/features') as Map<String, dynamic>;
      final on = (data['features'] as Map<String, dynamic>?)?['nutrition'] != false;
      if (mounted && on != _nutrition) {
        setState(() {
          _nutrition = on;
          _index = 0;
        });
      }
    } on ApiException {
      // Sin respuesta se mantiene la pestaña; la API igual rechaza las pautas si la función está apagada.
    }
  }

  void _openNotifications() => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => NotificationsPage(api: widget.api)));

  @override
  Widget build(BuildContext context) {
    // Recién creada la cuenta se pide el perfil guiado, antes de mostrar las pestañas.
    if (widget.api.justRegistered) {
      return OnboardingScreen(
        api: widget.api,
        nutritionEnabled: _nutrition,
        onFinished: () => setState(() {
          widget.api.finishRegistration();
          _index = 1;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) showMessage(context, 'Perfil listo: estas son tus rutinas recomendadas.');
          });
        }),
        onSkipped: () => setState(widget.api.finishRegistration),
      );
    }
    final profileIndex = _nutrition ? 3 : 2;
    final tabs = <Widget>[
      PlanTab(key: const ValueKey('plan'), api: widget.api, onGoToProfile: () => setState(() => _index = profileIndex), onGoToRoutines: () => setState(() => _index = 1)),
      RoutinesTab(
        key: const ValueKey('routines'),
        api: widget.api,
        onGoToProfile: () => setState(() => _index = profileIndex),
        onStarted: (message) {
          setState(() => _index = 0);
          showMessage(context, message);
        },
      ),
      if (_nutrition) NutritionTab(key: const ValueKey('nutrition'), api: widget.api, onGoToProfile: () => setState(() => _index = profileIndex)),
      ProfileTab(key: const ValueKey('profile'), api: widget.api),
      MyDataTab(key: const ValueKey('mydata'), api: widget.api),
    ];
    final destinations = <_Destination>[
      (icon: Icons.fitness_center_outlined, selectedIcon: Icons.fitness_center, label: 'Mi rutina', title: 'Mi rutina', subtitle: 'Tu racha, tu semana y tu progreso', maxWidth: kContentMaxWidth),
      (icon: Icons.explore_outlined, selectedIcon: Icons.explore, label: 'Rutinas', title: 'Rutinas', subtitle: 'Recomendadas para ti, todo el catálogo y la biblioteca de ejercicios', maxWidth: kContentMaxWidth),
      if (_nutrition) (icon: Icons.restaurant_menu_outlined, selectedIcon: Icons.restaurant_menu, label: 'Alimentación', title: 'Alimentación', subtitle: 'Tu pauta de 7 días, aprobada por la nutricionista', maxWidth: kContentMaxWidth),
      (icon: Icons.person_outline, selectedIcon: Icons.person, label: 'Perfil', title: 'Mi perfil', subtitle: 'Tu objetivo, tus días disponibles y tus consentimientos', maxWidth: 896),
      (icon: Icons.shield_outlined, selectedIcon: Icons.shield, label: 'Mis datos', title: 'Mis datos', subtitle: 'Tus derechos sobre tus datos personales', maxWidth: 768),
    ];
    final current = destinations[_index];
    final body = _TabSwitcher(child: tabs[_index]);
    final wide = MediaQuery.sizeOf(context).width >= kShellBreakpoint;
    if (!wide) {
      return Scaffold(
        appBar: AppBar(title: Text(current.title), actions: [
          IconButton(key: const Key('open-notifications'), icon: const Icon(Icons.notifications_outlined), tooltip: 'Avisos', onPressed: _openNotifications),
          AccountMenu(api: widget.api, onLogout: widget.onLogout),
          const SizedBox(width: 4),
        ]),
        body: SafeArea(child: body),
        bottomNavigationBar: _GlassNavBar(destinations: destinations, selectedIndex: _index, onSelected: (value) => setState(() => _index = value)),
      );
    }
    return Scaffold(
      body: Row(children: [
        _Sidebar(
          destinations: destinations,
          selectedIndex: _index,
          onSelected: (value) => setState(() => _index = value),
          onNotifications: _openNotifications,
          account: AccountMenu(api: widget.api, onLogout: widget.onLogout, child: _AccountTile(email: widget.api.user?.email ?? '')),
        ),
        Expanded(
          child: SafeArea(
            left: false,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _DesktopHeader(title: current.title, subtitle: current.subtitle, maxWidth: current.maxWidth),
              Expanded(child: body),
            ]),
          ),
        ),
      ]),
    );
  }
}

/// Al cambiar de módulo, el contenido nuevo aparece con un fundido y un leve desplazamiento hacia arriba.
class _TabSwitcher extends StatelessWidget {
  const _TabSwitcher({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeIn,
      layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.015), end: Offset.zero).animate(animation), child: child),
      ),
      child: child,
    );
  }
}

/// Encabezado del escritorio: el título del módulo alineado con el contenido.
class _DesktopHeader extends StatelessWidget {
  const _DesktopHeader({required this.title, required this.subtitle, required this.maxWidth});
  final String title;
  final String subtitle;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    return LayoutBuilder(builder: (context, constraints) {
      final side = ((constraints.maxWidth - maxWidth) / 2).clamp(32.0, double.infinity);
      return Padding(
        padding: EdgeInsets.fromLTRB(side, 32, side, 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 30)),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: tokens.muted, fontSize: 14)),
        ]),
      );
    });
  }
}

/// Barra inferior del teléfono: vidrio esmerilado sobre el contenido, con un indicador luminoso en el módulo activo.
class _GlassNavBar extends StatelessWidget {
  const _GlassNavBar({required this.destinations, required this.selectedIndex, required this.onSelected});
  final List<_Destination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: DecoratedBox(
          decoration: BoxDecoration(color: tokens.glass, border: Border(top: BorderSide(color: tokens.border))),
          child: SafeArea(
            top: false,
            child: SizedBox(
              height: 68,
              child: Row(children: [
                for (final (index, destination) in destinations.indexed)
                  Expanded(child: _NavItem(destination: destination, selected: index == selectedIndex, onTap: () => onSelected(index))),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.destination, required this.selected, required this.onTap});
  final _Destination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final scheme = Theme.of(context).colorScheme;
    final color = selected ? tokens.accent : tokens.muted;
    return Semantics(
      button: true,
      selected: selected,
      label: destination.label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 36,
        highlightShape: BoxShape.rectangle,
        child: Stack(alignment: Alignment.topCenter, children: [
          // Indicador luminoso del módulo activo.
          AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutCubic,
            width: selected ? 28 : 0,
            height: 3,
            decoration: BoxDecoration(
              color: tokens.accent,
              borderRadius: const BorderRadius.vertical(bottom: Radius.circular(3)),
              boxShadow: [if (selected) BoxShadow(color: tokens.accent.withValues(alpha: 0.7), blurRadius: 12, spreadRadius: 1)],
            ),
          ),
          Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                width: 52,
                height: 30,
                decoration: BoxDecoration(color: selected ? scheme.primary.withValues(alpha: 0.16) : Colors.transparent, borderRadius: BorderRadius.circular(15)),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  transitionBuilder: (child, animation) => ScaleTransition(scale: Tween(begin: 0.8, end: 1.0).animate(animation), child: FadeTransition(opacity: animation, child: child)),
                  child: Icon(selected ? destination.selectedIcon : destination.icon, key: ValueKey(selected), color: color, size: 22),
                ),
              ),
              const SizedBox(height: 4),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 180),
                style: TextStyle(fontSize: 11.5, height: 1.1, color: color, fontWeight: selected ? FontWeight.w700 : FontWeight.w500),
                child: Text(destination.label, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Barra lateral del escritorio: el logo, los cinco módulos, los avisos y la cuenta.
class _Sidebar extends StatelessWidget {
  const _Sidebar({required this.destinations, required this.selectedIndex, required this.onSelected, required this.onNotifications, required this.account});
  final List<_Destination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final VoidCallback onNotifications;
  final Widget account;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: 256,
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF0C1110) : tokens.card,
        border: Border(right: BorderSide(color: tokens.border)),
      ),
      child: SafeArea(
        right: false,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Padding(padding: EdgeInsets.fromLTRB(20, 24, 20, 28), child: _Logo()),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
            child: Text('MENÚ', style: TextStyle(fontSize: 11, letterSpacing: 1.4, fontWeight: FontWeight.w700, color: tokens.muted.withValues(alpha: 0.8))),
          ),
          for (final (index, destination) in destinations.indexed)
            _SideItem(icon: destination.icon, selectedIcon: destination.selectedIcon, label: destination.label, selected: index == selectedIndex, onTap: () => onSelected(index)),
          const Spacer(),
          Divider(height: 1, indent: 16, endIndent: 16, color: tokens.border),
          const SizedBox(height: 8),
          _SideItem(key: const Key('open-notifications'), icon: Icons.notifications_outlined, selectedIcon: Icons.notifications, label: 'Avisos', selected: false, onTap: onNotifications),
          Padding(padding: const EdgeInsets.fromLTRB(12, 4, 12, 16), child: account),
        ]),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo();

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    return Row(children: [
      Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF34D399), Color(0xFF0D9488)]),
          boxShadow: [BoxShadow(color: const Color(0xFF10B981).withValues(alpha: 0.35), blurRadius: 16, offset: const Offset(0, 6))],
        ),
        child: const Icon(Icons.fitness_center, color: Color(0xFF03150F), size: 22),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('FitGoal', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.6, height: 1.1)),
          Text('Tu plan, paso a paso', style: TextStyle(fontSize: 12, color: tokens.muted)),
        ]),
      ),
    ]);
  }
}

class _SideItem extends StatefulWidget {
  const _SideItem({super.key, required this.icon, required this.selectedIcon, required this.label, required this.selected, required this.onTap});
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_SideItem> createState() => _SideItemState();
}

class _SideItemState extends State<_SideItem> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final scheme = Theme.of(context).colorScheme;
    final selected = widget.selected;
    final radius = BorderRadius.circular(12);
    return Semantics(
      button: true,
      selected: selected,
      label: widget.label,
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          height: 46,
          decoration: BoxDecoration(
            color: selected ? scheme.primary.withValues(alpha: 0.12) : _hover ? scheme.onSurface.withValues(alpha: 0.05) : Colors.transparent,
            borderRadius: radius,
            border: Border.all(color: selected ? scheme.primary.withValues(alpha: 0.28) : Colors.transparent),
          ),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              borderRadius: radius,
              onTap: widget.onTap,
              onHover: (value) => setState(() => _hover = value),
              child: Row(children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  width: 3,
                  height: selected ? 20 : 0,
                  decoration: BoxDecoration(
                    color: tokens.accent,
                    borderRadius: const BorderRadius.horizontal(right: Radius.circular(3)),
                    boxShadow: [if (selected) BoxShadow(color: tokens.accent.withValues(alpha: 0.7), blurRadius: 10)],
                  ),
                ),
                const SizedBox(width: 11),
                Icon(selected ? widget.selectedIcon : widget.icon, size: 21, color: selected ? tokens.accent : tokens.muted),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    widget.label,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14.5, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? scheme.onSurface : scheme.onSurface.withValues(alpha: 0.78)),
                  ),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Lo que se ve de la cuenta en la barra lateral; al tocarlo se abre el menú de cuenta y tema.
class _AccountTile extends StatelessWidget {
  const _AccountTile({required this.email});
  final String email;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final initial = email.isEmpty ? '?' : email[0].toUpperCase();
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: tokens.cardHigh, borderRadius: BorderRadius.circular(14), border: Border.all(color: tokens.border)),
      child: Row(children: [
        Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(shape: BoxShape.circle, color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.18)),
          child: Text(initial, style: TextStyle(fontWeight: FontWeight.w800, color: tokens.accent)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Mi cuenta', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            Text(email, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, color: tokens.muted)),
          ]),
        ),
        Icon(Icons.unfold_more, size: 18, color: tokens.muted),
      ]),
    );
  }
}
