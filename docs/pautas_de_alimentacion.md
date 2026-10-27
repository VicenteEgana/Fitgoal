# Pautas de alimentación de 7 días (demostración)

Generado desde `backend/src/seed/nutrition.js` con `node src/seed/export-meal-plans.js`: es exactamente lo que muestra la app con las porciones de referencia. **Es contenido de demostración**: la nutricionista del proyecto debe revisarlo y aprobarlo antes del piloto. Fundamento en `docs/investigacion_alimentacion.md`.

## Cómo se ajustan los gramos a cada persona

Cada pauta está escrita para 2.000 kcal al día. Si la persona indicó estatura, peso, sexo y nivel de actividad (con sus consentimientos), la app estima su mantenimiento con Mifflin-St Jeor × factor de actividad y aplica su objetivo: **déficit -20 %** (con un tope de 750 kcal y un mínimo de 1.200 kcal en mujeres y 1.500 kcal en hombres), **mantenimiento** o **superávit +10 %**. Luego multiplica los gramos de cada día por la misma proporción, salvo las verduras, que quedan fijas. Lo que se cuenta por unidad (huevos, claras, rebanadas, láminas, potes y marraquetas) se sirve en unidades enteras, o medias en la marraqueta, y el resto de los alimentos compensa la diferencia; los demás gramos se redondean al gramo hasta 20 g y de 5 en 5 g sobre eso.

| Ejemplo | Mantenimiento | Objetivo | Calorías de la pauta |
|---|---|---|---|
| Mujer, 30 años, 165 cm, 62 kg, actividad ligera, quiere bajar de peso | 1.843 kcal | déficit | **1.450 kcal** |
| Hombre, 30 años, 180 cm, 80 kg, actividad moderada, quiere mantener su peso | 2.759 kcal | mantenimiento | **2.750 kcal** |
| Hombre, 25 años, 175 cm, 68 kg, actividad intensa, quiere subir de peso | 2.853 kcal | superávit | **3.150 kcal** |

Por ejemplo, 100 g de pechuga de pollo en la pauta de referencia pasan a unos 80 g con 1.600 kcal y a unos 125 g con 2.500 kcal.

## Mediterránea

Aceite de oliva, pescado, legumbres, cereales integrales, frutas, verduras y frutos secos. Es la dieta con más respaldo para la salud cardiovascular.

Promedio semanal: 2.002 kcal · proteínas 110 g (21 %) · carbohidratos 232 g (45 %) · grasas 76 g (33 %).

### Lunes · 2.008 kcal · P 109 g · C 238 g · G 75 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Pan integral de molde 60 g (≈ 2 rebanadas); Palta Hass 65 g (≈ ½ unidad); Huevo 50 g (≈ 1 unidad); Tomate 60 g (≈ ½ unidad) | 344 | 16 | 34 | 17 |
| Colación | Yogur natural descremado sin azúcar 125 g (≈ 1 pote); Nueces 25 g; Frutillas 125 g (≈ ¾ taza) | 274 | 12 | 23 | 17 |
| Almuerzo | Lentejas cocidas 275 g (≈ 1½ tazas); Arroz integral cocido 100 g (≈ ½ taza); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Aceite de oliva 13 g (≈ 3 cucharaditas); Naranja 200 g (≈ 1¼ unidades) | 673 | 31 | 109 | 16 |
| Once | Pan integral de molde 60 g (≈ 2 rebanadas); Quesillo 30 g (≈ 1 rebanada); Tomate 40 g (≈ ¼ unidad); Aceite de oliva 6 g (≈ 1 cucharadita) | 252 | 12 | 28 | 10 |
| Cena | Merluza al horno 150 g; Papa cocida 190 g (≈ 1¼ unidades medianas); Lechuga 50 g (≈ 1 taza); Zanahoria 50 g (≈ ¾ unidad); Aceite de oliva 13 g (≈ 3 cucharaditas) | 465 | 39 | 44 | 15 |

### Martes · 2.006 kcal · P 93 g · C 266 g · G 72 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Avena en hojuelas 45 g (≈ 4½ cucharadas); Leche descremada 230 g (≈ 1¼ tazas); Plátano 115 g (≈ 1 unidad); Nueces 17 g | 462 | 18 | 71 | 15 |
| Colación | Manzana 175 g (≈ 1¼ unidades); Almendras 25 g (≈ 21 unidades) | 236 | 6 | 30 | 13 |
| Almuerzo | Pechuga de pollo a la plancha 115 g; Quínoa cocida 175 g (≈ 1 taza); Brócoli cocido 100 g; Zanahoria 50 g (≈ ¾ unidad); Aceite de oliva 12 g (≈ 2 cucharaditas) | 562 | 46 | 49 | 20 |
| Once | Pan marraqueta 50 g (≈ ½ unidad); Palta Hass 45 g (≈ ¼ unidad); Tomate 40 g (≈ ¼ unidad) | 215 | 6 | 33 | 7 |
| Cena | Garbanzos cocidos 175 g (≈ 1 taza); Zapallo italiano cocido 100 g; Cebolla 30 g; Aceite de oliva 12 g (≈ 2 cucharaditas); Pera 195 g (≈ 1¼ unidades) | 531 | 18 | 83 | 17 |

### Miércoles · 2.001 kcal · P 107 g · C 203 g · G 89 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Yogur griego natural descremado 125 g (≈ 1 pote); Avena en hojuelas 40 g (≈ 4 cucharadas); Arándanos 130 g (≈ ¾ taza); Semillas de chía 13 g (≈ 1 cucharada); Nueces 13 g | 448 | 23 | 58 | 16 |
| Colación | Pan integral de molde 30 g (≈ 1 rebanada); Hummus 40 g (≈ 2¾ cucharadas); Pepino 80 g | 154 | 8 | 21 | 5 |
| Almuerzo | Salmón al horno 155 g; Arroz integral cocido 155 g (≈ ¾ taza); Porotos verdes cocidos 100 g; Tomate 80 g (≈ ¾ unidad); Aceite de oliva 13 g (≈ 3 cucharaditas) | 674 | 41 | 51 | 34 |
| Once | Leche descremada 260 g (≈ 1¼ tazas); Pan integral de molde 60 g (≈ 2 rebanadas); Palta Hass 40 g (≈ ¼ unidad) | 303 | 17 | 42 | 8 |
| Cena | Huevo 100 g (≈ 2 unidades); Zapallo italiano cocido 100 g; Pan integral de molde 30 g (≈ 1 rebanada); Aceite de oliva 13 g (≈ 3 cucharaditas); Kiwi 100 g (≈ 1¼ unidades) | 422 | 19 | 31 | 26 |

