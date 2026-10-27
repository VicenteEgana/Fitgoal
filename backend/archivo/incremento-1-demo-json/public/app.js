'use strict';
const $ = id => document.getElementById(id);
const dayNames = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
let token = null;
let savedProfile = null;
let plan = null;
let loading = false;
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function notify(message, error = false) {
  $('notice').hidden = false;
  $('notice').textContent = message;
  $('notice').className = error ? 'notice error' : 'notice';
  $('notice').setAttribute('role', error ? 'alert' : 'status');
}
function readInputProfile() {
  const days = [...document.querySelectorAll('input[name="days"]:checked')]
    .map(input => Number(input.value)).sort((a, b) => a - b);
  return {name:$('name').value.trim(),age:Number($('age').value),objective:$('objective').value,
    level:$('level').value,equipment:$('equipment').value,days,durationMinutes:Number($('duration').value)};
}
function profileChanged(values = readInputProfile()) {
  if (!savedProfile) return true;
  if (['name','age','objective','level','equipment','durationMinutes'].some(field => values[field] !== savedProfile[field])) return true;
  const savedDays = [...savedProfile.days].sort((a, b) => a - b);
  return values.days.length !== savedDays.length || values.days.some((day, index) => day !== savedDays[index]);
}
function showPlan() {
  const root = $('plan');
  root.replaceChildren();
  if (!plan) {
    root.append(el('p','Tu rutina de ejemplo aparecerá aquí con las sesiones de los días elegidos.'));
    return;
  }
  root.append(el('h3',plan.title || 'Mi rutina de ejemplo','plan-title'));
  root.append(el('p','Plan v' + plan.version + ' · perfil v' + plan.profileVersion,'metadata'));
  if (plan.isFromCurrentProfile === false || profileChanged()) {
    root.append(el('p','Esta rutina corresponde a un perfil anterior o tiene cambios pendientes. Genera otra para aplicar los valores del formulario.','warning'));
  }
  root.append(el('p',(plan.days || []).map(day => dayNames[day - 1]).join(' · ') + ' · tiempo disponible: ' + plan.durationMinutes + ' minutos','metadata'));
  if (Array.isArray(plan.sessions) && plan.sessions.length) {
    for (const session of plan.sessions) {
      const card = el('article',undefined,'session');
      card.append(el('h4',(session.dayLabel || dayNames[session.day - 1] || 'Sesión') + ' · ' + session.title));
      if (session.focus) card.append(el('p',session.focus,'session-focus'));
      const exercises = el('ul',undefined,'exercise-list');
      for (const exercise of session.exercises || []) {
        const row = el('li');
        row.append(el('strong',exercise.name),el('p',exercise.description));
        exercises.append(row);
      }
      card.append(exercises);
      root.append(card);
    }
  } else {
    const exercises = el('ul',undefined,'exercise-list');
    for (const exercise of plan.exercises || []) {
      const row = el('li');
      row.append(el('strong',exercise.name),el('p',exercise.description));
      exercises.append(row);
    }
    root.append(exercises);
  }
}
function syncActions() {
  $('generate-plan').disabled = loading || !token;
  $('save-profile').disabled = loading || !token;
  $('dirty-hint').textContent = !savedProfile
    ? 'Generar rutina de ejemplo guarda tu perfil automáticamente.'
    : profileChanged()
      ? 'Hay cambios en el formulario. Generar rutina de ejemplo los guardará automáticamente.'
      : 'Perfil guardado. Puedes generar otra rutina de ejemplo.';
  showPlan();
}
function renderUserState() {
  $('profile-version').textContent = savedProfile ? 'Perfil guardado · v' + savedProfile.version : 'Aún sin guardar';
  syncActions();
}
function adoptProfile(profile) {
  savedProfile = profile;
  if (plan) plan = {...plan,isFromCurrentProfile:plan.profileVersion === profile?.version};
  renderUserState();
}
function fillProfile(profile) {
  if (!profile) return;
  $('name').value = profile.name;
  $('age').value = profile.age;
  $('objective').value = profile.objective;
  $('level').value = profile.level;
  $('equipment').value = profile.equipment;
  $('duration').value = String(profile.durationMinutes);
  document.querySelectorAll('input[name="days"]').forEach(input => { input.checked = profile.days.includes(Number(input.value)); });
  syncActions();
}
async function api(path, options = {}) {
  const response = await fetch('/api' + path,{...options,headers:{'Content-Type':'application/json',
    ...(token ? {Authorization:'Bearer ' + token} : {}),...options.headers}});
  let data;
  try { data = await response.json(); } catch { throw new Error('La API devolvió una respuesta inesperada.'); }
  if (!response.ok) {
    const error = new Error(data.error?.message || 'No se pudo completar la operación.');
    error.code = data.error?.code;
    throw error;
  }
  return data;
}
async function run(action) {
  if (loading) return;
  loading = true;
  document.querySelectorAll('button,input,select').forEach(control => {
    control.dataset.wasDisabled = String(control.disabled);
    control.disabled = true;
  });
  try { await action(); } catch (error) { notify(error.message || 'No se pudo conectar con la API.',true); }
  finally {
    document.querySelectorAll('button,input,select').forEach(control => { control.disabled = control.dataset.wasDisabled === 'true'; });
    loading = false;
    syncActions();
  }
}
async function refreshUser(fill = false) {
  const state = await api('/demo/state');
  savedProfile = state.profile;
  plan = state.plan;
  if (fill) fillProfile(savedProfile);
  renderUserState();
}
async function connect(fill = false) {
  const session = await api('/demo/login',{method:'POST',body:JSON.stringify({role:'user'})});
  token = session.token;
  await refreshUser(fill);
}
async function saveCurrentProfile(values) {
  const {profile} = await api('/profiles/me');
  adoptProfile(profile);
  if (!profileChanged(values)) return false;
  const result = await api('/profiles/me',{method:'PUT',body:JSON.stringify(values)});
  adoptProfile(result.profile);
  return true;
}
$('example').addEventListener('click',() => {
  fillProfile({name:'Usuario demo',age:25,objective:'mantener',level:'principiante',equipment:'sin_equipo',days:[1,3,5],durationMinutes:30});
  notify('Ejemplo cargado. Puedes cambiar sus datos y generar la rutina.');
});
$('profile-form').addEventListener('input',syncActions);
$('profile-form').addEventListener('change',syncActions);
$('profile-form').addEventListener('submit',event => {
  event.preventDefault();
  run(async () => {
    const values = readInputProfile();
    if (!values.days.length) throw new Error('Selecciona al menos un día disponible.');
    const changed = await saveCurrentProfile(values);
    await refreshUser();
    notify(changed ? 'Perfil guardado. Genera la rutina para aplicar estos datos.' : 'El perfil ya está guardado.');
  });
});
$('generate-plan').addEventListener('click',() => {
  if (!$('profile-form').reportValidity()) return;
  run(async () => {
    const values = readInputProfile();
    if (!values.days.length) throw new Error('Selecciona al menos un día disponible.');
    await saveCurrentProfile(values);
    try {
      const result = await api('/plans/generate',{method:'POST',body:JSON.stringify({profileVersion:savedProfile.version})});
      plan = result.plan;
      renderUserState();
    } catch (error) {
      try { await refreshUser(); } catch { /* Preserve the original error and the form values. */ }
      if (error.code === 'STALE_PROFILE') error.message += ' El formulario se conserva; vuelve a pulsar Generar rutina de ejemplo para usar estos valores.';
      throw error;
    }
    notify('Rutina de ejemplo generada. Ya puedes ver tus sesiones.');
  });
});
$('refresh').addEventListener('click',() => run(() => connect()));
run(() => connect(true));

