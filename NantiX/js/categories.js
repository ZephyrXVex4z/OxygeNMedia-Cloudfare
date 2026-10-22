// Registro de categorías: añadir una categoría = añadir una entrada aquí (y, si hace falta, un "kind").
const C = (label, full, icon, kind, group) => ({ label, full, icon, kind, group });
export const CATS = {
  "music-album": C("Álbum", "Música · Álbum", "💿", "music", "music"),
  "music-single": C("Sencillo", "Música · Sencillo", "🎵", "music", "music"),
  "music-ep": C("EP", "Música · EP", "🎶", "music", "music"),
  "music-collection": C("Colección", "Música · Discografía o colección", "🗂️", "music", "music"),
  android: C("Android", "Juegos Android", "🤖", "game"),
  ios: C("iPhone/iPad", "Juegos iPhone y iPad", "📱", "game"),
  pc: C("PC", "Juegos para PC", "🖥️", "game"),
  consoles: C("Consola", "Juegos para consolas", "🎮", "game"),
  roms: C("ROM", "ROMs", "👾", "rom"),
  emulators: C("Emulador", "Emuladores", "🕹️", "app"),
  apps: C("App", "Aplicaciones", "📦", "app"),
  tools: C("Herramienta", "Herramientas", "🛠️", "app"),
  mods: C("Mod", "Mods y contenido adicional", "🧩", "mod"),
  docs: C("Documento", "Documentos", "📄", "file"),
  images: C("Imagen", "Imágenes y recursos gráficos", "🖼️", "file"),
  video: C("Vídeo", "Vídeos y multimedia", "🎬", "file"),
  other: C("Archivo", "Otros archivos", "📁", "file")
};
for (const [k, c] of Object.entries(CATS)) c.group ||= k;

export const NAV = [
  { title: "Explorar", items: [["home", "Inicio", "🏠"], ["all", "Catálogo completo", "📚"]] },
  { title: "Música", items: [["music", "Toda la música", "🎧"], ["music-album", "Álbumes", "💿"], ["music-single", "Sencillos", "🎵"], ["music-ep", "EP", "🎶"], ["music-collection", "Discografías y colecciones", "🗂️"]] },
  { title: "Juegos", items: [["android", "Android", "🤖"], ["ios", "iPhone y iPad", "📱"], ["pc", "PC", "🖥️"], ["consoles", "Consolas", "🎮"], ["roms", "ROMs", "👾"]] },
  { title: "Software", items: [["emulators", "Emuladores", "🕹️"], ["apps", "Aplicaciones", "📦"], ["tools", "Herramientas", "🛠️"], ["mods", "Mods y adicionales", "🧩"]] },
  { title: "Archivos", items: [["docs", "Documentos", "📄"], ["images", "Imágenes y recursos", "🖼️"], ["video", "Vídeos y multimedia", "🎬"], ["other", "Otros archivos", "📁"]] }
];
export const navLabel = k => NAV.flatMap(g => g.items).find(i => i[0] === k)?.[1] ?? "Catálogo";
// Filtro de Firestore para cada entrada del menú
export const navFilter = k => k === "home" || k === "all" || k === "drafts" ? null
  : { scope: (k === "music" ? "group:" : "cat:") + k };

const T = "text", TA = "textarea", N = "number", D = "date", L = "list", U = "url", S = "select";
const F = (k, label, type, o = {}) => ({ k, label, type, ...o });
const GAME = [F("platform", "Plataforma", T), F("developer", "Desarrollador", T), F("genre", "Género", T), F("version", "Versión", T),
  F("languages", "Idiomas", L), F("requirements", "Requisitos del sistema", TA), F("distribution", "Tipo de distribución", T), F("installNotes", "Notas de instalación", TA)];
