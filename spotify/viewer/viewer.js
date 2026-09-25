// viewer.js — Spotify Now Playing Viewer
// Reutiliza obtenerCancionActual() de spotify.js (mismo módulo que ya usa
// perfil.js y muro-app.js). No implementa OAuth ni maneja tokens directamente.

import { observarSesion, cuentaBloqueada } from "../../auth.js";
import { obtenerCancionActual, iniciarConexionSpotify } from "../../spotify.js";
import { leerAjustesViewer } from "./ajustes-shared.js";
import { aplicarTemaViewer, obtenerTemaViewerGuardado } from "./viewer-temas.js";
import { crearEspectro } from "./espectro.js";
import { obtenerLetra, indiceLineaActiva } from "./lrc-parser.js";

// ============ CONFIGURACIÓN DE POLLING ============

const MARGEN_SEGURIDAD_MS = 2000;       // colchón tras el fin estimado de la canción
const INTERVALO_PAUSADO_MS = 12000;     // cada cuánto revisar si sigue pausado
const INTERVALO_SIN_REPRODUCCION_MS = 20000; // cada cuánto revisar si empezó a sonar algo
const INTERVALO_MAXIMO_MS = 60000;      // techo por si duration_ms viene raro
const INTERVALO_MINIMO_MS = 3000;       // piso para no encadenar consultas casi inmediatas
const INTERVALO_SEGUIMIENTO_LETRA_MS = 900; // solo corre mientras hay letra activa visible

let uidActual = null;
let timerId = null;
let cancionAnterior = null; // para detectar cambio real de pista
let destruido = false;

// Estado de reproducción "en vivo" estimado, para el seguimiento de letra entre
// una consulta a Spotify y la siguiente (no es un nuevo polling a Spotify).
let progresoEstimadoMs = 0;
let duracionActualMs = 0;
let reproduciendoActual = false;
let ultimaMarcaTiempo = 0;
let timerLetra = null;

let letraActualParseada = null; // [{ms, texto}] o null
let indiceLineaAnterior = -1;
let instanciaEspectro = null;

const elStage = document.getElementById("viewerStage");
const elFondo = document.getElementById("viewerFondo");

// ============ TEMA EXCLUSIVO DEL VIEWER ============
// Se aplica antes que nada más, para que no haya flash del tema global sin
// mapear a --v-*.
aplicarTemaViewer(obtenerTemaViewerGuardado());

// ============ SESIÓN ============

observarSesion((user, perfil) => {
  if (!user || cuentaBloqueada(perfil).bloqueada) {
    mostrarNoSesion();
    return;
  }
  if (!perfil.spotifyConectado) {
    mostrarSpotifyDesconectado();
    return;
  }
  uidActual = user.uid;
  aplicarAjustesVisuales();
  iniciarCicloDeConsulta();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && uidActual) {
    cancelarTimerPendiente();
    consultarYProgramar();
  } else if (document.visibilityState === "hidden") {
    detenerAnimacionesAmbientales();
    detenerSeguimientoLetra();
    if (instanciaEspectro) instanciaEspectro.detener();
  }
});

window.addEventListener("beforeunload", () => {
  destruido = true;
  cancelarTimerPendiente();
  detenerSeguimientoLetra();
  if (instanciaEspectro) instanciaEspectro.destruir();
});

// ============ CICLO PRINCIPAL (consulta a Spotify) ============

function iniciarCicloDeConsulta() {
  consultarYProgramar();
}

function cancelarTimerPendiente() {
  if (timerId) { clearTimeout(timerId); timerId = null; }
}

async function consultarYProgramar() {
  if (destruido || !uidActual) return;
  cancelarTimerPendiente();

  let datos = null;
  try {
    datos = await obtenerCancionActual(uidActual);
  } catch (err) {
    mostrarErrorSuave();
    programarSiguienteConsulta(INTERVALO_SIN_REPRODUCCION_MS);
    return;
  }

  renderizarEstado(datos);

  if (!datos) {
    reproduciendoActual = false;
    if (instanciaEspectro) instanciaEspectro.setReproduciendo(false);
    detenerSeguimientoLetra();
    programarSiguienteConsulta(INTERVALO_SIN_REPRODUCCION_MS);
    return;
  }

  // Sincroniza el estado "en vivo" usado por el seguimiento de letra
  progresoEstimadoMs = datos.progresoMs || 0;
  duracionActualMs = datos.duracionMs || 0;
  reproduciendoActual = !!datos.reproduciendo;
  ultimaMarcaTiempo = performance.now();

  if (instanciaEspectro) instanciaEspectro.setReproduciendo(reproduciendoActual);

  if (!datos.reproduciendo) {
    detenerSeguimientoLetra();
    programarSiguienteConsulta(INTERVALO_PAUSADO_MS);
    return;
  }

  iniciarSeguimientoLetraSiAplica();

  const restanteMs = (datos.duracionMs || 0) - (datos.progresoMs || 0);
  let espera = restanteMs + MARGEN_SEGURIDAD_MS;
  if (!Number.isFinite(espera) || espera <= 0) espera = INTERVALO_MINIMO_MS;
  espera = Math.max(INTERVALO_MINIMO_MS, Math.min(espera, INTERVALO_MAXIMO_MS));

  programarSiguienteConsulta(espera);
}

