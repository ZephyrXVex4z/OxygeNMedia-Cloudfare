// pixel-imagen.js
// Todo lo relacionado a IMPORTAR una imagen normal (foto, ilustración, etc.) y
// convertirla en un grid de pixel art compatible con el resto del editor.
//
// El resultado de convertirImagenAGrid() es un grid[y][x] de hex/null exactamente
// igual al que produce crearGridVacio() en pixel-herramientas.js — por eso, una
// vez convertida, la imagen queda 100% editable con lápiz/borrador/relleno/gotero
// y entra al historial de deshacer/rehacer como cualquier otro dibujo.
//
// Proceso (el mismo que usan los conversores de pixel art más conocidos):
//   1) Recortar/ajustar la imagen a un lienzo cuadrado
//   2) Reducirla al tamaño final de la cuadrícula (esto YA promedia los colores)
//   3) Ajustes opcionales de brillo/contraste/saturación
//   4) Reducir a una paleta limitada de colores (median cut, o una paleta fija)
//   5) Dithering opcional (Floyd–Steinberg) para simular más tonos con pocos colores

// ============ CARGA DE IMÁGENES ============

// Desde un archivo local (input type="file" o arrastrado al navegador).
// Usa FileReader -> data URL, así que nunca hay problema de CORS/canvas "tainted".
export function cargarImagenDesdeArchivo(archivo) {
  return new Promise((resolve, reject) => {
    if (!archivo || !archivo.type || !archivo.type.startsWith("image/")) {
      reject(new Error("El archivo no es una imagen."));
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo leer la imagen. ¿El archivo está dañado?"));
      img.src = lector.result;
    };
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.readAsDataURL(archivo);
  });
}

// Desde una URL (por ejemplo, una imagen ya subida a Cloudflare R2).
// IMPORTANTE: para poder leer los píxeles de una imagen cargada por URL, el
// servidor que la sirve debe responder con cabeceras CORS que permitan GET
// desde este sitio (si no, el navegador "mancha" el canvas y no deja leerlo).
// En Cloudflare R2 esto se configura con una regla CORS en el bucket.
export function cargarImagenDesdeUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(
      "No se pudo cargar la imagen desde esa URL. Si es de Cloudflare R2 u otro " +
      "almacenamiento propio, revisa que el bucket tenga configurado CORS " +
      "permitiendo GET desde este dominio."
    ));
    img.src = url;
  });
}

// ============ CONVERSIÓN PRINCIPAL ============

