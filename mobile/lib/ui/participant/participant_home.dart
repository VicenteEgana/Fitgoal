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
    final titles = ['Mi rutina', 'Rutinas', if (_nutrition) 'Alimentación', 'Mi perfil', 'Mis datos'];
    return Scaffold(
      appBar: AppBar(title: Text(titles[_index]), actions: [
        IconButton(
          key: const Key('open-notifications'),
          icon: const Icon(Icons.notifications_outlined),
          tooltip: 'Avisos',
          onPressed: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => NotificationsPage(api: widget.api))),
        ),
        AccountMenu(api: widget.api, onLogout: widget.onLogout),
      ]),
      body: SafeArea(child: tabs[_index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.fitness_center_outlined), selectedIcon: Icon(Icons.fitness_center), label: 'Mi rutina'),
          const NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Rutinas'),
          if (_nutrition) const NavigationDestination(icon: Icon(Icons.restaurant_menu_outlined), selectedIcon: Icon(Icons.restaurant_menu), label: 'Alimentación'),
          const NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Perfil'),
          const NavigationDestination(icon: Icon(Icons.shield_outlined), selectedIcon: Icon(Icons.shield), label: 'Mis datos'),
        ],
      ),
    );
  }
}
