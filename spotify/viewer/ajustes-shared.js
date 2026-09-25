// ajustes-shared.js
// Lectura/escritura de las preferencias del Spotify Viewer. Puramente visuales,
// por eso viven en localStorage (por dispositivo) y NO en Firestore — no hay
// razón para sincronizarlas entre dispositivos ni para gastar escrituras de
// Firestore en algo que no afecta a nadie más que a quien mira su propio Viewer.

const CLAVE = "oxygenmedia_spotify_viewer_ajustes";

export const AJUSTES_DEFAULT = {
  // Información
  mostrarPortada: true,
  mostrarCancion: true,
  mostrarArtista: true,
  mostrarAlbum: true,
  mostrarDuracion: true,
  mostrarBoton: true,
  // Visuales
  fondoDinamico: true,
  blur: true,
  glow: true,
  particulas: false,
  animCambioCancion: true,
  // Animaciones
  animaciones: "auto", // "auto" | "ligero" | "medio" | "potente" | "ninguna"
  // Portada
  tamanoPortada: "mediana", // "grande" | "mediana" | "pequena" | "oculta"
  // Diseño
  diseno: "centrado" // "centrado" | "compacto" | "tarjeta" | "fullscreen"
};

export function leerAjustesViewer() {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return { ...AJUSTES_DEFAULT };
    const guardado = JSON.parse(raw);
    return { ...AJUSTES_DEFAULT, ...guardado };
  } catch {
    return { ...AJUSTES_DEFAULT };
  }
}

export function guardarAjustesViewer(ajustes) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ajustes));
    return true;
  } catch {
    return false; // localStorage lleno o bloqueado (incógnito estricto) — no es crítico
  }
}
