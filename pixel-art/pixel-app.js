// pixel-app.js
// Punto de entrada del editor. Conecta los módulos entre sí y traduce los
// eventos del usuario (mouse, touch, teclado, clics de UI) en llamadas a esos
// módulos. Este archivo no contiene lógica de dibujo/color/historial en sí —
// solo "pega" las piezas, tal como pide la arquitectura modular.

import {
  inicializarCanvas, cambiarTamanoGrid, obtenerGridSize,
  establecerZoom, obtenerZoom, dibujar, celdaDesdeEvento, dentroDelGrid,
  ZOOM_MIN, ZOOM_MAX
} from "/pixel-art/pixel-canvas.js";
import {
  inicializarHistorial, registrarEstado, deshacer, rehacer
} from "/pixel-art/pixel-historial.js";
import {
  obtenerPaleta, obtenerColorActual, establecerColorActual, agregarAPaleta, quitarDePaleta,
  normalizarHex, PALETAS_PREDETERMINADAS, cargarPaletaPredeterminada, establecerPaleta
} from "/pixel-art/pixel-color.js";
import { HERRAMIENTAS, aplicarHerramienta, crearGridVacio } from "/pixel-art/pixel-herramientas.js";
import { exportarComoPng } from "/pixel-art/pixel-exportar.js";
import { guardarProyectoActual, cargarProyectoActual, segundosDesdeUltimoGuardado } from "/pixel-art/pixel-storage.js";
import { cargarImagenDesdeArchivo, cargarImagenDesdeUrl, convertirImagenAGrid } from "/pixel-art/pixel-imagen.js";

const canvasEl = document.getElementById("pixelCanvas");
const wrapEl = document.getElementById("wrapCanvas");
const selectTamano = document.getElementById("selectTamano");
const btnLimpiarLienzo = document.getElementById("btnLimpiarLienzo");
const btnDeshacer = document.getElementById("btnDeshacer");
const btnRehacer = document.getElementById("btnRehacer");
const btnZoomMas = document.getElementById("btnZoomMas");
const btnZoomMenos = document.getElementById("btnZoomMenos");
const textoZoom = document.getElementById("textoZoom");
const coordenadasCursor = document.getElementById("coordenadasCursor");
const paletaGrid = document.getElementById("paletaGrid");
const paletaTabs = document.getElementById("paletaTabs");
const inputColorPicker = document.getElementById("inputColorPicker");
const inputHex = document.getElementById("inputHex");
const btnAgregarColor = document.getElementById("btnAgregarColor");
const selectMultiplicador = document.getElementById("selectMultiplicador");
const btnExportarPng = document.getElementById("btnExportarPng");
const estadoGuardado = document.getElementById("estadoGuardado");

let gridSize = parseInt(selectTamano.value, 10);
let grid = crearGridVacio(gridSize);
let herramientaActual = HERRAMIENTAS.LAPIZ;
let dibujando = false;
let huboCambioEnTrazoActual = false;

const proyectoGuardado = cargarProyectoActual();
if (proyectoGuardado) {
  gridSize = proyectoGuardado.gridSize;
  grid = proyectoGuardado.grid;
  selectTamano.value = gridSize;
}

inicializarCanvas(canvasEl, wrapEl, gridSize);
inicializarHistorial(grid, actualizarBotonesHistorial);
renderTodo();

function renderTodo() {
  dibujar([grid]);
}

function actualizarBotonesHistorial(estado) {
  btnDeshacer.disabled = !estado.puedeDeshacer;
  btnRehacer.disabled = !estado.puedeRehacer;
}

function manejarInicioDibujo(e) {
  e.preventDefault();
  dibujando = true;
  huboCambioEnTrazoActual = false;
  procesarCelda(e);
}

function manejarMovimientoDibujo(e) {
  actualizarCoordenadas(e);
  if (!dibujando) return;
  procesarCelda(e);
}

function manejarFinDibujo() {
  if (dibujando && huboCambioEnTrazoActual) {
    registrarEstado(grid);
    autoguardar();
  }
  dibujando = false;
}

function procesarCelda(e) {
  const { x, y } = celdaDesdeEvento(e);
  if (!dentroDelGrid(x, y)) return;

  const { cambio, colorCopiado } = aplicarHerramienta(herramientaActual, grid, x, y, obtenerColorActual(), gridSize);

  if (colorCopiado) {
    seleccionarColor(colorCopiado);
    return;
  }

  if (cambio) {
    huboCambioEnTrazoActual = true;
    renderTodo();
  }
}

