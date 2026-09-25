// viewer-temas.js — Temas visuales EXCLUSIVOS del Spotify Viewer.
//
// Estos NO tienen relación con /temas.js ni con tema-inline.js (el sistema de
// temas general del sitio). Aquí se define una paleta paralela que solo aplica
// dentro de /spotify/viewer/, seleccionable desde /spotify/viewer/ajustes/ y
// guardada en su propia clave de localStorage (ver ajustes-shared.js).
//
// Por qué exclusivos: el Viewer es una pantalla "para mirar" (a menudo en un
// segundo monitor, streaming, etc.) y tiene sentido que tenga su propia estética
// aunque el resto del sitio esté en modo Terminal o Minimal. Si el usuario elige
// "Igual que el sitio", se reutiliza el tema global normalmente (ver
// aplicarTemaViewer en viewer.js).

export const TEMAS_VIEWER = {
  sitio: {
    nombre: "Igual que el sitio",
    emoji: "🔗",
    // No define vars propias: cuando se selecciona, simplemente no se sobreescribe
    // nada y se deja el tema global (tema-inline.js) tal cual.
    vars: null
  },

  medianoche: {
    nombre: "Medianoche",
    emoji: "🌙",
    vars: {
      "--v-bg": "#05060c",
      "--v-card": "#0d1020",
      "--v-border": "#20264a",
      "--v-accent": "#7c8cff",
      "--v-accent-hover": "#6472e0",
      "--v-text": "#eef0ff",
      "--v-text-dim": "#8890c0",
      "--v-radius": "18px",
      "--v-espectro": "#7c8cff"
    }
  },

  vinilo: {
    nombre: "Vinilo",
    emoji: "🎙️",
    vars: {
      "--v-bg": "#1a1512",
      "--v-card": "#241d18",
      "--v-border": "#3d3128",
      "--v-accent": "#e0a941",
      "--v-accent-hover": "#c7922f",
      "--v-text": "#f3ead9",
      "--v-text-dim": "#a89584",
      "--v-radius": "10px",
      "--v-espectro": "#e0a941"
    }
  },

  neon_pulse: {
    nombre: "Neon Pulse",
    emoji: "⚡",
    vars: {
      "--v-bg": "#0a0014",
      "--v-card": "#160026",
      "--v-border": "#3d0a5c",
      "--v-accent": "#ff2fd6",
      "--v-accent-hover": "#e01fc0",
      "--v-text": "#f5e8ff",
      "--v-text-dim": "#b98fd6",
      "--v-radius": "22px",
      "--v-espectro": "#00e5ff"
    }
  },

  pastel_lofi: {
    nombre: "Pastel Lofi",
    emoji: "🌸",
    vars: {
      "--v-bg": "#fdf3f0",
      "--v-card": "#ffffff",
      "--v-border": "#f0dcd6",
      "--v-accent": "#e8877f",
      "--v-accent-hover": "#d4746c",
      "--v-text": "#3d2e2a",
      "--v-text-dim": "#9c8580",
      "--v-radius": "20px",
      "--v-espectro": "#e8877f"
    }
  },

  cristal: {
    nombre: "Cristal",
    emoji: "🧊",
    vars: {
      "--v-bg": "#0c1420",
      "--v-card": "rgba(255,255,255,0.06)",
      "--v-border": "rgba(255,255,255,0.16)",
      "--v-accent": "#6fd7ff",
      "--v-accent-hover": "#4fc3f0",
      "--v-text": "#eaf6ff",
      "--v-text-dim": "#8fb3c9",
      "--v-radius": "20px",
      "--v-espectro": "#6fd7ff"
    }
  }
};

const CLAVE_TEMA_VIEWER = "oxygenmedia_spotify_viewer_tema";
const TEMA_VIEWER_DEFAULT = "sitio";

export function obtenerTemaViewerGuardado() {
  try {
    return localStorage.getItem(CLAVE_TEMA_VIEWER) || TEMA_VIEWER_DEFAULT;
  } catch {
    return TEMA_VIEWER_DEFAULT;
  }
}

export function guardarTemaViewer(idTema) {
  try { localStorage.setItem(CLAVE_TEMA_VIEWER, idTema); } catch {}
}

// Aplica el tema exclusivo del Viewer sobre :root, con prefijo --v-* para no
// pisar jamás las variables globales del sitio (--bg, --accent, etc.) — así, si
// el usuario navega de /spotify/viewer/ a cualquier otra página, el tema global
// sigue intacto sin necesidad de "restaurar" nada al salir.
export function aplicarTemaViewer(idTema) {
  const tema = TEMAS_VIEWER[idTema] || TEMAS_VIEWER[TEMA_VIEWER_DEFAULT];
  const root = document.documentElement;

  if (!tema.vars) {
    // "Igual que el sitio": mapea las --v-* a las variables globales existentes,
    // así el CSS del Viewer (que siempre lee --v-*) no necesita reglas duplicadas.
    root.style.setProperty("--v-bg", "var(--bg)");
    root.style.setProperty("--v-card", "var(--card)");
    root.style.setProperty("--v-border", "var(--border)");
    root.style.setProperty("--v-accent", "var(--accent)");
    root.style.setProperty("--v-accent-hover", "var(--accent-hover)");
    root.style.setProperty("--v-text", "var(--text)");
    root.style.setProperty("--v-text-dim", "var(--text-dim)");
    root.style.setProperty("--v-radius", "var(--radius)");
    root.style.setProperty("--v-espectro", "var(--accent)");
    return;
  }

  Object.entries(tema.vars).forEach(([variable, valor]) => {
    root.style.setProperty(variable, valor);
  });
}
