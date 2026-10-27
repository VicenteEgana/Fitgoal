# Investigación: dietas, calorías y pautas de alimentación

Objetivo: definir con fundamento cómo FitGoal entrega una pauta de alimentación de 7 días según el objetivo de la persona (déficit, mantenimiento o superávit) y la dieta que prefiera, con productos del mercado chileno y gramos sugeridos. Consultado el 15 y 16 de octubre de 2026. Para el informe, cada fuente debe citarse en APA 7 con su fecha de consulta. Las pautas resultantes están en `docs/pautas_de_alimentacion.md`.

## 1. ¿Qué dieta da mejores resultados?

| Pregunta | Hallazgo | Fuente |
|---|---|---|
| ¿Baja en grasa o baja en carbohidratos? | En 609 adultos con sobrepeso u obesidad, a 12 meses, la baja en grasa saludable y la baja en carbohidratos saludable bajaron en promedio 5,3 y 6,0 kg, sin diferencia significativa. | [Gardner et al. (2018), *JAMA*, 319(7), 667–679 (DIETFITS)](https://doi.org/10.1001/jama.2018.0245) |
| ¿Y en conjunto? | En 61 ensayos (6.925 personas), la baja en carbohidratos y la equilibrada producen probablemente poca o ninguna diferencia en el peso hasta 2 años, ni en presión arterial, HbA1c o colesterol LDL. | [Naude et al. (2022), *Cochrane Database of Systematic Reviews*, CD013334](https://doi.org/10.1002/14651858.CD013334.pub2) |
| ¿Cuál protege más la salud? | La dieta mediterránea con aceite de oliva extra virgen o con frutos secos tuvo alrededor de 30 % menos eventos cardiovasculares mayores que la dieta control en 7.447 adultos de alto riesgo. | [Estruch et al. (2018), *NEJM*, PREDIMED; resumen del ACC](https://acc.org/latest-in-cardiology/articles/2018/06/13/16/05/mediterranean-diet-supplemented-with-extra-virgin-olive-oil-or-nuts-shows-lower-cv-risk) |
| ¿Cuánta proteína para el músculo? | Con entrenamiento de fuerza, sobre unos 1,6 g/kg/día de proteína no hubo ganancias adicionales de masa libre de grasa. | [Morton et al. (2018), *Br J Sports Med*, 52(6), 376–384](https://pubmed.ncbi.nlm.nih.gov/28698222/) |
| ¿Y en déficit? | Para construir y mantener músculo se recomienda 1,4 a 2,0 g/kg/día; en déficit y con entrenamiento de fuerza, algunas personas se benefician de más. | [Jäger et al. (2017), ISSN, *JISSN*, 14, 20](https://doi.org/10.1186/s12970-017-0177-8) |
| ¿Es adecuada una dieta vegetariana? | Bien planificada, incluida la vegana, es saludable y nutricionalmente adecuada en todas las etapas de la vida; la vegana necesita una fuente fiable de vitamina B12. | [Melina, Craig y Levin (2016), *J Acad Nutr Diet*, 116(12), 1970–1980](https://pubmed.ncbi.nlm.nih.gov/27886704/) |
| ¿Qué piden las guías chilenas? | Frutas y verduras en todas las comidas, legumbres, pescado, lácteos, agua en vez de bebidas azucaradas, alimentos frescos y evitar los productos con sellos «ALTO EN». | [Guías Alimentarias para Chile, Minsal](https://www.minsal.cl/ministerio-de-salud-presenta-actualizacion-de-las-guias-alimentarias-para-chile/) |

**Conclusión:** ninguna dieta «gana» por sí sola para bajar de peso. Mandan el balance de energía, una proteína suficiente y la adherencia, es decir, la dieta que la persona pueda sostener. Por eso FitGoal ofrece cuatro dietas con respaldo y deja elegir:

| Dieta | Por qué está | Energía de cada macronutriente en la pauta (promedio semanal) |
|---|---|---|
| **Mediterránea** | La de más respaldo para la salud cardiovascular (PREDIMED). | Proteínas 21 % · carbohidratos 45 % · grasas 33 % |
| **Alta en proteína** | Saciedad y músculo en déficit y en superávit (Morton 2018; ISSN 2017). | Proteínas 36 % · carbohidratos 39 % · grasas 24 % |
| **Baja en carbohidratos (moderada)** | Rinde igual que la equilibrada (DIETFITS, Cochrane 2022): sirve a quien le acomoda. | Proteínas 36 % · carbohidratos 20 % · grasas 45 % |
| **Vegetariana (ovoláctea)** | Adecuada si está bien planificada (Academy 2016). | Proteínas 21 % · carbohidratos 53 % · grasas 26 % |

No se ofrecen dietas muy restrictivas (cetogénica estricta, muy bajas en calorías o ayunos prolongados), porque requieren supervisión profesional individual.

## 2. Calorías según el objetivo

| Paso | Regla de FitGoal | Fundamento |
|---|---|---|
| Gasto en reposo | Mifflin-St Jeor: 10 × peso + 6,25 × estatura − 5 × edad + 5 (hombres) o − 161 (mujeres). | Es la ecuación que predijo el gasto con menos de 10 % de error en más personas, aunque con errores individuales relevantes ([Frankenfield et al., 2005](https://pubmed.ncbi.nlm.nih.gov/15883556/)). |
| Mantenimiento | Gasto en reposo × factor de actividad: sedentario 1,2; ligero 1,375; moderado 1,55; intenso 1,725. | Factores de uso habitual en la práctica: los debe validar la nutricionista. |
| Déficit (bajar de peso) | −20 % del mantenimiento, con un tope de 750 kcal por día y un mínimo de 1.200 kcal (mujeres) o 1.500 kcal (hombres). | La pérdida de grasa depende de un déficit sostenido, más suave cuanto más delgada es la persona ([Aragon et al., 2017, ISSN](https://doi.org/10.1186/s12970-017-0174-y)). La guía ACC/AHA de obesidad usa déficits de 500 a 750 kcal y 1.200–1.500 kcal (mujeres) o 1.500–1.800 kcal (hombres) ([resumen](https://eguideline.guidelinecentral.com/i/277525/3)). |
| Superávit (subir de peso) | +10 % del mantenimiento. | Para ganar músculo se recomienda un superávit de 10 a 20 % en principiantes e intermedios, apuntando a subir 0,25 a 0,5 % del peso por semana, con 1,6 a 2,2 g/kg de proteína ([Iraki et al., 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6680710/)). FitGoal usa el extremo conservador. |
| Seguridad por IMC | Con bajo peso no se aplica déficit y con obesidad no se aplica superávit: se usa el mantenimiento y se muestra una orientación. | Coherente con las reglas de seguridad del entrenamiento (`docs/investigacion_imc_y_ejercicio.md`). |

Todas estas cifras son contenido de las **reglas nutricionales** que aprueba la nutricionista (`rule_versions`, ámbito `nutricion`): cambiarlas no exige reprogramar.

## 3. Cómo se arma la pauta

- **Cinco comidas a la chilena:** desayuno, colación, almuerzo, once y cena. Cada comida combina carbohidratos, proteínas y grasas. En desayuno, almuerzo y cena hay al menos 10 g de proteína (lo verifican las pruebas automáticas).
- **Productos del mercado chileno:** marraqueta, pan integral de molde, quesillo, jurel en lata, atún, merluza, salmón, posta negra, porotos, lentejas, garbanzos, palta, choclo, zapallo camote, frutas de temporada y otros. Son 57 alimentos aprobados con su composición por 100 g y medidas caseras, más uno en borrador (mote) para mostrar la aprobación.
- **Gramos para cada persona:** la pauta está escrita para 2.000 kcal. La app escala cada día a las calorías de la persona. Las verduras quedan fijas, lo que se cuenta por unidad (huevos, rebanadas, potes) va en unidades enteras y el resto compensa. Así cada día suma la energía buscada con un margen de unas 20 kcal.
- **Sin datos o sin consentimiento:** se muestran las porciones de referencia de 2.000 kcal y se invita a completar el perfil.
- **Si te falta un alimento, lo cambias.** Se basa en el **sistema de porciones de intercambio**: alimentos del mismo grupo se pueden reemplazar entre sí en cantidades de aporte parecido. Las nutricionistas lo usan para dar indicaciones flexibles; en Chile, las listas de porciones intercambiables son de 1999 ([Cáceres y colaboradores, 2020](https://repositorio.uchile.cl/handle/2250/177365)), y en Estados Unidos el equivalente es *Choose Your Foods* ([ADA y Academy of Nutrition and Dietetics, 2019](https://www.eatrightstore.org/product-type/booklets-and-handouts/choose-your-foods-food-lists-for-diabetes-25pk--2019)). En FitGoal:
  - Solo se ofrecen alimentos **aprobados, del mismo grupo y que la nutricionista incluyó en esa misma pauta**. Así se respeta la dieta elegida: la pauta vegetariana nunca ofrece carne, y la baja en carbohidratos solo ofrece los cereales que ya usa. No se ofrece un alimento que ya está en esa comida.
  - La cantidad es la que aporta **la misma energía** (gramos × kcal del original / kcal del reemplazo). Después, el día se vuelve a ajustar a las calorías de la persona, como siempre. Lo que se cuenta por unidad (huevos, potes, rebanadas) se redondea a unidades, así que en esos casos la energía queda parecida y el resto del día compensa. Las verduras se cambian por la misma cantidad, porque son la base libre de la pauta.
  - La app muestra la proteína, los carbohidratos y las grasas de cada opción, porque dentro de un grupo no son iguales: por ejemplo, el salmón tiene más grasa que la merluza.
  - El cambio se puede hacer en una comida o en toda la semana, se guarda en `meal_plan_swaps` (no se guardan gramos, se recalculan) y se deshace cuando la persona quiera. Una base de datos con un disparador impide cambiar por un alimento de otro grupo o que la pauta no incluye. Si la nutricionista publica una versión nueva de la pauta, los cambios no se trasladan.

## 4. Pendiente de verificar

1. **Composición de los alimentos.** Los valores son de USDA FoodData Central y de etiquetas; hay que verificarlos con la tabla de composición de alimentos chilena (INTA) y con los productos que se usen en el piloto. Por ejemplo, la marraqueta varía según la panadería.
2. **Factores de actividad, porcentajes de déficit y superávit, tope y mínimos.** Los debe validar la nutricionista del proyecto.
3. **ISSN 2017.** La cifra de 2,3 a 3,1 g/kg en déficit se tomó de un resumen: hay que confirmar si se refiere al peso total o a la masa libre de grasa.
4. **Guía ACC/AHA de obesidad.** Las cifras vienen de un resumen: hay que citar el documento original.
5. **Aspectos éticos y legales.** Antes, las minutas personales estaban bloqueadas hasta contar con nutricionista. Ahora las pautas se ajustan solas con contenido y reglas aprobados una vez por la nutricionista, como las rutinas. Hay que validar con el docente guía y con la nutricionista que esto basta para una pauta general, y cómo se trata la prescripción dietética individual en Chile. La estatura, el peso, el sexo y la actividad son datos de salud: se piden con consentimientos específicos, revocables y que borran los datos (Ley 19.628 y Ley 21.719).
6. **Cambio de alimentos.** La nutricionista debe validar que igualar la energía dentro del grupo del catálogo sea un intercambio aceptable. Los grupos de FitGoal (proteínas, lácteos, cereales y tubérculos, legumbres, frutas, verduras, grasas) no son idénticos a los de las listas chilenas de intercambio. Por ejemplo, conviene revisar si el queso debe quedar con los lácteos y si las legumbres pueden reemplazar proteínas en la pauta vegetariana. Además, falta confirmar en la fuente original la referencia de Cáceres y colaboradores (2020).
7. **Grupos que no deben usar la pauta sin un profesional:** embarazo, lactancia, enfermedades (por ejemplo, diabetes o enfermedad renal), medicamentos y antecedentes de trastornos de la conducta alimentaria. La app lo advierte, pero conviene revisar si además debe preguntarlo.

## 5. Qué NO hace FitGoal con la alimentación

- No diagnostica ni indica dietas terapéuticas.
- No baja de 1.200 kcal (mujeres) o 1.500 kcal (hombres) ni aplica déficits mayores a 750 kcal al día.
- No calcula calorías sin los consentimientos de datos corporales y nutricionales.
- No muestra contenido que la nutricionista no haya aprobado: la base de datos impide aprobar una pauta con alimentos sin aprobar y cambiar una pauta ya aprobada.
