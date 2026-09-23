// pixel-historial.js
// Sistema de deshacer/rehacer. Guarda "snapshots" del estado del grid completo
// en cada acción confirmada (no en cada pixel individual mientras se arrastra el
// mouse, para no llenar el historial de cientos de pasos por un solo trazo).
//
// Modular a propósito (sección 20 del pedido): el resto del editor nunca toca
// el arreglo de historial directamente, solo llama a estas funciones — así,
// si el día de mañana se cambia cómo se guarda el estado (por capas, por
// ejemplo), este archivo es el único que hay que tocar.

const LIMITE_HISTORIAL = 60; // pasos máximos guardados, para no crecer sin límite

let pila = [];       // estados pasados (el último es el actual)
let pilaRehacer = []; // estados deshechos, listos para rehacer
let onCambio = null;  // callback que se llama cada vez que el estado disponible cambia (para actualizar botones)

export function inicializarHistorial(estadoInicial, callbackCambio) {
  pila = [clonarEstado(estadoInicial)];
  pilaRehacer = [];
  onCambio = callbackCambio;
  notificar();
}

function clonarEstado(estado) {
  // El grid es un array 2D de strings/null — JSON.parse/stringify es suficiente
  // y más simple que una copia profunda manual para esta forma de dato.
  return JSON.parse(JSON.stringify(estado));
}

// Se llama DESPUÉS de completar una acción (soltar el mouse tras pintar, terminar
// un relleno, etc.) — nunca en cada pixel individual de un arrastre continuo.
export function registrarEstado(estadoNuevo) {
  pila.push(clonarEstado(estadoNuevo));
  if (pila.length > LIMITE_HISTORIAL) pila.shift();
  pilaRehacer = []; // cualquier acción nueva invalida el futuro "rehacer" anterior
  notificar();
}

export function deshacer() {
  if (pila.length <= 1) return null; // no hay nada antes del estado actual
  const actual = pila.pop();
  pilaRehacer.push(actual);
  notificar();
  return clonarEstado(pila[pila.length - 1]);
}

export function rehacer() {
  if (pilaRehacer.length === 0) return null;
  const siguiente = pilaRehacer.pop();
  pila.push(siguiente);
  notificar();
  return clonarEstado(siguiente);
}

export function puedeDeshacer() { return pila.length > 1; }
export function puedeRehacer() { return pilaRehacer.length > 0; }

function notificar() {
  if (onCambio) onCambio({ puedeDeshacer: puedeDeshacer(), puedeRehacer: puedeRehacer() });
}
