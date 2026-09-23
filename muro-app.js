// muro-app.js
// Lógica de la página muro.html

import { db } from "./firebase-config.js";
import { observarSesion, cuentaBloqueada } from "./auth.js";
import { listarAmigos } from "./amistades.js";
import {
  crearPublicacion, editarPublicacion, obtenerFeed, borrarPublicacion,
  yaDioLike, alternarLike, listarQuienesDieronLike,
  obtenerComentarios, agregarComentario, borrarComentario,
  repostearPublicacion, buscarPublicaciones
} from "./muro.js";
import { crearTema, listarTemas, buscarTemas } from "./temas.js";
import { insigniaVerificado } from "./verificados.js";
import { crearReporte, TIPO_OBJETIVO, MOTIVOS_POR_TIPO } from "./reportes.js";
import { iniciarAyudaImagen } from "./ayuda-imagen.js";
import { subirImagen } from "./subir-imagen.js";
import { actualizarCancionActualEnPerfil, actualizarTopEnPerfil } from "./spotify.js";
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// Caché simple de perfiles de autores (uid -> {rol, verificadoDorado, verificadoAzul})
// Caché de insignias de autores (uid -> HTML de insignia), para no pedir el
// documento completo del usuario cada vez que se pinta un post/comentario.
const cacheInsignias = new Map();
async function obtenerInsigniaHTML(autorId) {
  if (cacheInsignias.has(autorId)) return cacheInsignias.get(autorId);
  try {
    const snap = await getDoc(doc(db, "usuarios", autorId));
    const html = snap.exists() ? insigniaVerificado(snap.data()) : "";
    cacheInsignias.set(autorId, html);
    return html;
  } catch {
    return "";
  }
}

// Caché de fotos/nombres de autores (uid -> {fotoURL, nombre}), mismo patrón
// que cacheInsignias — evita pedir el documento completo de cada usuario más
// de una vez por carga de feed. Se usa para refrescar avatar/nombre en vivo
// en vez de quedarse con el valor "congelado" que guardó el post al crearse
// (si alguien cambia su foto después de publicar, los posts viejos seguían
// mostrando la foto vieja para siempre sin esto).
const cacheAutor = new Map();
async function obtenerDatosAutorActuales(autorId) {
  if (cacheAutor.has(autorId)) return cacheAutor.get(autorId);
  try {
    const snap = await getDoc(doc(db, "usuarios", autorId));
    const datos = snap.exists() ? { fotoURL: snap.data().fotoURL || "", nombre: snap.data().nombre || "" } : null;
    cacheAutor.set(autorId, datos);
    return datos;
  } catch {
    return null;
  }
}

let usuarioActual = null;
let modoFeed = "general"; // "general" | "amigos"
let uidsAmigos = null;
let recursoCitadoActual = null;
let editandoPubId = null; // si no es null, el composer está en modo "editar" esta publicación
let ultimoDocFeed = null;
let filtroHashtagActual = null;
let publicacionesEnMemoria = new Map(); // pubId -> datos, para acceder rápido (repost, editar, etc.)

const CLAVE_BORRADOR = "oxygenmedia_borrador_post";

const inputTexto = document.getElementById("inputTexto");
const btnToggleImagen = document.getElementById("btnToggleImagen");
const extraImagen = document.getElementById("extraImagen");
const inputImagenURL = document.getElementById("inputImagenURL");
const previewImagen = document.getElementById("previewImagen");
const btnCitarRecurso = document.getElementById("btnCitarRecurso");
const citaPreview = document.getElementById("citaPreview");
const btnPublicar = document.getElementById("btnPublicar");
const listaFeed = document.getElementById("listaFeed");
const emptyFeed = document.getElementById("emptyFeed");
const btnCargarMas = document.getElementById("btnCargarMas");
const temasBar = document.getElementById("temasBar");
const temasTendencias = document.getElementById("temasTendencias");
const temasCreados = document.getElementById("temasCreados");
const filtroActivo = document.getElementById("filtroActivo");
const filtroActivoTexto = document.getElementById("filtroActivoTexto");
const btnQuitarFiltro = document.getElementById("btnQuitarFiltro");

const inputBuscarPost = document.getElementById("inputBuscarPost");
const btnLimpiarBusquedaPost = document.getElementById("btnLimpiarBusquedaPost");

const inputTemaComposer = document.getElementById("inputTemaComposer");
const resultadosTemaComposer = document.getElementById("resultadosTemaComposer");
const temaSeleccionadoChip = document.getElementById("temaSeleccionadoChip");
const btnNuevoTema = document.getElementById("btnNuevoTema");
const crearTemaBox = document.getElementById("crearTemaBox");
const inputNuevoTemaNombre = document.getElementById("inputNuevoTemaNombre");
const inputNuevoTemaDesc = document.getElementById("inputNuevoTemaDesc");
const btnConfirmarNuevoTema = document.getElementById("btnConfirmarNuevoTema");
const btnCancelarNuevoTema = document.getElementById("btnCancelarNuevoTema");
const msgNuevoTema = document.getElementById("msgNuevoTema");

let temaSeleccionado = null; // { slug, nombre } o null
const contadorTexto = document.getElementById("contadorTexto");

const MAX_CARACTERES_POST = 750;

const modalCitarRecurso = document.getElementById("modalCitarRecurso");
const buscarRecursoCitar = document.getElementById("buscarRecursoCitar");
const resultadosCitarRecurso = document.getElementById("resultadosCitarRecurso");

// ============ RECOMPENSA DE LINK DE AFILIADO (si entró con ?ref=...) ============
// muro-app.js es la primera pantalla real tras el login/registro, así que
// aquí se muestra el resultado del intento de reclamo que index.html dejó
// guardado en sessionStorage (si hubo alguno).
function mostrarRecompensaAfiliadoSiHay() {
  const descripcion = sessionStorage.getItem("oxygenmedia_recompensa_afiliado");
  if (!descripcion) return;
  sessionStorage.removeItem("oxygenmedia_recompensa_afiliado");
  alert(`🎁 ¡Bienvenido! Recibiste: ${descripcion}`);
}