function programarSiguienteConsulta(ms) {
  if (destruido) return;
  timerId = setTimeout(consultarYProgramar, ms);
}

// ============ RENDER PRINCIPAL ============

function renderizarEstado(datos) {
  if (!datos) {
    mostrarSinReproduccion();
    cancionAnterior = null;
    letraActualParseada = null;
    return;
  }

  const esCancionNueva = !cancionAnterior ||
    cancionAnterior.cancion !== datos.cancion ||
    cancionAnterior.artista !== datos.artista;

  mostrarTarjetaNowPlaying(datos, esCancionNueva);

  if (esCancionNueva) {
    letraActualParseada = obtenerLetra(datos.artista, datos.cancion);
    indiceLineaAnterior = -1;
    renderPanelLetra(datos);
  }

  cancionAnterior = datos;
}

function plantillaBase(ajustes) {
  const usarLayoutLetra = ajustes.diseno === "letra";

  const bloqueInfo = `
    <div class="np-portada-wrap">
      <div class="np-portada-glow" id="npGlow" aria-hidden="true"></div>
      <img class="np-portada" id="npPortada" alt="">
    </div>
    <div class="np-info" id="npInfo">
      <div class="np-cancion" id="npCancion"></div>
      <div class="np-artista" id="npArtista"></div>
      <div class="np-album" id="npAlbum"></div>
      <div class="np-estado-row">
        <span class="np-dot" id="npDot"></span>
        <span id="npEstadoTexto"></span>
      </div>
      <div class="np-linea"><div class="np-linea-fill" id="npLineaFill"></div></div>
      <div class="np-duracion" id="npDuracion"></div>
      <div class="np-espectro-wrap" id="npEspectroWrap">
        <canvas class="np-espectro-canvas" id="npEspectroCanvas"></canvas>
      </div>
      <a class="np-btn-spotify" id="npBtnSpotify" href="#" target="_blank" rel="noopener noreferrer">
        🎧 Escuchar en Spotify
      </a>
    </div>
  `;

  if (!usarLayoutLetra) {
    return `<div class="np-card" role="region" aria-label="Reproduciendo ahora">${bloqueInfo}</div>`;
  }

  return `
    <div class="np-card" role="region" aria-label="Reproduciendo ahora">
      <div class="np-lado-info">${bloqueInfo}</div>
      <div class="np-lado-letra" id="npLadoLetra">
        <!-- renderPanelLetra() llena esto -->
      </div>
    </div>
  `;
}

let estadoActualDom = null; // "vacio" | "cargando" | "np" | "sinsesion" | "error"

function asegurarPlantilla() {
  if (estadoActualDom === "np") return;
  const ajustes = leerAjustesViewer();
  elStage.innerHTML = plantillaBase(ajustes);
  estadoActualDom = "np";
  configurarEspectroEnDom(ajustes);
}