### Jueves · 2.001 kcal · P 109 g · C 256 g · G 68 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Pan marraqueta 50 g (≈ ½ unidad); Palta Hass 65 g (≈ ½ unidad); Tomate 50 g (≈ ½ unidad); Leche descremada 260 g (≈ 1¼ tazas) | 337 | 15 | 49 | 11 |
| Colación | Naranja 205 g (≈ 1¼ unidades); Nueces 25 g | 260 | 6 | 28 | 17 |
| Almuerzo | Porotos cocidos 260 g (≈ 1½ tazas); Fideos cocidos 75 g (≈ ½ taza); Zapallo camote cocido 80 g; Lechuga 50 g (≈ 1 taza); Tomate 50 g (≈ ½ unidad); Aceite de oliva 13 g (≈ 3 cucharaditas) | 613 | 29 | 94 | 15 |
| Once | Yogur natural descremado sin azúcar 125 g (≈ 1 pote); Avena en hojuelas 25 g (≈ 2½ cucharadas); Frutillas 130 g (≈ ¾ taza); Almendras 13 g (≈ 11 unidades) | 282 | 14 | 39 | 9 |
| Cena | Pechuga de pavo a la plancha 130 g; Papa cocida 195 g (≈ 1¼ unidades medianas); Brócoli cocido 100 g; Aceite de oliva 13 g (≈ 3 cucharaditas) | 509 | 45 | 46 | 16 |

### Viernes · 1.988 kcal · P 112 g · C 227 g · G 74 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Avena en hojuelas 50 g (≈ 5 cucharadas); Yogur natural descremado sin azúcar 125 g (≈ 1 pote); Manzana 120 g (≈ ¾ unidad); Almendras 18 g (≈ 15 unidades) | 426 | 18 | 64 | 13 |
| Colación | Pan integral de molde 30 g (≈ 1 rebanada); Hummus 35 g (≈ 2¼ cucharadas); Tomate 40 g (≈ ¼ unidad) | 141 | 7 | 19 | 5 |
| Almuerzo | Jurel en lata al natural (escurrido) 120 g; Arroz blanco cocido 145 g (≈ 1 taza); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Cebolla 20 g; Palta Hass 35 g (≈ ¼ unidad); Aceite de oliva 12 g (≈ 2 cucharaditas) | 568 | 34 | 50 | 25 |
| Once | Pan integral de molde 60 g (≈ 2 rebanadas); Huevo 50 g (≈ 1 unidad); Palta Hass 35 g (≈ ¼ unidad) | 285 | 14 | 29 | 13 |
| Cena | Pechuga de pollo a la plancha 100 g; Zapallo italiano cocido 100 g; Pimentón 80 g; Quínoa cocida 120 g (≈ ¾ taza); Aceite de oliva 12 g (≈ 2 cucharaditas); Pera 205 g (≈ 1¼ unidades) | 568 | 39 | 64 | 19 |

### Sábado · 1.997 kcal · P 125 g · C 221 g · G 72 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Pan integral de molde 90 g (≈ 3 rebanadas); Huevo 50 g (≈ 1 unidad); Palta Hass 50 g (≈ ¼ unidad); Tomate 50 g (≈ ½ unidad); Naranja 205 g (≈ 1¼ unidades) | 490 | 21 | 70 | 16 |
| Colación | Yogur griego natural descremado 125 g (≈ 1 pote); Nueces 25 g | 238 | 17 | 8 | 17 |
| Almuerzo | Merluza al horno 155 g; Arroz integral cocido 155 g (≈ ¾ taza); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Pepino 50 g; Aceite de oliva 13 g (≈ 3 cucharaditas) | 499 | 42 | 46 | 17 |
| Once | Leche descremada 260 g (≈ 1¼ tazas); Pan marraqueta 50 g (≈ ½ unidad); Palta Hass 40 g (≈ ¼ unidad) | 288 | 14 | 44 | 7 |
| Cena | Fideos cocidos 155 g (≈ 1 taza); Atún en agua (escurrido) 80 g (≈ ¾ lata); Tomate 100 g (≈ ¾ unidad); Champiñones 50 g; Aceite de oliva 13 g (≈ 3 cucharaditas) | 482 | 32 | 54 | 15 |

### Domingo · 2.013 kcal · P 112 g · C 216 g · G 85 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Avena en hojuelas 50 g (≈ 5 cucharadas); Leche descremada 250 g (≈ 1¼ tazas); Frutillas 125 g (≈ ¾ taza); Semillas de chía 13 g (≈ 1 cucharada); Almendras 13 g (≈ 11 unidades) | 453 | 21 | 64 | 15 |
| Colación | Plátano 150 g (≈ 1¼ unidades); Nueces 19 g | 258 | 5 | 37 | 13 |
| Almuerzo | Posta negra (vacuno magro) a la plancha 115 g; Papa cocida 190 g (≈ 1¼ unidades medianas); Zapallo camote cocido 80 g; Choclo cocido (granos) 75 g (≈ ½ taza); Porotos verdes cocidos 50 g; Aceite de oliva 6 g (≈ 1 cucharadita) | 533 | 41 | 66 | 14 |
| Once | Pan integral de molde 60 g (≈ 2 rebanadas); Quesillo 30 g (≈ 1 rebanada); Tomate 40 g (≈ ¼ unidad); Aceite de oliva 6 g (≈ 1 cucharadita) | 252 | 12 | 28 | 10 |
| Cena | Salmón al horno 125 g; Lechuga 60 g (≈ 1¼ tazas); Tomate 80 g (≈ ¾ unidad); Pepino 60 g; Aceitunas 25 g (≈ 6 unidades); Aceite de oliva 13 g (≈ 3 cucharaditas); Pan integral de molde 30 g (≈ 1 rebanada) | 517 | 34 | 21 | 34 |

