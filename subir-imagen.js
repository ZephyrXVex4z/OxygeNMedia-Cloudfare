// subir-imagen.js
// Reemplaza el flujo de "pega un link de Imgur" por subida real de archivos:
// comprime la imagen a WebP DIRECTO en el navegador (usando <canvas>, sin
// librerías externas) para que nunca se suba más de ~1 MB, y la manda al
// Worker de Cloudflare que la guarda en R2. Devuelve la URL pública final,
// que se guarda en Firestore exactamente igual que antes se guardaba el
// link de Imgur (fotoURL, imagenURL, etc. no cambian de forma).
//
// Se usa desde perfil.js (foto de perfil), muro-app.js (imagen de post), y
// admin.js/publicar-recurso.js (imágenes de recursos) — un solo lugar para
// la lógica de compresión y subida, sin duplicarla en cada página.

import { auth } from "./firebase-config.js";

// Pega aquí la URL de tu Worker de subida (Cloudflare Workers & Pages → tu
// worker → la URL bajo el nombre, algo como
// "https://oxygenmedia-subir-imagenes.tu-cuenta.workers.dev").
const SUBIR_IMAGEN_ENDPOINT = "https://oxygenmedia-subir-imagenes.zephyr-tech-gob.workers.dev/";

const CALIDAD_WEBP = 0.82;      // 0-1, buen balance calidad/peso para fotos
const LADO_MAXIMO_PX = 1600;    // redimensiona si la imagen es más grande que esto
const MAX_BYTES_FINAL = 1 * 1024 * 1024; // 1 MB, debe coincidir con el límite del Worker

// Comprime un File/Blob de imagen a WebP usando <canvas>, redimensionando si
// hace falta, y bajando la calidad en pasos hasta que quepa en MAX_BYTES_FINAL.
// Devuelve un Blob listo para subir.
async function comprimirAWebp(archivo) {
  const bitmap = await createImageBitmap(archivo);

  let { width, height } = bitmap;
  if (width > LADO_MAXIMO_PX || height > LADO_MAXIMO_PX) {
    const escala = LADO_MAXIMO_PX / Math.max(width, height);
    width = Math.round(width * escala);
    height = Math.round(height * escala);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Baja la calidad en pasos si hace falta, hasta caber en el límite o
  // agotar los intentos razonables (evita un bucle infinito con imágenes
  // imposibles de comprimir lo suficiente, ej. ruido puro).
  let calidad = CALIDAD_WEBP;
  for (let intento = 0; intento < 6; intento++) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", calidad));
    if (!blob) throw new Error("Tu navegador no pudo procesar esta imagen.");
    if (blob.size <= MAX_BYTES_FINAL) return blob;
    calidad -= 0.12;
    if (calidad < 0.35) {
      // Ya no vale la pena bajar más la calidad — como último recurso,
      // reduce también las dimensiones a la mitad y reintenta una vez.
      canvas.width = Math.round(width / 1.4);
      canvas.height = Math.round(height / 1.4);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      calidad = 0.6;
    }
  }

  throw new Error("No se pudo comprimir la imagen lo suficiente (máximo 1 MB). Prueba con otra imagen.");
}

// Sube un archivo de imagen (File del input, o Blob) para un tipo dado
// ("perfiles" | "posts" | "recursos"). Devuelve la URL pública final.
export async function subirImagen(archivo, tipo) {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes iniciar sesión de nuevo para subir imágenes.");

  if (!archivo.type.startsWith("image/")) {
    throw new Error("Solo se aceptan archivos de imagen.");
  }

  const webpBlob = await comprimirAWebp(archivo);
  const idToken = await user.getIdToken();

  const resp = await fetch(SUBIR_IMAGEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "image/webp",
      "X-Firebase-Token": idToken,
      "X-Tipo-Imagen": tipo
    },
    body: webpBlob
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "No se pudo subir la imagen.");
  return data.url;
}