function actualizarCoordenadas(e) {
  const { x, y } = celdaDesdeEvento(e);
  coordenadasCursor.textContent = dentroDelGrid(x, y) ? `X: ${x}  Y: ${y}` : "";
}

canvasEl.addEventListener("mousedown", manejarInicioDibujo);
canvasEl.addEventListener("mousemove", manejarMovimientoDibujo);
window.addEventListener("mouseup", manejarFinDibujo);
canvasEl.addEventListener("mouseleave", () => { coordenadasCursor.textContent = ""; });

canvasEl.addEventListener("touchstart", manejarInicioDibujo, { passive: false });
canvasEl.addEventListener("touchmove", manejarMovimientoDibujo, { passive: false });
window.addEventListener("touchend", manejarFinDibujo);

document.querySelectorAll(".herramienta-btn[data-herramienta]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".herramienta-btn[data-herramienta]").forEach(b => b.classList.remove("activa"));
    btn.classList.add("activa");
    herramientaActual = btn.dataset.herramienta;
  });
});

btnDeshacer.addEventListener("click", aplicarDeshacer);
btnRehacer.addEventListener("click", aplicarRehacer);

function aplicarDeshacer() {
  const estadoAnterior = deshacer();
  if (estadoAnterior) {
    grid = estadoAnterior;
    renderTodo();
    autoguardar();
  }
}

function aplicarRehacer() {
  const estadoSiguiente = rehacer();
  if (estadoSiguiente) {
    grid = estadoSiguiente;
    renderTodo();
    autoguardar();
  }
}

document.addEventListener("keydown", (e) => {
  const ctrlOCmd = e.ctrlKey || e.metaKey;
  if (!ctrlOCmd) return;
  if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); aplicarDeshacer(); }
  else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); aplicarRehacer(); }
});

btnLimpiarLienzo.addEventListener("click", () => {
  if (grid.flat().some(c => c !== null) && !confirm("¿Borrar todo el dibujo?")) return;
  grid = crearGridVacio(gridSize);
  renderTodo();
  registrarEstado(grid);
  autoguardar();
});

selectTamano.addEventListener("change", () => {
  if (grid.flat().some(c => c !== null) && !confirm("Cambiar el tamaño del lienzo borra tu dibujo actual. ¿Continuar?")) {
    selectTamano.value = gridSize;
    return;
  }
  gridSize = parseInt(selectTamano.value, 10);
  grid = crearGridVacio(gridSize);
  cambiarTamanoGrid(gridSize);
  renderTodo();
  inicializarHistorial(grid, actualizarBotonesHistorial);
  autoguardar();
});

function actualizarTextoZoom() {
  textoZoom.textContent = obtenerZoom() + "px";
  btnZoomMas.disabled = obtenerZoom() >= ZOOM_MAX;
  btnZoomMenos.disabled = obtenerZoom() <= ZOOM_MIN;
}
btnZoomMas.addEventListener("click", () => { establecerZoom(obtenerZoom() + 4); renderTodo(); actualizarTextoZoom(); });
btnZoomMenos.addEventListener("click", () => { establecerZoom(obtenerZoom() - 4); renderTodo(); actualizarTextoZoom(); });
actualizarTextoZoom();

function seleccionarColor(hex) {
  establecerColorActual(hex);
  inputColorPicker.value = hex;
  inputHex.value = hex;
  renderPaleta();
}

function renderPaleta() {
  const paleta = obtenerPaleta();
  const colorActivo = obtenerColorActual();

  paletaGrid.innerHTML = paleta.map(color => `
    <div class="swatch ${color === colorActivo ? "activo" : ""}" style="background:${color};" data-color="${color}">
      <span class="quitar" data-quitar="${color}">✕</span>
    </div>
  `).join("") + `<div class="swatch agregar" id="btnFocoAgregar">+</div>`;

  paletaGrid.querySelectorAll(".swatch[data-color]").forEach(el => {
    el.addEventListener("click", (e) => {
      if (e.target.dataset.quitar) return;
      seleccionarColor(el.dataset.color);
    });
  });
  paletaGrid.querySelectorAll("[data-quitar]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      quitarDePaleta(el.dataset.quitar);
      renderPaleta();
    });
  });
  const btnFoco = document.getElementById("btnFocoAgregar");
  if (btnFoco) btnFoco.addEventListener("click", () => inputColorPicker.click());
}