## Alta en proteína

Más proteína en cada comida (carnes magras, pescado, huevos, lácteos y legumbres). Ayuda a la saciedad, a conservar músculo en déficit y a ganarlo en superávit junto al entrenamiento de fuerza.

Promedio semanal: 2.003 kcal · proteínas 183 g (36 %) · carbohidratos 198 g (39 %) · grasas 54 g (24 %).

### Lunes · 2.012 kcal · P 189 g · C 186 g · G 56 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Huevo 150 g (≈ 3 unidades); Pan integral de molde 90 g (≈ 3 rebanadas); Tomate 50 g (≈ ½ unidad); Leche descremada 235 g (≈ 1¼ tazas) | 549 | 39 | 54 | 19 |
| Colación | Yogur griego natural descremado 250 g (≈ 2 potes); Arándanos 95 g (≈ ¾ taza) | 202 | 26 | 23 | 1 |
| Almuerzo | Pechuga de pollo a la plancha 175 g; Arroz blanco cocido 175 g (≈ 1 taza); Brócoli cocido 120 g; Aceite de oliva 12 g (≈ 2 cucharaditas) | 665 | 62 | 58 | 19 |
| Once | Pan integral de molde 30 g (≈ 1 rebanada); Jamón de pavo 60 g (≈ 4 láminas); Quesillo 30 g (≈ 1 rebanada) | 183 | 19 | 15 | 5 |
| Cena | Atún en agua (escurrido) 140 g (≈ 1¼ latas); Quínoa cocida 140 g (≈ ¾ taza); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Pepino 50 g; Aceite de oliva 6 g (≈ 1 cucharadita) | 413 | 44 | 36 | 10 |

### Martes · 1.995 kcal · P 182 g · C 209 g · G 50 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Avena en hojuelas 50 g (≈ 5 cucharadas); Leche descremada 255 g (≈ 1¼ tazas); Yogur griego natural descremado 125 g (≈ 1 pote); Frutillas 125 g (≈ ¾ taza) | 391 | 29 | 61 | 5 |
| Colación | Huevo 100 g (≈ 2 unidades); Manzana 190 g (≈ 1¼ unidades) | 254 | 13 | 27 | 11 |
| Almuerzo | Posta negra (vacuno magro) a la plancha 200 g; Papa cocida 255 g (≈ 1¾ unidades medianas); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Aceite de oliva 6 g (≈ 1 cucharadita) | 634 | 64 | 56 | 18 |
| Once | Pan marraqueta 50 g (≈ ½ unidad); Quesillo 60 g (≈ 2 rebanadas); Jamón de pavo 30 g (≈ 2 láminas) | 250 | 19 | 30 | 6 |
| Cena | Merluza al horno 230 g; Arroz integral cocido 125 g (≈ ¾ taza); Zapallo italiano cocido 120 g; Aceite de oliva 6 g (≈ 1 cucharadita) | 466 | 58 | 35 | 11 |

### Miércoles · 2.003 kcal · P 177 g · C 191 g · G 59 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Pan integral de molde 60 g (≈ 2 rebanadas); Huevo 100 g (≈ 2 unidades); Quesillo 30 g (≈ 1 rebanada); Tomate 50 g (≈ ½ unidad) | 356 | 25 | 30 | 15 |
| Colación | Yogur griego natural descremado 125 g (≈ 1 pote); Almendras 12 g (≈ 10 unidades) | 143 | 15 | 7 | 7 |
| Almuerzo | Pechuga de pavo a la plancha 210 g; Fideos cocidos 145 g (≈ 1 taza); Espinaca cocida 100 g; Tomate 50 g (≈ ½ unidad); Aceite de oliva 6 g (≈ 1 cucharadita) | 623 | 75 | 51 | 12 |
| Once | Leche descremada 305 g (≈ 1½ tazas); Plátano 120 g (≈ 1 unidad); Avena en hojuelas 25 g (≈ 2½ cucharadas) | 306 | 15 | 60 | 2 |
| Cena | Salmón al horno 185 g; Papa cocida 185 g (≈ 1¼ unidades medianas); Brócoli cocido 100 g | 575 | 46 | 44 | 23 |

### Jueves · 2.001 kcal · P 186 g · C 183 g · G 58 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Clara de huevo 66 g (≈ 2 claras); Huevo 50 g (≈ 1 unidad); Espinaca cocida 50 g; Pan integral de molde 60 g (≈ 2 rebanadas); Palta Hass 40 g (≈ ¼ unidad); Naranja 205 g (≈ 1¼ unidades) | 435 | 25 | 56 | 14 |
| Colación | Yogur griego natural descremado 125 g (≈ 1 pote); Frutillas 125 g (≈ ¾ taza) | 114 | 14 | 14 | 1 |
| Almuerzo | Carne molida 5 % grasa, cocida 190 g; Arroz blanco cocido 165 g (≈ 1 taza); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Aceite de oliva 6 g (≈ 1 cucharadita) | 602 | 54 | 51 | 19 |
| Once | Pan integral de molde 60 g (≈ 2 rebanadas); Atún en agua (escurrido) 75 g (≈ ¾ lata); Palta Hass 40 g (≈ ¼ unidad) | 302 | 27 | 29 | 9 |
| Cena | Pechuga de pollo a la plancha 190 g; Quínoa cocida 125 g (≈ ¾ taza); Zapallo italiano cocido 100 g; Pimentón 60 g; Aceite de oliva 6 g (≈ 1 cucharadita) | 548 | 66 | 33 | 16 |

