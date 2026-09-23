// pixel-canvas.js
// Todo lo relacionado a DIBUJAR el estado en pantalla y traducir eventos de
// mouse/touch a coordenadas de celda del grid. Este módulo no sabe nada de
// herramientas ni de colores — solo sabe pintar un grid[y][x] en un <canvas>,
// con zoom, y decir "el cursor está en la celda (x,y)".

let canvas, ctx, wrapEl;
let gridSize = 24;
let zoom = 16; // píxeles de pantalla por celda de grid — este es el "zoom"
let panX = 0, panY = 0; // desplazamiento del lienzo dentro de su contenedor (para "mover/panear")

export const ZOOM_MIN = 4;
export const ZOOM_MAX = 64;

export function inicializarCanvas(canvasEl, wrapperEl, tamanoGrid) {
  canvas = canvasEl;
  wrapEl = wrapperEl;
  gridSize = tamanoGrid;
  ctx = canvas.getContext("2d");
  // Clave para que el pixel art se vea nítido y no borroso al escalar: apagar
  // cualquier suavizado del navegador, tanto en el contexto de edición como en
  // cualquier canvas de exportación que se cree después.
  ctx.imageSmoothingEnabled = false;
  redimensionar();
}

export function cambiarTamanoGrid(nuevoTamano) {
  gridSize = nuevoTamano;
  redimensionar();
}

export function obtenerGridSize() { return gridSize; }

function redimensionar() {
  const dpr = window.devicePixelRatio || 1;
  const ladoCss = gridSize * zoom;
  canvas.width = ladoCss * dpr;
  canvas.height = ladoCss * dpr;
  canvas.style.width = ladoCss + "px";
  canvas.style.height = ladoCss + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

export function establecerZoom(nuevoZoom) {
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nuevoZoom));
  redimensionar();
  return zoom;
}

export function obtenerZoom() { return zoom; }

// Dibuja el grid completo. "mostrarLineas"/"opacidadLineas" controlan la
// cuadrícula (sección 3 del pedido); "capasVisibles" es un array de grids (una
// por capa, de abajo a arriba) para cuando el sistema de capas esté activo —
// en modo simple (Prioridad 1) solo se pasa una capa.
export function dibujar(capasVisibles, opciones = {}) {
  const { mostrarLineas = true, opacidadLineas = 0.08 } = opciones;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const grid of capasVisibles) {
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const color = grid[y] && grid[y][x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        }
      }
    }
  }

  if (mostrarLineas && zoom >= 6) { // por debajo de 6px las líneas solo ensucian la vista
    ctx.strokeStyle = `rgba(255,255,255,${opacidadLineas})`;
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * zoom + 0.5, 0); ctx.lineTo(i * zoom + 0.5, gridSize * zoom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * zoom + 0.5); ctx.lineTo(gridSize * zoom, i * zoom + 0.5);
      ctx.stroke();
    }
  }
}

// Traduce un evento de mouse/touch a coordenadas de celda (x,y) del grid.
export function celdaDesdeEvento(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const x = Math.floor((clientX - rect.left) / zoom);
  const y = Math.floor((clientY - rect.top) / zoom);
  return { x, y };
}

export function dentroDelGrid(x, y) {
  return x >= 0 && y >= 0 && x < gridSize && y < gridSize;
}