function renderPaletaTabs() {
  const nombres = Object.keys(PALETAS_PREDETERMINADAS);
  paletaTabs.innerHTML = `<button class="paleta-tab activa" data-paleta="__personalizada__">Mi paleta</button>` +
    nombres.map(n => `<button class="paleta-tab" data-paleta="${n}">${n}</button>`).join("");

  paletaTabs.querySelectorAll(".paleta-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      paletaTabs.querySelectorAll(".paleta-tab").forEach(t => t.classList.remove("activa"));
      tab.classList.add("activa");
      const nombre = tab.dataset.paleta;
      if (nombre !== "__personalizada__") {
        cargarPaletaPredeterminada(nombre);
        renderPaleta();
      }
    });
  });
}

btnAgregarColor.addEventListener("click", () => {
  const hex = normalizarHex(inputHex.value || inputColorPicker.value);
  if (!hex) { alert("Ese código no es un HEX válido. Usa el formato #RRGGBB."); return; }
  agregarAPaleta(hex);
  seleccionarColor(hex);
});

inputColorPicker.addEventListener("input", () => { inputHex.value = inputColorPicker.value; });
inputHex.addEventListener("change", () => {
  const hex = normalizarHex(inputHex.value);
  if (hex) seleccionarColor(hex);
});

renderPaleta();
renderPaletaTabs();

btnExportarPng.addEventListener("click", () => {
  const multiplicador = parseInt(selectMultiplicador.value, 10);
  exportarComoPng(grid, gridSize, multiplicador, "oxygenmedia-pixel-art.png");
});

// ============ IMPORTAR IMAGEN A PIXEL ART ============

const zonaImagen = document.getElementById("zonaImagen");
const inputArchivoImagen = document.getElementById("inputArchivoImagen");
const btnElegirArchivo = document.getElementById("btnElegirArchivo");
const inputUrlImagen = document.getElementById("inputUrlImagen");
const btnCargarUrl = document.getElementById("btnCargarUrl");
const panelImagenCargada = document.getElementById("panelImagenCargada");
const infoImagenCargada = document.getElementById("infoImagenCargada");
const infoColoresDetectados = document.getElementById("infoColoresDetectados");
const canvasPreviaImagen = document.getElementById("canvasPreviaImagen");
const selectAjusteImagen = document.getElementById("selectAjusteImagen");
const selectTamanoImagen = document.getElementById("selectTamanoImagen");
const selectModoColor = document.getElementById("selectModoColor");
const checkDithering = document.getElementById("checkDithering");
const rangoBrillo = document.getElementById("rangoBrillo");
const rangoContraste = document.getElementById("rangoContraste");
const rangoSaturacion = document.getElementById("rangoSaturacion");
const btnAplicarImagen = document.getElementById("btnAplicarImagen");
const btnCancelarImagen = document.getElementById("btnCancelarImagen");

let imagenActual = null;
let resultadoImagenActual = null; // { grid, colores } — lo último calculado para la previsualización
const ZOOM_PREVIA_MAX = 12;

btnElegirArchivo.addEventListener("click", () => inputArchivoImagen.click());
inputArchivoImagen.addEventListener("change", () => {
  const archivo = inputArchivoImagen.files[0];
  if (archivo) manejarArchivoImagen(archivo);
});

["dragover", "dragenter"].forEach(evento => {
  zonaImagen.addEventListener(evento, (e) => { e.preventDefault(); zonaImagen.classList.add("arrastrando"); });
});
["dragleave", "dragend"].forEach(evento => {
  zonaImagen.addEventListener(evento, () => zonaImagen.classList.remove("arrastrando"));
});
zonaImagen.addEventListener("drop", (e) => {
  e.preventDefault();
  zonaImagen.classList.remove("arrastrando");
  const archivo = e.dataTransfer.files && e.dataTransfer.files[0];
  if (archivo) manejarArchivoImagen(archivo);
});

async function manejarArchivoImagen(archivo) {
  try {
    const img = await cargarImagenDesdeArchivo(archivo);
    mostrarImagenCargada(img, archivo.name);
  } catch (err) {
    alert(err.message);
  }
}

btnCargarUrl.addEventListener("click", async () => {
  const url = inputUrlImagen.value.trim();
  if (!url) return;
  btnCargarUrl.disabled = true;
  try {
    const img = await cargarImagenDesdeUrl(url);
    mostrarImagenCargada(img, url);
  } catch (err) {
    alert(err.message);
  } finally {
    btnCargarUrl.disabled = false;
  }
});

function mostrarImagenCargada(img, nombre) {
  imagenActual = img;
  selectTamanoImagen.value = String(gridSize); // por defecto, igual al lienzo actual
  infoImagenCargada.textContent = `${nombre} — ${img.naturalWidth || img.width}×${img.naturalHeight || img.height}px`;
  panelImagenCargada.classList.remove("oculto");
  recalcularPreviaImagen();
}