### Viernes · 2.017 kcal · P 180 g · C 222 g · G 47 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Avena en hojuelas 55 g (≈ 5½ cucharadas); Leche descremada 265 g (≈ 1¼ tazas); Yogur griego natural descremado 125 g (≈ 1 pote); Arándanos 105 g (≈ ¾ taza) | 432 | 30 | 70 | 5 |
| Colación | Quesillo 60 g (≈ 2 rebanadas); Galletas de arroz 25 g (≈ 3 unidades); Tomate 50 g (≈ ½ unidad) | 187 | 12 | 24 | 5 |
| Almuerzo | Merluza al horno 235 g; Arroz integral cocido 170 g (≈ 1 taza); Porotos verdes cocidos 100 g; Aceite de oliva 7 g (≈ 1 cucharadita) | 553 | 61 | 51 | 12 |
| Once | Pan marraqueta 50 g (≈ ½ unidad); Huevo 50 g (≈ 1 unidad); Jamón de pavo 30 g (≈ 2 láminas); Tomate 40 g (≈ ¼ unidad) | 254 | 17 | 31 | 7 |
| Cena | Posta negra (vacuno magro) a la plancha 195 g; Papa cocida 195 g (≈ 1¼ unidades medianas); Lechuga 50 g (≈ 1 taza); Zanahoria 50 g (≈ ¾ unidad); Aceite de oliva 7 g (≈ 1 cucharadita) | 591 | 61 | 45 | 18 |

### Sábado · 1.991 kcal · P 184 g · C 165 g · G 66 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Pan integral de molde 60 g (≈ 2 rebanadas); Huevo 100 g (≈ 2 unidades); Palta Hass 35 g (≈ ¼ unidad); Leche descremada 245 g (≈ 1¼ tazas) | 445 | 29 | 42 | 18 |
| Colación | Yogur griego natural descremado 125 g (≈ 1 pote); Nueces 12 g | 152 | 15 | 6 | 8 |
| Almuerzo | Pechuga de pollo a la plancha 195 g; Papa cocida 245 g (≈ 1¾ unidades medianas); Brócoli cocido 100 g; Aceite de oliva 6 g (≈ 1 cucharadita) | 621 | 67 | 56 | 14 |
| Once | Pan integral de molde 60 g (≈ 2 rebanadas); Quesillo 60 g (≈ 2 rebanadas); Pechuga de pavo a la plancha 50 g | 306 | 32 | 27 | 7 |
| Cena | Jurel en lata al natural (escurrido) 150 g; Quínoa cocida 125 g (≈ ¾ taza); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Cebolla 20 g; Aceite de oliva 6 g (≈ 1 cucharadita) | 467 | 42 | 33 | 18 |

### Domingo · 2.002 kcal · P 182 g · C 233 g · G 41 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Avena en hojuelas 50 g (≈ 5 cucharadas); Huevo 50 g (≈ 1 unidad); Clara de huevo 99 g (≈ 3 claras); Plátano 75 g (≈ ¾ unidad); Yogur griego natural descremado 125 g (≈ 1 pote) | 460 | 37 | 57 | 9 |
| Colación | Manzana 185 g (≈ 1¼ unidades); Almendras 18 g (≈ 15 unidades) | 200 | 4 | 29 | 9 |
| Almuerzo | Pechuga de pavo a la plancha 195 g; Papa cocida 185 g (≈ 1¼ unidades medianas); Zapallo camote cocido 80 g; Choclo cocido (granos) 60 g (≈ ½ taza); Porotos verdes cocidos 50 g | 554 | 66 | 62 | 6 |
| Once | Pan integral de molde 90 g (≈ 3 rebanadas); Jamón de pavo 60 g (≈ 4 láminas); Quesillo 30 g (≈ 1 rebanada) | 334 | 27 | 41 | 7 |
| Cena | Atún en agua (escurrido) 150 g (≈ 1¼ latas); Fideos cocidos 125 g (≈ 1 taza); Tomate 100 g (≈ ¾ unidad); Champiñones 50 g; Aceite de oliva 6 g (≈ 1 cucharadita) | 454 | 48 | 44 | 9 |

## Baja en carbohidratos (moderada)

Menos cereales y pan, más proteína, verduras y grasas saludables (palta, aceite de oliva, frutos secos). Rinde igual que una dieta equilibrada para bajar de peso; elígela si te acomoda más.

Promedio semanal: 2.003 kcal · proteínas 181 g (36 %) · carbohidratos 100 g (20 %) · grasas 101 g (45 %).

### Lunes · 2.003 kcal · P 163 g · C 89 g · G 115 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Huevo 100 g (≈ 2 unidades); Palta Hass 65 g (≈ ½ unidad); Tomate 50 g (≈ ½ unidad); Pan integral de molde 30 g (≈ 1 rebanada) | 344 | 18 | 21 | 21 |
| Colación | Yogur griego natural descremado 125 g (≈ 1 pote); Nueces 19 g; Frutillas 130 g (≈ ¾ taza) | 240 | 17 | 17 | 13 |
| Almuerzo | Pechuga de pollo a la plancha 190 g; Lechuga 80 g (≈ 1½ tazas); Tomate 80 g (≈ ¾ unidad); Pepino 60 g; Palta Hass 65 g (≈ ½ unidad); Aceite de oliva 13 g (≈ 3 cucharaditas); Quínoa cocida 75 g (≈ ½ taza) | 658 | 66 | 29 | 31 |
| Once | Quesillo 60 g (≈ 2 rebanadas); Jamón de pavo 30 g (≈ 2 láminas); Palta Hass 40 g (≈ ¼ unidad); Tomate 50 g (≈ ½ unidad) | 187 | 16 | 8 | 11 |
| Cena | Salmón al horno 190 g; Brócoli cocido 150 g; Zapallo italiano cocido 100 g; Aceite de oliva 13 g (≈ 3 cucharaditas) | 574 | 47 | 14 | 38 |

