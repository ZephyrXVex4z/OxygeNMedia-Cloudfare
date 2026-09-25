// viewer.js — Spotify Now Playing Viewer
// Reutiliza obtenerCancionActual() de spotify.js (mismo módulo que ya usa
// perfil.js y muro-app.js). No implementa OAuth ni maneja tokens directamente.

import { observarSesion, cuentaBloqueada } from "../../auth.js";
import { obtenerCancionActual, iniciarConexionSpotify } from "../../spotify.js";
import { leerAjustesViewer } from "./ajustes-shared.js";

// ============ CONFIGURACIÓN DE POLLING ============

const MARGEN_SEGURIDAD_MS = 2000;       // colchón tras el fin estimado de la canción
const INTERVALO_PAUSADO_MS = 12000;     // cada cuánto revisar si sigue pausado
const INTERVALO_SIN_REPRODUCCION_MS = 20000; // cada cuánto revisar si empezó a sonar algo
const INTERVALO_MAXIMO_MS = 60000;      // techo por si duration_ms viene raro (evita timers eternos o inexistentes)
const INTERVALO_MINIMO_MS = 3000;       // piso para no encadenar consultas casi inmediatas

let uidActual = null;
let timerId = null;
let controladorFetch = null;
let cancionAnterior = null; // para detectar cambio real de pista
let destruido = false;

const elStage = document.getElementById("viewerStage");
const elFondo = document.getElementById("viewerFondo");

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
    // Al volver a la pestaña, resincroniza de inmediato en vez de esperar al timer.
    cancelarTimerPendiente();
    consultarYProgramar();
  } else if (document.visibilityState === "hidden") {
    // No apagamos el timer por completo (podría perderse el próximo cambio de
    // canción por mucho tiempo), pero evitamos trabajo visual innecesario.
    detenerAnimacionesAmbientales();
  }
});

window.addEventListener("beforeunload", () => { destruido = true; cancelarTimerPendiente(); });

// ============ CICLO PRINCIPAL ============

function iniciarCicloDeConsulta() {
  consultarYProgramar();
}

function cancelarTimerPendiente() {
  if (timerId) { clearTimeout(timerId); timerId = null; }
  if (controladorFetch) { controladorFetch.abort(); controladorFetch = null; }
}

async function consultarYProgramar() {
  if (destruido || !uidActual) return;
  cancelarTimerPendiente();

  let datos = null;
  try {
    // obtenerCancionActual no acepta señal de abort internamente (usa fetch propio
    // dentro de spotify.js), así que solo protegemos contra solapamiento con el
    // candado de timerId/controladorFetch a nivel de este módulo.
    datos = await obtenerCancionActual(uidActual);
  } catch (err) {
    // Token vencido sin refresh posible, cuenta desconectada, etc.
    mostrarErrorSuave();
    programarSiguienteConsulta(INTERVALO_SIN_REPRODUCCION_MS);
    return;
  }

  renderizarEstado(datos);

  if (!datos) {
    programarSiguienteConsulta(INTERVALO_SIN_REPRODUCCION_MS);
    return;
  }

  if (!datos.reproduciendo) {
    programarSiguienteConsulta(INTERVALO_PAUSADO_MS);
    return;
  }

  // Reproduciendo: calcula cuánto falta para que termine y programa la siguiente
  // consulta justo después de ese momento (con margen de seguridad), en vez de
  // hacer polling constante.
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

// ============ RENDER ============

function renderizarEstado(datos) {
  if (!datos) {
    mostrarSinReproduccion();
    cancionAnterior = null;
    return;
  }

  const esCancionNueva = !cancionAnterior ||
    cancionAnterior.cancion !== datos.cancion ||
    cancionAnterior.artista !== datos.artista;

  mostrarTarjetaNowPlaying(datos, esCancionNueva);
  cancionAnterior = datos;
}

function plantillaBase() {
  return `
    <div class="np-card" role="region" aria-label="Reproduciendo ahora">
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
        <a class="np-btn-spotify" id="npBtnSpotify" href="#" target="_blank" rel="noopener noreferrer">
          🎧 Escuchar en Spotify
        </a>
      </div>
    </div>
  `;
}

let estadoActualDom = null; // "vacio" | "cargando" | "np" | "sinsesion" | "error"

function asegurarPlantilla() {
  if (estadoActualDom === "np") return;
  elStage.innerHTML = plantillaBase();
  estadoActualDom = "np";
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

// Extrae un color promedio aproximado de la portada, reescalándola a 1x1px en un
// canvas — barato en CPU, sin descargar/procesar la imagen a tamaño completo más
// de una vez por URL (se cachea por URL).
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
        resolve(null); // CORS u otro fallo — se ignora, el fondo simplemente no se colorea
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
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
  // No se revela nada técnico — se trata igual que "sin reproducción" para el
  // usuario, salvo que reintenta más pronto.
  if (estadoActualDom === "vacio") return;
  mostrarSinReproduccion();
}

// Muestra el skeleton inicial mientras llega el primer resultado
mostrarSkeleton();

// ============ ANIMACIONES AMBIENTALES (partículas del modo medio/potente) ============

let animacionesActivas = false;
let idsParticulas = [];

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

  const nivelAnim = resolverNivelAnimacion(ajustes.animaciones || "auto");
  root.dataset.anim = nivelAnim;

  const particulasPedidas = ajustes.particulas === true && nivelAnim !== "ligero" && nivelAnim !== "ninguna";
  const prefiereReducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (particulasPedidas && !prefiereReducido) {
    iniciarParticulas(nivelAnim === "potente" ? 18 : 9);
  }
}

function resolverNivelAnimacion(preferencia) {
  if (preferencia !== "auto") return preferencia;

  const prefiereReducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefiereReducido) return "ninguna";

  // Detección razonable y no invasiva: núcleos lógicos + memoria aproximada,
  // ambos expuestos de forma estándar y sin pedir permisos.
  const nucleos = navigator.hardwareConcurrency || 4;
  const memoria = navigator.deviceMemory || 4; // GB aproximados, Chrome/Edge only; fallback 4

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

// Reaplicar ajustes si el usuario los cambia en otra pestaña (localStorage se
// comparte entre pestañas del mismo origen) y vuelve a esta.
window.addEventListener("storage", (e) => {
  if (e.key === "oxygenmedia_spotify_viewer_ajustes") {
    aplicarAjustesVisuales();
  }
});

// ============ PANTALLA COMPLETA ============
// Fullscreen API nativa del navegador (oculta barra de dirección/pestañas),
// independiente del ajuste de "Diseño: Fullscreen" (que solo cambia el layout
// CSS de la tarjeta). Útil para dejar el Viewer en un segundo monitor o al
// hacer streaming. Con prefijos para compatibilidad con Safari/iOS.

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
    // El navegador puede rechazar la solicitud (ej. sin gesto de usuario directo,
    // o no soportado en este contexto) — no es un error que deba mostrarse.
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

  // Salir con Escape ya lo maneja el navegador de forma nativa; no se requiere
  // lógica extra. Si el ajuste "Sin animaciones" está activo, el fullscreen no
  // se ve afectado por completo — no bloquea la funcionalidad.
}