function leerOpcionesImagen() {
  const modo = selectModoColor.value;
  return {
    ajuste: selectAjusteImagen.value,
    numColores: (modo === "paleta" || modo === "ilimitado") ? null : parseInt(modo, 10),
    paletaFija: modo === "paleta" ? obtenerPaleta() : null,
    dither: checkDithering.checked && modo !== "ilimitado",
    brillo: parseInt(rangoBrillo.value, 10),
    contraste: parseInt(rangoContraste.value, 10),
    saturacion: parseInt(rangoSaturacion.value, 10)
  };
}

let temporizadorPreviaImagen = null;
function recalcularPreviaImagen() {
  clearTimeout(temporizadorPreviaImagen);
  temporizadorPreviaImagen = setTimeout(() => {
    if (!imagenActual) return;
    const tamanoImagen = parseInt(selectTamanoImagen.value, 10);
    resultadoImagenActual = convertirImagenAGrid(imagenActual, tamanoImagen, leerOpcionesImagen());
    dibujarPreviaImagen(resultadoImagenActual.grid, tamanoImagen);
    const nColores = resultadoImagenActual.colores.length;
    infoColoresDetectados.textContent = `${nColores} color${nColores === 1 ? "" : "es"} en el resultado`;
  }, 120);
}

function dibujarPreviaImagen(grid, tamano) {
  const zoomPrevia = Math.max(2, Math.min(ZOOM_PREVIA_MAX, Math.floor(280 / tamano)));
  canvasPreviaImagen.width = tamano * zoomPrevia;
  canvasPreviaImagen.height = tamano * zoomPrevia;
  const ctx = canvasPreviaImagen.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvasPreviaImagen.width, canvasPreviaImagen.height);
  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      const color = grid[y][x];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * zoomPrevia, y * zoomPrevia, zoomPrevia, zoomPrevia);
      }
    }
  }
}

[selectAjusteImagen, selectTamanoImagen, selectModoColor].forEach(el => el.addEventListener("change", recalcularPreviaImagen));
checkDithering.addEventListener("change", recalcularPreviaImagen);
[rangoBrillo, rangoContraste, rangoSaturacion].forEach(el => el.addEventListener("input", recalcularPreviaImagen));

selectModoColor.addEventListener("change", () => {
  checkDithering.disabled = selectModoColor.value === "ilimitado";
});

btnCancelarImagen.addEventListener("click", cerrarPanelImagen);

function cerrarPanelImagen() {
  imagenActual = null;
  resultadoImagenActual = null;
  panelImagenCargada.classList.add("oculto");
  inputArchivoImagen.value = "";
  inputUrlImagen.value = "";
}

btnAplicarImagen.addEventListener("click", () => {
  if (!resultadoImagenActual) return;
  if (grid.flat().some(c => c !== null) && !confirm("Esto reemplaza tu dibujo actual en el lienzo. ¿Continuar?")) return;

  const tamanoImagen = parseInt(selectTamanoImagen.value, 10);
  const { grid: gridNuevo, colores } = resultadoImagenActual;

  gridSize = tamanoImagen;
  grid = gridNuevo;
  selectTamano.value = String(gridSize);
  cambiarTamanoGrid(gridSize);
  renderTodo();
  inicializarHistorial(grid, actualizarBotonesHistorial);

  const modo = selectModoColor.value;
  if (modo !== "paleta" && modo !== "ilimitado" && colores.length) {
    if (confirm("¿Reemplazar tu paleta con los colores detectados en la imagen? Así puedes seguir editando con los mismos tonos.")) {
      establecerPaleta(colores);
      renderPaleta();
    }
  }

  autoguardar();
  cerrarPanelImagen();
});

let temporizadorGuardado = null;
function autoguardar() {
  clearTimeout(temporizadorGuardado);
  temporizadorGuardado = setTimeout(() => {
    guardarProyectoActual(gridSize, grid);
    actualizarTextoEstadoGuardado(0);
  }, 500);
}

function actualizarTextoEstadoGuardado(segundos) {
  estadoGuardado.textContent = segundos < 5 ? "· Guardado" : `· Guardado hace ${segundos}s`;
}

setInterval(() => {
  const proyecto = cargarProyectoActual();
  if (proyecto) actualizarTextoEstadoGuardado(segundosDesdeUltimoGuardado(proyecto.fecha));
}, 3000);
