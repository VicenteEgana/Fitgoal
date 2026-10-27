const STRENGTH_SOURCE = 'https://www.nhs.uk/live-well/exercise/strength-exercises/';
const FLEXIBILITY_SOURCE = 'https://www.nhs.uk/live-well/exercise/flexibility-exercises/';
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const exercise = (name, description) => ({ name, description });
const sitToStand = exercise('Sentarse y levantarse', 'Movimiento de sentarse y levantarse de una silla como ejemplo general.');
const wallPress = exercise('Flexiones en pared', 'Ejemplo de empuje del cuerpo con las manos apoyadas en una pared.');
const calfRaise = exercise('Elevación de talones', 'Ejemplo de elevación de los talones desde una posición de pie.');
const miniSquat = exercise('Mini sentadillas', 'Ejemplo de flexión parcial de rodillas y caderas desde una posición de pie.');
const sideLegLift = exercise('Elevación lateral de pierna', 'Ejemplo de desplazamiento de una pierna hacia un lado estando de pie.');
const bicepsCurl = exercise('Curl de bíceps con mancuernas', 'Ejemplo de flexión de los codos usando mancuernas como material de demostración.');
const legExtension = exercise('Extensión de pierna de pie', 'Ejemplo de llevar una pierna hacia atrás desde una posición de pie.');

const ROUTINES = [
  { id: 'inicio-sin-equipo', title: 'Inicio sin equipo', focus: 'Ejemplos de movimientos básicos', levels: ['principiante'], equipmentOptions: ['sin_equipo'], exercises: [sitToStand, wallPress, calfRaise], sourceUrl: STRENGTH_SOURCE },
  { id: 'circuito-sin-equipo', title: 'Circuito sin equipo', focus: 'Ejemplos variados de movimiento', levels: ['intermedio'], equipmentOptions: ['sin_equipo'], exercises: [miniSquat, sideLegLift, wallPress], sourceUrl: STRENGTH_SOURCE },
  { id: 'inicio-con-mancuernas', title: 'Inicio con mancuernas', focus: 'Ejemplos con material sencillo', levels: ['principiante'], equipmentOptions: ['con_equipo'], exercises: [bicepsCurl, sitToStand, calfRaise], sourceUrl: STRENGTH_SOURCE },
  { id: 'circuito-con-equipo', title: 'Circuito con equipo', focus: 'Ejemplos de movimientos con material', levels: ['intermedio'], equipmentOptions: ['con_equipo'], exercises: [bicepsCurl, miniSquat, legExtension], sourceUrl: STRENGTH_SOURCE },
  { id: 'movilidad-general', title: 'Movilidad general', focus: 'Ejemplos de movilidad y flexibilidad', levels: ['principiante', 'intermedio'], equipmentOptions: ['sin_equipo', 'con_equipo'], exercises: [exercise('Rotación de cuello', 'Ejemplo de giro del cuello dentro de su movimiento habitual.'), exercise('Inclinación lateral del tronco', 'Ejemplo de inclinación del tronco hacia un lado.'), exercise('Estiramiento de gemelos', 'Ejemplo general de estiramiento de la parte posterior de la pierna.')], sourceUrl: FLEXIBILITY_SOURCE },
  { id: 'actividad-suave', title: 'Actividad suave', focus: 'Ejemplos de actividad cotidiana', levels: ['principiante', 'intermedio'], equipmentOptions: ['sin_equipo', 'con_equipo'], exercises: [exercise('Caminata', 'Desplazamiento a pie como ejemplo de actividad cotidiana.'), exercise('Movilidad de hombros', 'Movimientos de los hombros como ejemplo general de movilidad.'), exercise('Marcha en el lugar', 'Ejemplo de alternar pasos sin desplazarse del lugar.')] },
].map(routine => ({ ...routine, demo: true }));

export function getRoutines() { return structuredClone(ROUTINES); }

export function buildSessions(profile) {
  const specific = ROUTINES.find(routine => routine.levels.length === 1 && routine.equipmentOptions.length === 1 && routine.levels.includes(profile.level) && routine.equipmentOptions.includes(profile.equipment));
  if (!specific) throw new Error('No existe una estructura de catálogo para el perfil demo válido.');
  const rotation = [specific, ROUTINES.find(routine => routine.id === 'movilidad-general'), ROUTINES.find(routine => routine.id === 'actividad-suave')];
  return profile.days.map((day, index) => {
    const routine = rotation[index % rotation.length];
    return { day, dayLabel: DAY_LABELS[day - 1], routineId: routine.id, title: routine.title, focus: routine.focus, exercises: structuredClone(routine.exercises) };
  });
}