observarSesion((user, perfil) => {
  if (!user || cuentaBloqueada(perfil).bloqueada) {
    document.body.innerHTML = "<div style='padding:60px;text-align:center;color:#8b96b0;'>Debes iniciar sesión y estar aprobado para ver el muro. <br><br><a href='/' style='color:#5b8def;'>Volver al sitio</a></div>";
    return;
  }
  usuarioActual = { uid: user.uid, ...perfil };
  cargarBorrador();
  cargarFeed();
  cargarTemasCreados();
  cargarTendencias();
  mostrarRecompensaAfiliadoSiHay();

  const params = new URLSearchParams(location.search);
  const tagInicial = params.get("tag");
  if (tagInicial) aplicarFiltroHashtag(tagInicial);

  // Si el usuario ya conectó Spotify, mantenemos su "canción actual" razonablemente
  // al día mientras navega el sitio (cada 45s), y su top de artistas/canciones con
  // menor frecuencia (cada 10 min), ya que eso cambia mucho más lento.
  if (perfil.spotifyConectado) {
    actualizarCancionActualEnPerfil(user.uid);
    actualizarTopEnPerfil(user.uid);
    setInterval(() => actualizarCancionActualEnPerfil(user.uid), 45000);
    setInterval(() => actualizarTopEnPerfil(user.uid), 600000);
  }
});

// ============ BORRADOR AUTOMÁTICO ============

function cargarBorrador() {
  try {
    const guardado = localStorage.getItem(CLAVE_BORRADOR);
    if (guardado) inputTexto.value = guardado;
  } catch {}
  actualizarContadorTexto();
}

function actualizarContadorTexto() {
  const largo = inputTexto.value.length;
  contadorTexto.textContent = `${largo} / ${MAX_CARACTERES_POST}`;
  contadorTexto.style.color = largo >= MAX_CARACTERES_POST ? "var(--danger)" : "var(--text-dim)";
}

let debounceBorrador = null;
inputTexto.addEventListener("input", () => {
  actualizarContadorTexto();
  clearTimeout(debounceBorrador);
  debounceBorrador = setTimeout(() => {
    try {
      if (inputTexto.value.trim()) {
        localStorage.setItem(CLAVE_BORRADOR, inputTexto.value);
      } else {
        localStorage.removeItem(CLAVE_BORRADOR);
      }
    } catch {}
  }, 400);
});

function limpiarBorrador() {
  try { localStorage.removeItem(CLAVE_BORRADOR); } catch {}
}

// ============ COMPOSER: IMAGEN (subida real, comprimida a WebP y subida a R2) ============

const btnElegirImagenPost = document.getElementById("btnElegirImagenPost");
const inputImagenArchivo = document.getElementById("inputImagenArchivo");
const msgSubidaImagenPost = document.getElementById("msgSubidaImagenPost");

btnToggleImagen.addEventListener("click", () => {
  extraImagen.classList.toggle("hidden");
});

function mostrarPreviewImagen(url) {
  if (url) {
    previewImagen.src = url;
    previewImagen.classList.remove("hidden");
    previewImagen.onerror = () => previewImagen.classList.add("hidden");
  } else {
    previewImagen.classList.add("hidden");
  }
}

btnElegirImagenPost.addEventListener("click", () => inputImagenArchivo.click());

inputImagenArchivo.addEventListener("change", async () => {
  const archivo = inputImagenArchivo.files[0];
  if (!archivo) return;

  msgSubidaImagenPost.style.display = "none";
  btnElegirImagenPost.disabled = true;
  btnElegirImagenPost.textContent = "Comprimiendo y subiendo...";

  try {
    const url = await subirImagen(archivo, "posts");
    inputImagenURL.value = url;
    mostrarPreviewImagen(url);
  } catch (err) {
    msgSubidaImagenPost.textContent = err.message;
    msgSubidaImagenPost.className = "msg error";
    msgSubidaImagenPost.style.display = "block";
  }

  btnElegirImagenPost.disabled = false;
  btnElegirImagenPost.textContent = "📷 Elegir imagen desde tu dispositivo";
  inputImagenArchivo.value = "";
});

// ============ COMPOSER: CITAR RECURSO (modal con buscador) ============

let todosLosRecursosParaCitar = null;

