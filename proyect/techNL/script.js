/* =====================================================================
   OxygeNMedia · Análisis de un proceso tecnológico
   Vanilla JS (ES module). Sin dependencias.

   Estructura:
     1. Estado y persistencia (localStorage)
     2. Utilidades
     3. Render: medios, tabla, personas, pasos
     4. Progreso, navegación y estados de sección
     5. Eventos (delegados): bindings, acciones, drag & drop
     6. Exportar: validación + versión de impresión
     7. Inicio
   ===================================================================== */

/* ---------- 1. Estado y persistencia ---------- */

// La clave depende de la ruta: si se renombra la carpeta, cada proyecto
// conserva sus datos separados de otros proyectos del sitio.
const CLAVE = 'oxy-proceso-tecnologico:' + location.pathname;

const TIPOS = {
  herramienta: { singular: 'Herramienta', plural: 'Herramientas' },
  maquina: { singular: 'Máquina', plural: 'Máquinas' },
  instrumento: { singular: 'Instrumento', plural: 'Instrumentos' },
};

const SECCIONES = [
  { id: 'datos', nombre: 'Datos del proceso' },
  { id: 'medios', nombre: 'Medios técnicos' },
  { id: 'capacidad', nombre: 'Capacidad corporal ampliada' },
  { id: 'necesidad', nombre: 'Necesidad y alternativa' },
  { id: 'organizacion', nombre: 'Organización del trabajo' },
  { id: 'proceso', nombre: 'Pasos del proceso' },
  { id: 'conclusion', nombre: 'Conclusión' },
];

/** Estado vacío por defecto. */
function estadoVacio() {
  return {
    datos: { nombre: '', articulo: '', necesidad: '', descripcion: '' },
    alternativa: '',
    equipo: '',
    trabajo: '',
    conclusion: '',
    medios: [],    // {id, tipo, nombre, funcion, uso, imagen, capacidad, ejemplo}
    personas: [],  // {id, rol, responsabilidad, ejemplo}
    pasos: [],     // {id, titulo, descripcion, ejemplo}
  };
}

let estado = cargar();

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return estadoVacio();
    const d = JSON.parse(crudo);
    const base = estadoVacio();
    // Mezcla defensiva: ignora datos corruptos o de versiones viejas.
    return {
      datos: { ...base.datos, ...(d.datos || {}) },
      alternativa: String(d.alternativa || ''),
      equipo: String(d.equipo || ''),
      trabajo: String(d.trabajo || ''),
      conclusion: String(d.conclusion || ''),
      medios: Array.isArray(d.medios) ? d.medios.filter(m => m && TIPOS[m.tipo]) : [],
      personas: Array.isArray(d.personas) ? d.personas : [],
      pasos: Array.isArray(d.pasos) ? d.pasos : [],
    };
  } catch (e) {
    return estadoVacio();
  }
}

let temporizador = null;
const elGuardado = document.getElementById('estadoGuardado');

/** Guarda con un pequeño retraso para no escribir en cada tecla. */
function guardar() {
  elGuardado.textContent = 'Guardando…';
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
      const h = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      elGuardado.textContent = 'Guardado ✓ ' + h;
    } catch (e) {
      elGuardado.textContent = '⚠ No se pudo guardar (almacenamiento bloqueado o lleno)';
    }
  }, 300);
}

/* ---------- 2. Utilidades ---------- */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const txt = v => String(v == null ? '' : v).trim();

/** Escapa HTML para insertar texto de usuario con seguridad. */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Solo permite imágenes http(s) o data:image para evitar URLs peligrosas. */
function urlImagenValida(u) {
  return /^(https?:\/\/|data:image\/)/i.test(txt(u));
}

/** Lee/escribe una ruta tipo "datos.nombre" en el estado. */
function leerRuta(ruta) {
  return ruta.split('.').reduce((o, k) => (o ? o[k] : undefined), estado);
}
function escribirRuta(ruta, valor) {
  const partes = ruta.split('.');
  const ultima = partes.pop();
  const obj = partes.reduce((o, k) => o[k], estado);
  obj[ultima] = valor;
}

/** Marca "Ejemplo" en elementos demostrativos. */
const tagEjemplo = e => (e ? '<span class="tag-ejemplo">Ejemplo</span>' : '');

/* ---------- 3. Render ---------- */

