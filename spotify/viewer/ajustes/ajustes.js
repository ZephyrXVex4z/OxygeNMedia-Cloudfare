// ajustes.js — Página de configuración del Spotify Viewer.
// Ajustes visuales puros → localStorage (ajustes-shared.js). Tema exclusivo del
// Viewer → su propia clave (viewer-temas.js). Letras .lrc → clave por canción
// (lrc-parser.js). Nada de esto toca Firestore.

import { leerAjustesViewer, guardarAjustesViewer, AJUSTES_DEFAULT } from "../ajustes-shared.js";
import { TEMAS_VIEWER, obtenerTemaViewerGuardado, guardarTemaViewer } from "../viewer-temas.js";
import { parsearLRC, guardarLetra } from "../lrc-parser.js";

let ajustes = leerAjustesViewer();

const msgGuardado = document.getElementById("msgGuardado");

function mostrarGuardado() {
  msgGuardado.classList.add("visible");
  setTimeout(() => msgGuardado.classList.remove("visible"), 1400);
}

function persistir() {
  guardarAjustesViewer(ajustes);
  // localStorage no dispara el evento "storage" en la MISMA pestaña que escribe
  // (solo en otras pestañas), así que si el Viewer estuviera abierto en esta
  // misma pestaña no se enteraría — pero como ajustes.js vive en su propia
  // página, esto es exactamente el comportamiento esperado: el Viewer (en otra
  // pestaña/ventana) sí recibe el evento "storage" normalmente.
  mostrarGuardado();
}

// ============ HELPERS DE RENDER ============

function crearFilaCheck(clave, etiqueta) {
  const fila = document.createElement("div");
  fila.className = "fila-check";
  const idInput = "chk_" + clave;
  fila.innerHTML = `
    <label for="${idInput}" style="cursor:pointer;">${etiqueta}</label>
    <label class="switch">
      <input type="checkbox" id="${idInput}" ${ajustes[clave] ? "checked" : ""}>
      <span class="slider"></span>
    </label>
  `;
  fila.querySelector("input").addEventListener("change", (e) => {
    ajustes[clave] = e.target.checked;
    persistir();
  });
  return fila;
}

function crearFilaSelect(clave, etiqueta, opciones) {
  const fila = document.createElement("div");
  fila.className = "fila-select";
  const idSelect = "sel_" + clave;
  const optionsHtml = opciones.map(o =>
    `<option value="${o.valor}" ${ajustes[clave] === o.valor ? "selected" : ""}>${o.texto}</option>`
  ).join("");
  fila.innerHTML = `
    <label for="${idSelect}">${etiqueta}</label>
    <select id="${idSelect}">${optionsHtml}</select>
  `;
  fila.querySelector("select").addEventListener("change", (e) => {
    ajustes[clave] = e.target.value;
    persistir();
  });
  return fila;
}

function crearFilaRango(clave, etiqueta, min, max, paso) {
  const fila = document.createElement("div");
  fila.className = "fila-select";
  const idInput = "rng_" + clave;
  fila.innerHTML = `
    <label for="${idInput}">${etiqueta}</label>
    <input type="range" id="${idInput}" min="${min}" max="${max}" step="${paso}" value="${ajustes[clave]}">
  `;
  fila.querySelector("input").addEventListener("input", (e) => {
    ajustes[clave] = parseFloat(e.target.value);
    persistir();
  });
  return fila;
}

function crearFilaColor(clave, etiqueta) {
  const fila = document.createElement("div");
  fila.className = "fila-select";
  const idInput = "col_" + clave;
  const valorActual = ajustes[clave] || "#5b8def";
  fila.innerHTML = `
    <label for="${idInput}">${etiqueta}</label>
    <input type="color" id="${idInput}" value="${valorActual}">
  `;
  fila.querySelector("input").addEventListener("input", (e) => {
    ajustes[clave] = e.target.value;
    persistir();
  });
  return fila;
}

// ============ GRUPO: TEMA DEL VIEWER ============