btnCitarRecurso.addEventListener("click", async () => {
  modalCitarRecurso.classList.remove("hidden");
  buscarRecursoCitar.value = "";
  resultadosCitarRecurso.innerHTML = "Cargando...";

  if (!todosLosRecursosParaCitar) {
    const snap = await getDocs(query(collection(db, "recursos"), where("visible", "==", true), limit(60)));
    todosLosRecursosParaCitar = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  renderResultadosCitar(todosLosRecursosParaCitar);
  buscarRecursoCitar.focus();
});

document.getElementById("btnCerrarModalCitar").addEventListener("click", () => {
  modalCitarRecurso.classList.add("hidden");
});

buscarRecursoCitar.addEventListener("input", () => {
  const texto = buscarRecursoCitar.value.trim().toLowerCase();
  const filtrados = !texto
    ? todosLosRecursosParaCitar
    : todosLosRecursosParaCitar.filter(r => (r.titulo || "").toLowerCase().includes(texto));
  renderResultadosCitar(filtrados);
});

function renderResultadosCitar(recursos) {
  if (!recursos || recursos.length === 0) {
    resultadosCitarRecurso.innerHTML = "<div style='color:var(--text-dim); font-size:13px; text-align:center; padding:20px;'>No se encontraron recursos.</div>";
    return;
  }
  resultadosCitarRecurso.innerHTML = recursos.slice(0, 20).map(r => `
    <div class="recurso-resultado" data-elegir-recurso="${r.id}">
      <div class="titulo">${r.titulo}</div>
      <div class="meta">${r.categoria || "General"} · ${r.esGratis ? "Gratis" : "$" + r.precio}</div>
    </div>
  `).join("");

  resultadosCitarRecurso.querySelectorAll("[data-elegir-recurso]").forEach(el => {
    el.addEventListener("click", () => {
      const r = recursos.find(x => x.id === el.dataset.elegirRecurso);
      recursoCitadoActual = { id: r.id, titulo: r.titulo, categoria: r.categoria || "General" };
      renderCitaPreview();
      modalCitarRecurso.classList.add("hidden");
    });
  });
}

function renderCitaPreview() {
  if (!recursoCitadoActual) {
    citaPreview.innerHTML = "";
    return;
  }
  citaPreview.innerHTML = `
    <div class="cita-recurso-preview">
      <span><img src="/adjuntar-32.png" class="icon-inline" alt=""> Citando: <strong>${recursoCitadoActual.titulo}</strong></span>
      <span style="cursor:pointer;" id="quitarCita"><img src="/cerrar-32.png" class="icon-inline" alt="Quitar"></span>
    </div>
  `;
  document.getElementById("quitarCita").addEventListener("click", () => {
    recursoCitadoActual = null;
    renderCitaPreview();
  });
}

// ============ PUBLICAR / EDITAR ============

btnPublicar.addEventListener("click", async () => {
  const texto = inputTexto.value.trim();
  const imagenURL = inputImagenURL.value.trim();

  if (!texto && !imagenURL && !recursoCitadoActual) {
    alert("Escribe algo, agrega una imagen, o cita un recurso antes de publicar.");
    return;
  }

  if (texto.length > MAX_CARACTERES_POST) {
    alert(`Tu publicación supera el límite de ${MAX_CARACTERES_POST} caracteres. Recórtala un poco.`);
    return;
  }

  btnPublicar.disabled = true;
  try {
    if (editandoPubId) {
      await editarPublicacion(editandoPubId, { texto, imagenURL, recursoCitado: recursoCitadoActual });
      editandoPubId = null;
      btnPublicar.textContent = "Publicar";
    } else {
      await crearPublicacion({
        autorId: usuarioActual.uid,
        autorNombre: usuarioActual.nombre,
        autorFotoURL: usuarioActual.fotoURL || "",
        texto, imagenURL, recursoCitado: recursoCitadoActual,
        temaSlug: temaSeleccionado ? temaSeleccionado.slug : null
      });
    }

    inputTexto.value = "";
    inputImagenURL.value = "";
    extraImagen.classList.add("hidden");
    previewImagen.classList.add("hidden");
    recursoCitadoActual = null;
    renderCitaPreview();
    limpiarBorrador();
    limpiarTemaSeleccionado();
    cargarTemasCreados();

    resetearFeed();
    cargarFeed();
  } catch (err) {
    alert("Error al publicar: " + err.message);
  }
  btnPublicar.disabled = false;
});

function iniciarEdicion(pubId) {
  const p = publicacionesEnMemoria.get(pubId);
  if (!p) return;
  editandoPubId = pubId;
  inputTexto.value = p.texto || "";
  inputImagenURL.value = p.imagenURL || "";
  if (p.imagenURL) {
    extraImagen.classList.remove("hidden");
    previewImagen.src = p.imagenURL;
    previewImagen.classList.remove("hidden");
  }
  recursoCitadoActual = p.recursoCitado || null;
  renderCitaPreview();
  btnPublicar.textContent = "Guardar cambios";
  inputTexto.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============ TABS DE FEED ============

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    modoFeed = btn.dataset.feed;
    filtroHashtagActual = null;
    actualizarUiFiltro(null);
    resetearFeed();
    cargarFeed();
  });
});

function aplicarFiltroHashtag(tag) {
  filtroHashtagActual = tag;
  resetearFeed();
  cargarFeed();
  actualizarUiFiltro(tag);
}

function actualizarUiFiltro(tag) {
  temasBar.querySelectorAll(".tema-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.tema === tag);
  });
  if (tag) {
    filtroActivoTexto.textContent = "#" + tag;
    filtroActivo.classList.remove("hidden");
  } else {
    filtroActivo.classList.add("hidden");
  }
}

function quitarFiltro() {
  filtroHashtagActual = null;
  resetearFeed();
  cargarFeed();
  actualizarUiFiltro(null);
}
btnQuitarFiltro.addEventListener("click", quitarFiltro);

temasBar.querySelectorAll(".tema-chip").forEach(chip => {
  chip.addEventListener("click", () => aplicarFiltroHashtag(chip.dataset.tema));
});

// Calcula los hashtags más usados entre publicaciones recientes y los muestra
// como chips extra junto a los temas fijos — reutiliza el mismo filtro de arriba,
// no crea un sistema de búsqueda aparte.
async function cargarTendencias() {
  try {
    const snap = await getDocs(query(collection(db, "publicaciones"), orderBy("fecha", "desc"), limit(80)));
    const conteo = new Map();
    snap.forEach(docSnap => {
      const tags = docSnap.data().hashtags || [];
      tags.forEach(t => conteo.set(t, (conteo.get(t) || 0) + 1));
    });

    const fijos = new Set([...temasBar.querySelectorAll(".tema-chip")].map(c => c.dataset.tema));
    const top = [...conteo.entries()]
      .filter(([tag]) => !fijos.has(tag))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    temasTendencias.innerHTML = top.map(([tag]) =>
      `<button class="tema-chip tendencia" data-tema="${tag}">🔥 #${tag}</button>`
    ).join("");

    temasTendencias.querySelectorAll(".tema-chip").forEach(chip => {
      chip.addEventListener("click", () => aplicarFiltroHashtag(chip.dataset.tema));
    });
  } catch (e) { /* si falla, los temas fijos siguen funcionando igual */ }
}

// ============ TEMAS CREADOS POR USUARIOS ============

async function cargarTemasCreados() {
  try {
    const temas = await listarTemas(12);
    temasCreados.innerHTML = temas.map(t =>
      `<button class="tema-chip" data-tema="${t.slug}" title="${escapeHtml(t.descripcion || '')}">🏷️ ${escapeHtml(t.nombre)}</button>`
    ).join("");
    temasCreados.querySelectorAll(".tema-chip").forEach(chip => {
      chip.addEventListener("click", () => aplicarFiltroHashtag(chip.dataset.tema));
    });
  } catch (e) { /* si falla, los temas fijos siguen funcionando igual */ }
}

// Autocompletado al escribir en "Publicar en un tema..."
let debounceTemaComposer = null;
inputTemaComposer.addEventListener("input", () => {
  clearTimeout(debounceTemaComposer);
  const texto = inputTemaComposer.value.trim();
  if (!texto) { resultadosTemaComposer.classList.add("hidden"); return; }
  debounceTemaComposer = setTimeout(() => mostrarSugerenciasTema(texto), 250);
});