### Martes · 1.993 kcal · P 190 g · C 104 g · G 97 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Huevo 150 g (≈ 3 unidades); Queso gauda 45 g (≈ 3 láminas); Espinaca cocida 50 g; Champiñones 50 g; Aceite de oliva 6 g (≈ 1 cucharadita) | 469 | 33 | 6 | 35 |
| Colación | Frutillas 195 g (≈ 1¼ tazas); Almendras 25 g (≈ 21 unidades) | 207 | 7 | 20 | 13 |
| Almuerzo | Posta negra (vacuno magro) a la plancha 195 g; Porotos verdes cocidos 150 g; Papa cocida 105 g (≈ ¾ unidad mediana); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Aceite de oliva 13 g (≈ 3 cucharaditas) | 612 | 63 | 38 | 25 |
| Once | Yogur griego natural descremado 250 g (≈ 2 potes); Semillas de chía 13 g (≈ 1 cucharada); Arándanos 80 g (≈ ½ taza) | 257 | 28 | 26 | 5 |
| Cena | Merluza al horno 235 g; Espinaca cocida 100 g; Palta Hass 65 g (≈ ½ unidad); Zanahoria 50 g (≈ ¾ unidad); Aceite de oliva 6 g (≈ 1 cucharadita) | 448 | 59 | 14 | 19 |

### Miércoles · 2.003 kcal · P 193 g · C 96 g · G 97 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Yogur griego natural descremado 250 g (≈ 2 potes); Nueces 19 g; Frutillas 125 g (≈ ¾ taza); Semillas de chía 13 g (≈ 1 cucharada) | 375 | 31 | 27 | 18 |
| Colación | Huevo 150 g (≈ 3 unidades); Pepino 80 g | 245 | 20 | 5 | 16 |
| Almuerzo | Carne molida 5 % grasa, cocida 190 g; Zapallo italiano cocido 150 g; Queso gauda 30 g (≈ 2 láminas); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Aceite de oliva 6 g (≈ 1 cucharadita); Arroz integral cocido 75 g (≈ ½ taza) | 609 | 61 | 29 | 28 |
| Once | Pan integral de molde 30 g (≈ 1 rebanada); Palta Hass 65 g (≈ ½ unidad); Jamón de pavo 45 g (≈ 3 láminas); Quesillo 30 g (≈ 1 rebanada) | 271 | 18 | 20 | 14 |
| Cena | Pechuga de pollo a la plancha 190 g; Brócoli cocido 150 g; Pimentón 80 g; Aceite de oliva 13 g (≈ 3 cucharaditas) | 503 | 63 | 16 | 21 |

### Jueves · 2.003 kcal · P 163 g · C 85 g · G 115 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Huevo 150 g (≈ 3 unidades); Palta Hass 65 g (≈ ½ unidad); Tomate 60 g (≈ ½ unidad); Quesillo 30 g (≈ 1 rebanada) | 389 | 25 | 10 | 28 |
| Colación | Yogur natural descremado sin azúcar 125 g (≈ 1 pote); Almendras 19 g (≈ 16 unidades) | 180 | 11 | 14 | 10 |
| Almuerzo | Salmón al horno 180 g; Lechuga 60 g (≈ 1¼ tazas); Tomate 80 g (≈ ¾ unidad); Pepino 60 g; Aceitunas 25 g (≈ 6 unidades); Aceite de oliva 13 g (≈ 3 cucharaditas); Papa cocida 130 g (≈ ¾ unidad mediana) | 666 | 44 | 34 | 40 |
| Once | Quesillo 90 g (≈ 3 rebanadas); Tomate 60 g (≈ ½ unidad); Nueces 19 g; Pan integral de molde 30 g (≈ 1 rebanada) | 333 | 21 | 20 | 20 |
| Cena | Pechuga de pavo a la plancha 190 g; Zapallo italiano cocido 150 g; Champiñones 80 g; Aceite de oliva 13 g (≈ 3 cucharaditas) | 435 | 61 | 7 | 18 |

### Viernes · 2.008 kcal · P 177 g · C 112 g · G 98 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Huevo 150 g (≈ 3 unidades); Espinaca cocida 60 g; Queso gauda 30 g (≈ 2 láminas); Aceite de oliva 7 g (≈ 1 cucharadita); Kiwi 100 g (≈ 1¼ unidades) | 477 | 29 | 19 | 32 |
| Colación | Yogur griego natural descremado 250 g (≈ 2 potes); Arándanos 80 g (≈ ½ taza) | 194 | 26 | 21 | 1 |
| Almuerzo | Jurel en lata al natural (escurrido) 155 g; Palta Hass 80 g (≈ ½ unidad); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Cebolla 20 g; Aceite de oliva 7 g (≈ 1 cucharadita); Porotos cocidos 105 g (≈ ½ taza) | 595 | 48 | 37 | 29 |
| Once | Pan integral de molde 30 g (≈ 1 rebanada); Quesillo 60 g (≈ 2 rebanadas); Palta Hass 40 g (≈ ¼ unidad) | 221 | 14 | 18 | 11 |
| Cena | Posta negra (vacuno magro) a la plancha 195 g; Brócoli cocido 120 g; Zapallo camote cocido 80 g; Aceite de oliva 13 g (≈ 3 cucharaditas) | 521 | 60 | 17 | 24 |

### Sábado · 2.004 kcal · P 210 g · C 97 g · G 90 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Yogur griego natural descremado 250 g (≈ 2 potes); Almendras 25 g (≈ 21 unidades); Frutillas 155 g (≈ 1 taza) | 343 | 32 | 26 | 14 |
| Colación | Huevo 50 g (≈ 1 unidad); Quesillo 30 g (≈ 1 rebanada); Tomate 50 g (≈ ½ unidad) | 128 | 11 | 4 | 8 |
| Almuerzo | Pechuga de pollo a la plancha 245 g; Lechuga 60 g (≈ 1¼ tazas); Tomate 80 g (≈ ¾ unidad); Palta Hass 75 g (≈ ½ unidad); Aceite de oliva 15 g (≈ 3 cucharaditas); Quínoa cocida 95 g (≈ ½ taza) | 794 | 83 | 31 | 37 |
| Once | Pan integral de molde 30 g (≈ 1 rebanada); Jamón de pavo 60 g (≈ 4 láminas); Palta Hass 60 g (≈ ½ unidad) | 238 | 16 | 19 | 12 |
| Cena | Merluza al horno 280 g; Porotos verdes cocidos 150 g; Zanahoria 50 g (≈ ¾ unidad); Aceite de oliva 15 g (≈ 3 cucharaditas) | 501 | 68 | 17 | 19 |