// opciones:
//   ajuste       "recortar" (llena el cuadro recortando el sobrante, tipo "cover")
//                | "contener" (se ve la imagen completa, con bordes transparentes)
//   numColores   entero (ej. 16) para generar una paleta nueva con median cut,
//                o null para "sin límite" (color exacto por celda, sin cuantizar)
//   paletaFija   array de hex — si se define, se ignora numColores y cada celda
//                se ajusta al color más cercano DENTRO de esa paleta (útil para
//                usar la paleta activa del editor)
//   dither       boolean — aplica Floyd–Steinberg al cuantizar
//   brillo       -60..60
//   contraste    -60..60
//   saturacion   -100..100
//   umbralAlfa   0..255 — píxeles con alfa menor a esto se vuelven celdas vacías
export function convertirImagenAGrid(img, gridSize, opciones = {}) {
  const {
    ajuste = "recortar",
    numColores = 16,
    paletaFija = null,
    dither = false,
    brillo = 0,
    contraste = 0,
    saturacion = 0,
    umbralAlfa = 40
  } = opciones;

  const canvasFuente = recortarImagenACanvas(img, ajuste);
  const lado = canvasFuente.width;

  // Reducir al tamaño final: dejar que el navegador suavice esta reducción es,
  // en la práctica, un promedio de bloques — así es como se genera cada "pixel".
  const canvasReducido = document.createElement("canvas");
  canvasReducido.width = gridSize;
  canvasReducido.height = gridSize;
  const ctxReducido = canvasReducido.getContext("2d");
  ctxReducido.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctxReducido) ctxReducido.imageSmoothingQuality = "high";
  ctxReducido.drawImage(canvasFuente, 0, 0, lado, lado, 0, 0, gridSize, gridSize);

  const datos = ctxReducido.getImageData(0, 0, gridSize, gridSize).data;

  // Separar celdas transparentes (quedan como null, igual que una celda "sin pintar")
  // y aplicar brillo/contraste/saturación al resto.
  const celdas = new Array(gridSize * gridSize);
  const muestrasOpacas = [];
  for (let i = 0; i < gridSize * gridSize; i++) {
    const base = i * 4;
    const alfa = datos[base + 3];
    if (alfa < umbralAlfa) { celdas[i] = null; continue; }
    const rgb = aplicarAjustes(datos[base], datos[base + 1], datos[base + 2], brillo, contraste, saturacion);
    celdas[i] = rgb;
    muestrasOpacas.push(rgb);
  }

  // Determinar la paleta a usar (o null si es modo "sin límite")
  let paletaRgb = null;
  if (paletaFija && paletaFija.length) {
    paletaRgb = paletaFija.map(hexARgbArray);
  } else if (typeof numColores === "number" && muestrasOpacas.length) {
    paletaRgb = cuantizarPaletaMedianCut(muestrasOpacas, Math.max(2, numColores));
  }

  const grid = [];
  const coloresUsados = new Set();

  if (paletaRgb) {
    // Buffer mutable para poder difundir el error de cuantización (dithering)
    const buffer = celdas.map(c => (c ? [c[0], c[1], c[2]] : null));
    for (let y = 0; y < gridSize; y++) {
      const fila = new Array(gridSize);
      for (let x = 0; x < gridSize; x++) {
        const c = buffer[y * gridSize + x];
        if (!c) { fila[x] = null; continue; }
        const cercano = colorMasCercano(c, paletaRgb);
        const hex = rgbArrayAHex(cercano);
        fila[x] = hex;
        coloresUsados.add(hex);
        if (dither) {
          difundirError(buffer, x, y, gridSize, [c[0] - cercano[0], c[1] - cercano[1], c[2] - cercano[2]]);
        }
      }
      grid.push(fila);
    }
  } else {
    for (let y = 0; y < gridSize; y++) {
      const fila = new Array(gridSize);
      for (let x = 0; x < gridSize; x++) {
        const c = celdas[y * gridSize + x];
        if (!c) { fila[x] = null; continue; }
        const hex = rgbArrayAHex(c);
        fila[x] = hex;
        coloresUsados.add(hex);
      }
      grid.push(fila);
    }
  }

  return { grid, colores: [...coloresUsados] };
}

// ============ RECORTE / AJUSTE A CUADRADO ============

function recortarImagenACanvas(img, ajuste) {
  const anchoOriginal = img.naturalWidth || img.width;
  const altoOriginal = img.naturalHeight || img.height;
  const lado = ajuste === "contener"
    ? Math.max(anchoOriginal, altoOriginal)
    : Math.min(anchoOriginal, altoOriginal);

  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d");

  if (ajuste === "contener") {
    // Lienzo cuadrado transparente con la imagen completa centrada
    const dx = (lado - anchoOriginal) / 2;
    const dy = (lado - altoOriginal) / 2;
    ctx.drawImage(img, dx, dy, anchoOriginal, altoOriginal);
  } else {
    // Recorte centrado tipo "cover": llena todo el cuadro, recorta el sobrante
    const sx = (anchoOriginal - lado) / 2;
    const sy = (altoOriginal - lado) / 2;
    ctx.drawImage(img, sx, sy, lado, lado, 0, 0, lado, lado);
  }
  return canvas;
}

// ============ AJUSTES DE COLOR ============

