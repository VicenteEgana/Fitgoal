# FitGoal · Arquitectura de la solución (borrador del capítulo para ES2)

Este documento reúne el diseño técnico de FitGoal que exige la Evaluación Sumativa 2: procesos de negocio en BPMN, casos de uso y componentes en UML, modelo y diccionario de datos, topología de comunicaciones, infraestructura y arquitectura integrada. Se redactó tomando como especificación el informe de formulación del 01-10-2026 (`FitGoal_Formulacion_Proyecto_Corregida.docx`) y se genera con código, de modo que los diagramas, el esquema SQL y el diccionario sean coherentes entre sí.

**Estado de implementación.** Estos diagramas describen el MVP objetivo. El modelo de datos ya está implementado y verificado como migración SQL (19 tablas, con las reglas de integridad probadas en PostgreSQL 18). El resto del código se alinea con este diseño por incrementos, conforme al cronograma del informe.

**Cómo regenerar.** Desde `docs/diagramas`: `node build.mjs` (diagramas) y `node generate.mjs` (SQL y documentos). `node schema/validate.mjs` aplica el esquema en PostgreSQL y prueba sus reglas.

## 1. Contexto del sistema

![Contexto del sistema](diagramas/out/png/ar-0-contexto.png)

FitGoal es usado por cuatro roles: el participante, el preparador físico, la nutricionista (por incorporar) y el administrador, que es el equipo fundador a cargo de la operación. El sistema depende de Render (API y base de datos del piloto), de un almacenamiento externo cifrado para los respaldos, de GitHub (código, tablero e integración continua), de Google Play (pruebas internas) y de un sondeo externo que mide la disponibilidad.

## 2. Procesos de negocio (BPMN)

Se modelaron cuatro procesos principales con BPMN 2.0. Los tres primeros forman el ciclo de valor de FitGoal: incorporar al participante y generar su borrador (P1), revisar y publicar con aprobación profesional (P2) y acompañar el seguimiento (P3). El cuarto (P4) responde a una obligación legal y ética propia de trabajar con datos asociados a salud: atender los derechos del titular sobre sus datos. Cada proceso tiene un diagrama de nivel 1, con carriles por actor, y otro con sus subprocesos expandidos. Las tareas azules son automáticas y representan la optimización del proceso: lo que el sistema resuelve sin intervención humana.

Los procesos se conectan así: P1 termina con un borrador en la cola de P2; P2 publica el plan que alimenta P3; un cambio de perfil en P3 reinicia P1; y P4 puede iniciarse en cualquier momento del ciclo.

### P1 · Registro, perfil y generación del borrador de rutina

![Registro, perfil y generación del borrador de rutina](diagramas/out/png/bpmn-p1-registro-y-borrador.png)

![P1 subprocesos](diagramas/out/png/bpmn-p1-subprocesos.png)

| Elemento | Descripción |
| --- | --- |
| Objetivo | Incorporar al participante con consentimiento informado y convertir su perfil en un borrador de rutina listo para revisión profesional. |
| Disparador | Una persona adulta decide iniciar un plan y abre la app. |
| Actores | Participante, sistema FitGoal y preparador físico (receptor del aviso). |
| Resultado | Borrador asignado a la cola del preparador, o caso pendiente si falta plantilla aprobada o profesional asignado. |
| Requerimientos | RF001, RF002, RF004, RF009, RNF001, RNF002, RNF004 |
| Indicadores | K1 (registro sin ayuda en menos de 5 minutos) y K6 (p95 menor a 5 segundos). |

**Flujo.**

1. El participante se registra con correo y contraseña y acepta los consentimientos (SP1.1).
2. Completa objetivo, nivel, días, duración y equipo; el sistema valida el perfil (SP1.2) y, si es inválido o requiere evaluación, lo devuelve para corrección o lo deriva al profesional.
3. El sistema selecciona una plantilla aprobada y genera el borrador con sus motivos (SP1.3).
4. Si hay plantilla, guarda el borrador, lo asigna al preparador y le envía un aviso; el participante ve el estado «en revisión». Si no la hay, registra un caso pendiente y avisa al equipo.

**Subprocesos.**

| Subproceso | Qué hace | Trazabilidad |
| --- | --- | --- |
| SP1.1 Registro y consentimiento | Mostrar finalidad y política, validar correo y contraseña, crear la cuenta con Argon2id, registrar consentimientos con su versión y emitir JWT y refresh token. | RF001, RF009, RNF002 |
| SP1.2 Validación del perfil | Validar tipos y rangos (edad adulta, 1 a 7 días únicos, duración permitida), aplicar la regla de datos nutricionales solo para perfiles ficticios, guardar una versión nueva y derivar si requiere evaluación. | RF001, RF002, RNF002 |
| SP1.3 Selección de plantilla y generación del borrador | Clasificar objetivo × nivel × equipo con la matriz vigente, filtrar plantillas aprobadas por días y duración, aplicar solo ajustes permitidos, crear el borrador con motivos y reemplazar el borrador activo anterior. | RF004, RF006 |

**Optimización.** Las validaciones y la selección de plantilla las ejecuta el sistema en menos de 5 segundos antes de que intervenga una persona. El preparador recibe solo borradores completos y con motivos de selección explicables, y no arma rutinas desde cero. Un cambio de perfil genera un borrador nuevo sin modificar el plan vigente.

### P2 · Revisión profesional y publicación del plan aprobado

![Revisión profesional y publicación del plan aprobado](diagramas/out/png/bpmn-p2-revision-y-publicacion.png)

![P2 subprocesos](diagramas/out/png/bpmn-p2-subprocesos.png)

| Elemento | Descripción |
| --- | --- |
| Objetivo | Garantizar que ningún plan llegue al participante sin la aprobación, trazable y versionada, de un profesional competente. |
| Disparador | Aviso de un nuevo borrador asignado al profesional. |
| Actores | Profesional (preparador físico para rutinas, nutricionista para minutas), sistema FitGoal y participante. |
| Resultado | Plan aprobado vigente y aviso interno al participante, o borrador rechazado conservando el último plan aprobado. |
| Requerimientos | RF004, RF005, RF006, RF008, RF010 |
| Indicadores | K5 (100% de planes visibles aprobados; cero minutas personales sin nutricionista) y K9 (minutos de revisión manual frente a asistida). |

