# Ideas de otras aplicaciones fitness para FitGoal

Revisión del 16 de octubre de 2026. Objetivo: tomar ideas de aplicaciones conocidas que **complementen** la propuesta de FitGoal sin salir de lo que define el informe. El informe ya contempla:

- «registros breves, avance visible y recordatorios configurables» según el modelo de Fogg (P85);
- registrar sesiones y «observar continuidad» (HU3, RF007);
- la adherencia K3, en la que una sesión sin registro cuenta como no realizada.

Quedan fuera del MVP los pagos, las integraciones con terceros y wearables (P77, P141), las notificaciones push externas (RF008) y las recomendaciones sin aprobación profesional (P81, RF004).

## Aplicaciones revisadas

| Aplicación | Qué hace bien | Qué tomamos | Por qué cabe en el informe |
|---|---|---|---|
| **Hevy** (registro de entrenamientos) | Calendario con los días entrenados; racha **semanal** (semanas con al menos un entrenamiento) y contador de días de descanso; temporizador de descanso automático por ejercicio, que parte al completar una serie; reemplazar ejercicios y copiar rutinas. | Calendario de las últimas 5 semanas; modo sesión con series para marcar y temporizador de descanso (30 s a 2 min, +15 s, saltar); personalizar una rutina recomendada como rutina propia; ordenar ejercicios; equilibrio por grupo muscular. | Avance visible y registro breve (P85); rutina propia con ejercicios aprobados (RF004/RF005). Las series marcadas no se guardan: solo la sesión (minimización de datos). |
| **Duolingo** | Racha diaria con animación en los hitos; *Streak Freeze* (protector de racha) que según Duolingo aumentó los usuarios activos diarios; recordatorios. | Racha diaria con hitos (3, 7, 14, 21, 30, 50, 75, 100… días) y un **comodín semanal** automático y gratuito. | «Avance visible» (P85) y continuidad (HU3). No se usan monedas ni compras: el comodín no se vende (los pagos están fuera del MVP). |
| **Fitia** (nutrición, hispanohablante) | Registro rápido de comidas, metas diarias, widgets y recordatorios. | La idea de que el progreso diario se vea apenas se abre la app; aplicada a la pestaña «Mi rutina» (lo que toca hoy, arriba). | P85. No se agregan fotos con IA, códigos de barra ni registro de comidas: no están en el alcance (RF005 es una pauta aprobada, no un diario de comidas). |
| **Fitbod / Nike Training Club / JEFIT** | Planes por días de la semana, vista «hoy», recuperación por grupo muscular, biblioteca con búsqueda y filtros. | Horario semanal de lunes a domingo con la sesión de cada día; búsqueda y filtros por nivel, equipo y grupo; aviso cuando el mismo grupo de fuerza se trabaja dos días seguidos. | RF004/RF007. El aviso de recuperación es informativo; no cambia la rutina aprobada. No se adopta la generación automática de entrenamientos por algoritmo: el contenido lo aprueba el preparador (P81). |

En Fitia no se encontró una fuente oficial que describa una racha. Por eso la racha de FitGoal se basa en Duolingo y Hevy, no en Fitia.

## Ideas descartadas (fuera del alcance del informe)

- **Muro social, seguidores, rankings o compartir en redes.** El informe no lo contempla, y exponer rachas o entrenamientos es tratamiento de datos de salud que habría que justificar (Ley 21.719).
- **Sincronizar con relojes o Apple Health/Google Fit.** P141: «No se integran sistemas corporativos ni wearables en esta fase».
- **Notificaciones push para «salvar la racha».** RF008 prohíbe el push externo. Los recordatorios siguen siendo internos y configurables.
- **Comprar protectores de racha, monedas o premios.** Los pagos están fuera del MVP y la crítica a Duolingo señala que cobrar por la ansiedad de perder la racha es una práctica cuestionable.
- **Progresión automática de cargas o rutinas generadas por algoritmo.** P81: «No se fija una progresión universal de cargas». El preparador define la progresión.
- **Registrar kilos y repeticiones de cada serie.** RF007 registra sesiones por fecha. Guardar cada serie amplía los datos sin que el piloto lo necesite; queda como mejora futura.

## Cómo funciona lo nuevo