function formatearDuracion(ms) {
  if (!ms || ms <= 0) return "";
  const totalSeg = Math.round(ms / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return `${min}:${String(seg).padStart(2, "0")}`;
}

function mostrarTarjetaNowPlaying(datos, esCancionNueva) {
  const primeraVez = estadoActualDom !== "np";
  asegurarPlantilla();

  const elPortada = document.getElementById("npPortada");
  const elGlow = document.getElementById("npGlow");
  const elInfo = document.getElementById("npInfo");
  const elCancion = document.getElementById("npCancion");
  const elArtista = document.getElementById("npArtista");
  const elAlbum = document.getElementById("npAlbum");
  const elDot = document.getElementById("npDot");
  const elEstadoTexto = document.getElementById("npEstadoTexto");
  const elDuracion = document.getElementById("npDuracion");
  const elLineaFill = document.getElementById("npLineaFill");
  const elBtn = document.getElementById("npBtnSpotify");

  const actualizarContenido = () => {
    if (datos.imagenURL) elPortada.src = datos.imagenURL;
    elPortada.alt = `Portada del álbum ${datos.album || ""}`.trim();
    elGlow.style.backgroundImage = datos.imagenURL ? `url("${datos.imagenURL}")` : "none";
    elCancion.textContent = datos.cancion || "";
    elArtista.textContent = datos.artista || "";
    elAlbum.textContent = datos.album || "";
    elDuracion.textContent = formatearDuracion(datos.duracionMs);
    elBtn.href = datos.urlSpotify || "#";

    elDot.classList.toggle("reproduciendo", !!datos.reproduciendo);
    elEstadoTexto.textContent = datos.reproduciendo ? "Reproduciendo" : "Pausado";

    if (datos.duracionMs > 0) {
      const pct = Math.min(100, Math.max(0, (datos.progresoMs / datos.duracionMs) * 100));
      elLineaFill.style.width = pct + "%";
    } else {
      elLineaFill.style.width = "0%";
    }

    elInfo.classList.remove("cambiando");
    elPortada.classList.remove("cambiando");
  };

  const animarTransiciones = leerAjustesViewer().animCambioCancion !== false;

  if (!primeraVez && esCancionNueva && animarTransiciones) {
    elInfo.classList.add("cambiando");
    elPortada.classList.add("cambiando");
    setTimeout(actualizarContenido, 220);
  } else {
    actualizarContenido();
  }

  actualizarFondoDinamico(datos.imagenURL);
}

function actualizarFondoDinamico(imagenURL) {
  if (!elFondo || leerAjustesViewer().fondoDinamico === false) return;
  if (!imagenURL) {
    elFondo.style.background = "";
    return;
  }
  extraerColorAproximado(imagenURL).then(color => {
    if (!color) return;
    elFondo.style.background =
      `radial-gradient(circle at 50% 20%, rgba(${color.r},${color.g},${color.b},0.35), transparent 60%)`;
  }).catch(() => {});
}

const cacheColores = new Map();
function extraerColorAproximado(url) {
  if (cacheColores.has(url)) return Promise.resolve(cacheColores.get(url));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        const color = { r, g, b };
        cacheColores.set(url, color);
        resolve(color);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ============ ESPECTRO / ONDAS (decorativo, no sincronizado a audio) ============

function configurarEspectroEnDom(ajustes) {
  const wrap = document.getElementById("npEspectroWrap");
  const canvas = document.getElementById("npEspectroCanvas");
  if (!wrap || !canvas) return;

  if (!ajustes.espectroActivo) {
    wrap.classList.add("hidden");
    if (instanciaEspectro) { instanciaEspectro.destruir(); instanciaEspectro = null; }
    return;
  }

  wrap.classList.remove("hidden");

  if (instanciaEspectro) instanciaEspectro.destruir();

  const colorTema = getComputedStyle(document.documentElement).getPropertyValue("--v-espectro").trim() || "#5b8def";
  instanciaEspectro = crearEspectro(canvas, {
    estilo: ajustes.espectroEstilo,
    color: ajustes.espectroUsaColorTema ? colorTema : (ajustes.espectroColor || colorTema),
    intensidad: ajustes.espectroIntensidad
  });

  const prefiereReducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefiereReducido && document.visibilityState === "visible") {
    instanciaEspectro.setReproduciendo(reproduciendoActual);
    instanciaEspectro.iniciar();
  }
}

// ============ LETRA SINCRONIZADA (importada en .lrc) ============

function renderPanelLetra(datos) {
  const contenedor = document.getElementById("npLadoLetra");
  if (!contenedor) return; // diseño actual no es "letra"

  const ajustes = leerAjustesViewer();

  if (!ajustes.letraActiva || !letraActualParseada || letraActualParseada.length === 0) {
    contenedor.innerHTML = `
      <div class="np-letra-vacia">
        <div class="icono">📝</div>
        <p>No hay letra importada para esta canción.</p>
        <a href="/spotify/viewer/ajustes/">Importar un archivo .lrc</a>
      </div>
    `;
    return;
  }

  const scrollDiv = document.createElement("div");
  scrollDiv.className = "np-letra-scroll";
  scrollDiv.id = "npLetraScroll";
  scrollDiv.innerHTML = letraActualParseada.map((linea, i) =>
    `<p class="np-letra-linea" data-idx="${i}">${escapeHtml(linea.texto)}</p>`
  ).join("");

  contenedor.innerHTML = "";
  contenedor.appendChild(scrollDiv);
  indiceLineaAnterior = -1;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Seguimiento de letra: NO hace polling a Spotify. Usa el último progresoMs
// conocido + tiempo transcurrido localmente para estimar dónde va la canción, y
// solo actualiza qué línea se resalta. Se detiene si no hay letra visible, si
// está pausado, o si la pestaña está oculta.
function iniciarSeguimientoLetraSiAplica() {
  const ajustes = leerAjustesViewer();
  if (ajustes.diseno !== "letra" || !ajustes.letraActiva) return;
  if (!letraActualParseada || letraActualParseada.length === 0) return;
  if (timerLetra) return; // ya corriendo

  const prefiereReducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const paso = () => {
    if (destruido || document.visibilityState === "hidden" || !reproduciendoActual) {
      timerLetra = null;
      return;
    }
    const transcurrido = performance.now() - ultimaMarcaTiempo;
    const progresoActualEstimado = progresoEstimadoMs + transcurrido;
    const idx = indiceLineaActiva(letraActualParseada, progresoActualEstimado);

    if (idx !== indiceLineaAnterior) {
      actualizarLineaActivaEnDom(idx, !prefiereReducido);
      indiceLineaAnterior = idx;
    }
    timerLetra = setTimeout(paso, INTERVALO_SEGUIMIENTO_LETRA_MS);
  };
  paso();
}

function detenerSeguimientoLetra() {
  if (timerLetra) { clearTimeout(timerLetra); timerLetra = null; }
}

function actualizarLineaActivaEnDom(idxActiva, conScroll) {
  const scrollDiv = document.getElementById("npLetraScroll");
  if (!scrollDiv) return;

  const lineas = scrollDiv.querySelectorAll(".np-letra-linea");
  lineas.forEach((el, i) => {
    el.classList.toggle("activa", i === idxActiva);
    el.classList.toggle("pasada", i < idxActiva);
  });

  if (idxActiva >= 0 && conScroll) {
    const elActiva = lineas[idxActiva];
    if (elActiva) {
      const offset = elActiva.offsetTop - scrollDiv.clientHeight / 2 + elActiva.clientHeight / 2;
      scrollDiv.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
    }
  }
}

// ============ ESTADOS ALTERNATIVOS ============

function mostrarSkeleton() {
  if (estadoActualDom === "cargando") return;
  estadoActualDom = "cargando";
  elStage.innerHTML = `
    <div class="np-card" aria-busy="true" aria-label="Cargando">
      <div class="np-skeleton">
        <div class="sk-block sk-portada"></div>
        <div class="sk-block sk-linea1"></div>
        <div class="sk-block sk-linea2"></div>
        <div class="sk-block sk-linea3"></div>
      </div>
    </div>
  `;
}

function mostrarSinReproduccion() {
  if (estadoActualDom === "vacio") return;
  estadoActualDom = "vacio";
  if (instanciaEspectro) { instanciaEspectro.destruir(); instanciaEspectro = null; }
  elStage.innerHTML = `
    <div class="np-card">
      <div class="np-estado-vacio">
        <div class="icono">🎵</div>
        <h2>Sin reproducción</h2>
        <p>No hay ninguna canción reproduciéndose actualmente.</p>
      </div>
    </div>
  `;
}

function mostrarSpotifyDesconectado() {
  estadoActualDom = "sinsesion";
  elStage.innerHTML = `
    <div class="np-card">
      <div class="np-estado-vacio">
        <div class="icono">🎧</div>
        <h2>Conecta tu cuenta de Spotify</h2>
        <p>Necesitas vincular tu cuenta de Spotify para usar el Viewer.</p>
        <button id="npBtnConectar" type="button">Conectar Spotify</button>
      </div>
    </div>
  `;
  document.getElementById("npBtnConectar").addEventListener("click", () => {
    iniciarConexionSpotify();
  });
}

function mostrarNoSesion() {
  estadoActualDom = "sinsesion";
  elStage.innerHTML = `
    <div class="np-card">
      <div class="np-estado-vacio">
        <div class="icono">🔒</div>
        <h2>Inicia sesión</h2>
        <p>Debes iniciar sesión en OxygeNMedia para usar el Viewer.</p>
        <a href="/" style="text-decoration:none;"><button type="button">Ir al sitio</button></a>
      </div>
    </div>
  `;
}

function mostrarErrorSuave() {
  if (estadoActualDom === "vacio") return;
  mostrarSinReproduccion();
}

mostrarSkeleton();

// ============ AJUSTES VISUALES GENERALES (data-attrs + partículas + animación) ============

let animacionesActivas = false;

function detenerAnimacionesAmbientales() {
  animacionesActivas = false;
}

function aplicarAjustesVisuales() {
  const ajustes = leerAjustesViewer();
  const root = document.documentElement;

  root.dataset.fondo = ajustes.fondoDinamico === false ? "off" : "on";
  root.dataset.glow = ajustes.glow === false ? "off" : "on";
  root.dataset.mostrarCancion = ajustes.mostrarCancion === false ? "off" : "on";
  root.dataset.mostrarArtista = ajustes.mostrarArtista === false ? "off" : "on";
  root.dataset.mostrarAlbum = ajustes.mostrarAlbum === false ? "off" : "on";
  root.dataset.mostrarDuracion = ajustes.mostrarDuracion === false ? "off" : "on";
  root.dataset.mostrarBoton = ajustes.mostrarBoton === false ? "off" : "on";
  root.dataset.portada = ajustes.tamanoPortada || "mediana";
  root.dataset.diseno = ajustes.diseno || "centrado";
  root.dataset.letraTamano = ajustes.letraTamanoTexto || "mediano";
  root.dataset.letraDegradado = ajustes.letraDegradado === false ? "off" : "on";

  const nivelAnim = resolverNivelAnimacion(ajustes.animaciones || "auto");
  root.dataset.anim = nivelAnim;

  const particulasPedidas = ajustes.particulas === true && nivelAnim !== "ligero" && nivelAnim !== "ninguna";
  const prefiereReducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (particulasPedidas && !prefiereReducido) {
    iniciarParticulas(nivelAnim === "potente" ? 18 : 9);
  }

  // Si ya existe la plantilla renderizada (cambio de ajustes en vivo desde otra
  // pestaña), fuerza reconstrucción para reflejar diseño/espectro nuevos.
  if (estadoActualDom === "np" && cancionAnterior) {
    estadoActualDom = null; // fuerza a asegurarPlantilla() reconstruir
    mostrarTarjetaNowPlaying(cancionAnterior, false);
    renderPanelLetra(cancionAnterior);
  }
}

function resolverNivelAnimacion(preferencia) {
  if (preferencia !== "auto") return preferencia;

  const prefiereReducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefiereReducido) return "ninguna";

  const nucleos = navigator.hardwareConcurrency || 4;
  const memoria = navigator.deviceMemory || 4;

  if (nucleos <= 2 || memoria <= 2) return "ligero";
  if (nucleos >= 8 && memoria >= 8) return "potente";
  return "medio";
}

function iniciarParticulas(cantidad) {
  if (animacionesActivas) return;
  animacionesActivas = true;

  let capa = document.getElementById("npParticulas");
  if (!capa) {
    capa = document.createElement("div");
    capa.className = "np-particulas";
    capa.id = "npParticulas";
    elStage.prepend(capa);
  }
  capa.innerHTML = "";

  for (let i = 0; i < cantidad; i++) {
    const p = document.createElement("div");
    p.className = "np-particula";
    const tam = 2 + Math.random() * 3;
    p.style.width = tam + "px";
    p.style.height = tam + "px";
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDuration = (6 + Math.random() * 8) + "s";
    p.style.animationDelay = Math.random() * 6 + "s";
    capa.appendChild(p);
  }
}

// Reaplicar ajustes si el usuario los cambia en otra pestaña o en /ajustes/
window.addEventListener("storage", (e) => {
  if (e.key === "oxygenmedia_spotify_viewer_ajustes") {
    aplicarAjustesVisuales();
  }
  if (e.key === "oxygenmedia_spotify_viewer_tema") {
    aplicarTemaViewer(obtenerTemaViewerGuardado());
  }
});

// ============ PANTALLA COMPLETA ============

const btnPantallaCompleta = document.getElementById("btnPantallaCompleta");

function elementoFullscreenActual() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

async function alternarPantallaCompleta() {
  try {
    if (!elementoFullscreenActual()) {
      const shell = document.querySelector(".viewer-shell");
      if (shell.requestFullscreen) await shell.requestFullscreen();
      else if (shell.webkitRequestFullscreen) shell.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  } catch {
    // Rechazo del navegador (sin gesto directo, no soportado, etc.) — se ignora.
  }
}

function actualizarBotonFullscreen() {
  const activo = !!elementoFullscreenActual();
  btnPantallaCompleta.textContent = activo ? "⛶ Salir de pantalla completa" : "⛶ Pantalla completa";
  btnPantallaCompleta.setAttribute("aria-pressed", String(activo));
}

if (btnPantallaCompleta) {
  btnPantallaCompleta.addEventListener("click", alternarPantallaCompleta);
  document.addEventListener("fullscreenchange", actualizarBotonFullscreen);
  document.addEventListener("webkitfullscreenchange", actualizarBotonFullscreen);
}
