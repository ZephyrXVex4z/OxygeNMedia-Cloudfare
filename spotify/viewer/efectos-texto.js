// efectos-texto.js — Reacciona visualmente a la VELOCIDAD del texto, no solo a
// que aparezca. Se usa tanto para líneas (modo "linea") como para palabras
// individuales (modo "palabra").
//
// Idea central: convertimos "cuánto texto en cuánto tiempo" en una sola
// medida continua, `intensidad` (0..1), y a partir de ahí derivamos qué
// combinación de efectos visuales aplicar y con qué fuerza. Todo el mapeo
// vive aquí para que sea fácil de ajustar sin tocar el código de render.
//
// Estos efectos son independientes del sistema de "presets" de la Fase 4 —
// aquí solo se decide la intensidad y clase(s) por fragmento; los presets
// más adelante podrán multiplicar/escalar esta intensidad global.

// Caracteres por segundo que consideramos "ritmo normal de habla/canto" — por
// debajo de esto es lento, por encima es rápido. Calibrado para letras en
// español (más silabas por palabra que en inglés).
const CPS_LENTO = 4;   // <= esto: cadencia relajada
const CPS_NORMAL = 9;  // punto medio
const CPS_RAPIDO = 16; // >= esto: cadencia muy rápida (intensidad máxima)

// Duración mínima considerada (evita división por cero / valores absurdos
// cuando dos timestamps casi coinciden por error de LRC).
const DURACION_MINIMA_MS = 60;

// Calcula la intensidad (0..1) de un fragmento de texto dado su duración.
// texto: string ya trimeado. duracionMs: ventana de tiempo disponible.
export function calcularIntensidad(texto, duracionMs) {
  const longitud = Math.max(1, (texto || "").replace(/\s+/g, "").length);
  const duracionSeg = Math.max(DURACION_MINIMA_MS, duracionMs || DURACION_MINIMA_MS) / 1000;
  const cps = longitud / duracionSeg;

  if (cps <= CPS_LENTO) return 0;
  if (cps >= CPS_RAPIDO) return 1;
  return (cps - CPS_LENTO) / (CPS_RAPIDO - CPS_LENTO);
}

// Clasificación discreta, útil para elegir textos/joyas de UI o ramas simples
// de lógica ("lento" | "normal" | "rapido" | "muyrapido").
export function clasificarVelocidad(intensidad) {
  if (intensidad < 0.2) return "lento";
  if (intensidad < 0.5) return "normal";
  if (intensidad < 0.8) return "rapido";
  return "muyrapido";
}

// A partir de la intensidad, devuelve un objeto con los parámetros concretos
// que el CSS/JS de render debe aplicar. Todo acotado a rangos razonables para
// que nunca se vuelva ilegible o violento, tal como se pidió:
//   - a intensidad 0: prácticamente sin efecto (fade suave).
//   - a intensidad 1: shake sutil + glow + tracking ligeramente comprimido,
//     nunca rotaciones grandes ni blur pesado que dificulten leer.
export function parametrosEfecto(intensidad) {
  const i = Math.max(0, Math.min(1, intensidad));

  return {
    intensidad: i,
    // Duración de la transición de entrada de la palabra/línea: más rápido
    // cuanto mayor la intensidad (letra rápida = transiciones más cortas).
    duracionTransicionMs: Math.round(320 - i * 200), // 320ms → 120ms
    // Escala de "pulse" al activarse (siempre sutil: 1.0 → máx 1.08).
    escalaPulse: 1 + i * 0.08,
    // Desplazamiento vertical sutil en el pulse.
    desplazamientoPx: 1 + i * 2.5,
    // Shake: solo aparece a partir de intensidad media, y es siempre pequeño.
    shakeAmplitudPx: i > 0.55 ? (i - 0.55) / 0.45 * 1.6 : 0,
    // Glow: crece con la intensidad, nunca satura el texto.
    glowIntensidad: 0.15 + i * 0.5,
    // Tracking (letter-spacing) ligeramente más apretado en fragmentos muy
    // rápidos, sugiere urgencia sin sacrificar legibilidad.
    trackingEm: -i * 0.01,
    // Blur de "motion" simulado: solo perceptible en fragmentos muy rápidos y
    // siempre por debajo de 1px para no volver el texto ilegible.
    motionBlurPx: i > 0.75 ? (i - 0.75) / 0.25 * 0.7 : 0,
    clase: clasificarVelocidad(i)
  };
}

// Aplica los parámetros calculados a un elemento del DOM como variables CSS
// inline — el CSS del viewer las consume (ver .np-letra-linea / .np-palabra
// en viewer.css) sin que este módulo necesite conocer el resto de estilos.
export function aplicarEfectoAElemento(el, params) {
  if (!el || !params) return;
  el.style.setProperty("--fx-duracion", params.duracionTransicionMs + "ms");
  el.style.setProperty("--fx-escala", params.escalaPulse.toFixed(3));
  el.style.setProperty("--fx-desplazamiento", params.desplazamientoPx.toFixed(2) + "px");
  el.style.setProperty("--fx-shake", params.shakeAmplitudPx.toFixed(2) + "px");
  el.style.setProperty("--fx-glow", params.glowIntensidad.toFixed(3));
  el.style.setProperty("--fx-tracking", params.trackingEm.toFixed(4) + "em");
  el.style.setProperty("--fx-blur", params.motionBlurPx.toFixed(2) + "px");
  el.dataset.fxVelocidad = params.clase;
}

// Conveniencia: calcula intensidad + parámetros y los aplica en un solo paso,
// dado un fragmento { texto, ms, msFin } y el elemento del DOM que lo representa.
export function aplicarEfectoAFragmento(el, fragmento) {
  if (!fragmento || fragmento.ms == null || fragmento.msFin == null) {
    if (el) {
      el.style.removeProperty("--fx-shake");
      el.dataset.fxVelocidad = "sinsync";
    }
    return;
  }
  const duracionMs = fragmento.msFin - fragmento.ms;
  const intensidad = calcularIntensidad(fragmento.texto, duracionMs);
  aplicarEfectoAElemento(el, parametrosEfecto(intensidad));
}