async function mostrarSugerenciasTema(texto) {
  const coincidencias = await buscarTemas(texto);
  const slugTexto = texto.trim().toLowerCase();
  const yaExisteExacto = coincidencias.some(t => t.nombre.toLowerCase() === slugTexto);

  let html = coincidencias.map(t => `
    <div class="tema-sugerido-item" data-slug="${t.slug}" data-nombre="${escapeHtml(t.nombre)}">
      🏷️ <span><strong>${escapeHtml(t.nombre)}</strong> <span style="color:var(--text-dim);">· ${t.publicacionesCount || 0} publicaciones</span></span>
    </div>
  `).join("");

  if (!yaExisteExacto) {
    html += `<div class="tema-sugerido-item" id="crearTemaDesdeInput" style="color:var(--accent); font-weight:700;">+ Crear tema "${escapeHtml(texto)}"</div>`;
  }

  resultadosTemaComposer.innerHTML = html;
  resultadosTemaComposer.classList.remove("hidden");

  resultadosTemaComposer.querySelectorAll(".tema-sugerido-item[data-slug]").forEach(item => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      seleccionarTema({ slug: item.dataset.slug, nombre: item.dataset.nombre });
    });
  });

  const opcionCrear = document.getElementById("crearTemaDesdeInput");
  if (opcionCrear) {
    opcionCrear.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      await crearYSeleccionarTema(texto, "");
    });
  }
}

function seleccionarTema(tema) {
  temaSeleccionado = tema;
  inputTemaComposer.value = "";
  resultadosTemaComposer.classList.add("hidden");
  temaSeleccionadoChip.innerHTML = `🏷️ ${escapeHtml(tema.nombre)} <span class="quitar-tema">✕</span>`;
  temaSeleccionadoChip.classList.remove("hidden");
  temaSeleccionadoChip.querySelector(".quitar-tema").addEventListener("click", limpiarTemaSeleccionado);
}

function limpiarTemaSeleccionado() {
  temaSeleccionado = null;
  temaSeleccionadoChip.classList.add("hidden");
  temaSeleccionadoChip.innerHTML = "";
}

async function crearYSeleccionarTema(nombre, descripcion) {
  try {
    const tema = await crearTema(usuarioActual.uid, usuarioActual.nombre, nombre, descripcion);
    seleccionarTema(tema);
    resultadosTemaComposer.classList.add("hidden");
    return tema;
  } catch (err) {
    alert("No se pudo crear el tema: " + err.message);
    return null;
  }
}

// Botón "+ Nuevo tema" de la barra de temas — formulario con nombre + descripción
btnNuevoTema.addEventListener("click", () => {
  crearTemaBox.classList.toggle("hidden");
  if (!crearTemaBox.classList.contains("hidden")) inputNuevoTemaNombre.focus();
});
btnCancelarNuevoTema.addEventListener("click", () => {
  crearTemaBox.classList.add("hidden");
  inputNuevoTemaNombre.value = "";
  inputNuevoTemaDesc.value = "";
  msgNuevoTema.style.display = "none";
});
btnConfirmarNuevoTema.addEventListener("click", async () => {
  const nombre = inputNuevoTemaNombre.value.trim();
  if (nombre.length < 2) {
    msgNuevoTema.textContent = "El nombre debe tener al menos 2 caracteres.";
    msgNuevoTema.className = "msg error";
    msgNuevoTema.style.display = "block";
    return;
  }
  btnConfirmarNuevoTema.disabled = true;
  try {
    const tema = await crearTema(usuarioActual.uid, usuarioActual.nombre, nombre, inputNuevoTemaDesc.value.trim());
    seleccionarTema(tema);
    await cargarTemasCreados();
    crearTemaBox.classList.add("hidden");
    inputNuevoTemaNombre.value = "";
    inputNuevoTemaDesc.value = "";
    msgNuevoTema.style.display = "none";
    inputTexto.focus();
  } catch (err) {
    msgNuevoTema.textContent = err.message;
    msgNuevoTema.className = "msg error";
    msgNuevoTema.style.display = "block";
  }
  btnConfirmarNuevoTema.disabled = false;
});

// ============ BÚSQUEDA DE PUBLICACIONES ============

let debounceBusquedaPost = null;
inputBuscarPost.addEventListener("input", () => {
  clearTimeout(debounceBusquedaPost);
  const texto = inputBuscarPost.value.trim();
  btnLimpiarBusquedaPost.classList.toggle("hidden", texto.length === 0);
  if (texto.length < 2) {
    if (texto.length === 0) salirDeBusqueda();
    return;
  }
  debounceBusquedaPost = setTimeout(() => ejecutarBusquedaPost(texto), 350);
});

btnLimpiarBusquedaPost.addEventListener("click", () => {
  inputBuscarPost.value = "";
  btnLimpiarBusquedaPost.classList.add("hidden");
  salirDeBusqueda();
});

async function ejecutarBusquedaPost(texto) {
  listaFeed.innerHTML = "Buscando...";
  emptyFeed.classList.add("hidden");
  btnCargarMas.classList.add("hidden");

  const resultados = await buscarPublicaciones(texto);
  resultados.forEach(p => publicacionesEnMemoria.set(p.id, p));

  if (resultados.length === 0) {
    listaFeed.innerHTML = `<div class="search-results-label">Sin resultados para "${escapeHtml(texto)}".</div>`;
    return;
  }

  listaFeed.innerHTML =
    `<div class="search-results-label">${resultados.length} resultado(s) para "${escapeHtml(texto)}"</div>` +
    resultados.map(p => renderPost(p)).join("");
  conectarEventosFeed(resultados);
}

function salirDeBusqueda() {
  resetearFeed();
  cargarFeed();
}

// ============ MENCIONES @ (autocompletado compartido) ============

const dropdownMenciones = document.createElement("div");
dropdownMenciones.className = "menciones-dropdown hidden";
dropdownMenciones.style.position = "fixed";
document.body.appendChild(dropdownMenciones);

function activarAutocompletadoMenciones(inputEl) {
  let debounceId = null;
  inputEl.addEventListener("input", () => {
    clearTimeout(debounceId);
    const info = detectarMencionEnCursor(inputEl);
    if (!info) { ocultarDropdownMenciones(); return; }
    debounceId = setTimeout(() => buscarYMostrarMenciones(inputEl, info), 200);
  });
  inputEl.addEventListener("blur", () => setTimeout(ocultarDropdownMenciones, 150));
}

function detectarMencionEnCursor(inputEl) {
  const valor = inputEl.value;
  const cursor = inputEl.selectionStart ?? valor.length;
  const textoAntes = valor.slice(0, cursor);
  const match = textoAntes.match(/@([\wáéíóúñ]*)$/i);
  if (!match) return null;
  return { texto: match[1], inicio: cursor - match[1].length - 1 };
}

