// pixel-storage.js
// Guardado local del proyecto actual (Prioridad 1: que cerrar la pestaña no
// pierda el trabajo). El sistema completo de "proyectos recientes" con
// nombres/duplicar/eliminar (sección 13 del pedido) es Prioridad 3 — este
// módulo ya deja lista la base (guardar/cargar un proyecto por clave) para
// que ampliarlo más adelante sea agregar funciones aquí, no reescribir nada.

const CLAVE_PROYECTO_ACTUAL = "oxygenmedia_pixel_proyecto_actual";

export function guardarProyectoActual(gridSize, grid) {
  const datos = { gridSize, grid, fecha: Date.now() };
  try {
    localStorage.setItem(CLAVE_PROYECTO_ACTUAL, JSON.stringify(datos));
    return true;
  } catch (e) {
    // localStorage lleno o deshabilitado (modo privado, etc.) — no es crítico,
    // el usuario solo pierde el autoguardado, no la sesión de dibujo actual.
    return false;
  }
}

export function cargarProyectoActual() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_PROYECTO_ACTUAL));
    if (!datos || !datos.grid || !datos.gridSize) return null;
    return datos;
  } catch {
    return null;
  }
}

export function borrarProyectoActual() {
  localStorage.removeItem(CLAVE_PROYECTO_ACTUAL);
}

export function segundosDesdeUltimoGuardado(fechaGuardado) {
  return Math.floor((Date.now() - fechaGuardado) / 1000);
}
