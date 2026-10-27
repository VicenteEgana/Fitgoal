import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'app.dart';
import 'settings.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // El tema se lee antes de dibujar la primera pantalla, para que no aparezca un instante con el tema equivocado.
  final theme = ThemeController(SharedPreferenceStore());
  await theme.load();
  runApp(FitGoalApp(api: ApiClient(), theme: theme));
}