async function buscarYMostrarMenciones(inputEl, info) {
  if (info.texto.length < 1) { ocultarDropdownMenciones(); return; }
  const t = info.texto.toLowerCase();

  const snap = await getDocs(query(collection(db, "usuarios"), where("aprobado", "==", true)));
  const candidatos = [];
  snap.forEach(docSnap => {
    const u = docSnap.data();
    if (u.username && u.username.toLowerCase().startsWith(t)) candidatos.push({ uid: docSnap.id, ...u });
  });

  if (candidatos.length === 0) { ocultarDropdownMenciones(); return; }

  const rect = inputEl.getBoundingClientRect();
  dropdownMenciones.style.left = rect.left + "px";
  dropdownMenciones.style.top = (rect.bottom + 4) + "px";
  dropdownMenciones.style.width = Math.max(220, rect.width) + "px";

  dropdownMenciones.innerHTML = candidatos.slice(0, 6).map(u => {
    const inicial = (u.nombre || "?")[0].toUpperCase();
    return `
      <div class="mencion-item" data-username="${u.username}">
        ${u.fotoURL
          ? `<img class="mencion-avatar" src="${u.fotoURL}" onerror="this.outerHTML='<span class=&quot;mencion-avatar&quot;>${inicial}</span>'">`
          : `<span class="mencion-avatar">${inicial}</span>`}
        <span><strong>${escapeHtml(u.nombre || "")}</strong> <span style="color:var(--text-dim);">@${u.username}</span></span>
      </div>`;
  }).join("");
  dropdownMenciones.classList.remove("hidden");

  dropdownMenciones.querySelectorAll(".mencion-item").forEach(item => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      insertarMencion(inputEl, info, item.dataset.username);
      ocultarDropdownMenciones();
    });
  });
}

function insertarMencion(inputEl, info, username) {
  const valor = inputEl.value;
  const antes = valor.slice(0, info.inicio);
  const despues = valor.slice(info.inicio + 1 + info.texto.length);
  const nuevoValor = `${antes}@${username} ${despues}`;
  inputEl.value = nuevoValor;
  const nuevaPos = (antes + "@" + username + " ").length;
  inputEl.focus();
  inputEl.setSelectionRange(nuevaPos, nuevaPos);
  inputEl.dispatchEvent(new Event("input"));
}

function ocultarDropdownMenciones() {
  dropdownMenciones.classList.add("hidden");
}

activarAutocompletadoMenciones(inputTexto);


function resetearFeed() {
  ultimoDocFeed = null;
  publicacionesEnMemoria.clear();
}

// ============ CARGAR Y RENDERIZAR FEED ============

async function cargarFeed(esCargarMas = false) {
  if (!esCargarMas) {
    listaFeed.innerHTML = "Cargando...";
    emptyFeed.classList.add("hidden");
    btnCargarMas.classList.add("hidden");
  }

  let soloDeUids = null;
  if (modoFeed === "amigos") {
    if (uidsAmigos === null) {
      const amigos = await listarAmigos(usuarioActual.uid);
      uidsAmigos = amigos.map(a => a.uid);
    }
    soloDeUids = [...uidsAmigos, usuarioActual.uid];
  }

  const { publicaciones, ultimoDoc, hayMas } = await obtenerFeed({
    cantidad: 15,
    soloDeUids,
    cursorUltimoDoc: esCargarMas ? ultimoDocFeed : null,
    hashtag: filtroHashtagActual
  });

  ultimoDocFeed = ultimoDoc;
  publicaciones.forEach(p => publicacionesEnMemoria.set(p.id, p));

  if (!esCargarMas && publicaciones.length === 0) {
    listaFeed.innerHTML = "";
    emptyFeed.classList.remove("hidden");
    btnCargarMas.classList.add("hidden");
    return;
  }

  const html = publicaciones.map(p => renderPost(p)).join("");
  if (esCargarMas) {
    listaFeed.insertAdjacentHTML("beforeend", html);
  } else {
    listaFeed.innerHTML = html;
  }

  conectarEventosFeed(publicaciones);
  btnCargarMas.classList.toggle("hidden", !hayMas);
}

btnCargarMas.addEventListener("click", () => cargarFeed(true));

// ============ RENDER DE UN POST ============

function renderPost(p) {
  const inicial = (p.autorNombre || "?")[0].toUpperCase();
  const fecha = p.fecha ? p.fecha.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const puedoBorrar = p.autorId === usuarioActual.uid || usuarioActual.rol === "admin";
  const puedoEditar = p.autorId === usuarioActual.uid;

  const textoConEnlaces = linkificarTexto(p.texto || "");

  return `
    <div class="post" data-pub-id="${p.id}" data-autor-id="${p.autorId}">
      <div class="post-header">
        <span data-avatar-post="${p.id}">${p.autorFotoURL
          ? `<a href="/ver-perfil?uid=${p.autorId}"><img class="post-avatar" src="${p.autorFotoURL}" onerror="this.outerHTML='<div class=&quot;post-avatar&quot;>${inicial}</div>'"></a>`
          : `<a href="/ver-perfil?uid=${p.autorId}"><div class="post-avatar">${inicial}</div></a>`}</span>
        <div style="flex:1;">
          <div class="nombre"><a href="/ver-perfil?uid=${p.autorId}" style="color:inherit; text-decoration:none;" data-nombre-post="${p.id}">${p.autorNombre}</a><span data-insignia-post="${p.id}"></span></div>
          <div class="fecha">${fecha}</div>
        </div>
        ${puedoEditar ? `<button class="icon-only secondary" data-editar-post="${p.id}"><img src="/editar-32.png" class="icon-inline" alt="Editar"></button>` : ""}
        ${puedoBorrar ? `<button class="icon-only secondary" data-borrar-post="${p.id}"><img src="/borrar-32.png" class="icon-inline" alt="Borrar"></button>` : ""}
        ${!puedoEditar ? `<button class="icon-only secondary" data-reportar-post="${p.id}" title="Reportar"><img src="/reportar-32.png" class="icon-inline" alt="Reportar"></button>` : ""}
      </div>

      ${p.texto ? `<div class="post-texto">${textoConEnlaces}</div>` : ""}
      ${p.imagenURL ? `<img class="post-imagen" src="${p.imagenURL}" onerror="this.style.display='none'">` : ""}
      ${p.recursoCitado ? `
        <a class="cita-recurso" href="/">
          <img src="/adjuntar-32.png" class="icon-inline" alt=""> <strong>${p.recursoCitado.titulo}</strong> — ${p.recursoCitado.categoria}
        </a>
      ` : ""}
      ${p.repostDe ? `
        <div class="cita-recurso" style="flex-direction:column; align-items:flex-start; gap:4px;">
          <span style="color:var(--text-dim); font-size:11px;"><img src="/repost-32.png" class="icon-inline" alt=""> Compartido de ${p.repostDe.autorNombre}</span>
          ${p.repostDe.texto ? `<span>${escapeHtml(p.repostDe.texto)}</span>` : ""}
          ${p.repostDe.imagenURL ? `<img src="${p.repostDe.imagenURL}" style="width:100%; border-radius:var(--radius); margin-top:4px;" onerror="this.style.display='none'">` : ""}
        </div>
      ` : ""}

      <div class="post-actions">
        <button class="post-action" data-like-btn="${p.id}"><img src="/like-outline-32.png" class="icon-inline" alt="Me gusta"> <span class="like-count-num" data-like-count="${p.id}">${p.likesCount || 0}</span></button>
        <button class="post-action" data-toggle-comentarios="${p.id}"><img src="/comentario-32.png" class="icon-inline" alt="Comentarios"> ${p.comentariosCount || 0}</button>
        <button class="post-action" data-repost-btn="${p.id}"><img src="/repost-32.png" class="icon-inline" alt="Repost"> Compartir</button>
      </div>

      <div class="comentarios-box" id="comentarios-${p.id}">
        <div id="listaComentarios-${p.id}"></div>
        <div class="comentario-input-row">
          <input type="text" placeholder="Escribe un comentario..." maxlength="500" data-input-comentario="${p.id}">
          <button data-enviar-comentario="${p.id}">Enviar</button>
        </div>
      </div>
    </div>
  `;
}

