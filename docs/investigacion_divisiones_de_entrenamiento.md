# Investigación: full body, upper/lower y push/pull/legs

Objetivo: incorporar a las rutinas recomendadas las tres formas más usadas de organizar la semana de entrenamiento de fuerza, y decidir con fundamento cuál recomendar a cada persona. Consultado el 15 de octubre de 2026. Para el informe, cada fuente debe citarse en APA 7 con su fecha de consulta.

## 1. Las tres divisiones

| División | Cómo se organiza | Días por semana en FitGoal | Frecuencia por grupo muscular |
|---|---|---|---|
| **Full body** (cuerpo completo) | Cada sesión trabaja piernas, empuje, tracción y zona media. Sesiones A, B y C. | 2 a 3 | 2 a 3 veces |
| **Upper/Lower** (tren superior e inferior) | Se alternan sesiones de tren superior (empuje y tracción) y de tren inferior (piernas y zona media). Sesiones superior A, inferior A, superior B e inferior B. | 4 | 2 veces |
| **Push/Pull/Legs** (empuje, tracción y piernas) | Empuje (pecho, hombros y tríceps), tracción (espalda y bíceps) y piernas con zona media, en días separados. | 3 (una vuelta) a 6 (dos vueltas) | 1 vez con 3 días; 2 veces con 6 días |

Para armar estas sesiones, el grupo «tren superior» de la biblioteca se separó en **empuje** y **tracción**, y se agregaron ejercicios de tracción sin equipo (superman, elevación de brazos en T, remo isométrico con toalla) para que las tres divisiones se puedan hacer en casa.

## 2. Qué dice la evidencia

| Tema | Hallazgo | Fuente |
|---|---|---|
| Principiantes | Recomienda trabajar el cuerpo completo 2 a 3 días por semana. | ACSM, postura de 2009 (Ratamess et al., *Med Sci Sports Exerc*, 41(3), 687–708), según el resumen de [IDEA Fitness Journal](https://www.ideafit.com/progression-models-in-resistance-training-for-healthy-adults) |
| Nivel intermedio | Indica 3 días de cuerpo completo, o 4 días con una división (por ejemplo, tren superior e inferior). | Ídem |
| Nivel avanzado | Describe combinaciones de divisiones en 4 a 6 días por semana. | Ídem |
| Postura vigente del ACSM | Recomienda entrenamiento de fuerza **al menos dos veces por semana, con todos los grandes grupos musculares**. Con el volumen igualado, la frecuencia no cambia la ganancia muscular; para ganar músculo sugiere 10 o más series semanales por grupo. Le resta peso a la plantilla rígida de 2009 y promueve programas flexibles e individualizados. | [Currier et al. (2026), *Med Sci Sports Exerc*, 58(4), 851–872](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823) |
| Frecuencia por grupo (sin igualar el volumen) | Entrenar cada grupo 2 o más veces por semana da mejores resultados que una vez. | Schoenfeld, Ogborn y Krieger (2016), *Sports Med*, 46(11), 1689–1697 (citado por resúmenes secundarios) |
| Frecuencia por grupo (con el volumen igualado) | Sin diferencias significativas: lo que más pesa es el volumen semanal. | [Schoenfeld, Grgic y Krieger (2019), *J Sports Sci*, 37(11), 1286–1295](https://vuir.vu.edu.au/38370/) |
| División frente a cuerpo completo | En 67 hombres sin experiencia y 8 semanas, una división de 2 sesiones por grupo y un cuerpo completo de 4 sesiones, con igual volumen, lograron mejoras similares de fuerza y grosor muscular. | [Evangelista et al. (2021), *Einstein (São Paulo)*, 19, eAO5781](https://pmc.ncbi.nlm.nih.gov/articles/PMC8372753/) |
| Push/pull/legs | Las guías de práctica la describen en 3 días (cada grupo una vez) o en 6 días (dos veces). No se encontró un ensayo que la compare directamente con las otras divisiones. | Por ejemplo, [StrengthLog](https://www.strengthlog.com/push-pull-legs-split/) (práctica, sin revisión por pares) |

**Conclusión:** ninguna división es «la mejor» por sí sola. Lo que importa es trabajar todos los grandes grupos al menos dos veces por semana, con volumen suficiente y una progresión gradual. La división conviene elegirla según la experiencia y los días disponibles. Esa es la regla que aplica FitGoal.

## 3. La regla de FitGoal (el «if» que aprueba el preparador)

Se guarda en las reglas versionadas (`rule_versions`, campo `splitRules`), no en el código. Se aplica la primera condición que se cumple:

| Condición | División recomendada | Motivo que ve la persona |
|---|---|---|
| Nivel principiante | Full body | Si estás empezando, conviene trabajar todo el cuerpo en cada sesión, 2 o 3 días por semana. |
| Con experiencia y 6 días o más | Push/Pull/Legs | Con 6 días, push/pull/legs trabaja cada grupo muscular dos veces por semana. |
| Con experiencia y 4 o 5 días | Upper/Lower | Con 4 o 5 días, upper/lower trabaja cada grupo muscular dos veces por semana en 4 sesiones. |
| En cualquier otro caso (con experiencia y 3 días o menos) | Full body | Con 3 días o menos, full body trabaja cada grupo muscular en todas tus sesiones. |

- La regla se combina con lo que ya existía: objetivo, nivel, equipo y categoría de IMC, con sus reglas de seguridad (sin alto impacto con sobrepeso u obesidad, etc.). Así, la matriz aprobada tiene una rutina por objetivo × nivel × equipo × categoría × división (156 rutinas de demostración).
- Las otras dos divisiones de la misma combinación se muestran como **alternativas**. La persona puede elegir cualquiera, porque todas están aprobadas.
- Si la rutina contempla menos días de los que la persona tiene, la app lo avisa (por ejemplo, con 5 días se recomienda upper/lower y se le pide elegir 4).
- Al iniciar la rutina, cada día elegido recibe el nombre de su sesión, en ciclo. Por ejemplo, push/pull/legs en 6 días queda empuje, tracción, piernas, empuje, tracción y piernas.

## 4. Pendiente de verificar

1. **Postura del ACSM de 2009.** Las cifras de 2 a 3, 3 a 4 y 4 a 6 días por nivel salen de un resumen (IDEA) y de copias del texto que no se pudieron leer completas. Hay que confirmarlas en el artículo original.
2. **Postura del ACSM de 2026.** Se leyó solo una parte del texto. Hay que confirmar las citas textuales antes de usarlas en el informe.
3. **Schoenfeld et al. (2016).** Se citó a partir de resúmenes secundarios; conviene leer el resumen original.
4. **Contenido real.** El volumen por sesión (series y repeticiones), el número de ejercicios y la progresión de las rutinas de demostración son de ejemplo. Los define y aprueba el preparador físico del proyecto.
5. **Principiantes con divisiones.** Hoy pueden elegir upper/lower o push/pull/legs, aunque se les recomienda full body. Conviene confirmar ese criterio con el preparador.
