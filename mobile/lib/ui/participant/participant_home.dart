import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../common.dart';
import '../notifications_view.dart';
import 'my_data_tab.dart';
import 'nutrition_tab.dart';
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
  static const _profile = 3;
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = <Widget>[
      PlanTab(key: const ValueKey('plan'), api: widget.api, onGoToProfile: () => setState(() => _index = _profile), onGoToRoutines: () => setState(() => _index = 1)),
      RoutinesTab(
        key: const ValueKey('routines'),
        api: widget.api,
        onGoToProfile: () => setState(() => _index = _profile),
        onStarted: (message) {
          setState(() => _index = 0);
          showMessage(context, message);
        },
      ),
      NutritionTab(key: const ValueKey('nutrition'), api: widget.api, onGoToProfile: () => setState(() => _index = _profile)),
      ProfileTab(key: const ValueKey('profile'), api: widget.api),
      MyDataTab(key: const ValueKey('mydata'), api: widget.api),
    ];
    const titles = ['Mi rutina', 'Rutinas', 'Alimentación', 'Mi perfil', 'Mis datos'];
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
        destinations: const [
          NavigationDestination(icon: Icon(Icons.fitness_center_outlined), selectedIcon: Icon(Icons.fitness_center), label: 'Mi rutina'),
          NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Rutinas'),
          NavigationDestination(icon: Icon(Icons.restaurant_menu_outlined), selectedIcon: Icon(Icons.restaurant_menu), label: 'Alimentación'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Perfil'),
          NavigationDestination(icon: Icon(Icons.shield_outlined), selectedIcon: Icon(Icons.shield), label: 'Mis datos'),
        ],
      ),
    );
  }
}