// Convierte #hashtags en links clickeables que filtran el feed, y @menciones en
// enlaces al perfil de esa persona (/user/@username) — sin tocar el resto del texto
function linkificarTexto(texto) {
  const escapado = escapeHtml(texto);
  const conHashtags = escapado.replace(/#([\wáéíóúñÁÉÍÓÚÑ]+)/g, (match, tag) =>
    `<span class="hashtag-link" data-hashtag="${tag.toLowerCase()}" style="color:var(--accent); cursor:pointer; font-weight:600;">#${tag}</span>`
  );
  return conHashtags.replace(/@([\w.]+)/g, (match, username) =>
    `<a href="/user/@${username}" style="color:var(--accent); font-weight:600; text-decoration:none;">@${username}</a>`
  );
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============ EVENTOS DEL FEED ============

function conectarEventosFeed(publicaciones) {
  publicaciones.forEach(async (p) => {
    const yaLike = await yaDioLike(p.id, usuarioActual.uid);
    const btn = listaFeed.querySelector(`[data-like-btn="${p.id}"]`);
    if (btn && yaLike) {
      btn.classList.add("liked");
      btn.innerHTML = `<img src="/like-lleno-32.png" class="icon-inline" alt="Ya no me gusta"> <span class="like-count-num" data-like-count="${p.id}">${p.likesCount || 0}</span>`;
    }

    // Insignia del autor (admin/dorada/azul), se pinta aparte para no bloquear el render inicial del feed
    const insigniaEl = listaFeed.querySelector(`[data-insignia-post="${p.id}"]`);
    if (insigniaEl) insigniaEl.innerHTML = await obtenerInsigniaHTML(p.autorId);

    // Avatar y nombre ACTUALES del autor — el post guarda una copia fija de
    // ambos al momento de publicarse, así que si el autor cambió su foto o
    // nombre después, esa copia queda desactualizada para siempre a menos
    // que se refresque así en cada carga del feed (igual que la insignia).
    const datosAutor = await obtenerDatosAutorActuales(p.autorId);
    if (datosAutor) {
      const avatarEl = listaFeed.querySelector(`[data-avatar-post="${p.id}"]`);
      if (avatarEl) {
        const inicialActual = (datosAutor.nombre || "?")[0].toUpperCase();
        avatarEl.innerHTML = datosAutor.fotoURL
          ? `<a href="/ver-perfil?uid=${p.autorId}"><img class="post-avatar" src="${datosAutor.fotoURL}" onerror="this.outerHTML='<div class=&quot;post-avatar&quot;>${inicialActual}</div>'"></a>`
          : `<a href="/ver-perfil?uid=${p.autorId}"><div class="post-avatar">${inicialActual}</div></a>`;
      }
      const nombreEl = listaFeed.querySelector(`[data-nombre-post="${p.id}"]`);
      if (nombreEl && datosAutor.nombre) nombreEl.textContent = datosAutor.nombre;
    }
  });

  listaFeed.querySelectorAll("[data-like-btn]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if (e.target.classList.contains("like-count-num")) {
        e.stopPropagation();
        mostrarQuienesDieronLike(btn.dataset.likeBtn);
        return;
      }
      const pubId = btn.dataset.likeBtn;
      const p = publicacionesEnMemoria.get(pubId);
      btn.disabled = true;
      try {
        const seAgrego = await alternarLike(pubId, usuarioActual.uid, p.autorId, p.autorNombre, usuarioActual.nombre);
        const countActual = parseInt(btn.querySelector(".like-count-num").textContent, 10) || 0;
        const nuevoCount = seAgrego ? countActual + 1 : Math.max(0, countActual - 1);
        btn.classList.toggle("liked", seAgrego);
        btn.innerHTML = `<img src="${seAgrego ? "/like-lleno-32.png" : "/like-outline-32.png"}" class="icon-inline" alt="Me gusta"> <span class="like-count-num" data-like-count="${pubId}">${nuevoCount}</span>`;
      } catch (err) {
        alert("Error: " + err.message);
      }
      btn.disabled = false;
    });
  });

  listaFeed.querySelectorAll("[data-toggle-comentarios]").forEach(btn => {
    btn.addEventListener("click", () => abrirComentarios(btn.dataset.toggleComentarios));
  });

  listaFeed.querySelectorAll("[data-borrar-post]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Borrar esta publicación?")) return;
      await borrarPublicacion(btn.dataset.borrarPost);
      resetearFeed();
      cargarFeed();
    });
  });

  listaFeed.querySelectorAll("[data-editar-post]").forEach(btn => {
    btn.addEventListener("click", () => iniciarEdicion(btn.dataset.editarPost));
  });

  listaFeed.querySelectorAll("[data-repost-btn]").forEach(btn => {
    btn.addEventListener("click", () => hacerRepost(btn.dataset.repostBtn));
  });

  listaFeed.querySelectorAll(".hashtag-link").forEach(el => {
    el.addEventListener("click", () => aplicarFiltroHashtag(el.dataset.hashtag));
  });

  listaFeed.querySelectorAll("[data-reportar-post]").forEach(btn => {
    btn.addEventListener("click", () => {
      const pubId = btn.dataset.reportarPost;
      const p = publicacionesEnMemoria.get(pubId);
      if (!p) return;
      abrirModalReporte({
        objetivoTipo: TIPO_OBJETIVO.PUBLICACION,
        objetivoId: pubId,
        objetivoAutorUid: p.autorId,
        objetivoAutorNombre: p.autorNombre
      });
    });
  });
}