function aplicarAjustes(r, g, b, brillo, contraste, saturacion) {
  const factorContraste = (259 * (contraste + 255)) / (255 * (259 - contraste));
  r = factorContraste * (r - 128) + 128;
  g = factorContraste * (g - 128) + 128;
  b = factorContraste * (b - 128) + 128;

  r += brillo; g += brillo; b += brillo;

  const gris = 0.299 * r + 0.587 * g + 0.114 * b;
  const factorSaturacion = 1 + saturacion / 100;
  r = gris + (r - gris) * factorSaturacion;
  g = gris + (g - gris) * factorSaturacion;
  b = gris + (b - gris) * factorSaturacion;

  return [clamp255(r), clamp255(g), clamp255(b)];
}

function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

// ============ CUANTIZACIÓN DE COLOR (MEDIAN CUT) ============

// Reduce una lista de colores [r,g,b] a "numColores" colores representativos,
// dividiendo repetidamente el grupo con mayor rango de color por su mediana.
function cuantizarPaletaMedianCut(pixeles, numColores) {
  let buckets = [pixeles];

  while (buckets.length < numColores) {
    let idxElegido = -1, rangoMax = -1, canalElegido = 0;

    buckets.forEach((bucket, idx) => {
      if (bucket.length < 2) return;
      for (let canal = 0; canal < 3; canal++) {
        let min = 255, max = 0;
        for (const p of bucket) {
          if (p[canal] < min) min = p[canal];
          if (p[canal] > max) max = p[canal];
        }
        const rango = max - min;
        if (rango > rangoMax) { rangoMax = rango; idxElegido = idx; canalElegido = canal; }
      }
    });

    if (idxElegido === -1) break; // ya no se puede dividir más

    const bucket = buckets[idxElegido];
    bucket.sort((a, b) => a[canalElegido] - b[canalElegido]);
    const mitad = Math.floor(bucket.length / 2);
    buckets.splice(idxElegido, 1, bucket.slice(0, mitad), bucket.slice(mitad));
  }

  return buckets.filter(b => b.length > 0).map(promedioColor);
}

function promedioColor(bucket) {
  let r = 0, g = 0, b = 0;
  for (const p of bucket) { r += p[0]; g += p[1]; b += p[2]; }
  const n = bucket.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

// ============ EMPAREJAMIENTO Y DITHERING ============

function colorMasCercano(rgb, paleta) {
  let mejor = paleta[0], mejorDist = Infinity;
  for (const candidato of paleta) {
    const d = distanciaColor(rgb, candidato);
    if (d < mejorDist) { mejorDist = d; mejor = candidato; }
  }
  return mejor;
}

// "redmean": aproximación perceptual de distancia de color, más fiel al ojo
// humano que una distancia euclidiana simple en RGB.
function distanciaColor(c1, c2) {
  const rm = (c1[0] + c2[0]) / 2;
  const dr = c1[0] - c2[0], dg = c1[1] - c2[1], db = c1[2] - c2[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

// Difunde el error de cuantización a las celdas vecinas aún no procesadas
// (patrón clásico de Floyd–Steinberg), saltando celdas vacías (null).
function difundirError(buffer, x, y, gridSize, error) {
  const vecinos = [
    [x + 1, y, 7 / 16],
    [x - 1, y + 1, 3 / 16],
    [x, y + 1, 5 / 16],
    [x + 1, y + 1, 1 / 16]
  ];
  for (const [nx, ny, factor] of vecinos) {
    if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
    const c = buffer[ny * gridSize + nx];
    if (!c) continue;
    c[0] += error[0] * factor;
    c[1] += error[1] * factor;
    c[2] += error[2] * factor;
  }
}

// ============ HEX <-> RGB ============

function hexARgbArray(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbArrayAHex([r, g, b]) {
  return "#" + [r, g, b].map(v => clamp255(v).toString(16).padStart(2, "0")).join("");
}