### Domingo · 2.005 kcal · P 173 g · C 115 g · G 98 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Huevo 150 g (≈ 3 unidades); Palta Hass 70 g (≈ ½ unidad); Pan integral de molde 30 g (≈ 1 rebanada); Tomate 50 g (≈ ½ unidad) | 430 | 24 | 22 | 27 |
| Colación | Nueces 20 g; Manzana 140 g (≈ 1 unidad) | 204 | 3 | 22 | 13 |
| Almuerzo | Posta negra (vacuno magro) a la plancha 210 g; Tomate 120 g (≈ 1 unidad); Cebolla 30 g; Aceite de oliva 14 g (≈ 3 cucharaditas); Papa cocida 140 g (≈ 1 unidad mediana) | 635 | 65 | 36 | 26 |
| Once | Yogur griego natural descremado 250 g (≈ 2 potes); Semillas de chía 14 g (≈ 1¼ cucharadas); Frutillas 110 g (≈ ¾ taza) | 251 | 29 | 23 | 6 |
| Cena | Atún en agua (escurrido) 165 g (≈ 1½ latas); Palta Hass 85 g (≈ ½ unidad); Lechuga 60 g (≈ 1¼ tazas); Pepino 60 g; Huevo 50 g (≈ 1 unidad); Aceite de oliva 7 g (≈ 1 cucharadita) | 485 | 51 | 12 | 26 |

## Vegetariana (ovolácteo)

Sin carnes ni pescados: la proteína viene de legumbres, huevos, lácteos y tofu, combinados con cereales. Bien planificada cubre los requerimientos en todas las etapas de la vida.

Promedio semanal: 2.001 kcal · proteínas 108 g (21 %) · carbohidratos 273 g (53 %) · grasas 60 g (26 %).

### Lunes · 2.006 kcal · P 107 g · C 286 g · G 54 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Avena en hojuelas 55 g (≈ 5½ cucharadas); Leche descremada 265 g (≈ 1¼ tazas); Plátano 135 g (≈ 1¼ unidades); Nueces 13 g | 503 | 20 | 83 | 13 |
| Colación | Yogur natural descremado sin azúcar 125 g (≈ 1 pote); Frutillas 135 g (≈ 1 taza) | 113 | 8 | 20 | 1 |
| Almuerzo | Lentejas cocidas 325 g (≈ 1¾ tazas); Arroz integral cocido 105 g (≈ ½ taza); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Aceite de oliva 7 g (≈ 1 cucharadita) | 590 | 34 | 97 | 10 |
| Once | Pan integral de molde 90 g (≈ 3 rebanadas); Quesillo 60 g (≈ 2 rebanadas); Tomate 40 g (≈ ¼ unidad) | 315 | 21 | 42 | 8 |
| Cena | Huevo 150 g (≈ 3 unidades); Espinaca cocida 80 g; Papa cocida 200 g (≈ 1¼ unidades medianas); Aceite de oliva 7 g (≈ 1 cucharadita) | 485 | 25 | 45 | 23 |

### Martes · 1.995 kcal · P 113 g · C 256 g · G 67 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Pan integral de molde 60 g (≈ 2 rebanadas); Huevo 50 g (≈ 1 unidad); Palta Hass 50 g (≈ ¼ unidad); Leche descremada 255 g (≈ 1¼ tazas) | 396 | 23 | 43 | 15 |
| Colación | Manzana 190 g (≈ 1¼ unidades); Almendras 19 g (≈ 16 unidades) | 209 | 5 | 30 | 10 |
| Almuerzo | Porotos cocidos 255 g (≈ 1½ tazas); Fideos cocidos 75 g (≈ ½ taza); Zapallo camote cocido 80 g; Tomate 80 g (≈ ¾ unidad); Aceite de oliva 6 g (≈ 1 cucharadita) | 542 | 28 | 93 | 8 |
| Once | Yogur griego natural descremado 125 g (≈ 1 pote); Avena en hojuelas 25 g (≈ 2½ cucharadas); Arándanos 75 g (≈ ½ taza) | 212 | 17 | 32 | 2 |
| Cena | Tofu firme 190 g; Arroz integral cocido 155 g (≈ ¾ taza); Brócoli cocido 100 g; Zanahoria 50 g (≈ ¾ unidad); Aceite de oliva 13 g (≈ 3 cucharaditas) | 636 | 40 | 57 | 32 |

### Miércoles · 2.010 kcal · P 123 g · C 280 g · G 51 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Yogur griego natural descremado 250 g (≈ 2 potes); Avena en hojuelas 45 g (≈ 4½ cucharadas); Frutillas 150 g (≈ 1 taza); Semillas de chía 15 g (≈ 1¼ cucharadas) | 440 | 35 | 57 | 9 |
| Colación | Pan integral de molde 30 g (≈ 1 rebanada); Hummus 70 g (≈ 4¾ cucharadas); Pepino 60 g | 201 | 10 | 25 | 8 |
| Almuerzo | Garbanzos cocidos 300 g (≈ 1¾ tazas); Quínoa cocida 120 g (≈ ¾ taza); Espinaca cocida 80 g; Tomate 80 g (≈ ¾ unidad); Aceite de oliva 8 g (≈ 2 cucharaditas) | 739 | 35 | 114 | 19 |
| Once | Leche descremada 300 g (≈ 1½ tazas); Pan marraqueta 50 g (≈ ½ unidad); Quesillo 30 g (≈ 1 rebanada) | 279 | 19 | 44 | 3 |
| Cena | Zapallo italiano cocido 200 g; Huevo 50 g (≈ 1 unidad); Quesillo 60 g (≈ 2 rebanadas); Choclo cocido (granos) 90 g (≈ ½ taza); Pan integral de molde 30 g (≈ 1 rebanada) | 351 | 24 | 40 | 13 |