// ============ REPORTAR (publicación, comentario, o usuario) ============
// Modal genérico e inyectado en el DOM la primera vez que se usa, reutilizable
// tanto para publicaciones como para comentarios (ver-perfil.js también lo usa
// para reportar usuarios, importando esta misma función).

let modalReporteEl = null;
let reporteObjetivoActual = null;

export function abrirModalReporte(objetivo) {
  reporteObjetivoActual = objetivo;

  if (!modalReporteEl) {
    modalReporteEl = document.createElement("div");
    modalReporteEl.id = "modalReporteGlobal";
    modalReporteEl.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px;";
    document.body.appendChild(modalReporteEl);
    modalReporteEl.addEventListener("click", (e) => {
      if (e.target === modalReporteEl) cerrarModalReporte();
    });
  }

  const motivos = MOTIVOS_POR_TIPO[objetivo.objetivoTipo] || MOTIVOS_POR_TIPO.publicacion;
  const etiquetaTipo = {
    usuario: "usuario",
    publicacion: "publicación",
    comentario: "comentario"
  }[objetivo.objetivoTipo];

  modalReporteEl.innerHTML = `
    <div style="background:var(--card, #1a2233);border:1px solid var(--border, #2a3550);border-radius:var(--radius, 14px);padding:22px;max-width:420px;width:100%;max-height:85vh;overflow-y:auto;font-family:inherit;color:var(--text, #e8ecf5);">
      <h3 style="margin-top:0;">Reportar ${etiquetaTipo}</h3>
      <p style="font-size:12px;color:var(--text-dim, #8b96b0);margin-top:-8px;">
        Vas a reportar a <strong>${objetivo.objetivoAutorNombre || "este usuario"}</strong>. Un administrador revisará tu reporte.
      </p>

      <label style="font-size:13px;color:var(--text-dim, #8b96b0);display:block;margin-bottom:4px;">Motivo</label>
      <select id="selectMotivoReporte" style="width:100%;padding:10px 12px;border-radius:var(--radius,14px);border:1px solid var(--border,#2a3550);background:var(--input-bg,#10182a);color:inherit;font-size:14px;margin-bottom:12px;">
        <option value="">Selecciona un motivo...</option>
        ${motivos.map(m => `<option value="${m}">${m}</option>`).join("")}
      </select>

      <label style="font-size:13px;color:var(--text-dim, #8b96b0);display:block;margin-bottom:4px;">Proporcione más información (opcional)</label>
      <textarea id="inputInfoReporte" placeholder="Ej: El nombre indica una grosería" style="width:100%;min-height:70px;padding:10px 12px;border-radius:var(--radius,14px);border:1px solid var(--border,#2a3550);background:var(--input-bg,#10182a);color:inherit;font-size:14px;font-family:inherit;resize:vertical;margin-bottom:14px;"></textarea>

      <div id="errorReporte" style="display:none;color:var(--danger,#e35d5d);font-size:12px;margin-bottom:10px;"></div>

      <div style="display:flex;gap:8px;">
        <button id="btnCancelarReporte" type="button" style="flex:1;background:transparent;border:1px solid var(--border,#2a3550);color:var(--text-dim,#8b96b0);">Cancelar</button>
        <button id="btnEnviarReporte" type="button" style="flex:1;">Enviar reporte</button>
      </div>
    </div>
  `;

  document.getElementById("btnCancelarReporte").addEventListener("click", cerrarModalReporte);
  document.getElementById("btnEnviarReporte").addEventListener("click", enviarReporteActual);
}

function cerrarModalReporte() {
  if (modalReporteEl) modalReporteEl.innerHTML = "";
  reporteObjetivoActual = null;
}

