# FitGoal · cliente Flutter

Aplicación Flutter (web y Android) conectada a la API de `../backend`. Una sola base de código con cuatro experiencias según el rol de la cuenta:

| Rol | Pantallas | Qué hace |
|---|---|---|
| Participante (`user`) | Mi rutina · Rutinas · Alimentación · Perfil · Mis datos (los avisos, en la barra superior) | En «Mi rutina» ve su racha, el horario de la semana (la sesión de cada día o el descanso) y entrena en el modo sesión con temporizador de descanso. Completa el perfil (con estatura y peso opcionales y su consentimiento; la app muestra su IMC), ve las rutinas recomendadas (full body, upper/lower o push/pull/legs según su nivel y días, con las otras divisiones como alternativas), explora el catálogo filtrando por objetivo y división y la biblioteca de ejercicios, empieza una rutina al instante o arma la propia con sugerencias, elige una dieta y ve su pauta de alimentación de 7 días con los gramos ajustados a las calorías de su objetivo (si da su sexo y actividad con su consentimiento), cambia un alimento que no tiene por un equivalente aprobado, ve qué trabaja cada grupo muscular (empuje, tracción…) al tocarlo, registra sesiones y peso, ve su adherencia y ejerce sus derechos sobre datos. |
| Preparador (`trainer`) | Catálogo (Rutinas · Ejercicios · Reglas) | Ve primero lo pendiente de aprobación, revisa una rutina y la aprueba o retira, crea ejercicios en borrador y aprueba o retira ejercicios y reglas. |
| Nutricionista (`nutritionist`) | Pautas · Alimentos · Reglas | Revisa y aprueba o retira las pautas de 7 días (ve los alimentos sin aprobar), crea y aprueba alimentos con su composición por 100 g y aprueba las reglas nutricionales. |
| Administración (`admin`) | Inicio | Solicitudes de derechos (resolver, rechazar, prorrogar), indicadores K1, K2, K3 y K5 con numerador y denominador, avisos. |

## Iniciar

El modo habitual es el iniciador de la raíz (`Iniciar_FitGoal.cmd`), que compila la app y la sirve junto a la API en http://127.0.0.1:3000/app/.

Para desarrollo con recarga en caliente, inicia la API (`npm start` en `backend`) y ejecuta desde `mobile`:

```powershell
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:3000 --dart-define=DEMO_MODE=true
```

Si el SDK no está en el PATH: `& 'C:\Users\Vicente\Documents\flutter\bin\flutter.bat' run ...`.

Compilación web servida por la API (el prefijo `MSYS_NO_PATHCONV=1` solo se necesita en Git Bash):

```powershell
flutter build web --base-href=/app/ --no-web-resources-cdn --dart-define=API_BASE_URL=http://127.0.0.1:3000 --dart-define=DEMO_MODE=true
```

### Parámetros de compilación

| `--dart-define` | Efecto |
|---|---|
| `API_BASE_URL` | Dirección de la API (por defecto `http://127.0.0.1:3000`). En el emulador Android estándar, `http://10.0.2.2:3000`. |
| `DEMO_MODE=true` | Muestra la opción «Cuenta de demostración (datos ficticios)» en el registro, que habilita la estimación energética de prueba. Debe omitirse en una compilación real. |

## Comportamiento relevante

- Los tokens se guardan con `flutter_secure_storage`. Ante un 401 la app renueva la sesión una sola vez (varias peticiones simultáneas comparten la renovación) y reintenta; si la renovación falla, vuelve al inicio de sesión con un aviso.
- Cada petición tiene un límite de 10 segundos y los errores de red se informan como tales; nunca se finge que algo se guardó. Cada pantalla de datos permite reintentar y «tirar para actualizar».
- El registro exige aceptar por separado el tratamiento de la cuenta y del perfil; la estatura y el peso, los recordatorios y el seguimiento de progreso son opcionales. Se envía la versión de la política vigente.
- **Rutinas recomendadas:** «Para ti» muestra solo las que coinciden con el perfil, con sus motivos y avisos (por ejemplo, si piden más días de los que indicó); «Todas» permite explorar el catálogo aprobado por objetivo; «Ejercicios» es la biblioteca aprobada, filtrable por grupo.
- **Empezar:** elegir una rutina precarga los días del perfil (dentro del rango de la rutina). Si ya hay una rutina vigente, la app pide confirmar el reemplazo.
- **Rutina propia:** el selector muestra primero los ejercicios sugeridos para el objetivo (con su motivo); series, repeticiones y segundos se validan antes de enviar. Si no hay reglas aprobadas, ofrece igualmente la biblioteca.
- Cambiar el perfil no modifica la rutina vigente: «Mi rutina» avisa que cambió y lleva a las recomendadas.
- Al revocar el consentimiento de los datos corporales, los campos desaparecen del formulario y dejan de enviarse. El IMC se muestra solo como referencia y los avisos de seguridad (por ejemplo, con bajo peso no se recomienda bajar de peso) vienen de las reglas aprobadas por el preparador.
- Enter en el campo de contraseña envía el inicio de sesión.

## Comprobaciones

```powershell
flutter analyze    # sin problemas
flutter test       # 77 pruebas con una API simulada (test/fake_server.dart)
```

Las pruebas simulan la API con `MockClient`; las reglas de negocio se prueban en `backend/test`. El flujo completo (perfil, recomendación, inicio, rutina propia y catálogo) también se recorrió en el navegador contra la API real. Compilar para web no comprueba Android: no hay SDK ni emulador en este equipo.

## Android en desarrollo

Con Android SDK y emulador:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

Un dispositivo físico requiere la dirección del equipo en la red local y una API accesible allí. `android/app/src/debug/AndroidManifest.xml` habilita HTTP solo en desarrollo.