**Flujo.**

1. El profesional abre su cola y toma el caso; el sistema lo marca «en revisión» y registra al revisor.
2. Revisa adecuación, frecuencia, técnica, progresión y restricciones autorizadas. Si pasan 2 días hábiles sin decisión, el sistema recuerda al profesional y avisa al Product Owner.
3. Decide si el borrador cumple los criterios. Si no cumple, registra el motivo y se ejecuta el rechazo (SP2.2). Si cumple, puede corregir el contenido antes de aprobar.
4. La publicación (SP2.1) verifica el rol competente y que el perfil siga vigente, y ejecuta en una sola transacción la revisión, el plan aprobado, el reemplazo del plan anterior, las sesiones programadas, el aviso y la auditoría.
5. El participante recibe el aviso, actualiza la app y consulta su plan aprobado.

**Subprocesos.**

| Subproceso | Qué hace | Trazabilidad |
| --- | --- | --- |
| SP2.1 Publicación del plan aprobado | Verificar rol competente y estado del borrador; si el perfil cambió, marcar el borrador como reemplazado y generar otro; en caso contrario registrar la revisión, crear el plan aprobado y reemplazar el vigente, programar las sesiones y, en paralelo, crear el aviso interno y registrar la auditoría. | RF006, RF008, RF010 |
| SP2.2 Rechazo del borrador | Registrar la revisión con el motivo obligatorio, cambiar el estado a rechazado, conservar el último plan aprobado como vigente, avisar al participante sin detalle sensible y al Product Owner, y registrar la auditoría. | RF006, RF010 |

**Optimización.** La cola de casos asignados, los motivos de selección y la corrección en la misma pantalla reducen el trabajo manual del profesional. La publicación es transaccional: o se publica todo o no se publica nada. La base de datos impide que un rol no competente apruebe y que un plan aprobado se modifique.

### P3 · Seguimiento de sesiones y progreso

![Seguimiento de sesiones y progreso](diagramas/out/png/bpmn-p3-seguimiento.png)

![P3 subprocesos](diagramas/out/png/bpmn-p3-subprocesos.png)

| Elemento | Descripción |
| --- | --- |
| Objetivo | Permitir que el participante consulte su plan aprobado, registre las sesiones realizadas y observe su continuidad, calculando la adherencia de forma automática. |
| Disparador | El participante tiene un plan vigente publicado (fin de P2). |
| Actores | Participante y sistema FitGoal. |
| Resultado | Sesiones registradas, historial actualizado y adherencia calculada; un cambio de perfil reinicia el ciclo en P1. |
| Requerimientos | RF002, RF007, RF008, RF009 |
| Indicadores | K2 (retención en la semana 4), K3 (adherencia declarada mayor o igual a 75%) y K4 (utilidad percibida). |

**Flujo.**

1. El participante consulta el plan y la sesión programada; el sistema entrega solo el plan vigente aprobado.
2. Realiza la sesión fuera de la app y la registra como realizada, con su peso solo si está habilitado y hay consentimiento (SP3.1).
3. El sistema actualiza el historial y calcula la adherencia; el participante consulta su progreso.
4. Cada domingo a las 23:59 el sistema cierra la semana (SP3.2): las sesiones no registradas cuentan como no realizadas y, si el participante lo activó, crea un recordatorio interno.
5. Si el participante cambia su disponibilidad u objetivo, el flujo continúa en P1 con un nuevo borrador, y el plan vigente se mantiene.

**Subprocesos.**

| Subproceso | Qué hace | Trazabilidad |
| --- | --- | --- |
| SP3.1 Registro de sesión y peso | Verificar que la sesión es del plan vigente del participante y que su fecha no es futura, marcarla como realizada, verificar consentimiento y habilitación antes de guardar el peso y registrar el evento seudonimizado. | RF007, RF009, RNF002 |
| SP3.2 Cierre semanal y adherencia | Contar sesiones programadas y declaradas, tratar las no registradas como no realizadas, calcular la adherencia acumulada con el denominador inicial, guardar el evento y crear el recordatorio si corresponde. | RF007, RF008 |

**Optimización.** Las sesiones se programan automáticamente al publicar el plan y la adherencia se calcula sin intervención. El peso es opcional y se bloquea sin consentimiento, de modo que el seguimiento no exige datos que el participante no haya autorizado.

### P4 · Atención de derechos sobre datos personales

![Atención de derechos sobre datos personales](diagramas/out/png/bpmn-p4-derechos-de-datos.png)

![P4 subprocesos](diagramas/out/png/bpmn-p4-subproceso.png)

| Elemento | Descripción |
| --- | --- |
| Objetivo | Responder en plazo y con trazabilidad las solicitudes del titular sobre sus datos, tratándose de datos asociados a salud. |
| Disparador | El participante quiere ejercer un derecho sobre sus datos. |
| Actores | Participante, sistema FitGoal y responsable de operación (administrador). |
| Resultado | Solicitud resuelta con comprobante, registro de la resolución y auditoría. |
| Requerimientos | RF009, RF010, RNF002 |
| Indicadores | Se propone medir el porcentaje de solicitudes respondidas dentro del plazo (se formaliza en la sección de KPI y SLA). |

**Flujo.**

1. El participante elige el tipo de derecho (acceso, rectificación, oposición, bloqueo, exportación o eliminación) y envía la solicitud.
2. El sistema la registra, emite el comprobante y calcula el plazo: 30 días corridos, o 2 días hábiles para el bloqueo.
3. El responsable de operación verifica la identidad y el alcance. Si quedan 5 días del plazo, evalúa la prórroga única de hasta 30 días.
4. Si procede, ejecuta el derecho según su tipo (SP4.1); si no, responde con el fundamento del rechazo.
5. El sistema registra la resolución, audita y avisa al titular, que recibe la respuesta y el comprobante.