function renderTemasViewer() {
  const cont = document.getElementById("gridTemasViewer");
  const temaActivo = obtenerTemaViewerGuardado();
  cont.innerHTML = Object.entries(TEMAS_VIEWER).map(([id, t]) => {
    const colorSwatch = t.vars ? t.vars["--v-bg"] : "linear-gradient(135deg,#333,#555)";
    return `
      <button type="button" class="tema-viewer-chip ${id === temaActivo ? "activo" : ""}" data-tema-viewer="${id}">
        <span class="swatch" style="background:${colorSwatch};">${t.emoji}</span>
        <span>${t.nombre}</span>
      </button>
    `;
  }).join("");

  cont.querySelectorAll("[data-tema-viewer]").forEach(btn => {
    btn.addEventListener("click", () => {
      guardarTemaViewer(btn.dataset.temaViewer);
      renderTemasViewer();
      mostrarGuardado();
    });
  });
}

// ============ GRUPO: INFORMACIÓN ============

function renderInfo() {
  const cont = document.getElementById("grupoInfo");
  cont.innerHTML = "";
  cont.appendChild(crearFilaCheck("mostrarPortada", "Mostrar portada"));
  cont.appendChild(crearFilaCheck("mostrarCancion", "Mostrar nombre de canción"));
  cont.appendChild(crearFilaCheck("mostrarArtista", "Mostrar artista"));
  cont.appendChild(crearFilaCheck("mostrarAlbum", "Mostrar álbum"));
  cont.appendChild(crearFilaCheck("mostrarDuracion", "Mostrar duración"));
  cont.appendChild(crearFilaCheck("mostrarBoton", 'Mostrar botón "Escuchar en Spotify"'));
}

// ============ GRUPO: VISUALES + ESPECTRO ============

function renderVisuales() {
  const cont = document.getElementById("grupoVisuales");
  cont.innerHTML = "";
  cont.appendChild(crearFilaCheck("fondoDinamico", "Fondo dinámico"));
  cont.appendChild(crearFilaCheck("blur", "Blur"));
  cont.appendChild(crearFilaCheck("glow", "Glow"));
  cont.appendChild(crearFilaCheck("particulas", "Partículas"));
  cont.appendChild(crearFilaCheck("animCambioCancion", "Animación al cambiar de canción"));
}

function renderEspectro() {
  const cont = document.getElementById("grupoEspectro");
  cont.innerHTML = "";
  cont.appendChild(crearFilaCheck("espectroActivo", "Mostrar espectro / ondas"));
  cont.appendChild(crearFilaSelect("espectroEstilo", "Estilo", [
    { valor: "barras", texto: "Barras" },
    { valor: "ondas", texto: "Ondas" },
    { valor: "circular", texto: "Circular" }
  ]));
  cont.appendChild(crearFilaRango("espectroIntensidad", "Intensidad", 0.4, 1.4, 0.1));
  cont.appendChild(crearFilaCheck("espectroUsaColorTema", "Usar color del tema"));
  if (!ajustes.espectroUsaColorTema) {
    cont.appendChild(crearFilaColor("espectroColor", "Color personalizado"));
  }

  const nota = document.createElement("p");
  nota.className = "sub";
  nota.style.marginTop = "8px";
  nota.textContent = "El espectro es decorativo — no está sincronizado con el audio real de la canción.";
  cont.appendChild(nota);
}

// ============ GRUPO: ANIMACIONES ============

function renderAnimaciones() {
  const cont = document.getElementById("grupoAnimaciones");
  cont.innerHTML = "";
  cont.appendChild(crearFilaSelect("animaciones", "Nivel", [
    { valor: "auto", texto: "Automático" },
    { valor: "ligero", texto: "Ligero" },
    { valor: "medio", texto: "Medio" },
    { valor: "potente", texto: "Potente" },
    { valor: "ninguna", texto: "Sin animaciones" }
  ]));
}

// ============ GRUPO: PORTADA ============

function renderPortada() {
  const cont = document.getElementById("grupoPortada");
  cont.innerHTML = "";
  cont.appendChild(crearFilaSelect("tamanoPortada", "Tamaño", [
    { valor: "grande", texto: "Grande" },
    { valor: "mediana", texto: "Mediana" },
    { valor: "pequena", texto: "Pequeña" },
    { valor: "oculta", texto: "Ocultar" }
  ]));
}

// ============ GRUPO: DISEÑO ============

