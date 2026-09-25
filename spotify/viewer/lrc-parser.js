// lrc-parser.js — Importación manual de letras sincronizadas en formato .lrc.
//
// Formato esperado (estándar LRC), una línea por timestamp:
//   [00:12.34] Primera línea de la letra
//   [00:15.80] Segunda línea
// Admite varios timestamps por línea ([00:12.34][00:45.10] texto repetido) y
// metadatos [ar:], [ti:], [al:] (se ignoran para el render, no son necesarios).
//
// Las letras se guardan en localStorage, indexadas por una clave derivada de
// "artista - canción" (normalizada), para que cuando esa misma canción vuelva a
// sonar se recupere automáticamente sin tener que reimportar el archivo.
//
// NOTA: esto es intencionalmente manual — Spotify no expone letras en su API
// pública, y no hay integración con ningún proveedor de letras todavía. Cuando
// se agregue una API en el futuro, esta clave de almacenamiento y el formato de
// "letra parseada" (array de {ms, texto}) pueden reutilizarse tal cual.

const PREFIJO_CLAVE = "oxygenmedia_letra_lrc__";
const LIMITE_LETRAS_GUARDADAS = 60; // evita que localStorage crezca sin control

function normalizarClave(artista, cancion) {
  const limpiar = (s) => (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return PREFIJO_CLAVE + limpiar(artista) + "__" + limpiar(cancion);
}

// Convierte "mm:ss.xx" o "mm:ss" a milisegundos
function timestampAMs(mm, ss, cent) {
  const min = parseInt(mm, 10) || 0;
  const seg = parseInt(ss, 10) || 0;
  const centesimas = cent ? parseInt(cent.padEnd(2, "0").slice(0, 2), 10) : 0;
  return min * 60000 + seg * 1000 + centesimas * 10;
}

// Parsea el contenido crudo de un .lrc y devuelve un array ordenado
// [{ ms, texto }, ...]. Líneas sin timestamp o vacías se ignoran.
export function parsearLRC(contenido) {
  if (!contenido || typeof contenido !== "string") return [];

  const lineas = contenido.split(/\r?\n/);
  const regexTiempo = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g;
  const resultado = [];

  for (const linea of lineas) {
    const matches = [...linea.matchAll(regexTiempo)];
    if (matches.length === 0) continue; // línea de metadato u otra cosa, se ignora

    const texto = linea.replace(regexTiempo, "").trim();
    if (!texto) continue; // timestamp sin texto (silencio) — no aporta nada al render

    for (const m of matches) {
      resultado.push({ ms: timestampAMs(m[1], m[2], m[3]), texto });
    }
  }

  resultado.sort((a, b) => a.ms - b.ms);
  return resultado;
}

// Guarda una letra ya parseada para una canción específica.
export function guardarLetra(artista, cancion, letraParsedaOTextoLRC) {
  const clave = normalizarClave(artista, cancion);
  const letra = typeof letraParsedaOTextoLRC === "string"
    ? parsearLRC(letraParsedaOTextoLRC)
    : letraParsedaOTextoLRC;

  if (!letra || letra.length === 0) return false;

  try {
    localStorage.setItem(clave, JSON.stringify({ guardadoEn: Date.now(), letra }));
    limpiarSiExcedeLimite();
    return true;
  } catch {
    return false; // localStorage lleno — no es crítico, el Viewer sigue sin letra
  }
}

// Recupera la letra guardada para una canción, o null si no existe ninguna.
export function obtenerLetra(artista, cancion) {
  try {
    const raw = localStorage.getItem(normalizarClave(artista, cancion));
    if (!raw) return null;
    const datos = JSON.parse(raw);
    return Array.isArray(datos.letra) ? datos.letra : null;
  } catch {
    return null;
  }
}

export function borrarLetra(artista, cancion) {
  try { localStorage.removeItem(normalizarClave(artista, cancion)); } catch {}
}

// Lista todas las letras guardadas (para una futura pantalla de "gestionar
// letras importadas" en ajustes, si se necesita).
export function listarLetrasGuardadas() {
  const items = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (clave && clave.startsWith(PREFIJO_CLAVE)) {
        items.push(clave);
      }
    }
  } catch {}
  return items;
}

// Si se acumulan demasiadas letras guardadas, borra las más antiguas primero
// (por guardadoEn) — evita que un uso prolongado del importador llene el
// localStorage del dispositivo poco a poco.
function limpiarSiExcedeLimite() {
  try {
    const entradas = listarLetrasGuardadas().map(clave => {
      let guardadoEn = 0;
      try { guardadoEn = JSON.parse(localStorage.getItem(clave)).guardadoEn || 0; } catch {}
      return { clave, guardadoEn };
    });
    if (entradas.length <= LIMITE_LETRAS_GUARDADAS) return;

    entradas.sort((a, b) => a.guardadoEn - b.guardadoEn);
    const sobrantes = entradas.length - LIMITE_LETRAS_GUARDADAS;
    for (let i = 0; i < sobrantes; i++) localStorage.removeItem(entradas[i].clave);
  } catch {}
}

// Devuelve el índice de la línea que debería estar activa en un momento dado
// (la última cuyo timestamp ya pasó). -1 si progresoMs es anterior a la primera línea.
export function indiceLineaActiva(letra, progresoMs) {
  if (!letra || letra.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < letra.length; i++) {
    if (letra[i].ms <= progresoMs) idx = i;
    else break;
  }
  return idx;
}
