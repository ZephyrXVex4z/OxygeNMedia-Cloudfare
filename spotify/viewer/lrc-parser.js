// lrc-parser.js — Importación de letras sincronizadas: .lrc, .txt o texto pegado.
//
// Soporta tres niveles de sincronización, detectados automáticamente:
//
//   1) Por PALABRA/fragmento (LRC "enhanced"):
//        [00:12.50]Esta [00:12.80]es [00:13.00]una [00:13.30]línea
//      Cada línea resultante trae también un array `palabras` con el texto y
//      el ms de inicio de cada fragmento, más `msFin` (inicio de la palabra
//      siguiente, o el de la línea siguiente si es la última palabra).
//
//   2) Por LÍNEA (LRC estándar):
//        [00:12.50]Esta es una línea
//      Cada línea trae ms de inicio; `msFin` se calcula como el inicio de la
//      línea siguiente (o +4000ms si es la última), y NO trae `palabras`.
//
//   3) Sin sincronización (texto plano / .txt / pegado sin timestamps):
//      Se devuelve como líneas con `ms: null` — el viewer las muestra tal
//      cual, sin inventar una sincronización falsa. El usuario puede fijar
//      manualmente una duración total desde ajustes (ver `aplicarDuracionManual`).
//
// Todo resultado parseado usa la misma forma de línea:
//   { ms, msFin, texto, palabras }
//   - ms: number | null      → inicio de la línea (null = sin sync)
//   - msFin: number | null   → fin estimado de la línea
//   - texto: string          → texto completo de la línea (para modo por línea)
//   - palabras: Array|null  → [{ texto, ms, msFin }] si hay sync por palabra, si no null
//
// Compatibilidad: código existente que solo lee `{ ms, texto }` sigue
// funcionando sin cambios — esos dos campos nunca se quitan ni cambian de tipo
// cuando hay sincronización.
//
// parsearLRC() ahora devuelve { modo, lineas } en vez de un array plano
// (antes devolvía directamente el array). Todo el código de este proyecto que
// consume el resultado se actualiza en esta misma entrega para leer
// `.lineas`; guardarLetra()/obtenerLetra() hacen lo mismo internamente.
//
// Las letras se guardan en localStorage, indexadas por una clave derivada de
// "artista - canción" (normalizada), para que cuando esa misma canción vuelva
// a sonar se recupere automáticamente sin tener que reimportar el archivo.

const PREFIJO_CLAVE = "oxygenmedia_letra_lrc__";
const LIMITE_LETRAS_GUARDADAS = 60; // evita que localStorage crezca sin control
const DURACION_ASUMIDA_ULTIMA_LINEA_MS = 4000; // si no hay línea siguiente para calcular msFin