**Subprocesos.**

| Subproceso | Qué hace | Trazabilidad |
| --- | --- | --- |
| SP4.1 Ejecución según el tipo de derecho | Acceso: copia de los datos. Rectificación: nueva versión del perfil conservando la anterior. Oposición: dejar de tratar para la finalidad y registrar la revocación. Bloqueo: suspender el tratamiento afectado dentro de 2 días hábiles. Exportación: archivo portable en JSON. Eliminación: eliminar o anonimizar y registrar la solicitud para reaplicarla tras restaurar copias. | RF009 |

**Optimización.** El comprobante y el plazo se calculan automáticamente, el sistema alerta antes del vencimiento y la ejecución queda auditada. Las eliminaciones se registran para reaplicarse si se restaura una copia de respaldo.

## 3. Casos de uso (UML)

![Casos de uso del participante](diagramas/out/png/cu-1-participante.png)

![Casos de uso de profesionales y administración](diagramas/out/png/cu-2-profesionales-y-administracion.png)

Los 31 casos de uso cubren los diez requerimientos funcionales. CU-02 (autenticación) es previo a todos los casos protegidos. CU-13, CU-14 y CU-16 son funciones del sistema incluidas por otros casos; CU-15 extiende a CU-07 y CU-21 a CU-23 extienden a CU-20. Cada caso se relaciona con el problema del informe: personas que no saben estructurar un plan coherente (CU-03 a CU-06), la necesidad de validación profesional (CU-17 a CU-24), el seguimiento que sostiene la continuidad (CU-07 a CU-09) y el cuidado de datos de salud (CU-10, CU-16, CU-27).

### Especificación de los casos de uso

