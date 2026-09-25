// viewer-tema-inline.js
// Aplica el tema EXCLUSIVO del Viewer de forma SÍNCRONA en el <head>, antes de
// que se pinte nada — igual que /tema-inline.js hace para el tema global del
// sitio. Evita el "flash blanco" que ocurría porque viewer.js (type="module",
// que carga diferido) aplicaba las variables --v-* demasiado tarde.
//
// Debe mantenerse sincronizado a mano con el catálogo de viewer-temas.js si se
// agrega o edita un tema ahí (mismo patrón que tema-inline.js / temas.js).
(function () {
  try {
    var TEMAS_VIEWER_RAPIDO = {
      medianoche: {"--v-bg":"#05060c","--v-card":"#0d1020","--v-border":"#20264a","--v-accent":"#7c8cff","--v-accent-hover":"#6472e0","--v-text":"#eef0ff","--v-text-dim":"#8890c0","--v-radius":"18px","--v-espectro":"#7c8cff"},
      vinilo: {"--v-bg":"#1a1512","--v-card":"#241d18","--v-border":"#3d3128","--v-accent":"#e0a941","--v-accent-hover":"#c7922f","--v-text":"#f3ead9","--v-text-dim":"#a89584","--v-radius":"10px","--v-espectro":"#e0a941"},
      neon_pulse: {"--v-bg":"#0a0014","--v-card":"#160026","--v-border":"#3d0a5c","--v-accent":"#ff2fd6","--v-accent-hover":"#e01fc0","--v-text":"#f5e8ff","--v-text-dim":"#b98fd6","--v-radius":"22px","--v-espectro":"#00e5ff"},
      pastel_lofi: {"--v-bg":"#fdf3f0","--v-card":"#ffffff","--v-border":"#f0dcd6","--v-accent":"#e8877f","--v-accent-hover":"#d4746c","--v-text":"#3d2e2a","--v-text-dim":"#9c8580","--v-radius":"20px","--v-espectro":"#e8877f"},
      cristal: {"--v-bg":"#0c1420","--v-card":"rgba(255,255,255,0.06)","--v-border":"rgba(255,255,255,0.16)","--v-accent":"#6fd7ff","--v-accent-hover":"#4fc3f0","--v-text":"#eaf6ff","--v-text-dim":"#8fb3c9","--v-radius":"20px","--v-espectro":"#6fd7ff"}
    };

    var idTema = localStorage.getItem("oxygenmedia_spotify_viewer_tema") || "sitio";
    var root = document.documentElement;

    if (idTema === "sitio" || !TEMAS_VIEWER_RAPIDO[idTema]) {
      // "Igual que el sitio": tema-inline.js YA corrió antes que este script (va
      // primero en el <head>) y ya dejó --bg, --accent, etc. listas — solo
      // mapeamos --v-* a esas variables globales.
      var mapa = { bg: "bg", card: "card", border: "border", accent: "accent",
        "accent-hover": "accent-hover", text: "text", "text-dim": "text-dim", radius: "radius" };
      for (var k in mapa) root.style.setProperty("--v-" + k, "var(--" + mapa[k] + ")");
      root.style.setProperty("--v-espectro", "var(--accent)");
    } else {
      var vars = TEMAS_VIEWER_RAPIDO[idTema];
      for (var prop in vars) root.style.setProperty(prop, vars[prop]);
    }
  } catch (e) {
    // Si algo falla, viewer.js aplicará el tema de todas formas al cargar —
    // solo se pierde la prevención del flash, no la función.
  }
})();