async function enviarReporteActual() {
  const select = document.getElementById("selectMotivoReporte");
  const info = document.getElementById("inputInfoReporte");
  const errorEl = document.getElementById("errorReporte");
  const btn = document.getElementById("btnEnviarReporte");

  const motivo = select.value;
  if (!motivo) {
    errorEl.textContent = "Selecciona un motivo antes de enviar.";
    errorEl.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Enviando...";
  try {
    // Mismo timeout de seguridad que en el reporte de mensajes de chat: si Firestore
    // no responde en 15 segundos, se cancela con un error claro en vez de dejar el
    // botón colgado en "Enviando..." sin ninguna salida.
    await Promise.race([
      crearReporte({
        reportanteUid: usuarioActual.uid,
        reportanteNombre: usuarioActual.nombre,
        objetivoTipo: reporteObjetivoActual.objetivoTipo,
        objetivoId: reporteObjetivoActual.objetivoId,
        objetivoAutorUid: reporteObjetivoActual.objetivoAutorUid,
        objetivoAutorNombre: reporteObjetivoActual.objetivoAutorNombre,
        objetivoExtraId: reporteObjetivoActual.objetivoExtraId || null,
        motivo,
        infoAdicional: info.value.trim()
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Se tardó demasiado en enviarse. Revisa tu conexión e intenta de nuevo.")), 15000))
    ]);
    cerrarModalReporte();
    alert("Reporte enviado. Gracias por ayudar a mantener segura la comunidad.");
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Enviar reporte";
  }
}

async function mostrarQuienesDieronLike(pubId) {
  const nombres = await listarQuienesDieronLike(pubId);
  if (nombres.length === 0) {
    alert("Nadie le ha dado like todavía.");
    return;
  }
  alert("Le dio like:\n\n" + nombres.map(n => "• " + n.nombre).join("\n"));
}

async function hacerRepost(pubId) {
  const p = publicacionesEnMemoria.get(pubId);
  if (!p) return;

  const comentario = prompt("¿Quieres agregar un comentario al compartir? (opcional)", "");
  if (comentario === null) return;

  try {
    await repostearPublicacion(p, usuarioActual.uid, usuarioActual.nombre, usuarioActual.fotoURL || "", comentario.trim());
    alert("¡Publicación compartida en tu muro!");
    resetearFeed();
    cargarFeed();
  } catch (err) {
    alert("Error al compartir: " + err.message);
  }
}

// ============ COMENTARIOS ============

async function abrirComentarios(pubId) {
  const box = document.getElementById("comentarios-" + pubId);
  const yaAbierto = box.classList.contains("open");
  box.classList.toggle("open");
  if (yaAbierto) return;

  await refrescarListaComentarios(pubId);

  const input = document.querySelector(`[data-input-comentario="${pubId}"]`);
  const btnEnviar = document.querySelector(`[data-enviar-comentario="${pubId}"]`);
  if (input && !input.dataset.mencionesActivadas) {
    activarAutocompletadoMenciones(input);
    input.dataset.mencionesActivadas = "1";
  }

  // Evita duplicar el envío de comentarios: abrirComentarios() se llama cada vez que
  // el usuario abre el panel (incluso si ya lo había abierto antes en esta misma
  // sesión), y sin este candado se iba acumulando un addEventListener nuevo por
  // cada apertura — con 2 aperturas, el comentario se guardaba 2 veces; con 3, 3
  // veces, etc. El data-attribute marca que este input/botón ya tiene su listener.
  if (btnEnviar.dataset.listenerListo === "true") return;
  btnEnviar.dataset.listenerListo = "true";

  const enviar = async () => {
    const texto = input.value.trim();
    if (!texto) return;
    if (texto.length > 500) {
      alert("Tu comentario supera el límite de 500 caracteres. Recórtalo un poco.");
      return;
    }

    const postDiv = document.querySelector(`[data-pub-id="${pubId}"]`);
    const autorId = postDiv?.dataset.autorId || null;

    input.disabled = true;
    btnEnviar.disabled = true;
    try {
      await agregarComentario(pubId, usuarioActual.uid, usuarioActual.nombre, texto, autorId, usuarioActual.nombre);
      input.value = "";
      await refrescarListaComentarios(pubId);
      const contadorBtn = document.querySelector(`[data-toggle-comentarios="${pubId}"]`);
      if (contadorBtn) {
        const actual = parseInt(contadorBtn.textContent.replace(/\D/g, ""), 10) || 0;
        contadorBtn.innerHTML = `<img src="/comentario-32.png" class="icon-inline" alt="Comentarios"> ${actual + 1}`;
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
    input.disabled = false;
    btnEnviar.disabled = false;
  };

  btnEnviar.addEventListener("click", enviar);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") enviar(); });
}

async function refrescarListaComentarios(pubId) {
  const lista = document.getElementById("listaComentarios-" + pubId);
  lista.innerHTML = "Cargando...";

  const comentarios = await obtenerComentarios(pubId);
  lista.innerHTML = comentarios.length === 0
    ? "<div style='color:var(--text-dim); font-size:12px;'>Sé el primero en comentar.</div>"
    : comentarios.map(c => `
        <div class="comentario-item">
          <span><span class="nombre"><a href="/ver-perfil?uid=${c.autorId}" style="color:inherit; text-decoration:none;" data-nombre-comentario="${c.id}">${c.autorNombre}</a><span data-insignia-comentario="${c.id}"></span>:</span>${linkificarTexto(c.texto)}</span>
          ${(c.autorId === usuarioActual.uid || usuarioActual.rol === "admin")
            ? `<span style="cursor:pointer; margin-left:auto;" data-borrar-comentario="${c.id}" data-pub-id="${pubId}"><img src="/cerrar-32.png" class="icon-inline-sm" alt="Borrar"></span>`
            : `<span style="cursor:pointer; margin-left:auto;" data-reportar-comentario="${c.id}" data-pub-id="${pubId}" data-autor-id="${c.autorId}" data-autor-nombre="${escapeHtml(c.autorNombre || '')}" title="Reportar"><img src="/reportar-32.png" class="icon-inline-sm" alt="Reportar"></span>`}
        </div>
      `).join("");

  comentarios.forEach(async (c) => {
    const el = lista.querySelector(`[data-insignia-comentario="${c.id}"]`);
    if (el) el.innerHTML = await obtenerInsigniaHTML(c.autorId);

    // Nombre ACTUAL del autor — mismo motivo que en los posts: el comentario
    // guarda el nombre "congelado" del momento en que se escribió.
    const datosAutor = await obtenerDatosAutorActuales(c.autorId);
    const nombreEl = lista.querySelector(`[data-nombre-comentario="${c.id}"]`);
    if (nombreEl && datosAutor?.nombre) nombreEl.textContent = datosAutor.nombre;
  });

  lista.querySelectorAll(".hashtag-link").forEach(el => {
    el.addEventListener("click", () => aplicarFiltroHashtag(el.dataset.hashtag));
  });

  lista.querySelectorAll("[data-borrar-comentario]").forEach(el => {
    el.addEventListener("click", async () => {
      await borrarComentario(el.dataset.pubId, el.dataset.borrarComentario);
      await refrescarListaComentarios(pubId);
      const contadorBtn = document.querySelector(`[data-toggle-comentarios="${pubId}"]`);
      if (contadorBtn) {
        const actual = parseInt(contadorBtn.textContent.replace(/\D/g, ""), 10) || 0;
        contadorBtn.innerHTML = `<img src="/comentario-32.png" class="icon-inline" alt="Comentarios"> ${Math.max(0, actual - 1)}`;
      }
    });
  });

  lista.querySelectorAll("[data-reportar-comentario]").forEach(el => {
    el.addEventListener("click", () => {
      abrirModalReporte({
        objetivoTipo: TIPO_OBJETIVO.COMENTARIO,
        objetivoId: el.dataset.reportarComentario,
        objetivoExtraId: el.dataset.pubId,
        objetivoAutorUid: el.dataset.autorId,
        objetivoAutorNombre: el.dataset.autorNombre
      });
    });
  });
}