| Caso de uso | Actor | Requerimientos | Precondición | Flujo principal | Flujos alternativos | Postcondición |
| --- | --- | --- | --- | --- | --- | --- |
| **CU-01** Registrarse y aceptar consentimientos | Participante | RF001, RF009 | Persona adulta con la app instalada y conexión; sin cuenta previa. | 1) La app muestra la finalidad, la política de datos y los consentimientos. 2) El participante acepta los necesarios y escribe correo y contraseña. 3) El sistema valida el formato y la política de contraseña. 4) Crea la cuenta con hash Argon2id y registra cada consentimiento con la versión de la política. 5) Emite el JWT de 15 minutos y el refresh token rotativo. 6) Registra el evento seudonimizado y la auditoría. | Si no acepta, no se crea la cuenta ni se tratan datos. Si el correo ya existe o los datos son inválidos, responde con un mensaje genérico. Con 10 intentos fallidos en 15 minutos responde 429. | Cuenta de rol participante creada, sesión iniciada y consentimientos registrados. |
| **CU-02** Iniciar y cerrar sesión | Todos los roles | RNF002 | Cuenta activa. | 1) El usuario ingresa correo y contraseña. 2) El sistema verifica el hash y que la cuenta no esté bloqueada. 3) Crea la sesión (sid y versión de sesión) y emite JWT y refresh token. 4) La app guarda los tokens en el almacén seguro del sistema operativo. 5) Al cerrar sesión se revoca el refresh token. | Credenciales inválidas: error genérico. Cuenta bloqueada: acceso denegado. Cambiar la contraseña o el rol invalida todas las sesiones anteriores. | Sesión activa o revocada. |
| **CU-03** Completar y actualizar perfil y objetivo | Participante | RF001, RF002 | Sesión activa y consentimiento de perfil de entrenamiento. | 1) El participante ingresa edad, objetivo, nivel, días disponibles, duración y equipo. 2) El sistema ejecuta CU-13 (validar perfil). 3) Guarda una nueva versión del perfil. 4) Registra la auditoría. | Datos inválidos: 400 indicando el campo. Peso, talla, sexo o actividad en un perfil real: rechazados. Un cambio posterior crea otra versión sin modificar el plan vigente. | Perfil versionado; el plan vigente permanece intacto. |
| **CU-04** Solicitar rutina de entrenamiento | Participante | RF004 | Perfil vigente válido, consentimiento y profesional asignado. | 1) El participante pulsa «Solicitar rutina». 2) El sistema ejecuta CU-13 y CU-14. 3) Guarda el borrador y lo asigna al preparador. 4) Crea un aviso para el preparador. 5) El participante ve el estado «en revisión». | Sin plantilla aprobada o sin profesional asignado: borrador pendiente con su motivo y aviso al equipo. Perfil que requiere evaluación: derivación sin generación automática. | Borrador activo en la cola; el participante no ve su contenido. |
| **CU-05** Consultar el estado de la solicitud | Participante | RF006 | Existe una solicitud. | 1) La app consulta el estado de la solicitud. 2) El sistema devuelve solo el estado (pendiente, en revisión, aprobada o rechazada con un mensaje general), nunca el contenido. | Sin solicitud: estado vacío. | El participante conoce el estado sin ver borradores. |
| **CU-06** Consultar el plan aprobado vigente | Participante | RF004, RF005, RF006 | Existe un plan aprobado vigente. | 1) La app consulta el plan vigente. 2) El sistema devuelve la versión vigente con sus sesiones programadas. 3) Registra el evento «plan consultado». | Sin plan: mensaje de que está pendiente. Si hay un borrador nuevo, el plan anterior sigue visible. | Plan vigente mostrado. |
| **CU-07** Registrar sesión realizada | Participante | RF007 | Plan vigente con sesiones programadas. | 1) El participante elige la sesión y la marca como realizada, con una nota opcional. 2) El sistema verifica que es de su plan vigente y que la fecha no es futura. 3) Guarda la fecha de realización y actualiza la adherencia. 4) Registra el evento seudonimizado. | Sesión ajena o futura: 403 o 400. Sesión ya registrada: la operación es idempotente. | Sesión registrada y adherencia actualizada. |
| **CU-08** Consultar historial y progreso | Participante | RF007 | Sesión activa. | 1) La app consulta el progreso. 2) El sistema devuelve las sesiones programadas y realizadas por semana, la adherencia acumulada y, con consentimiento, el historial de peso. 3) La app lo muestra como lista o gráfico. | Sin registros: estado vacío. | Historial mostrado. |
| **CU-09** Consultar avisos internos | Participante | RF008 | Sesión activa. | 1) La app consulta los avisos. 2) El sistema devuelve avisos sin datos sensibles (nueva versión del plan, recordatorios, solicitudes de derechos). 3) El participante abre un aviso y queda marcado como leído. | Sin avisos: lista vacía. | Aviso leído. Meta de propagación menor a 30 segundos tras publicar. |
| **CU-10** Solicitar el ejercicio de derechos sobre mis datos | Participante | RF009 | Sesión activa. | 1) El participante elige el derecho a ejercer. 2) La app envía la solicitud. 3) El sistema emite el comprobante y calcula el plazo (30 días corridos; 2 días hábiles para el bloqueo). 4) Avisa a administración. 5) El participante consulta el estado hasta recibir la respuesta (continúa en CU-27). | Si ya existe una solicitud abierta del mismo tipo, devuelve la existente. | Solicitud registrada con comprobante. |
| **CU-11** Consultar estimación energética (perfil ficticio) | Participante | RF003 | Perfil ficticio con sexo, peso, talla y nivel de actividad. | 1) La app solicita la estimación energética. 2) El sistema aplica Mifflin-St Jeor con unidades y versión de fórmula. 3) Devuelve la estimación como referencia, tras ejecutar CU-16. | Perfil real: bloqueado; no se muestran calorías objetivo, macros ni minutas como indicación personal. Datos incompletos: 400. | Estimación mostrada con la advertencia de que no sustituye una evaluación profesional. |
| **CU-12** Consultar minuta aprobada (prototipo ficticio) | Participante | RF005 | Minuta aprobada para un perfil ficticio. | 1) La app solicita la minuta vigente. 2) El sistema ejecuta CU-16. 3) Devuelve la minuta aprobada. | Perfil real: bloqueado hasta contar con nutricionista y habilitación de datos. | Minuta del prototipo mostrada. |
| **CU-13** Validar perfil | Sistema | RF001, RF002 | Perfil recibido. | 1) Valida tipos y rangos: edad entera de 18 o más, 1 a 7 días únicos, duración de 20, 30, 45 o 60 minutos, objetivo, nivel y equipo. 2) Aplica la regla de datos nutricionales: solo perfiles ficticios. 3) Determina si requiere evaluación profesional. | Datos inválidos: error 400. Requiere evaluación: se deriva al profesional sin generación automática. | Perfil válido y apto, o error con el campo afectado. |
| **CU-14** Seleccionar plantilla y generar borrador | Sistema | RF004 | Perfil válido y reglas de entrenamiento aprobadas vigentes. | 1) Clasifica objetivo × nivel × equipo con la matriz de reglas. 2) Filtra las plantillas aprobadas por días y duración. 3) Aplica solo los ajustes que permite la plantilla. 4) Crea el borrador con versión, motivos y perfil usado. 5) Reemplaza el borrador activo anterior y asigna al revisor. | Sin coincidencia: borrador pendiente («sin plantilla»). Sin profesional asignado: pendiente («sin profesional»). | Borrador creado o caso pendiente. |
| **CU-15** Registrar peso | Participante | RF007 | Consentimiento de seguimiento y datos habilitados. | 1) El participante ingresa su peso. 2) El sistema ejecuta CU-16. 3) Valida que sea positivo, de hasta 500 kg y uno por día. 4) Lo guarda. | Sin consentimiento o sin habilitación: se rechaza solo el peso; la sesión sí queda guardada. | Registro de peso guardado. |
| **CU-16** Verificar consentimiento y habilitación de datos | Sistema | RF009, RNF002 | Operación que requiere datos de salud o nutricionales. | 1) Consulta el último consentimiento por finalidad. 2) Verifica la habilitación de datos y si la cuenta es ficticia. | Sin consentimiento vigente o revocado: 403 con explicación. | Operación autorizada o rechazada. |
| **CU-17** Gestionar ejercicios y plantillas de rutina | Preparador físico | RF004, RF010 | Rol preparador físico. | 1) Crea o edita ejercicios con descripción y atribución. 2) Crea una plantilla en borrador: objetivo, nivel, equipo, rango de días, duración, semanas y ajustes permitidos. 3) Compone las sesiones con ejercicios e indicaciones. 4) Guarda y registra la auditoría. | Una plantilla aprobada no se edita: se crea una versión nueva. | Plantilla en borrador lista para aprobar (CU-18). |
| **CU-18** Aprobar plantillas y reglas de entrenamiento | Preparador físico | RF006 | Plantilla o reglas en borrador. | 1) Revisa la plantilla o las reglas de entrenamiento. 2) Aprueba: el sistema registra aprobador, rol y fecha. 3) La versión aprobada anterior pasa a retirada. | Si no aprueba, queda en borrador con observaciones. La base de datos exige que el aprobador tenga rol preparador. | Plantilla o reglas vigentes. |
| **CU-19** Consultar la cola de casos asignados | Preparador físico, nutricionista | RF006, RF010 | Rol profesional con casos asignados. | 1) El profesional abre su cola. 2) El sistema lista los borradores en estado borrador o en revisión de los participantes asignados, solo de su ámbito. 3) Muestra antigüedad y motivos de selección. | Sin casos: lista vacía. Acceso a un caso ajeno: 403. | Cola mostrada. |
| **CU-20** Revisar un borrador asignado | Preparador físico, nutricionista | RF004, RF005, RF006 | Caso asignado en la cola. | 1) El profesional toma el caso (estado «en revisión»). 2) Revisa adecuación, frecuencia, técnica, progresión y restricciones, con los motivos de selección. 3) Decide: aprobar (CU-21), corregir y aprobar (CU-22) o rechazar (CU-23). | Puede liberar el caso y volver a la cola. Con 2 días hábiles sin decisión, el sistema recuerda al profesional y avisa al Product Owner. | Decisión registrada. |
| **CU-21** Aprobar y publicar el plan | Preparador físico, nutricionista | RF006, RF008 | Borrador en revisión por un profesional competente. | 1) El profesional aprueba. 2) El sistema verifica el rol competente y que el perfil usado siga vigente. 3) En una transacción registra la revisión, crea el plan aprobado, reemplaza el vigente, programa las sesiones, crea el aviso y audita. | Si el perfil cambió, el borrador queda reemplazado y se genera otro. Si falla algo, no se publica nada. | Plan vigente publicado y aviso al participante. |
| **CU-22** Corregir el contenido antes de aprobar | Preparador físico, nutricionista | RF006 | Borrador en revisión. | 1) El profesional edita el contenido dentro de los ajustes permitidos. 2) El sistema guarda el contenido corregido. 3) Continúa en CU-21. | Cambios fuera de los ajustes permitidos: rechazados. | Contenido corregido registrado. |
| **CU-23** Rechazar el borrador con motivo | Preparador físico, nutricionista | RF006 | Borrador en revisión. | 1) El profesional escribe el motivo, obligatorio. 2) El sistema registra la revisión «rechazado» y cierra el borrador. 3) Conserva el último plan aprobado como vigente. 4) Avisa al participante sin detalle sensible y al Product Owner, y audita. | Sin motivo: la base de datos rechaza la operación. | Borrador rechazado. |
| **CU-24** Gestionar y aprobar alimentos y reglas nutricionales | Nutricionista | RF003, RF005 | Rol nutricionista. | 1) Carga alimentos con porción, energía, macronutrientes, grupo de sustitución y exclusiones. 2) Define factores de actividad, ajustes por objetivo y macros en las reglas de nutrición. 3) Aprueba el contenido; el sistema registra aprobador y fecha. | Mientras no exista nutricionista, el contenido sigue siendo ficticio y la publicación personal permanece bloqueada. | Alimentos y reglas nutricionales aprobados. |
| **CU-25** Gestionar cuentas y roles | Administrador | RF010 | Rol administrador. | 1) Crea cuentas de profesionales o administradores. 2) Cambia roles o bloquea cuentas. 3) El sistema incrementa la versión de sesión, lo que invalida los accesos anteriores. 4) Registra la auditoría. | Nadie puede autoasignarse privilegios. | Cuenta creada o modificada. |
| **CU-26** Asignar casos a profesionales | Administrador | RF010 | Participante y profesional existentes. | 1) El administrador elige participante, profesional y ámbito. 2) El sistema verifica el rol del profesional. 3) Crea la asignación activa y finaliza la anterior. 4) Audita. | Un participante solo puede tener un profesional activo por ámbito. | Asignación vigente. |
| **CU-27** Resolver solicitudes de derechos sobre datos | Administrador | RF009 | Solicitud de derechos recibida. | 1) El administrador lista las solicitudes abiertas por plazo. 2) Verifica identidad y alcance. 3) Decide la procedencia y ejecuta el derecho según su tipo. 4) Registra la resolución, avisa al titular y audita. | Rechazo fundado. Prórroga única de hasta 30 días, con alerta cuando quedan 5 días. | Solicitud resuelta con comprobante. |
| **CU-28** Consultar la auditoría | Administrador | RF010 | Rol administrador. | 1) Filtra por entidad, actor o período. 2) Consulta los eventos «entidad.verbo» con la versión de la entidad; no incluyen tokens ni contenido sensible. | La bitácora es de solo lectura: no se modifica ni se borra. | Eventos consultados. |
| **CU-29** Consultar los indicadores del piloto | Administrador | RF007 | Piloto en ejecución o con datos de prueba. | 1) El administrador elige un indicador (K1 a K9). 2) El sistema calcula numerador y denominador con eventos seudonimizados, sesiones y respuestas cargadas. 3) Muestra el tamaño de la muestra y sus límites. | Sin datos: se informa «sin mediciones»; no se estiman resultados. | Indicador mostrado. |
| **CU-30** Operar respaldo y restauración | Administrador | RNF003 | Job de respaldo configurado. | 1) Verifica la ejecución diaria del respaldo. 2) Restaura una copia en un ambiente aislado. 3) Comprueba los conteos de perfiles, planes y aprobaciones. 4) Reaplica las eliminaciones pendientes. 5) Registra el RPO y el RTO medidos. | Si la restauración falla o supera el RTO de 4 horas, se registra como incidente y se corrige antes del piloto. | Recuperación demostrada. |
| **CU-31** Monitorear disponibilidad y atender incidentes | Administrador | RNF003 | Servicio desplegado. | 1) Revisa los sondeos de API y base de datos, cada 5 minutos. 2) Ante una falla, detiene el acceso afectado y preserva los registros técnicos. 3) Evalúa el alcance y las obligaciones de comunicación. 4) Restablece el servicio y registra el incidente. | Si hay riesgo para datos personales, se activa la evaluación de obligaciones de comunicación. | Servicio restablecido e incidente registrado. |