### Horario semanal con días de descanso

- **Semana visible.** «Mi rutina» muestra la semana de lunes a domingo con el estado de cada día: realizada, descanso, te toca hoy, programada, comodín o sin registrar.
- **Se abre en hoy.** Al tocar otro día se ve su sesión con los ejercicios, o el descanso. Se puede pasar a la semana anterior o a la siguiente.
- **Los días de descanso se deducen, no se guardan.** Son los días de la semana que no se eligieron para entrenar. Su vista explica para qué sirve descansar y sugiere, como opción, una caminata o los ejercicios de movilidad del catálogo aprobado.
- **Al elegir los días de una rutina** (recomendada o propia), los siete días aparecen con su sesión o «Descanso». La app avisa si el mismo grupo de fuerza (piernas, empuje o tracción) cae en dos días seguidos, también de domingo a lunes, o si no queda ningún día de descanso.
- **Fundamento del aviso.** La NSCA recomienda dejar al menos un día, y no más de tres, entre sesiones que trabajan el mismo grupo muscular. El ACSM (2009) recomienda 2 o 3 días por semana para quien empieza.
- **Valores por defecto.** Si el perfil no alcanza el mínimo de días de la rutina, la app propone días separados (lunes, miércoles, viernes…).

### Racha (días seguidos cumpliendo el plan)

1. **Qué suma.** Suma un día cada sesión programada que se registra y **cada día de descanso de la rutina**. Descansar es parte del plan, y así la racha nunca empuja a entrenar todos los días. Es la diferencia ética principal con una racha «tipo Duolingo» aplicada al ejercicio.
2. **Cuándo empieza.** La racha empieza con la primera sesión registrada; los descansos anteriores no cuentan.
3. **La sesión de hoy.** Mientras el día no termina, la sesión de hoy no corta la racha, pero la app avisa que hoy toca entrenar.
4. **Comodín semanal.** La primera sesión sin registrar de cada semana (lunes a domingo) queda cubierta: ese día no suma, pero tampoco corta. La segunda de la misma semana sí la corta. Si la persona registra después una sesión vencida, cuenta y el comodín queda libre.
5. **Sin rutina, se corta.** Un día pasado sin rutina vigente corta la racha. Empezar la siguiente rutina el mismo día en que termina la anterior la mantiene, porque el día de inicio es de descanso.
6. **La adherencia K3 no cambia.** Una sesión cubierta por el comodín sigue contando como no realizada. La racha es motivación; la adherencia es la medición del piloto.
7. **Mensajes sin culpa.** Cuando la racha se corta, la app anima a «no fallar dos veces seguidas» en vez de destacar la falla.
8. **Nada nuevo se guarda.** La racha y el calendario se calculan con las sesiones y los días de la rutina que ya existen, sin tablas ni columnas nuevas.

**Evidencia que respalda estas reglas:**

| Fuente | Hallazgo | Cómo se aplica |
|---|---|---|
| Lally et al. (2010) | En la formación de hábitos, saltarse una oportunidad aislada no afectó de forma importante el proceso; la mediana hasta la automaticidad fue de 66 días. | Comodín semanal: una falla aislada no rompe la racha. |
| Silverman y Barasch (2023) | Ver una racha intacta aumenta la probabilidad de seguir; ver una rota la reduce, sobre todo cuando la persona se culpa. El efecto se atenúa si la racha se puede reparar. | Comodín, registro tardío que repara la racha y mensajes sin culpa. |
| Milkman et al. (2021, megaestudio con 24 Hour Fitness) | Entre las intervenciones más efectivas estuvo un pequeño incentivo por volver después de faltar a un entrenamiento («no fallar dos veces»). | Mensaje tras un corte y foco en la próxima sesión. |
| Duolingo (blog oficial) | Los hitos de la racha y el *Streak Freeze* aumentaron la retención; cita investigación sobre dar holgura (*slack*) frente a metas rígidas. | Hitos y comodín. |
| Mazeas et al. (2022, metaanálisis en JMIR) | Las intervenciones con gamificación aumentan la actividad física, con un efecto que persiste tras el seguimiento. | Respaldo general a la racha. FitGoal no promete efectos: el piloto mide uso y cumplimiento declarado (P86). |

### Modo sesión

