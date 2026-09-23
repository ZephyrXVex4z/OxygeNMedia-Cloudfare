// pixel-herramientas.js
// Cada herramienta es una función pura que recibe el grid y una celda, y
// devuelve si el grid cambió (para saber si vale la pena registrar un paso de
// historial). Mantenerlas aquí, separadas del canvas y de los eventos de
// mouse/touch, es lo que permite agregar nuevas herramientas (línea, rectángulo,
// círculo — Prioridad 2/3) sin tocar el código de renderizado ni de historial.

export const HERRAMIENTAS = {
  LAPIZ: "lapiz",
  BORRADOR: "borrador",
  RELLENO: "relleno",
  GOTERO: "gotero"
};

export function pintarCelda(grid, x, y, color) {
  if (grid[y][x] === color) return false;
  grid[y][x] = color;
  return true;
}

export function borrarCelda(grid, x, y) {
  if (grid[y][x] === null) return false;
  grid[y][x] = null;
  return true;
}

export function copiarColor(grid, x, y) {
  return grid[y][x] || null;
}

// Relleno tipo "cubeta de pintura": pinta la celda y todas sus vecinas
// contiguas del MISMO color original (búsqueda en anchura con pila).
export function rellenarArea(grid, xInicial, yInicial, colorNuevo, gridSize) {
  const colorObjetivo = grid[yInicial][xInicial];
  if (colorObjetivo === colorNuevo) return false;

  const pila = [[xInicial, yInicial]];
  const visitado = new Set();
  let cambio = false;

  while (pila.length > 0) {
    const [x, y] = pila.pop();
    const clave = x + "," + y;
    if (visitado.has(clave)) continue;
    if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;
    if (grid[y][x] !== colorObjetivo) continue;

    visitado.add(clave);
    grid[y][x] = colorNuevo;
    cambio = true;
    pila.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return cambio;
}

// Aplica la herramienta activa a una celda. Devuelve { cambio, colorCopiado }
// — colorCopiado solo es relevante para el gotero, lo usa el llamador para
// actualizar el color seleccionado en la UI.
export function aplicarHerramienta(herramienta, grid, x, y, colorActual, gridSize) {
  switch (herramienta) {
    case HERRAMIENTAS.LAPIZ:
      return { cambio: pintarCelda(grid, x, y, colorActual), colorCopiado: null };
    case HERRAMIENTAS.BORRADOR:
      return { cambio: borrarCelda(grid, x, y), colorCopiado: null };
    case HERRAMIENTAS.RELLENO:
      return { cambio: rellenarArea(grid, x, y, colorActual, gridSize), colorCopiado: null };
    case HERRAMIENTAS.GOTERO:
      return { cambio: false, colorCopiado: copiarColor(grid, x, y) };
    default:
      return { cambio: false, colorCopiado: null };
  }
}

export function crearGridVacio(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}