## 4. Diagrama de componentes

![Diagrama de componentes](diagramas/out/png/ar-1-componentes.png)

El backend es un monolito modular: cada módulo es un componente lógico con responsabilidades y dependencias explícitas, y todos acceden a los datos mediante la capa de acceso a datos. Se eligió un solo despliegue porque tres estudiantes pueden operarlo; los límites entre módulos y los contratos internos permiten separarlos en el futuro si fuera necesario.

| Componente | Tipo | Responsabilidad | Depende de | Rutas o puertos |
| --- | --- | --- | --- | --- |
| Presentación por rol | App Flutter | Pantallas de participante, profesional y administrador, con navegación por rol. | Estado y navegación; Cliente de la API | — |
| Estado y navegación | App Flutter | Estado de la sesión, formularios y validaciones de interfaz (prevención de errores y mensajes de estado). | Cliente de la API | — |
| Cliente de la API | App Flutter | HTTP/JSON con JWT, tiempos de espera de 10 s, un reintento en consultas y control de versiones del perfil. | Almacén seguro de tokens; API REST | Todas las rutas |
| Almacén seguro de tokens | App Flutter | Guarda JWT y refresh token en el almacenamiento seguro del sistema operativo (Keystore). | — | — |
| Consulta de avisos | App Flutter | Actualiza el plan y los avisos al abrir o refrescar la app. | Cliente de la API | GET /notifications/me, GET /plans/me |
| Plataforma transversal | API REST | Validación de entradas, autenticación y autorización por rol y relación con el recurso, límite de solicitudes, cabeceras y CORS, registros sin datos sensibles y /health. | Identidad; Acceso a datos | GET /health |
| Identidad | API REST | Registro, inicio y cierre de sesión, Argon2id, JWT de 15 minutos, refresh token rotativo, roles y cuentas. | Auditoría; Acceso a datos | POST /auth/register, /auth/login, /auth/refresh, /auth/logout, /auth/change-password; POST y PATCH /admin/users |
| Perfil y consentimiento | API REST | Perfil versionado y validado; consentimientos con versión de la política. | Auditoría; Acceso a datos | GET y PUT /profiles/me; GET y POST /consents |
| Catálogo | API REST | Ejercicios, plantillas, reglas y alimentos con versión y aprobación del profesional competente. | Auditoría; Acceso a datos | /catalog/exercises, /catalog/templates, /catalog/rules, /catalog/foods (con /approve) |
| Cálculo energético | API REST | Estimación Mifflin-St Jeor con unidades y versión de fórmula, solo para perfiles ficticios. | Perfil y consentimiento; Catálogo (reglas) | GET /estimates/energy |
| Borradores | API REST | Selección de plantilla aprobada y generación del borrador con motivos; asignación del revisor. | Perfil y consentimiento; Catálogo; Cálculo energético; Notificaciones; Auditoría | POST /drafts; GET /drafts/me/status |
| Revisión | API REST | Cola de casos, decisión del profesional y publicación transaccional del plan aprobado. | Borradores; Notificaciones; Auditoría | GET /reviews/queue; POST /reviews/{id}/claim y /decision; GET /plans/me |
| Progreso | API REST | Sesiones programadas y realizadas, peso con consentimiento y cálculo de adherencia. | Revisión (plan vigente); Perfil y consentimiento; Notificaciones | GET /sessions/me; POST /sessions/{id}/complete; GET y POST /weights/me; GET /progress/me |
| Notificaciones | API REST | Avisos internos sin información sensible. | Acceso a datos | GET /notifications/me; POST /notifications/{id}/read |
| Derechos de datos | API REST | Solicitudes del titular, comprobantes, plazos y ejecución por tipo de derecho. | Perfil y consentimiento; Identidad; Auditoría | GET y POST /data-requests; GET /admin/data-requests; POST /admin/data-requests/{id}/resolve |
| Auditoría | API REST | Bitácora de solo anexado con autor, fecha, entidad y versión. | Acceso a datos | GET /admin/audit |
| Acceso a datos | API REST | Repositorios con SQL parametrizado, transacciones, pool acotado y migraciones versionadas. | PostgreSQL | — |
| PostgreSQL 18 | Base de datos (Render) | 19 tablas con claves foráneas, restricciones y disparadores. | — | Puerto 5432, TLS |
| Job de respaldo | Cron job (Render) | Exportación diaria con pg_dump y cifrado AES-256 hacia el almacenamiento externo. | PostgreSQL; Almacenamiento externo | — |
| Sondeo externo | Servicio externo | Consulta /health cada 5 minutos para medir la disponibilidad. | API REST | GET /health |