- **Cómo se usa.** «Empezar sesión» (solo para la sesión de hoy) muestra cada ejercicio con su indicación, «cómo hacerlo» y una casilla por serie, contadas desde la indicación (por ejemplo, «3 series de 12 repeticiones» → 3).
- **Descanso entre series.** Al marcar una serie parte un temporizador de descanso. La persona elige 30, 60, 90 o 120 segundos y puede sumar 15 segundos o saltarlo.
- **Al terminar.** «Terminar y registrar» registra la sesión con nota opcional, y peso solo si está habilitado.
- **Datos.** Las series marcadas no se envían al servidor.

### Mejor selección de rutinas y ejercicios

- **Para ti.** La recomendada aparece destacada, con una vista de la semana (días de entrenamiento según el perfil y días de descanso).
- **Todas.** Búsqueda por nombre y filtros por objetivo, división, nivel y equipo.
- **Ejercicios.** Búsqueda, filtros por grupo y equipo, ícono por grupo muscular y aviso de «para personas con experiencia».
- **Detalle de una rutina.** Muestra la semana con días de entrenamiento y de descanso, los grupos de cada sesión y la descripción de cada ejercicio. Se puede «personalizar como rutina propia»: abre el armado con las mismas sesiones en los días elegidos.
- **Rutina propia.** Cada sesión se puede nombrar (por ejemplo, «Piernas»), los ejercicios se pueden reordenar y el picker busca por nombre. Un panel muestra cuántos ejercicios trabajan cada grupo y qué grupo de fuerza falta.

## Pendientes de verificar

- **Lally et al. (2010).** Confirmar en el artículo original la frase sobre la oportunidad perdida; las fuentes secundarias no coinciden en el tamaño de muestra (96 o 39 personas).
- **Milkman et al. (2021).** Confirmar en *Nature* el efecto (fuentes secundarias: hasta 27 %) y el número de intervenciones (53 o 54).
- **Mazeas et al. (2022).** Confirmar el tamaño del efecto en el texto completo (PMC8767479).
- **Preparador físico.** Validar las reglas de recuperación (un día entre sesiones del mismo grupo de fuerza) y si el descanso entre series debería fijarlo él en cada plantilla.
- **Docente guía.** Validar que la racha (gamificación) no contradice la ética del informe. La racha cuenta los descansos, no castiga y no reemplaza a K3.

## Fuentes

- Hevy: [calendario y racha](https://help.hevyapp.com/hc/en-us/articles/35380117933207-Track-Your-Workout-Consistency-with-the-Calendar-and-Streak-Features), [racha semanal](https://help.hevyapp.com/hc/en-us/articles/34467766576279), [temporizador de descanso](https://www.hevyapp.com/features/workout-rest-timer/) y [rutinas](https://www.hevyapp.com/features/gym-routines/).
- Duolingo: [«How the Duolingo streak builds habit»](https://blog.duolingo.com/how-duolingo-streak-builds-habit).
- Fitia: [App Store](https://apps.apple.com/es/app/fitia-contar-calor%C3%ADas-dietas/id1448277011) y [acerca de](https://fitia.app/about/).
- Lally et al. (2010), *European Journal of Social Psychology*: [resumen de UCL](https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit).
- Silverman, J. y Barasch, A. (2023). On or off track: How (broken) streaks affect consumer decisions. *Journal of Consumer Research, 49*(6), 1095–1117. [Resumen de CU Boulder](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions).
- Milkman, K. et al. (2021). Megastudies improve the impact of applied behavioural science. *Nature*. [Resumen de Penn Today](https://penntoday.upenn.edu/news/wharton-study-best-ways-boost-workout-habits).
- Mazeas, A. et al. (2022). Evaluating the effectiveness of gamification on physical activity. *JMIR, 24*(1), e26779. [jmir.org](https://www.jmir.org/2022/1/E26779/).
- NSCA: [Determination of resistance training frequency](https://www.nsca.com/education/articles/kinetic-select/determination-of-resistance-training-frequency/).
- ACSM (2009): [Progression models in resistance training for healthy adults](https://www.sportgeneeskunde.com/wp-content/uploads/ACSM-Position-Stand-Progression-Models-in-Resistance-Training-for-Healthy-Adults.pdf).
