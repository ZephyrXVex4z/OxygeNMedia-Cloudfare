// pixel-color.js
// Todo lo relacionado a color: la paleta activa, el color actualmente
// seleccionado, conversión HEX/RGB, y la lista de "colores recientes" que se
// actualiza sola conforme el usuario pinta.

const PALETA_INICIAL = [
  "#5b8def", "#8b5cf6", "#e0a941", "#4caf7d", "#e35d5d",
  "#ffffff", "#1a2233", "#0f1420", "#ff9db8", "#00e5ff"
];

const LIMITE_RECIENTES = 10;

let paleta = [...PALETA_INICIAL];
let recientes = [];
let colorActual = "#5b8def";

export function obtenerPaleta() { return paleta; }
export function obtenerRecientes() { return recientes; }
export function obtenerColorActual() { return colorActual; }

export function establecerColorActual(hex) {
  colorActual = hex;
  agregarAReciente(hex);
}

function agregarAReciente(hex) {
  recientes = [hex, ...recientes.filter(c => c !== hex)].slice(0, LIMITE_RECIENTES);
}

export function agregarAPaleta(hex) {
  if (!paleta.includes(hex)) paleta.push(hex);
}

// Reemplaza la paleta completa (usado, por ejemplo, al importar una imagen y
// querer trabajar con los colores detectados en ella).
export function establecerPaleta(colores) {
  paleta = [...new Set(colores)];
}

export function quitarDePaleta(hex) {
  paleta = paleta.filter(c => c !== hex);
}

export function reordenarPaleta(indiceOrigen, indiceDestino) {
  const [item] = paleta.splice(indiceOrigen, 1);
  paleta.splice(indiceDestino, 0, item);
}

export function normalizarHex(valor) {
  let v = (valor || "").trim();
  if (!v.startsWith("#")) v = "#" + v;
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
}

export function hexARgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbAHex(r, g, b) {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}

// ============ PALETAS PREDETERMINADAS (sección 2 del pedido) ============
export const PALETAS_PREDETERMINADAS = {
  "Nature":     ["#2d5a27", "#4a7c3c", "#8bc34a", "#c5e1a5", "#795548", "#5d4037", "#8d6e63", "#3e2723"],
  "Ocean":      ["#01579b", "#0288d1", "#4fc3f7", "#b3e5fc", "#004d40", "#00897b", "#4db6ac", "#ffffff"],
  "Fire":       ["#b71c1c", "#e53935", "#ff7043", "#ffb74d", "#ffe082", "#3e0000", "#1a0000", "#fff3e0"],
  "Retro":      ["#0f380f", "#306230", "#8bac0f", "#9bbc0f", "#e0f8cf", "#081820", "#346856", "#88c070"],
  "Pastel":     ["#ffd1dc", "#ffe4b5", "#e0bbff", "#b5ead7", "#c7ceea", "#fff0f5", "#f0fff0", "#e6e6fa"],
  "Dark":       ["#0d0d0d", "#1a1a1a", "#333333", "#4d4d4d", "#666666", "#808080", "#b3b3b3", "#e6e6e6"],
  "Cyberpunk":  ["#ff00c8", "#7000ff", "#00e5ff", "#f0ff00", "#0f0f1a", "#ff2079", "#05d9e8", "#d1f7ff"],
  "Monochrome": ["#000000", "#1c1c1c", "#383838", "#545454", "#707070", "#8c8c8c", "#c8c8c8", "#ffffff"]
};

export function cargarPaletaPredeterminada(nombre) {
  if (!PALETAS_PREDETERMINADAS[nombre]) return;
  paleta = [...PALETAS_PREDETERMINADAS[nombre]];
}

// ============ GUARDAR / CARGAR PALETAS PERSONALIZADAS (localStorage) ============

const CLAVE_PALETAS_GUARDADAS = "oxygenmedia_pixel_paletas";

export function guardarPaletaPersonalizada(nombre) {
  const guardadas = obtenerPaletasGuardadas();
  guardadas[nombre] = [...paleta];
  localStorage.setItem(CLAVE_PALETAS_GUARDADAS, JSON.stringify(guardadas));
}

export function obtenerPaletasGuardadas() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PALETAS_GUARDADAS)) || {};
  } catch {
    return {};
  }
}

export function cargarPaletaGuardada(nombre) {
  const guardadas = obtenerPaletasGuardadas();
  if (guardadas[nombre]) paleta = [...guardadas[nombre]];
}

export function eliminarPaletaGuardada(nombre) {
  const guardadas = obtenerPaletasGuardadas();
  delete guardadas[nombre];
  localStorage.setItem(CLAVE_PALETAS_GUARDADAS, JSON.stringify(guardadas));
}

export function renombrarPaletaGuardada(nombreViejo, nombreNuevo) {
  const guardadas = obtenerPaletasGuardadas();
  if (guardadas[nombreViejo]) {
    guardadas[nombreNuevo] = guardadas[nombreViejo];
    delete guardadas[nombreViejo];
    localStorage.setItem(CLAVE_PALETAS_GUARDADAS, JSON.stringify(guardadas));
  }
}