### Jueves · 1.995 kcal · P 97 g · C 279 g · G 61 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Avena en hojuelas 50 g (≈ 5 cucharadas); Leche descremada 250 g (≈ 1¼ tazas); Plátano 125 g (≈ 1 unidad); Mantequilla de maní sin azúcar 20 g (≈ 1¼ cucharadas) | 504 | 22 | 79 | 14 |
| Colación | Yogur natural descremado sin azúcar 125 g (≈ 1 pote); Nueces 13 g | 155 | 9 | 11 | 9 |
| Almuerzo | Lentejas cocidas 250 g (≈ 1¼ tazas); Papa cocida 125 g (≈ ¾ unidad mediana); Zanahoria 50 g (≈ ¾ unidad); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Aceite de oliva 6 g (≈ 1 cucharadita) | 494 | 27 | 85 | 8 |
| Once | Pan integral de molde 90 g (≈ 3 rebanadas); Huevo 50 g (≈ 1 unidad); Palta Hass 40 g (≈ ¼ unidad) | 369 | 18 | 42 | 14 |
| Cena | Fideos cocidos 175 g (≈ 1¼ tazas); Tomate 100 g (≈ ¾ unidad); Champiñones 80 g; Queso gauda 30 g (≈ 2 láminas); Aceite de oliva 6 g (≈ 1 cucharadita) | 473 | 21 | 61 | 16 |

### Viernes · 1.994 kcal · P 105 g · C 268 g · G 61 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Pan integral de molde 90 g (≈ 3 rebanadas); Quesillo 60 g (≈ 2 rebanadas); Tomate 40 g (≈ ¼ unidad); Naranja 205 g (≈ 1¼ unidades) | 411 | 22 | 66 | 8 |
| Colación | Yogur griego natural descremado 125 g (≈ 1 pote); Almendras 13 g (≈ 11 unidades) | 149 | 16 | 7 | 7 |
| Almuerzo | Porotos cocidos 260 g (≈ 1½ tazas); Arroz blanco cocido 105 g (≈ ¾ taza); Lechuga 50 g (≈ 1 taza); Tomate 80 g (≈ ¾ unidad); Cebolla 20 g; Aceite de oliva 6 g (≈ 1 cucharadita) | 550 | 27 | 95 | 8 |
| Once | Pan marraqueta 50 g (≈ ½ unidad); Palta Hass 50 g (≈ ¼ unidad); Huevo 50 g (≈ 1 unidad) | 294 | 12 | 33 | 14 |
| Cena | Huevo 150 g (≈ 3 unidades); Espinaca cocida 100 g; Quínoa cocida 130 g (≈ ¾ taza); Aceite de oliva 6 g (≈ 1 cucharadita); Pera 220 g (≈ 1¼ unidades) | 590 | 28 | 67 | 25 |

### Sábado · 2.010 kcal · P 116 g · C 253 g · G 68 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Yogur griego natural descremado 125 g (≈ 1 pote); Avena en hojuelas 40 g (≈ 4 cucharadas); Arándanos 100 g (≈ ¾ taza); Nueces 13 g | 368 | 21 | 48 | 12 |
| Colación | Pan integral de molde 30 g (≈ 1 rebanada); Hummus 40 g (≈ 2¾ cucharadas); Zanahoria 60 g (≈ ¾ unidad) | 167 | 7 | 24 | 5 |
| Almuerzo | Garbanzos cocidos 230 g (≈ 1½ tazas); Arroz integral cocido 125 g (≈ ¾ taza); Zapallo italiano cocido 100 g; Pimentón 60 g; Aceite de oliva 6 g (≈ 1 cucharadita) | 615 | 26 | 101 | 14 |
| Once | Leche descremada 255 g (≈ 1¼ tazas); Pan integral de molde 60 g (≈ 2 rebanadas); Quesillo 30 g (≈ 1 rebanada) | 279 | 21 | 39 | 5 |
| Cena | Tofu firme 190 g; Quínoa cocida 125 g (≈ ¾ taza); Brócoli cocido 120 g; Aceite de oliva 13 g (≈ 3 cucharaditas) | 581 | 41 | 41 | 32 |

### Domingo · 1.997 kcal · P 96 g · C 288 g · G 59 g

| Comida | Alimentos | kcal | P | C | G |
|---|---|---|---|---|---|
| Desayuno | Huevo 100 g (≈ 2 unidades); Pan integral de molde 60 g (≈ 2 rebanadas); Palta Hass 50 g (≈ ¼ unidad); Leche descremada 245 g (≈ 1¼ tazas) | 469 | 29 | 43 | 20 |
| Colación | Plátano 145 g (≈ 1¼ unidades); Mantequilla de maní sin azúcar 20 g (≈ 1¼ cucharadas) | 247 | 7 | 37 | 10 |
| Almuerzo | Porotos cocidos 120 g (≈ ¾ taza); Papa cocida 185 g (≈ 1¼ unidades medianas); Zapallo camote cocido 100 g; Choclo cocido (granos) 75 g (≈ ½ taza); Porotos verdes cocidos 50 g; Huevo 50 g (≈ 1 unidad); Aceite de oliva 6 g (≈ 1 cucharadita); Tomate 80 g (≈ ¾ unidad) | 586 | 25 | 98 | 14 |
| Once | Yogur natural descremado sin azúcar 125 g (≈ 1 pote); Avena en hojuelas 25 g (≈ 2½ cucharadas); Frutillas 120 g (≈ ¾ taza) | 203 | 11 | 36 | 2 |
| Cena | Fideos cocidos 145 g (≈ 1 taza); Lentejas cocidas 120 g (≈ ½ taza); Tomate 100 g (≈ ¾ unidad); Queso gauda 15 g (≈ 1 lámina); Aceite de oliva 6 g (≈ 1 cucharadita) | 492 | 24 | 73 | 12 |

## Alimentos usados (composición por 100 g)

