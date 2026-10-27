# Investigación: IMC y recomendación de ejercicio

Objetivo: decidir cómo usar la **estatura y el peso** (IMC) para recomendar rutinas de forma responsable. Consultado el 9 de octubre de 2026. Para el informe, cada fuente debe citarse en APA 7 con su fecha de consulta.

## 1. Qué se pudo establecer

| Tema | Hallazgo | Fuente | Cómo se aplica en FitGoal |
|---|---|---|---|
| Fórmula | IMC = peso (kg) / estatura (m)². | OMS (ficha «Obesidad y sobrepeso») | `src/lib/body.js`, `bodyMassIndex` (un decimal). |
| Cortes en adultos | Sobrepeso: IMC ≥ 25. Obesidad: IMC ≥ 30. Bajo peso: IMC < 18,5 (corte de la OMS citado por varias fuentes secundarias). | [OMS](https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight); [tabla OMS en Medigraphic](https://www.medigraphic.com/files/actmed/am-2023/4/am234l-T1.html) | Categorías `bajo_peso` (< 18,5), `normal` (18,5–24,9), `sobrepeso` (25–29,9) y `obesidad` (≥ 30) para menores de 65 años. |
| Cortes en personas mayores (Chile) | El Minsal clasifica a las personas mayores con otros cortes: enflaquecido < 23; normal 23–27,9; sobrepeso 28–31,9; obeso ≥ 32. | [Manual del EMPAM, Minsal](https://diprece.minsal.cl/wrdprss_minsal/wp-content/uploads/2015/05/instructivo-de-control-de-salud-empam.pdf); [Plan Nacional de Salud Integral para Personas Mayores](https://diprece.minsal.cl/wp-content/uploads/2021/09/Plan-Nacional-de-Salud-Integral-para-Personas-Mayores_v2.pdf) | Desde los 65 años se usan estos cortes. |
| Límites del IMC | Es una medida de **tamizaje**, no un diagnóstico. No distingue músculo de grasa: una persona muy musculosa puede quedar en «sobrepeso» sin exceso de grasa. | [CDC, IMC en adultos](https://www.cdc.gov/bmi/); estudios con deportistas citados en las búsquedas | La app lo muestra siempre como «solo una referencia» y nunca bloquea el uso: la persona puede explorar todo el catálogo y armar su rutina. |
| Actividad recomendada (adultos) | Entre 150 y 300 minutos semanales de actividad aeróbica moderada (o 75 a 150 de vigorosa), más actividades de fuerza regulares. | [OMS 2020, Bull et al., *Br J Sports Med* 54:1451–1462](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7719906/) | Las rutinas de demostración usan 2 o 3 sesiones por semana como piso; la progresión hacia 150 minutos queda a cargo del preparador. |
| Sobrepeso y obesidad | Aumentar de forma **gradual** hasta 150 minutos semanales de actividad moderada; privilegiar actividades de **bajo impacto** (caminar, bicicleta, natación); extremar el cuidado si hay hipertensión, diabetes, cardiopatía o artrosis. | [Posición del ACSM sobre pérdida de peso](https://um.es/innova/OCW/educacion_fisica_y_salud/efs2012/ejercicios_proyectos_casos/posicionamiento_perdida_peso_ACSM.pdf); [resumen de IDEA](https://www.ideafit.com/acsm-on-weight-loss) | Con sobrepeso u obesidad no se sugieren ejercicios de **alto impacto** (`safety.avoidHighImpact`) y se muestra una orientación de inicio gradual (`safety.notices`). |
| Bajo peso | Conviene priorizar el entrenamiento de fuerza de los grandes grupos musculares (al menos dos veces por semana) junto con una alimentación suficiente; un IMC < 18,5, o una baja de peso sin buscarla, justifica una evaluación médica antes de empezar. | [ACSM, guías de entrenamiento de fuerza 2026](https://acsm.org/resistance-training-guidelines-update-2026/); estudios en personas con bajo peso | Con bajo peso **no** se recomienda bajar de peso: se ofrecen rutinas para subir (`safety.adjustObjective`), con énfasis en fuerza, y se invita a consultar a un profesional. |

## 2. Reglas de seguridad resultantes (son contenido que aprueba el preparador)

Se guardan en las reglas versionadas (`rule_versions`, ámbito `entrenamiento`), no en el código. Los valores de la demostración son:

- `adjustObjective`: con **bajo peso**, «bajar de peso» pasa a «subir de peso»; con **obesidad**, «subir de peso» pasa a «bajar de peso».
- `avoidHighImpact`: **sobrepeso** y **obesidad**.
- `notices`: orientación breve por categoría (bajo peso, sobrepeso, obesidad).
- Sin estatura y peso, o sin consentimiento vigente: categoría **general** (rutinas conservadoras, de bajo impacto).

El código solo calcula el IMC y la categoría, aplica las reglas aprobadas y deja constancia de la versión de las reglas usada. Así, si el docente o el preparador piden otros criterios, se cambian aprobando una versión nueva, sin reprogramar.

## 3. Pendiente de verificar

1. **Cortes del Minsal para personas mayores.** Se obtuvieron de fuentes secundarias que citan el manual del EMPAM; no se pudo leer la tabla en el PDF original. Confirmar los valores en el documento oficial (también los límites exactos: 23,0 y 28,0).
2. **Corte de bajo peso de la OMS (18,5).** Es el valor estándar, pero la ficha de la OMS consultada solo menciona los de sobrepeso y obesidad.
3. **Frecuencia mínima de fuerza (2 días por semana).** Figura en las guías de la OMS 2020 según el texto completo; las copias consultadas no lo mostraron.
4. **Poblaciones con cortes distintos** (por ejemplo, ascendencia asiática: sobrepeso desde 23 y obesidad desde 27,5, según algunas fuentes). Hoy FitGoal no los aplica; conviene decidirlo con el preparador.
5. **Aspectos legales.** La estatura y el peso son datos de salud (Ley 19.628 y Ley 21.719, vigente desde el 1-dic-2026): el consentimiento específico es opcional, revocable y su revocación borra los datos. Validar la redacción con el docente guía.
6. **Contenido real.** Las rutinas y las orientaciones de la demostración son de ejemplo. Las reales las redacta y aprueba el preparador físico del proyecto.

## 4. Qué NO hace FitGoal con el IMC

- No diagnostica ni promete resultados de salud o de peso.
- No bloquea al usuario: puede explorar todo el catálogo y armar su propia rutina; solo se **sugiere** con cuidado (sin ejercicios de alto impacto en sobrepeso u obesidad) y se explica por qué.
- No guarda el IMC: se calcula en cada consulta a partir de la estatura y el peso del perfil vigente.
