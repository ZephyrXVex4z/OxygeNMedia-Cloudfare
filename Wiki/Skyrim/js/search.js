// search.js
// Búsqueda local: normalización, puntuación, sugerencias, historial reciente y debounce.
// Respeta los filtros activos (DLC / categoría) usando applyFilters().

import { ITEMS, GAME } from "./data.js";
import { applyFilters } from "./filters.js";

export function normalize(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function debounce(fn, ms = 200) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

// Índice precalculado una sola vez: evita normalizar texto en cada pulsación.
const INDEX = ITEMS.map((item) => {
  const words = (item.words || []).map((w) => `${w.word} ${w.translation}`).join(" ");
  return {
    item,
    name: normalize(item.name),
    aliases: (item.aliases || []).map(normalize),
    blob: normalize([item.description, item.effect, item.location, words, (item.tags || []).join(" "), item.type].filter(Boolean).join(" "))
  };
});

function score(entry, tokens, full) {
  let s = 0;
  if (entry.name === full) s += 100;
  else if (entry.name.startsWith(full)) s += 80;
  else if (entry.name.split(/\s+/).some((w) => w.startsWith(full))) s += 60;
  else if (entry.name.includes(full)) s += 50;

  if (entry.aliases.some((a) => a === full)) s += 90;
  else if (entry.aliases.some((a) => a.includes(full))) s += 45;

  // Todos los términos deben aparecer en nombre, alias o texto.
  const haystack = `${entry.name} ${entry.aliases.join(" ")} ${entry.blob}`;
  if (!tokens.every((t) => haystack.includes(t))) return s >= 45 ? s : 0;
  if (s === 0) s = 10;
  s += tokens.filter((t) => entry.name.includes(t)).length * 5;
  return s;
}

// Devuelve artículos locales ordenados por relevancia, filtrados por DLC/categoría.
export function searchLocal(query, filters = {}, limit = Infinity) {
  const full = normalize(query);
  if (!full) return [];
  const allowed = new Set(applyFilters(ITEMS, filters).map((i) => i.id));
  const tokens = full.split(/\s+/).filter(Boolean);
  return INDEX
    .filter((e) => allowed.has(e.item.id))
    .map((e) => ({ item: e.item, score: score(e, tokens, full) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((r) => r.item);
}

export const suggest = (query, filters, n = 7) => searchLocal(query, filters, n);

// ============ Historial reciente ============
const KEY = `${GAME.storagePrefix}recent`;
const MAX_RECENT = 6;

export function getRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch { return []; }
}

export function addRecent(q) {
  const t = String(q || "").trim();
  if (t.length < 2) return;
  try {
    const list = [t, ...getRecent().filter((x) => normalize(x) !== normalize(t))].slice(0, MAX_RECENT);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* storage bloqueado: no es crítico */ }
}

export function clearRecent() {
  try { localStorage.removeItem(KEY); } catch { /* ignorar */ }
}
