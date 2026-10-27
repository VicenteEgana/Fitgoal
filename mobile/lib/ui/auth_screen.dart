import 'package:flutter/material.dart';

import '../api/api_client.dart';

final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');

/// Inicio de sesión y registro con consentimiento informado (RF001, RF009).
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.api, required this.onAuthenticated, this.notice});
  final ApiClient api;
  final VoidCallback onAuthenticated;
  final String? notice;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _registering = false;
  bool _busy = false;
  bool _account = false;
  bool _profileData = false;
  bool _bodyData = false;
  bool _reminders = false;
  bool _progress = false;
  bool _fictitious = false;
  String? _error;
  String? _intentId;

  void _switchMode() {
    setState(() {
      _registering = !_registering;
      _error = null;
    });
    if (_registering && _intentId == null) {
      _intentId = ApiClient.newIntentId();
      widget.api.registrationStarted(_intentId!);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_registering && !(_account && _profileData)) {
      setState(() => _error = 'Para crear tu cuenta debes aceptar el tratamiento de tus datos.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final email = _emailController.text.trim();
      if (_registering) {
        await widget.api.register(
          email: email,
          password: _passwordController.text,
          consents: {
            'registro_cuenta': true,
            'perfil_entrenamiento': true,
            if (_bodyData) 'datos_corporales': true,
            if (_reminders) 'recordatorios': true,
            if (_progress) 'seguimiento_progreso': true,
          },
          fictitious: _fictitious,
          intentId: _intentId,
        );
      } else {
        await widget.api.login(email, _passwordController.text);
      }
      if (mounted) widget.onAuthenticated();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(Icons.fitness_center, size: 48, color: scheme.primary),
                    const SizedBox(height: 8),
                    Text('FitGoal', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
                    Text(
                      'Rutinas aprobadas por profesionales, o armadas por ti.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 24),
                    if (widget.notice != null) ...[
                      Text(widget.notice!, key: const Key('auth-notice'), style: TextStyle(color: scheme.primary)),
                      const SizedBox(height: 12),
                    ],
                    TextFormField(
                      key: const Key('email'),
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(labelText: 'Correo', border: OutlineInputBorder()),
                      validator: (value) => _email.hasMatch((value ?? '').trim()) ? null : 'Ingresa un correo válido.',
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('password'),
                      controller: _passwordController,
                      obscureText: true,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) {
                        if (!_busy) _submit();
                      },
                      autofillHints: _registering ? const [AutofillHints.newPassword] : const [AutofillHints.password],
                      decoration: InputDecoration(labelText: _registering ? 'Contraseña (mínimo 10 caracteres)' : 'Contraseña', border: const OutlineInputBorder()),
                      validator: (value) => (value ?? '').length >= (_registering ? 10 : 1) ? null : 'La contraseña debe tener al menos 10 caracteres.',
                    ),
                    if (_registering) ...[
                      const SizedBox(height: 12),
                      Text('Tratamiento de tus datos', style: Theme.of(context).textTheme.titleSmall),
                      const SizedBox(height: 4),
                      Text(
                        'FitGoal es para personas adultas. Tus datos se usan solo para recomendarte rutinas y llevar tu seguimiento. Política de datos: $policyVersion.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      CheckboxListTile(
                        key: const Key('consent-account'),
                        value: _account,
                        onChanged: (value) => setState(() => _account = value ?? false),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Acepto el tratamiento de mis datos para crear mi cuenta (obligatorio).'),
                      ),
                      CheckboxListTile(
                        key: const Key('consent-profile'),
                        value: _profileData,
                        onChanged: (value) => setState(() => _profileData = value ?? false),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Acepto el tratamiento de los datos de mi perfil de entrenamiento (obligatorio).'),
                      ),
                      CheckboxListTile(
                        key: const Key('consent-body-data'),
                        value: _bodyData,
                        onChanged: (value) => setState(() => _bodyData = value ?? false),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Quiero que usen mi estatura y peso para recomendarme rutinas (dato de salud, opcional).'),
                      ),
                      CheckboxListTile(
                        key: const Key('consent-reminders'),
                        value: _reminders,
                        onChanged: (value) => setState(() => _reminders = value ?? false),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Quiero recordatorios de sesiones pendientes (opcional).'),
                      ),
                      CheckboxListTile(
                        key: const Key('consent-progress'),
                        value: _progress,
                        onChanged: (value) => setState(() => _progress = value ?? false),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Quiero registrar mi progreso, incluido mi peso (opcional).'),
                      ),
                      if (demoMode)
                        SwitchListTile(
                          key: const Key('fictitious'),
                          value: _fictitious,
                          onChanged: (value) => setState(() => _fictitious = value),
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Cuenta de demostración (datos ficticios)'),
                          subtitle: const Text('Habilita la estimación energética de prueba.'),
                        ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, key: const Key('auth-error'), style: TextStyle(color: scheme.error)),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      key: const Key('submit'),
                      onPressed: _busy ? null : _submit,
                      child: _busy ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)) : Text(_registering ? 'Crear cuenta' : 'Iniciar sesión'),
                    ),
                    TextButton(
                      key: const Key('switch-mode'),
                      onPressed: _busy ? null : _switchMode,
                      child: Text(_registering ? 'Ya tengo cuenta' : 'Crear una cuenta'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
