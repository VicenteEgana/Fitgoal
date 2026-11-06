# Procedimiento ante vulneraciones de seguridad

**Estado:** propuesta del equipo, por revisar con el docente guía y un abogado antes del piloto. Se apoya en el art. 14 sexies de la Ley 19.628, en el texto que introduce la Ley 21.719. Mientras esa reforma no entre en vigencia, el equipo aplica este procedimiento igual, como buena práctica.

## Qué se considera vulneración

Cualquier destrucción, filtración, pérdida o alteración accidental o ilícita de datos personales, y cualquier comunicación o acceso no autorizado a ellos. Incluye, por ejemplo, un acceso a datos de otra persona, un respaldo expuesto, un secreto publicado o una cuenta del equipo comprometida.

## Roles

| Rol | Persona | Responsabilidad |
| --- | --- | --- |
| Coordinación técnica | Jonatan Fernandez (suplente: Jorge Farias) | Contener, preservar evidencia y restablecer |
| Decisión de comunicar | Los tres responsables de los datos: Vicente Egaña, Jorge Farias y Jonatan Fernandez | Evaluar el riesgo y aprobar las comunicaciones |
| Registro | Quien coordine | Mantener el registro del incidente |

Es un incidente P1: se atiende de inmediato, incluso fuera del horario de soporte.

## Pasos

Los plazos internos son una propuesta: la ley exige actuar por los medios más expeditos posibles y sin dilaciones indebidas, sin fijar horas.

| Paso | Qué se hace | Plazo interno |
| --- | --- | --- |
| 1. Detectar y registrar | Anotar fecha y hora, quién lo detectó y qué se observó | De inmediato |
| 2. Contener | Detener el acceso afectado, bloquear cuentas comprometidas, invalidar sesiones y rotar los secretos expuestos | 1 hora desde la detección |
| 3. Preservar | Guardar registros técnicos y `audit_log`. No borrar evidencia | Junto con la contención |
| 4. Evaluar | Qué datos, cuántas personas, si hay datos de salud y si existe un riesgo razonable para sus derechos y libertades | 24 horas |
| 5. Reportar a la Agencia | Si hay riesgo razonable, por el medio más expedito disponible | Apenas se concluya la evaluación |
| 6. Comunicar a los titulares | Si hay datos sensibles, a cada persona afectada | Apenas se concluya la evaluación |
| 7. Restablecer | Corregir la causa, ejecutar pruebas y reabrir el acceso | Según SLA-5 |
| 8. Aprender | Revisión sin culpas en la retrospectiva y acciones de mejora | Sprint siguiente |

**Rotación de secretos.** Cambiar `JWT_SECRET` cierra todos los accesos. Cambiar `PSEUDONYM_SECRET` rompe la continuidad de los eventos de uso y de K2: solo se hace si ese secreto se expuso. Si se expone la base o un respaldo, se cambian también sus credenciales y claves de cifrado.

## Comunicación a los titulares

Estatura, peso, sexo y actividad se tratan como datos sensibles, por lo que la ley exige avisar también a los titulares. La comunicación debe usar un lenguaje claro y sencillo, y singularizar los datos afectados, las posibles consecuencias y las medidas adoptadas. Se envía a cada titular al correo de su cuenta, porque la app no tiene un canal externo. Si no fuera posible, la ley exige un aviso en un medio de comunicación social masivo y de alcance nacional.

**Plantilla.**

> Asunto: Aviso de seguridad sobre tus datos en FitGoal
>
> El [fecha] detectamos [qué ocurrió]. Los datos afectados son [datos]. Esto podría [posibles consecuencias]. Ya [medidas adoptadas]. Te recomendamos [acciones para la persona]. Puedes escribirnos a [contacto].

## Registro

Cada vulneración se registra, se haya reportado o no, con estos campos, que exige la ley para las comunicaciones realizadas:

| Campo | Contenido |
| --- | --- |
| Identificador y fechas | Ocurrencia, detección, contención y cierre |
| Naturaleza | Qué ocurrió y cuál fue la causa |
| Efectos | Consecuencias conocidas para las personas y el servicio |
| Categorías de datos | Según la clasificación del diccionario de datos |
| Titulares afectados | Número aproximado |
| Medidas | Las adoptadas para gestionarla y para precaver incidentes futuros |
| Comunicaciones | A la Agencia y a los titulares, con fecha y medio |
| Evaluación | Por qué se reportó o no, y quién lo decidió |

El registro no incluye contraseñas, tokens ni datos de salud de las personas afectadas.

## Falta completar antes del piloto

- Confirmar el canal de reporte a la Agencia, que aún debe constituirse.
- Crear el correo de contacto y de envío.
- Hacer un ensayo de mesa con un caso ficticio.