## 5. Modelo de datos

![Vista general del modelo de datos](diagramas/out/png/er-0-general.png)

El modelo relacional tiene 19 tablas en cuatro módulos y se implementa en PostgreSQL 18, elegido por las relaciones entre usuarios, perfiles, borradores, revisiones y planes, y por la necesidad de integridad referencial y transacciones. La base de datos aplica por sí misma las reglas que el informe declara como requisitos: solo el preparador puede aprobar rutinas y solo la nutricionista minutas, un plan aprobado no se modifica ni se borra, la bitácora es de solo anexado, los datos nutricionales no existen en perfiles reales y hay un único plan vigente por participante y tipo.

![ER 1](diagramas/out/png/er-1-identidad.png)

![ER 2](diagramas/out/png/er-2-catalogo.png)

![ER 3](diagramas/out/png/er-3-planes.png)

![ER 4](diagramas/out/png/er-4-seguimiento.png)

### Correspondencia con las entidades del informe

| Entidad del informe | Tabla | Observación |
| --- | --- | --- |
| Usuario | users | Cuenta con rol: participante, preparador físico, nutricionista o administrador. |
| Perfil | profile_versions | Cada cambio crea una versión; el borrador referencia la versión usada. |
| Objetivo | profile_versions.objective | Bajar, mantener o subir de peso, dentro del perfil versionado. |
| Plantilla | routine_templates, template_exercises, exercises | Plantilla aprobada por el preparador; los ejercicios se componen desde el catálogo. |
| Versión de reglas | rule_versions | Matriz de selección de entrenamiento y factores de nutrición, con aprobación. |
| Borrador | plan_drafts | Propuesta (rutina o minuta) que espera revisión; el participante no la ve. |
| Plan aprobado | approved_plans | Copia inmutable del contenido aprobado y publicado. |
| Revisión | reviews | Decisión del profesional competente; la base exige rol y motivo del rechazo. |
| Sesión | training_sessions (entrenamiento), auth_sessions (acceso) | Sesión programada y declarada; la sesión de autenticación se guarda aparte. |
| Consentimiento | consents | Registro anexado con la versión de la política. |
| Auditoría | audit_log | Bitácora de solo anexado. |