function renderDiseno() {
  const cont = document.getElementById("grupoDiseno");
  cont.innerHTML = "";
  cont.appendChild(crearFilaSelect("diseno", "Distribución", [
    { valor: "centrado", texto: "Centrado" },
    { valor: "compacto", texto: "Compacto" },
    { valor: "tarjeta", texto: "Tarjeta" },
    { valor: "fullscreen", texto: "Fullscreen" },
    { valor: "letra", texto: "Con letra (portada + letra)" }
  ]));
}

// ============ GRUPO: LETRA SINCRONIZADA ============

function renderLetra() {
  const cont = document.getElementById("grupoLetra");
  cont.innerHTML = "";
  cont.appendChild(crearFilaCheck("letraActiva", "Mostrar letra (si está importada)"));
  cont.appendChild(crearFilaSelect("letraTamanoTexto", "Tamaño del texto", [
    { valor: "pequeno", texto: "Pequeño" },
    { valor: "mediano", texto: "Mediano" },
    { valor: "grande", texto: "Grande" }
  ]));
  cont.appendChild(crearFilaCheck("letraDegradado", "Degradado arriba/abajo"));

  const nota = document.createElement("p");
  nota.className = "sub";
  nota.style.marginTop = "8px";
  nota.textContent = 'Solo visible cuando el Diseño está en "Con letra".';
  cont.appendChild(nota);
}

function renderTodo() {
  renderTemasViewer();
  renderInfo();
  renderVisuales();
  renderEspectro();
  renderAnimaciones();
  renderPortada();
  renderDiseno();
  renderLetra();
}

renderTodo();

// ============ IMPORTADOR DE .LRC ============

const inputArtistaLrc = document.getElementById("inputArtistaLrc");
const inputCancionLrc = document.getElementById("inputCancionLrc");
const inputArchivoLrc = document.getElementById("inputArchivoLrc");
const btnElegirArchivoLrc = document.getElementById("btnElegirArchivoLrc");
const msgImportarLrc = document.getElementById("msgImportarLrc");

btnElegirArchivoLrc.addEventListener("click", () => inputArchivoLrc.click());

inputArchivoLrc.addEventListener("change", () => {
  const archivo = inputArchivoLrc.files[0];
  msgImportarLrc.className = "msg-importar";
  msgImportarLrc.style.display = "none";
  if (!archivo) return;

  const artista = inputArtistaLrc.value.trim();
  const cancion = inputCancionLrc.value.trim();

  if (!artista || !cancion) {
    mostrarMsgImportar("Escribe el artista y el nombre de la canción antes de elegir el archivo.", "error");
    inputArchivoLrc.value = "";
    return;
  }

  const nombreOk = /\.lrc$/i.test(archivo.name) || archivo.type === "text/plain" || archivo.name.toLowerCase().endsWith(".txt");
  if (!nombreOk) {
    mostrarMsgImportar("Elige un archivo .lrc válido.", "error");
    inputArchivoLrc.value = "";
    return;
  }

  const lector = new FileReader();
  lector.onload = () => {
    const lineasParsed = parsearLRC(lector.result);
    if (lineasParsed.length === 0) {
      mostrarMsgImportar("No se encontraron líneas con marca de tiempo en el archivo. Verifica que sea un .lrc válido.", "error");
      return;
    }
    const ok = guardarLetra(artista, cancion, lineasParsed);
    if (ok) {
      mostrarMsgImportar(`Letra importada: ${lineasParsed.length} líneas guardadas para "${cancion}" — ${artista}.`, "ok");
      inputArchivoLrc.value = "";
    } else {
      mostrarMsgImportar("No se pudo guardar la letra (almacenamiento local lleno o bloqueado).", "error");
    }
  };
  lector.onerror = () => mostrarMsgImportar("No se pudo leer el archivo.", "error");
  lector.readAsText(archivo, "utf-8");
});

function mostrarMsgImportar(texto, tipo) {
  msgImportarLrc.textContent = texto;
  msgImportarLrc.className = "msg-importar " + tipo;
  msgImportarLrc.style.display = "block";
}

// ============ RESTABLECER ============

document.getElementById("btnRestablecer").addEventListener("click", () => {
  if (!confirm("¿Restablecer todos los ajustes del Viewer a sus valores predeterminados? (Esto no borra las letras .lrc importadas ni el tema del Viewer)")) return;
  ajustes = { ...AJUSTES_DEFAULT };
  guardarAjustesViewer(ajustes);
  renderTodo();
  mostrarGuardado();
});