function normalizarClave(artista, cancion) {
  const limpiar = (s) => (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return PREFIJO_CLAVE + limpiar(artista) + "__" + limpiar(cancion);
}

// Convierte "mm:ss.xx", "mm:ss.xxx" o "mm:ss" a milisegundos. Tolera 1-3
// dígitos de fracción (centésimas o milisegundos) y minutos de 1+ dígitos.
function timestampAMs(mm, ss, frac) {
  const min = parseInt(mm, 10) || 0;
  const seg = parseInt(ss, 10) || 0;
  let ms = 0;
  if (frac) {
    // Normaliza a milisegundos exactos sin importar si venían 1, 2 o 3 dígitos.
    const tresDigitos = frac.padEnd(3, "0").slice(0, 3);
    ms = parseInt(tresDigitos, 10);
  }
  return min * 60000 + seg * 1000 + ms;
}

// Etiquetas de metadata LRC estándar — se detectan y se descartan del texto,
// nunca se muestran como si fueran letra.
const CLAVES_METADATA = new Set([
  "ar", "ti", "al", "by", "offset", "re", "ve", "length", "au", "kana"
]);

const REGEX_TIEMPO = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const REGEX_METADATA = /^\[([a-zA-Z]+):(.*)\]$/;

function esLineaSoloMetadata(lineaOriginal) {
  const m = lineaOriginal.trim().match(REGEX_METADATA);
  if (!m) return false;
  return CLAVES_METADATA.has(m[1].toLowerCase());
}

// Parsea el contenido crudo de un .lrc/.txt/texto pegado y devuelve:
//   { modo: "palabra" | "linea" | "plano", lineas: [...] }
//
// - "palabra": al menos una línea trae texto no vacío *entre* dos timestamps
//   consecutivos → hay sincronización por fragmento, se rellena `palabras`.
// - "linea": cada línea empieza con uno o más timestamps seguidos de todo el
//   texto, sin timestamps intermedios con texto propio.
// - "plano": no se encontró ningún timestamp en todo el contenido → texto tal
//   cual, línea por línea, sin inventar sincronización.
export function parsearLRC(contenido) {
  if (!contenido || typeof contenido !== "string") {
    return { modo: "plano", lineas: [] };
  }

  // Tolerar BOM UTF-8 y distintos finales de línea.
  const limpio = contenido.replace(/^\uFEFF/, "");
  const lineasCrudas = limpio.split(/\r\n|\r|\n/);

  // Por cada línea con al menos un timestamp: sus timestamps (ms + posición
  // donde termina el tag en el string) y el texto completo sin tags.
  const lineasConTiempo = [];
  const lineasPlanas = [];
  let huboAlgunTimestamp = false;

  for (const lineaOriginal of lineasCrudas) {
    const linea = lineaOriginal.trim();
    if (!linea) continue; // línea vacía — se ignora, no aporta al render
    if (esLineaSoloMetadata(linea)) continue; // [ar:], [ti:], etc. — nunca es letra

    const regexLocal = new RegExp(REGEX_TIEMPO.source, "g");
    const matches = [...linea.matchAll(regexLocal)];
    if (matches.length === 0) {
      lineasPlanas.push(linea);
      continue;
    }

    huboAlgunTimestamp = true;

    const tiempos = matches.map(m => ({
      ms: timestampAMs(m[1], m[2], m[3]),
      inicioTag: m.index,
      finTag: m.index + m[0].length
    }));

    const textoCompleto = linea.replace(regexLocal, "").trim();

    lineasConTiempo.push({ lineaOriginal: linea, tiempos, textoCompleto });
  }

  if (!huboAlgunTimestamp) {
    // Modo plano: cada línea no vacía se muestra tal cual, sin ms.
    return {
      modo: "plano",
      lineas: lineasPlanas
        .filter(Boolean)
        .map(texto => ({ ms: null, msFin: null, texto, palabras: null }))
    };
  }

  // Detectar si es sincronización por palabra: en al menos una línea, el
  // texto entre dos timestamps consecutivos (fin del tag i → inicio del tag
  // i+1) no está vacío.
  let esPorPalabra = false;
  for (const l of lineasConTiempo) {
    if (l.tiempos.length < 2) continue;
    for (let i = 0; i < l.tiempos.length - 1; i++) {
      const fragmento = l.lineaOriginal.slice(l.tiempos[i].finTag, l.tiempos[i + 1].inicioTag).trim();
      if (fragmento) { esPorPalabra = true; break; }
    }
    if (esPorPalabra) break;
  }

  if (esPorPalabra) {
    return { modo: "palabra", lineas: construirLineasPorPalabra(lineasConTiempo) };
  }

  return { modo: "linea", lineas: construirLineasPorLinea(lineasConTiempo) };
}

function construirLineasPorLinea(lineasConTiempo) {
  // Una línea puede tener varios timestamps repetidos apuntando al mismo
  // texto (coro repetido): [00:12][00:45] Estribillo → dos líneas resultantes
  // con el mismo texto, cada una en su ms.
  const resultado = [];
  for (const l of lineasConTiempo) {
    if (!l.textoCompleto) continue; // timestamp sin texto (silencio) — se ignora
    for (const t of l.tiempos) {
      resultado.push({ ms: t.ms, texto: l.textoCompleto });
    }
  }
  resultado.sort((a, b) => a.ms - b.ms);

  // Calcular msFin de cada línea = inicio de la siguiente línea.
  return resultado.map((linea, i) => {
    const siguiente = resultado[i + 1];
    const msFin = siguiente ? siguiente.ms : linea.ms + DURACION_ASUMIDA_ULTIMA_LINEA_MS;
    return { ms: linea.ms, msFin, texto: linea.texto, palabras: null };
  });
}

function construirLineasPorPalabra(lineasConTiempo) {
  const previas = [];

  for (const l of lineasConTiempo) {
    const palabras = [];
    for (let i = 0; i < l.tiempos.length; i++) {
      const t = l.tiempos[i];
      const finFragmento = l.tiempos[i + 1] ? l.tiempos[i + 1].inicioTag : l.lineaOriginal.length;
      const texto = l.lineaOriginal.slice(t.finTag, finFragmento).trim();
      if (!texto) continue; // timestamp sin fragmento propio — se salta
      palabras.push({ texto, ms: t.ms, msFin: null });
    }
    if (palabras.length === 0) continue;

    for (let i = 0; i < palabras.length - 1; i++) {
      palabras[i].msFin = palabras[i + 1].ms;
    }

    previas.push({
      ms: palabras[0].ms,
      texto: palabras.map(p => p.texto).join(" "),
      palabras
    });
  }

  previas.sort((a, b) => a.ms - b.ms);

  return previas.map((linea, i) => {
    const siguiente = previas[i + 1];
    const ultima = linea.palabras[linea.palabras.length - 1];
    const msFinLinea = siguiente ? siguiente.ms : linea.ms + DURACION_ASUMIDA_ULTIMA_LINEA_MS;
    // La última palabra de la línea, si no tenía ya un fin propio (sí lo
    // tiene si había otro timestamp repetido pegado al final), termina
    // cuando empieza la línea siguiente.
    if (ultima.msFin == null) ultima.msFin = msFinLinea;

    return { ms: linea.ms, msFin: msFinLinea, texto: linea.texto, palabras: linea.palabras };
  });
}

// Permite al usuario fijar manualmente una duración total para letra en modo
// "plano" (sin timestamps), repartiendo el tiempo de forma proporcional a la
// longitud de cada línea. No es sincronización real, es una aproximación
// explícitamente pedida por el usuario — nunca se activa automáticamente.
export function aplicarDuracionManual(lineasPlanas, duracionTotalMs) {
  if (!Array.isArray(lineasPlanas) || lineasPlanas.length === 0) return lineasPlanas;
  if (!duracionTotalMs || duracionTotalMs <= 0) return lineasPlanas;

  const totalCaracteres = lineasPlanas.reduce((acc, l) => acc + Math.max(1, l.texto.length), 0);
  let acumulado = 0;
  return lineasPlanas.map(l => {
    const proporcion = Math.max(1, l.texto.length) / totalCaracteres;
    const duracion = proporcion * duracionTotalMs;
    const ms = acumulado;
    acumulado += duracion;
    return { ...l, ms: Math.round(ms), msFin: Math.round(acumulado) };
  });
}

// ============ PERSISTENCIA ============

// Guarda una letra ya parseada (objeto { modo, lineas }) o texto crudo de LRC
// para una canción específica.
export function guardarLetra(artista, cancion, letraParseadaOTextoLRC) {
  const clave = normalizarClave(artista, cancion);
  const paquete = typeof letraParseadaOTextoLRC === "string"
    ? parsearLRC(letraParseadaOTextoLRC)
    : letraParseadaOTextoLRC;

  if (!paquete || !Array.isArray(paquete.lineas) || paquete.lineas.length === 0) return false;

  try {
    localStorage.setItem(clave, JSON.stringify({
      guardadoEn: Date.now(),
      modo: paquete.modo,
      lineas: paquete.lineas
    }));
    limpiarSiExcedeLimite();
    return true;
  } catch {
    return false; // localStorage lleno — no es crítico, el Viewer sigue sin letra
  }
}

// Recupera la letra guardada para una canción, o null si no existe ninguna.
// Devuelve { modo, lineas } — mismo formato que parsearLRC().
export function obtenerLetra(artista, cancion) {
  try {
    const raw = localStorage.getItem(normalizarClave(artista, cancion));
    if (!raw) return null;
    const datos = JSON.parse(raw);
    if (!Array.isArray(datos.lineas)) return null;
    return { modo: datos.modo || "linea", lineas: datos.lineas };
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

// ============ CONSULTA EN TIEMPO REAL ============

// Devuelve el índice de la línea que debería estar activa en un momento dado
// (la última cuyo ms ya pasó). -1 si progresoMs es anterior a la primera
// línea o si las líneas no tienen timestamp (modo "plano").
export function indiceLineaActiva(lineas, progresoMs) {
  if (!lineas || lineas.length === 0) return -1;
  if (lineas[0].ms == null) return -1; // modo plano, sin sync real
  let idx = -1;
  for (let i = 0; i < lineas.length; i++) {
    if (lineas[i].ms <= progresoMs) idx = i;
    else break;
  }
  return idx;
}

// Devuelve el índice del fragmento/palabra activa dentro de una línea con
// sincronización por palabra, o -1 si la línea no tiene `palabras` o el
// progreso todavía no llegó a la primera palabra.
export function indicePalabraActiva(linea, progresoMs) {
  if (!linea || !Array.isArray(linea.palabras) || linea.palabras.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < linea.palabras.length; i++) {
    if (linea.palabras[i].ms <= progresoMs) idx = i;
    else break;
  }
  return idx;
}

// Progreso 0..1 dentro de la palabra activa (para animaciones de transición
// suave, glow gradual, etc.). 0 si no aplica.
export function progresoDentroDePalabra(linea, idxPalabra, progresoMs) {
  if (!linea || !Array.isArray(linea.palabras) || idxPalabra < 0) return 0;
  const p = linea.palabras[idxPalabra];
  if (!p || p.msFin == null || p.msFin <= p.ms) return 0;
  const t = (progresoMs - p.ms) / (p.msFin - p.ms);
  return Math.max(0, Math.min(1, t));
}
s
