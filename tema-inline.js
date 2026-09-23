// tema-inline.js
// Se carga de forma SÍNCRONA (no como módulo) al inicio del <head> de cada página,
// para aplicar el tema de COLOR guardado ANTES de que se pinte el contenido y
// evitar el "flash" del tema por defecto. Debe mantenerse sincronizado con
// temas.js — si agregas/cambias un tema ahí, cámbialo aquí también.
//
// La FUENTE ya no vive aquí: es una personalización independiente del color
// (ver fuentes.js / fuente-inline.js, que debe cargarse justo después de este
// script en el <head> de cada página).
(function() {
  try {
    var TEMAS_RAPIDO = {
      terminal: {"--bg":"#0A0E0A","--card":"#0F1710","--border":"#1F8C52","--accent":"#3FFF8F","--accent-hover":"#2FE07A","--text":"#C9F5D8","--text-dim":"#5C9C77","--danger":"#FF5C5C","--success":"#3FFF8F","--warn":"#FFB627","--radius":"2px","--card-shadow":"none","--font-weight-heading":"700","--input-bg":"#050805"},
      neobrutal: {"--bg":"#FFF4E0","--card":"#FFFFFF","--border":"#16161A","--accent":"#FF5C8A","--accent-hover":"#E84577","--text":"#16161A","--text-dim":"#4A453D","--danger":"#E84545","--success":"#6FCF97","--warn":"#FFD23F","--radius":"10px","--card-shadow":"5px 5px 0 var(--border)","--font-weight-heading":"700","--input-bg":"#FFF4E0"},
      editorial: {"--bg":"#EFE8DC","--card":"#F8F4EB","--border":"#D8CFBE","--accent":"#A65B3F","--accent-hover":"#8C4A32","--text":"#2B2620","--text-dim":"#6B6255","--danger":"#B0473A","--success":"#6B7A5E","--warn":"#B8863B","--radius":"2px","--card-shadow":"none","--font-weight-heading":"400","--input-bg":"#EFE8DC"},
      aurora: {"--bg":"#0D0B1F","--card":"rgba(255,255,255,0.06)","--border":"rgba(255,255,255,0.14)","--accent":"#B08CFF","--accent-hover":"#9A6FFF","--text":"#F0EEFF","--text-dim":"#9C93C4","--danger":"#FF7A9C","--success":"#7CE8C4","--warn":"#FFC98C","--radius":"16px","--card-shadow":"0 8px 32px rgba(120,80,255,0.15)","--font-weight-heading":"700","--input-bg":"rgba(255,255,255,0.05)"},
      minimal: {"--bg":"#FFFFFF","--card":"#FFFFFF","--border":"#E4E4E4","--accent":"#111111","--accent-hover":"#333333","--text":"#111111","--text-dim":"#8A8A8A","--danger":"#D64545","--success":"#2E9E5B","--warn":"#B8862E","--radius":"6px","--card-shadow":"none","--font-weight-heading":"600","--input-bg":"#F7F7F7"}
    };
    var idTema = localStorage.getItem("oxygenmedia_tema") || "terminal";
    var vars = TEMAS_RAPIDO[idTema] || TEMAS_RAPIDO.terminal;
    var root = document.documentElement;
    for (var k in vars) root.style.setProperty(k, vars[k]);
  } catch (e) { /* si algo falla, se queda con el tema default del CSS de la página */ }
})();