| Alimento | Grupo | kcal | Proteínas (g) | Carbohidratos (g) | Grasas (g) | Medida casera |
|---|---|---|---|---|---|---|
| Pechuga de pollo a la plancha | proteinas | 165 | 31 | 0 | 3,6 | — |
| Pechuga de pavo a la plancha | proteinas | 147 | 30,1 | 0 | 2,1 | — |
| Posta negra (vacuno magro) a la plancha | proteinas | 170 | 29 | 0 | 5,5 | — |
| Carne molida 5 % grasa, cocida | proteinas | 164 | 25,5 | 0 | 6,4 | — |
| Merluza al horno | proteinas | 105 | 23 | 0 | 1,3 | — |
| Salmón al horno | proteinas | 206 | 22,1 | 0 | 12,4 | — |
| Jurel en lata al natural (escurrido) | proteinas | 156 | 23,2 | 0 | 6,3 | — |
| Atún en agua (escurrido) | proteinas | 116 | 25,5 | 0 | 0,8 | 1 lata = 120 g |
| Huevo | proteinas | 155 | 12,6 | 1,1 | 10,6 | 1 unidad = 50 g |
| Clara de huevo | proteinas | 52 | 10,9 | 0,7 | 0,2 | 1 clara = 33 g |
| Jamón de pavo | proteinas | 110 | 18 | 2 | 3,5 | 1 lámina = 15 g |
| Tofu firme | proteinas | 144 | 17,3 | 2,8 | 8,7 | — |
| Leche descremada | lacteos | 34 | 3,4 | 5 | 0,1 | 1 taza = 200 g |
| Yogur natural descremado sin azúcar | lacteos | 56 | 5,7 | 7,7 | 0,2 | 1 pote = 125 g |
| Yogur griego natural descremado | lacteos | 59 | 10,2 | 3,6 | 0,4 | 1 pote = 125 g |
| Quesillo | lacteos | 135 | 15 | 3 | 7 | 1 rebanada = 30 g |
| Queso gauda | lacteos | 356 | 25 | 2,2 | 27,4 | 1 lámina = 15 g |
| Avena en hojuelas | cereales | 379 | 13,2 | 67,7 | 6,5 | 1 cucharada = 10 g |
| Pan marraqueta | cereales | 272 | 9 | 56 | 1,5 | 1 unidad = 100 g |
| Pan integral de molde | cereales | 252 | 12,4 | 42,7 | 3,5 | 1 rebanada = 30 g |
| Arroz blanco cocido | cereales | 130 | 2,7 | 28,2 | 0,3 | 1 taza = 160 g |
| Arroz integral cocido | cereales | 123 | 2,7 | 25,6 | 1 | 1 taza = 190 g |
| Fideos cocidos | cereales | 158 | 5,8 | 30,9 | 0,9 | 1 taza = 140 g |
| Quínoa cocida | cereales | 120 | 4,4 | 21,3 | 1,9 | 1 taza = 185 g |
| Papa cocida | cereales | 86 | 1,7 | 20 | 0,1 | 1 unidad mediana = 150 g |
| Choclo cocido (granos) | cereales | 96 | 3,4 | 21 | 1,5 | 1 taza = 150 g |
| Galletas de arroz | cereales | 387 | 8,2 | 81,5 | 2,8 | 1 unidad = 9 g |
| Lentejas cocidas | legumbres | 116 | 9 | 20,1 | 0,4 | 1 taza = 200 g |
| Porotos cocidos | legumbres | 127 | 8,7 | 22,8 | 0,5 | 1 taza = 180 g |
| Garbanzos cocidos | legumbres | 164 | 8,9 | 27,4 | 2,6 | 1 taza = 165 g |
| Hummus | legumbres | 166 | 7,9 | 14,3 | 9,6 | 1 cucharada = 15 g |
| Plátano | frutas | 89 | 1,1 | 22,8 | 0,3 | 1 unidad = 120 g |
| Manzana | frutas | 52 | 0,3 | 13,8 | 0,2 | 1 unidad = 150 g |
| Naranja | frutas | 47 | 0,9 | 11,8 | 0,1 | 1 unidad = 160 g |
| Frutillas | frutas | 32 | 0,7 | 7,7 | 0,3 | 1 taza = 150 g |
| Arándanos | frutas | 57 | 0,7 | 14,5 | 0,3 | 1 taza = 150 g |
| Kiwi | frutas | 61 | 1,1 | 14,7 | 0,5 | 1 unidad = 75 g |
| Pera | frutas | 57 | 0,4 | 15,2 | 0,1 | 1 unidad = 170 g |
| Lechuga | verduras | 15 | 1,4 | 2,9 | 0,2 | 1 taza = 50 g |
| Tomate | verduras | 18 | 0,9 | 3,9 | 0,2 | 1 unidad = 120 g |
| Zanahoria | verduras | 41 | 0,9 | 9,6 | 0,2 | 1 unidad = 80 g |
| Pepino | verduras | 15 | 0,7 | 3,6 | 0,1 | — |
| Cebolla | verduras | 40 | 1,1 | 9,3 | 0,1 | — |
| Pimentón | verduras | 26 | 1 | 6 | 0,3 | — |
| Brócoli cocido | verduras | 35 | 2,4 | 7,2 | 0,4 | — |
| Zapallo italiano cocido | verduras | 15 | 1,1 | 2,7 | 0,4 | — |
| Espinaca cocida | verduras | 23 | 3 | 3,8 | 0,3 | — |
| Porotos verdes cocidos | verduras | 35 | 1,9 | 7,9 | 0,3 | — |
| Zapallo camote cocido | verduras | 40 | 0,9 | 10,5 | 0,1 | — |
| Champiñones | verduras | 22 | 3,1 | 3,3 | 0,3 | — |
| Palta Hass | grasas | 160 | 2 | 8,5 | 14,7 | 1 unidad = 140 g |
| Aceite de oliva | grasas | 884 | 0 | 0 | 100 | 1 cucharadita = 5 g |
| Nueces | grasas | 654 | 15,2 | 13,7 | 65,2 | — |
| Almendras | grasas | 579 | 21,2 | 21,6 | 49,9 | 1 unidad = 1,2 g |
| Mantequilla de maní sin azúcar | grasas | 588 | 25 | 20 | 50 | 1 cucharada = 16 g |
| Semillas de chía | grasas | 486 | 16,5 | 42,1 | 30,7 | 1 cucharada = 12 g |
| Aceitunas | grasas | 145 | 1 | 3,8 | 15,3 | 1 unidad = 4 g |

Valores referenciales de USDA FoodData Central y de etiquetas de productos chilenos; deben verificarse con la tabla de composición de alimentos chilena (INTA) y los productos que se usen en el piloto.