### Relaciones

| Tabla hija | Columnas | Tabla padre | Columnas | Cardinalidad |
| --- | --- | --- | --- | --- |
| auth_sessions | user_id | users | id | 1 : 0..N |
| consents | user_id | users | id | 1 : 0..N |
| data_requests | user_id | users | id | 1 : 0..N |
| data_requests | resolved_by | users | id | 0..1 : 0..N |
| case_assignments | participant_id | users | id | 1 : 0..N |
| case_assignments | assigned_by | users | id | 1 : 0..N |
| case_assignments | professional_id, professional_role | users | id, role | 1 : 0..N |
| exercises | created_by | users | id | 1 : 0..N |
| rule_versions | author_id | users | id | 1 : 0..N |
| rule_versions | approved_by, approved_by_role | users | id, role | 0..1 : 0..N |
| routine_templates | author_id | users | id | 1 : 0..N |
| routine_templates | approved_by, approved_by_role | users | id, role | 0..1 : 0..N |
| template_exercises | template_id | routine_templates | id | 1 : 0..N |
| template_exercises | exercise_id | exercises | id | 1 : 0..N |
| foods | author_id | users | id | 1 : 0..N |
| foods | approved_by, approved_by_role | users | id, role | 0..1 : 0..N |
| profile_versions | user_id | users | id | 1 : 0..N |
| plan_drafts | user_id | users | id | 1 : 0..N |
| plan_drafts | template_id | routine_templates | id | 0..1 : 0..N |
| plan_drafts | rule_version_id | rule_versions | id | 1 : 0..N |
| plan_drafts | assigned_reviewer_id | users | id | 0..1 : 0..N |
| plan_drafts | profile_version_id, user_id | profile_versions | id, user_id | 1 : 0..N |
| reviews | draft_id, draft_kind | plan_drafts | id, kind | 1 : 0..1 |
| reviews | reviewer_id, reviewer_role | users | id, role | 1 : 0..N |
| approved_plans | user_id | users | id | 1 : 0..N |
| approved_plans | review_id, draft_id, decision | reviews | id, draft_id, decision | 1 : 0..1 |
| approved_plans | draft_id, kind | plan_drafts | id, kind | 1 : 0..1 |
| training_sessions | plan_id, user_id | approved_plans | id, user_id | 1 : 0..N |
| weight_records | user_id | users | id | 1 : 0..N |
| notifications | user_id | users | id | 1 : 0..N |
| audit_log | actor_id | users | id | 0..1 : 0..N |

### Disparadores y funciones

| Nombre | Tabla | Finalidad |
| --- | --- | --- |
| audit_log_append_only | audit_log | Impide modificar o borrar filas de la bitácora. |
| approved_plans_frozen | approved_plans | Congela el contenido publicado (solo cambian el estado y la fecha de reemplazo) y impide borrar planes, salvo que el titular haya ejercido su derecho de eliminación. |
| template_exercises_frozen | template_exercises | Impide cambiar los ejercicios de una plantilla que ya no es borrador; se crea una versión nueva. |

### Verificación del modelo

El script `docs/diagramas/schema/validate.mjs` aplica la migración en un PostgreSQL real (PGlite 0.5.8, que ejecuta PostgreSQL 18.3) y ejecuta 35 comprobaciones de integridad: contraseña con Argon2id, correo único sin distinguir mayúsculas, perfil adulto, días válidos, datos nutricionales solo en perfiles ficticios, competencia del aprobador, plantillas y planes inmutables, un borrador activo por tipo, bitácora de solo anexado y formato del seudónimo.

El diccionario de datos completo, con cada columna, tipo, restricción y descripción, está en `docs/diccionario_de_datos.md`.

## 6. Comportamiento

![Estados del borrador y del plan](diagramas/out/png/st-1-estados.png)

![Secuencia del flujo crítico](diagramas/out/png/sq-1-secuencia.png)

El diagrama de estados define el ciclo de vida del borrador: nace «borrador» (o «pendiente» si no hay plantilla o profesional), pasa a «en revisión» cuando el profesional toma el caso y termina «aprobado», «rechazado» o «reemplazado». El plan aprobado solo está «vigente» o «reemplazado». La secuencia muestra el flujo crítico completo, desde la solicitud hasta la consulta del plan aprobado, con las transacciones que garantizan la consistencia entre revisión, publicación y auditoría.

## 7. Topología de comunicaciones

![Topología de comunicaciones](diagramas/out/png/ar-2-topologia.png)

Todo el tráfico del usuario entra por HTTPS (puerto 443) al borde gestionado de Render, que termina TLS 1.2 o superior; la API y la base de datos se comunican por la red privada del proveedor y la base exige TLS. El tramo entre el borde y el servicio ocurre dentro de la red del proveedor, y se solicitará evidencia de su protección antes del piloto.