let ayudaImagen = null; // módulo reutilizable del sitio (opcional)

/** Reemplaza los valores de los campos enlazados (data-bind) desde el estado. */
function pintarBindings() {
  $$('[data-bind]').forEach(el => {
    const v = leerRuta(el.dataset.bind);
    if (document.activeElement !== el) el.value = v == null ? '' : v;
  });
}

function renderMedios() {
  Object.keys(TIPOS).forEach(tipo => {
    const cont = $('#lista-' + tipo);
    const items = estado.medios.filter(m => m.tipo === tipo);
    $('#cuenta-' + tipo).textContent = items.length;
    if (!items.length) {
      cont.innerHTML = `<p class="vacio-msg">Aún no hay ${TIPOS[tipo].plural.toLowerCase()}. Usa el botón de abajo para agregar la primera.</p>`;
      return;
    }
    cont.innerHTML = items.map((m, i) => {
      const p = `${m.id}-`;
      return `
      <article class="item" data-id="${m.id}">
        <div class="item-head">
          <span class="item-titulo">${TIPOS[tipo].singular} ${i + 1}${tagEjemplo(m.ejemplo)}</span>
          <button type="button" class="icon-btn peligro" data-accion="del-medio" data-id="${m.id}"
                  aria-label="Eliminar ${esc(m.nombre || TIPOS[tipo].singular + ' ' + (i + 1))}" title="Eliminar">🗑</button>
        </div>
        <label class="campo" for="${p}nombre"><span>Nombre</span>
          <input id="${p}nombre" type="text" data-id="${m.id}" data-campo="nombre" value="${esc(m.nombre)}" placeholder="Ej. nombre del ${TIPOS[tipo].singular.toLowerCase()}" autocomplete="off"></label>
        <label class="campo" for="${p}funcion"><span>Función</span>
          <textarea id="${p}funcion" rows="2" data-id="${m.id}" data-campo="funcion" placeholder="¿Qué hace?">${esc(m.funcion)}</textarea></label>
        <label class="campo" for="${p}uso"><span>¿Para qué se utiliza?</span>
          <textarea id="${p}uso" rows="2" data-id="${m.id}" data-campo="uso" placeholder="¿En qué parte del proceso se usa?">${esc(m.uso)}</textarea></label>
        <label class="campo" for="${p}capacidad"><span>Capacidad humana que amplía o sustituye</span>
          <textarea id="${p}capacidad" rows="2" data-id="${m.id}" data-campo="capacidad" placeholder="Ej. fuerza, precisión, alcance, velocidad…">${esc(m.capacidad)}</textarea></label>
        <div class="campo"><label for="${p}imagen"><span>Imagen (opcional, enlace)</span></label>
          <input id="${p}imagen" type="url" data-id="${m.id}" data-campo="imagen" value="${esc(m.imagen)}" placeholder="https://… (enlace directo a la imagen)" autocomplete="off">
          <button type="button" class="btn-ayuda-imagen btn secondary mini" data-target="${p}imagen">¿No sabes cómo subir una imagen? Toca aquí</button>
          <img class="prev" data-prev="${m.id}" alt="Vista previa de ${esc(m.nombre || 'la imagen')}" ${urlImagenValida(m.imagen) ? `src="${esc(m.imagen)}"` : 'hidden'}>
        </div>
      </article>`;
    }).join('');
  });
  if (ayudaImagen) ayudaImagen.iniciarAyudaImagen();
}

function renderTabla() {
  const cuerpo = $('#tablaCuerpo');
  const orden = Object.keys(TIPOS);
  const lista = [...estado.medios].sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo));
  if (!lista.length) {
    cuerpo.innerHTML = '<tr class="vacio"><td colspan="4">Agrega medios técnicos en la sección anterior y aparecerán aquí.</td></tr>';
    return;
  }
  cuerpo.innerHTML = lista.map(m => {
    const p = `t-${m.id}-`;
    return `
    <tr data-id="${m.id}">
      <td data-label="Medio técnico">
        <input id="${p}nombre" type="text" data-id="${m.id}" data-campo="nombre" value="${esc(m.nombre)}" aria-label="Nombre del medio técnico" placeholder="Nombre" autocomplete="off">
        ${tagEjemplo(m.ejemplo)}
      </td>
      <td data-label="Tipo"><span class="chip tipo-${m.tipo}">${TIPOS[m.tipo].singular}</span></td>
      <td data-label="Función"><textarea id="${p}funcion" rows="2" data-id="${m.id}" data-campo="funcion" aria-label="Función" placeholder="Función">${esc(m.funcion)}</textarea></td>
      <td data-label="Capacidad humana ampliada / sustituida"><textarea id="${p}capacidad" rows="2" data-id="${m.id}" data-campo="capacidad" aria-label="Capacidad humana ampliada o sustituida" placeholder="Fuerza, precisión…">${esc(m.capacidad)}</textarea></td>
    </tr>`;
  }).join('');
}

