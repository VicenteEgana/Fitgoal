# Política de datos de FitGoal

**Versión:** `politica-datos-2026-10-v1`. **Estado:** borrador para el piloto, por revisar con el docente guía y un abogado antes de tratar datos reales.

La app muestra este mismo texto (`mobile/lib/ui/privacy_policy.dart`). Si cambia el fondo, se sube la versión de la política en `backend/src/config.js` y en `mobile/lib/api/api_client.dart`, y se actualizan ambos textos.

## Estado de los datos que exige la ley

| Dato | Estado | Por qué se exige |
| --- | --- | --- |
| Responsables de los datos | **Definidos:** los tres fundadores, como personas naturales, porque FitGoal no es una sociedad constituida. Si se constituye una, ella pasa a ser la responsable. **Por validar:** cómo se reparte su responsabilidad y si la individualización exige RUT o domicilio | Ley 21.719, arts. 2 n y 14 ter b |
| Correo o formulario de contacto | **Por definir** | Art. 14 ter c |
| Región de los servidores | **Definida:** Virginia, Estados Unidos. Render no permite cambiarla en un servicio ya creado | Art. 14 ter h |
| Garantía de la transferencia | **Por validar:** si el contrato de tratamiento de datos de Render es una garantía adecuada. Sus cláusulas tipo están pensadas para transferencias desde Europa. Revisar cuando la Agencia publique su listado de países y sus cláusulas modelo | Arts. 14 ter h, 27 y 28 |
| Proveedor y región de los respaldos | **Por definir** al cotizar. Se recomienda Estados Unidos, fuera de Virginia | Art. 14 ter h |

## Quién trata tus datos

Responsables: Vicente Egaña, Jorge Farias y Jonatan Fernandez, fundadores de FitGoal, que deciden en conjunto cómo se tratan tus datos. Contacto: por definir antes del piloto.

## Para qué los usamos

Crear tu cuenta y tu perfil, recomendarte rutinas y pautas de alimentación aprobadas por profesionales, llevar tu seguimiento y enviarte recordatorios si los activas. Si participas en el piloto, también para evaluar la aplicación.

| Finalidad | Consentimiento | Datos |
| --- | --- | --- |
| Crear y mantener la cuenta | `registro_cuenta` (obligatorio) | Correo y credencial |
| Recomendar rutinas | `perfil_entrenamiento` (obligatorio) | Edad, objetivo, nivel, días, duración y equipo |
| Afinar la recomendación con el IMC | `datos_corporales` (opcional) | Estatura y peso |
| Calcular calorías y ajustar la pauta | `datos_nutricionales` (opcional) | Sexo y nivel de actividad |
| Registrar el progreso | `seguimiento_progreso` (opcional) | Historial de peso |
| Enviar recordatorios internos | `recordatorios` (opcional) | Sesiones sin registrar |
| Evaluar el piloto | `evaluacion_piloto` (opcional) | Eventos de uso seudonimizados e inscripción en el piloto |

## Qué datos tratamos

Correo, edad, objetivo, nivel, días, duración y equipo; sesiones, rutinas y cambios de alimento. Solo si lo autorizas: estatura, peso, sexo y nivel de actividad, que tratamos como datos de salud. Tú nos entregas estos datos.

## Tu consentimiento

Cada finalidad opcional tiene su propio consentimiento. Puedes retirarlo cuando quieras, sin afectar lo tratado antes. Al retirarlo borramos lo que autorizaba:

| Si retiras | Se borra |
| --- | --- |
| `datos_corporales` | Estatura, peso, sexo y actividad de todas las versiones del perfil, y el historial de peso |
| `datos_nutricionales` | Sexo y actividad de todas las versiones del perfil |
| `seguimiento_progreso` | Historial de peso |
| `evaluacion_piloto` | Tus eventos de uso y tu inscripción en el piloto |

## Cuánto tiempo los conservamos

Son plazos propuestos por el equipo, que se configuran en `backend/src/config.js` y se aplican en la mantención periódica.

| Datos | Plazo | Cómo se aplica |
| --- | --- | --- |
| Cuenta y datos asociados | Mientras la uses. Se elimina tras 12 meses sin actividad | Automático. No aplica a cuentas con una solicitud de derechos abierta |
| Sesiones de acceso cerradas o vencidas | 30 días | Automático. Se conserva la última, que indica la fecha de actividad |
| Avisos internos | 6 meses | Automático |
| Eventos de uso seudonimizados | 24 meses | Automático |
| Copias de respaldo | Hasta 4 semanas | Al rotar las copias |
| Solicitudes de derechos | Se conservan con la cuenta anonimizada | **Por validar:** falta fijar un plazo |
| Bitácora de auditoría | Se conserva: no contiene datos de salud y la base impide borrarla | **Por validar:** falta fijar un plazo |
| Datos del piloto al cierre | Por decidir al cierre: continuar, transferir o cerrar | Manual |

La app no envía correos, por lo que hoy no existe un aviso previo a la eliminación por inactividad que llegue a quien no abre la aplicación.

## Con quién los compartimos

No vendemos tus datos ni los cedemos para publicidad. Render Services, Inc. aloja la aplicación y la base de datos por encargo nuestro en Virginia, Estados Unidos, y usa proveedores de ese país. Los respaldos cifrados quedan en otro proveedor, que se informará aquí antes del piloto. En Chile aún no existe una lista oficial de países con nivel adecuado de protección, por lo que no podemos afirmar que Estados Unidos lo tenga. Esta transferencia se apoya en el contrato de tratamiento de datos de Render, que limita el uso de tus datos a prestar el servicio y le exige medidas de seguridad y avisarnos de vulneraciones.

## Cómo los protegemos

Contraseñas con hash Argon2id, sesiones que expiran, comunicación cifrada, permisos por rol, bitácora de auditoría y respaldos cifrados.

## Tus derechos

Puedes pedir acceso, rectificación, supresión, oposición, portabilidad y bloqueo temporal en «Mis datos». Respondemos en 30 días corridos, con una prórroga única de hasta 30, y en 2 días hábiles el bloqueo. Si rechazamos tu solicitud o no respondemos a tiempo, puedes recurrir a la Agencia de Protección de Datos Personales.

## Solo para personas adultas

FitGoal entrega orientación general y no reemplaza una evaluación de salud.