export const KIND_FIELDS = {
  music: [F("artist", "Artista principal", T, { req: 1 }), F("featuring", "Artistas colaboradores", L), F("releaseDate", "Fecha de lanzamiento", D),
    F("year", "Año", N), F("genres", "Géneros", L), F("trackCount", "Número de pistas", N), F("duration", "Duración total", T),
    F("audioFormat", "Formato de audio", S, { opts: ["FLAC", "MP3", "WAV", "AAC", "ALAC", "Otro"] }),
    F("sampleRate", "Frecuencia de muestreo", T), F("bitDepth", "Profundidad de bits", T), F("label", "Discográfica", T),
    F("tracklist", "Lista de pistas (una por línea)", TA)],
  game: GAME,
  app: [F("developer", "Desarrollador", T), F("version", "Versión", T), F("os", "Sistemas operativos compatibles", L), F("arch", "Arquitectura", T),
    F("requirements", "Requisitos", TA), F("changelog", "Registro de cambios", TA), F("officialUrl", "Fuente oficial", U)],
  rom: [F("platform", "Plataforma original", T), F("gameTitle", "Título del juego", T), F("region", "Región", T), F("language", "Idioma", T),
    F("revision", "Revisión o versión", T), F("format", "Formato del archivo", T), F("hash", "Hash de verificación", T),
    F("license", "Licencia o permiso de distribución", TA, { req: 1 })],
  mod: [F("game", "Juego o aplicación base", T), F("developer", "Autor", T), F("version", "Versión", T), F("installNotes", "Notas de instalación", TA), F("officialUrl", "Fuente oficial", U)],
  file: [F("author", "Autor", T), F("format", "Formato", T), F("license", "Licencia", T)]
};
export const FILTERS = { music: ["genres", "audioFormat", "year", "artist"], game: ["platform", "genre", "languages"], app: ["os", "version"], rom: ["platform", "region", "language"], mod: ["game"], file: ["format"] };

export const SERVICES = ["MEGA", "Google Drive", "MediaFire", "Dropbox", "Otro"];
export function detectService(url) {
  try {
    const h = new URL(url).hostname;
    if (/(^|\.)mega\.(nz|io)$/.test(h)) return "MEGA";
    if (/(^|\.)(drive|docs)\.google\.com$/.test(h)) return "Google Drive";
    if (/mediafire\.com$/.test(h)) return "MediaFire";
    if (/dropbox\.com$/.test(h)) return "Dropbox";
  } catch {}
  return "Otro";
}
export const serviceName = d => d.service !== "Otro" ? d.service : (() => { try { return new URL(d.url).hostname; } catch { return "Enlace externo"; } })();
export const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function keywords(p) {
  const m = p.meta || {}, src = [p.title, m.artist, m.featuring, m.developer, m.platform, m.gameTitle, m.genres, m.genre, m.game, p.tags, CATS[p.category]?.label].flat();
  return [...new Set(norm(src.filter(Boolean).join(" ")).split(/[^a-z0-9]+/).filter(t => t.length >= 2))].slice(0, 60);
}
export function fmtSize(b) {
  if (!b) return ""; const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0, n = b;
  while (n >= 1024 && i < 4) { n /= 1024; i++; } return `${n < 10 && i ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
}
export function fmtDate(v) {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  return d && !isNaN(d) ? d.toLocaleDateString("es", { year: "numeric", month: "short", day: "numeric" }) : "";
}
export function cardLines(p) {
  const c = CATS[p.category] || CATS.other, m = p.meta || {}, d0 = p.downloads?.[0], j = a => (Array.isArray(a) ? a.join(", ") : a);
  switch (c.kind) {
    case "music": return [m.artist, [c.label, m.year || (m.releaseDate || "").slice(0, 4)].filter(Boolean).join(" · "), m.audioFormat];
    case "game": return [m.platform || c.full, m.genre, m.version && "v" + m.version];
    case "app": return [j(m.os) || c.label, m.version && "v" + m.version, p.description];
    case "rom": return [m.platform, [m.region, m.format].filter(Boolean).join(" · ")];
    case "mod": return [m.game, m.version && "v" + m.version];
    default: return [[d0?.ext || d0?.format, fmtSize(d0?.sizeBytes)].filter(Boolean).join(" · "), p.description];
  }
}
