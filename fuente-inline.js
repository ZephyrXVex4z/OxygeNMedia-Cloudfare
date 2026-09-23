// fuente-inline.js
// Se carga de forma SÍNCRONA en el <head> de cada página, justo después de
// tema-inline.js, para aplicar la fuente guardada ANTES de pintar el contenido.
// Usa la caché en localStorage (actualizada por fuentes.js cada vez que el
// usuario equipa una fuente) porque leer Firestore aquí sería asíncrono y
// causaría el mismo flash que se quiere evitar. Si el usuario cambia de
// dispositivo, la fuente real de su perfil se vuelve a aplicar (y a cachear)
// en cuanto observarSesion() carga su perfil — este script solo es el "primer
// pintado" aproximado, no la fuente de verdad.
(function() {
  try {
    var FUENTES_RAPIDO = {
      "fuente-sistema":  { css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", google: null },
      "fuente-inter":    { css: "'Inter', sans-serif", google: "Inter:wght@400;500;600;700" },
      "fuente-mono":     { css: "'Space Mono', monospace", google: "Space+Mono:wght@400;700" },
      "fuente-nunito":   { css: "'Nunito', sans-serif", google: "Nunito:wght@400;600;700" },
      "fuente-playfair": { css: "'Playfair Display', serif", google: "Playfair+Display:wght@500;700" },
      "fuente-poppins":  { css: "'Poppins', sans-serif", google: "Poppins:wght@400;600;700" },
      "fuente-orbitron": { css: "'Orbitron', sans-serif", google: "Orbitron:wght@500;700" },
      "fuente-caveat":   { css: "'Caveat', cursive", google: "Caveat:wght@500;700" }
    };
    var idFuente = localStorage.getItem("oxygenmedia_fuente_cache") || "fuente-sistema";
    var f = FUENTES_RAPIDO[idFuente] || FUENTES_RAPIDO["fuente-sistema"];
    var root = document.documentElement;
    root.style.setProperty("--font-body", f.css);
    root.style.setProperty("--font-display", f.css);

    if (f.google) {
      var link = document.createElement("link");
      link.id = "fuente-personalizada-google-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=" + f.google + "&display=swap";
      link.dataset.fuenteId = idFuente;
      document.head.appendChild(link);
    }
  } catch (e) { /* si algo falla, se queda con la fuente que puso tema-inline.js */ }
})();