| N.º | Enlace | Protocolo y puerto | Seguridad | Características de transmisión |
| --- | --- | --- | --- | --- |
| 1 | App Android → Internet → borde de Render | HTTPS (HTTP/1.1 o HTTP/2), puerto 443 | TLS 1.2 o superior con certificado gestionado; JWT de acceso de 15 minutos | JSON UTF-8; carga menor a 100 KB; 120 solicitudes por minuto por usuario e IP; tiempo de espera del cliente de 10 s, con un reintento en consultas |
| 2 | Borde de Render → servicio de la API | HTTP dentro de la red del proveedor, puerto PORT | El TLS termina en el borde gestionado; se solicitará al proveedor evidencia del tramo interno | Mismo formato y carga; el servicio solo se publica a través del borde |
| 3 | API → PostgreSQL | Protocolo de PostgreSQL, puerto 5432 | TLS obligatorio; usuario con privilegios mínimos; sin acceso público | Red privada de Render; pool de hasta 10 conexiones; consultas parametrizadas; tiempo máximo de consulta de 5 s |
| 4 | Job de respaldo → PostgreSQL | Protocolo de PostgreSQL, puerto 5432 | TLS obligatorio; usuario de solo lectura | Exportación diaria con pg_dump fuera del horario de uso; RPO de 24 h |
| 5 | Job de respaldo → almacenamiento externo | HTTPS, puerto 443 (API compatible con S3) | Archivo cifrado con AES-256 antes de subir; claves separadas de los datos | 7 copias diarias y 4 semanales; restauración ensayada antes del piloto; RTO de 4 h |
| 6 | Sondeo externo → borde de Render | HTTPS, puerto 443, GET /health | TLS 1.2 o superior; la ruta no expone datos personales | Cada 5 minutos; comprueba API y base de datos (SELECT 1); meta de disponibilidad ≥ 95% en 28 días |
| 7 | Desarrollo → GitHub → Render | HTTPS 443 o SSH 22; deploy hook por HTTPS | Autenticación individual; secretos fuera del repositorio | Análisis y pruebas en cada cambio; despliegue solo si pasan; revisión del responsable de operación |
| 8 | Google Play → smartphone | HTTPS, puerto 443 | Firma de la aplicación y canal de Play | Distribución por prueba interna; la producción pública se difiere |

## 8. Infraestructura

![Diagrama de infraestructura](diagramas/out/png/ar-3-infraestructura.png)

| Ambiente | Dónde corre | Datos | Secretos y accesos | Uso y condición |
| --- | --- | --- | --- | --- |
| Desarrollo local | Estación de cada integrante: API y PostgreSQL 18 en Docker Compose; la app en emulador o teléfono | Ficticios; sin datos personales ni de salud | Credenciales propias de desarrollo; archivo .env fuera del repositorio | Construir y probar cada cambio; pruebas automáticas con PostgreSQL en proceso (PGlite) |
| Staging local | Misma configuración, con migraciones y datos de prueba idénticos a los del piloto | Ficticios | Servicios y credenciales separados de los de desarrollo | Aceptación de cada hito y ensayo de revisión y restauración |
| Piloto en Render | Servicio web de la API y PostgreSQL 18 gestionados, con respaldo cifrado externo | Reales solo si se resuelve la habilitación de datos; de lo contrario, ficticios | Base de datos y secretos independientes; acceso individual del equipo | Se habilita tras aceptar pruebas, restauración, política de datos y financiamiento |

Las cifras de CPU, memoria y almacenamiento corresponden a las tarifas públicas consultadas el 1 de octubre de 2026 y a las condiciones del presupuesto del informe; deben confirmarse al contratar. La región se definirá al abrir la cuenta, considerando la latencia desde Chile.

## 9. Arquitectura de la solución

![Arquitectura de la solución](diagramas/out/png/ar-4-arquitectura-integrada.png)

La vista integrada une las capas de software (presentación, servicios y datos) con el hardware y los servicios que las soportan, y muestra los aspectos transversales de seguridad y ética, calidad y operación que atraviesan todas las capas.

## 10. Matriz de trazabilidad

| Requerimiento | Nombre | Casos de uso | Módulos | Tablas | Proceso BPMN | KPI | Prueba |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RF001 | Registro y perfil | CU-01, CU-03, CU-13 | Identidad; Perfil y consentimiento | users, auth_sessions, consents, profile_versions | P1 (SP1.1, SP1.2) | K1 | P01 |
| RF002 | Objetivo y disponibilidad | CU-03, CU-13 | Perfil y consentimiento | profile_versions | P1 (SP1.2) | K1, K5 | P02 |
| RF003 | Estimación energética | CU-11, CU-24 | Cálculo energético; Catálogo | profile_versions, rule_versions, plan_drafts.energy_estimate | P1 | K6 | P03 |
| RF004 | Borrador de rutina | CU-04, CU-14, CU-17, CU-20 | Catálogo; Borradores | routine_templates, template_exercises, exercises, rule_versions, plan_drafts | P1 (SP1.3) | K5, K6, K9 | P04 |
| RF005 | Borrador de minuta | CU-12, CU-20, CU-24 | Catálogo; Cálculo energético; Borradores | foods, rule_versions, plan_drafts | P2 | K5, K6 | P05 |
| RF006 | Revisión profesional | CU-05, CU-18 a CU-23 | Revisión; Borradores | plan_drafts, reviews, approved_plans | P2 (SP2.1, SP2.2) | K5 | P06 |
| RF007 | Progreso y sesiones | CU-07, CU-08, CU-15, CU-29 | Progreso | training_sessions, weight_records, usage_events | P3 (SP3.1, SP3.2) | K2, K3, K4 | P07 |
| RF008 | Aviso interno | CU-09, CU-21 | Notificaciones | notifications | P2, P3 | K2, K5 | P08 |
| RF009 | Control de datos | CU-01, CU-10, CU-16, CU-27 | Derechos de datos; Perfil y consentimiento | consents, data_requests | P4 (SP4.1) | K1, K5 | P09 |
| RF010 | Roles y auditoría | CU-02, CU-25, CU-26, CU-28 | Identidad; Auditoría | users, case_assignments, audit_log | P2 | K5 | P10 |
| RNF001 | Usabilidad | CU-01, CU-03 | Presentación por rol | usage_events | P1 | K1, K4 | P11 |
| RNF002 | Seguridad y datos | CU-02, CU-16 | Plataforma; Identidad; Auditoría | users, auth_sessions, consents, audit_log | P1 (SP1.1), P4 | K5 | P12 |
| RNF003 | Disponibilidad y recuperación | CU-30, CU-31 | Job de respaldo; Sondeo externo | — | — | K7 | P13 |
| RNF004 | Rendimiento | CU-04 | Borradores; Plataforma | plan_drafts | P1 (SP1.3) | K6 | P14 |

La columna «Prueba» remite a las evidencias propuestas en el Anexo 2 del informe. Esta matriz extiende la trazabilidad del informe (requisito → KPI → prueba) hacia el diseño: requisito → caso de uso → módulo → tabla → proceso.