function renderPersonas() {
  const cont = $('#listaPersonas');
  const n = estado.personas.length;
  $('#numPersonas').textContent = n;
  $('#numPersonasTxt').textContent = n === 1 ? 'persona registrada' : 'personas registradas';
  if (!n) {
    cont.innerHTML = '<p class="vacio-msg">Aún no hay integrantes. Agrega a cada persona que participa en el proceso.</p>';
    return;
  }
  cont.innerHTML = estado.personas.map((p, i) => `
    <article class="item" data-id="${p.id}">
      <div class="item-head">
        <span class="item-titulo">Persona ${i + 1}${tagEjemplo(p.ejemplo)}</span>
        <button type="button" class="icon-btn peligro" data-accion="del-persona" data-id="${p.id}" aria-label="Eliminar persona ${i + 1}" title="Eliminar">🗑</button>
      </div>
      <label class="campo" for="${p.id}-rol"><span>Rol</span>
        <input id="${p.id}-rol" type="text" data-lista="personas" data-id="${p.id}" data-campo="rol" value="${esc(p.rol)}" placeholder="Ej. el cargo o puesto que tiene" autocomplete="off"></label>
      <label class="campo" for="${p.id}-resp"><span>Responsabilidad</span>
        <textarea id="${p.id}-resp" rows="3" data-lista="personas" data-id="${p.id}" data-campo="responsabilidad" placeholder="¿Qué hace esta persona dentro del proceso?">${esc(p.responsabilidad)}</textarea></label>
    </article>`).join('');
}

function renderPasos(foco) {
  const ol = $('#listaPasos');
  const n = estado.pasos.length;
  if (!n) {
    ol.innerHTML = '<li class="vacio-msg" style="list-style:none">Aún no hay pasos. Agrega el primero para construir la línea de tiempo.</li>';
    return;
  }
  ol.innerHTML = estado.pasos.map((p, i) => `
    <li class="paso" data-id="${p.id}">
      <button type="button" class="handle" aria-hidden="true" tabindex="-1" title="Arrastrar para reordenar">⠿</button>
      <span class="paso-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <div class="paso-cuerpo">
        <div class="item-head"><span class="item-titulo">Paso ${i + 1}${tagEjemplo(p.ejemplo)}</span></div>
        <label class="campo" for="${p.id}-t"><span>Título</span>
          <input id="${p.id}-t" type="text" data-lista="pasos" data-id="${p.id}" data-campo="titulo" value="${esc(p.titulo)}" placeholder="Ej. nombre corto del paso" autocomplete="off"></label>
        <label class="campo" for="${p.id}-d"><span>Descripción</span>
          <textarea id="${p.id}-d" rows="2" data-lista="pasos" data-id="${p.id}" data-campo="descripcion" placeholder="¿Qué se hace en este paso?">${esc(p.descripcion)}</textarea></label>
      </div>
      <div class="paso-acc">
        <button type="button" class="icon-btn" data-accion="subir" data-id="${p.id}" aria-label="Subir paso ${i + 1}" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-btn" data-accion="bajar" data-id="${p.id}" aria-label="Bajar paso ${i + 1}" title="Bajar" ${i === n - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="icon-btn peligro" data-accion="del-paso" data-id="${p.id}" aria-label="Eliminar paso ${i + 1}" title="Eliminar">🗑</button>
      </div>
    </li>`).join('');
  if (foco) {
    const b = $(`[data-accion="${foco.accion}"][data-id="${foco.id}"]`, ol);
    (b && !b.disabled ? b : $(`[data-accion="${foco.alt}"][data-id="${foco.id}"]`, ol))?.focus();
  }
}

function renderTodo() {
  renderMedios(); renderTabla(); renderPersonas(); renderPasos();
  pintarBindings(); actualizarProgreso(); actualizarBotonEjemplo();
}

/* ---------- 4. Progreso, navegación y estados ---------- */

/** Los elementos de ejemplo NO cuentan como contenido real. */
const reales = lista => lista.filter(x => !x.ejemplo);

/** Devuelve {id: boolean} indicando qué secciones están completas. */
function seccionesCompletas() {
  const med = reales(estado.medios).filter(m => txt(m.nombre));
  const per = reales(estado.personas).filter(p => txt(p.rol));
  const pas = reales(estado.pasos).filter(p => txt(p.titulo));
  return {
    datos: !!(txt(estado.datos.nombre) && txt(estado.datos.necesidad)),
    medios: med.length > 0,
    capacidad: med.length > 0 && med.every(m => txt(m.capacidad)),
    necesidad: !!(txt(estado.datos.necesidad) && txt(estado.alternativa)),
    organizacion: per.length > 0 && !!(txt(estado.equipo) || txt(estado.trabajo)),
    proceso: pas.length >= 2,
    conclusion: !!txt(estado.conclusion),
  };
}

function actualizarProgreso() {
  const c = seccionesCompletas();
  const hechas = SECCIONES.filter(s => c[s.id]);
  const pct = Math.round((hechas.length / SECCIONES.length) * 100);

  $('#pctTexto').textContent = pct + '%';
  $('#pctMini').textContent = pct + '%';
  $('#barraProgreso').style.width = pct + '%';
  $('#lineaProgreso').style.width = pct + '%';
  $('#progresoAria').setAttribute('aria-valuenow', pct);

  const faltan = SECCIONES.filter(s => !c[s.id]).map(s => s.nombre);
  $('#faltanTexto').textContent = faltan.length
    ? 'Faltan completar: ' + faltan.join(', ') + '.'
    : '¡Todas las secciones están completas! Ya puedes exportar tu proyecto.';

  SECCIONES.forEach(s => {
    const chip = $(`.estado[data-estado="${s.id}"]`);
    chip.textContent = c[s.id] ? '✓ Completo' : 'Pendiente';
    chip.classList.toggle('ok', c[s.id]);
    $(`.nav a[data-nav="${s.id}"]`).classList.toggle('completo', c[s.id]);
  });
}

/** Resalta en la barra la sección visible (scrollspy). */
function iniciarScrollspy() {
  const links = new Map($$('.nav a').map(a => [a.dataset.nav, a]));
  const marcar = id => {
    links.forEach((a, k) => {
      const on = k === id;
      a.classList.toggle('activo', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      // Mantiene visible el botón activo en la barra horizontal del celular.
      if (on) {
        const nav = $('#nav');
        const x = a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2;
        nav.scrollTo({ left: x, behavior: 'smooth' });
      }
    });
  };
  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver(entradas => {
    entradas.forEach(e => { if (e.isIntersecting) marcar(e.target.dataset.seccion); });
  }, { rootMargin: '-35% 0px -55% 0px' });
  $$('.seccion').forEach(s => obs.observe(s));
}

/** El botón de ejemplo alterna entre cargar y quitar. */
function actualizarBotonEjemplo() {
  const hay = [...estado.medios, ...estado.personas, ...estado.pasos].some(x => x.ejemplo);
  $('#btnEjemplo').textContent = hay ? 'Quitar datos de ejemplo' : 'Cargar datos de ejemplo';
}

/* Datos DEMOSTRATIVOS (no pertenecen a ninguna entrevista real). */
function cargarEjemplos() {
  estado.medios.push(
    { id: nuevoId(), tipo: 'herramienta', nombre: 'Destornillador', funcion: 'Permite introducir y retirar tornillos.', uso: 'Ejemplo demostrativo.', imagen: '', capacidad: 'Fuerza y precisión de la mano.', ejemplo: true },
    { id: nuevoId(), tipo: 'maquina', nombre: 'Taladro', funcion: 'Perforar materiales.', uso: 'Ejemplo demostrativo.', imagen: '', capacidad: 'Fuerza, velocidad y precisión.', ejemplo: true },
  );
  estado.personas.push(
    { id: nuevoId(), rol: 'Operador', responsabilidad: 'Manejar la máquina.', ejemplo: true },
    { id: nuevoId(), rol: 'Supervisor', responsabilidad: 'Verificar el proceso.', ejemplo: true },
  );
  ['Preparación', 'Selección de materiales', 'Uso de herramientas', 'Procesamiento', 'Revisión', 'Resultado final']
    .forEach(t => estado.pasos.push({ id: nuevoId(), titulo: t, descripcion: '', ejemplo: true }));
}
function quitarEjemplos() {
  estado.medios = reales(estado.medios);
  estado.personas = reales(estado.personas);
  estado.pasos = reales(estado.pasos);
}

/* ---------- 5. Eventos ---------- */

const main = $('#contenido');

/** Escritura en cualquier campo: actualiza estado sin re-renderizar (no pierde el foco). */
main.addEventListener('input', e => {
  const el = e.target;

  // a) Campos simples enlazados (datos.*, alternativa, etc.)
  if (el.dataset.bind) {
    escribirRuta(el.dataset.bind, el.value);
    // Sincroniza el mismo dato si aparece en dos secciones (necesidad).
    $$(`[data-bind="${el.dataset.bind}"]`).forEach(o => { if (o !== el) o.value = el.value; });
  }
  // b) Medios técnicos (tarjetas y tabla comparten datos)
  else if (el.dataset.campo && !el.dataset.lista) {
    const m = estado.medios.find(x => x.id === el.dataset.id);
    if (!m) return;
    m[el.dataset.campo] = el.value;
    $$(`[data-id="${m.id}"][data-campo="${el.dataset.campo}"]`).forEach(o => { if (o !== el) o.value = el.value; });
    if (el.dataset.campo === 'imagen') {
      const img = $(`[data-prev="${m.id}"]`);
      if (img) {
        if (urlImagenValida(el.value)) { img.src = el.value; img.hidden = false; } else img.hidden = true;
      }
    }
  }
  // c) Personas y pasos
  else if (el.dataset.lista) {
    const it = estado[el.dataset.lista].find(x => x.id === el.dataset.id);
    if (!it) return;
    it[el.dataset.campo] = el.value;
  } else return;

  guardar();
  actualizarProgreso();
});

// Si la imagen no carga, se oculta la vista previa en lugar de mostrar un icono roto.
main.addEventListener('error', e => {
  if (e.target.classList?.contains('prev')) e.target.hidden = true;
}, true);

/** Acciones por botón (delegadas). */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const { accion, id, tipo } = b.dataset;

  switch (accion) {
    case 'add-medio': {
      const nuevo = { id: nuevoId(), tipo, nombre: '', funcion: '', uso: '', imagen: '', capacidad: '', ejemplo: false };
      estado.medios.push(nuevo);
      renderMedios(); renderTabla();
      $(`#${nuevo.id}-nombre`)?.focus();
      break;
    }
    case 'del-medio':
      estado.medios = estado.medios.filter(m => m.id !== id);
      renderMedios(); renderTabla();
      break;

    case 'add-persona': {
      const nueva = { id: nuevoId(), rol: '', responsabilidad: '', ejemplo: false };
      estado.personas.push(nueva);
      renderPersonas();
      $(`#${nueva.id}-rol`)?.focus();
      break;
    }
    case 'del-persona':
      estado.personas = estado.personas.filter(p => p.id !== id);
      renderPersonas();
      break;

    case 'add-paso': {
      const nuevo = { id: nuevoId(), titulo: '', descripcion: '', ejemplo: false };
      estado.pasos.push(nuevo);
      renderPasos();
      $(`#${nuevo.id}-t`)?.focus();
      break;
    }
    case 'del-paso':
      estado.pasos = estado.pasos.filter(p => p.id !== id);
      renderPasos();
      break;
    case 'subir': case 'bajar': {
      const i = estado.pasos.findIndex(p => p.id === id);
      const j = accion === 'subir' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= estado.pasos.length) return;
      [estado.pasos[i], estado.pasos[j]] = [estado.pasos[j], estado.pasos[i]];
      renderPasos({ id, accion, alt: accion === 'subir' ? 'bajar' : 'subir' });
      break;
    }

    case 'ejemplo':
      if ([...estado.medios, ...estado.personas, ...estado.pasos].some(x => x.ejemplo)) quitarEjemplos();
      else cargarEjemplos();
      renderTodo();
      break;

    case 'limpiar':
      if (confirm('¿Seguro que quieres limpiar TODO el proyecto?\n\nSe borrarán todos los datos guardados en este dispositivo 
