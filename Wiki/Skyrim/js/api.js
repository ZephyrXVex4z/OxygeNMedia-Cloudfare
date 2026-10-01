// api.js
// Única capa que conoce de dónde salen los datos. La interfaz nunca llama a fetch ni
// lee ITEMS directamente.
//
// Fuentes:
//  - local:  data.js (siempre disponible, define filtros, categorías y relaciones)
//  - remote: API MediaWiki de UESP (búsqueda ampliada + extracto e imagen de cada artículo)
//
// Para cambiar de proveedor remoto edita GAME.remote en data.js y, si la API no es
// MediaWiki, reemplaza solo las funciones `remoteSearch` y `remoteArticle` de este archivo.

import { GAME, ITEMS, getItemById } from "./data.js";
import { applyFilters, sortItems } from "./filters.js";
import { searchLocal } from "./search.js";

const R = GAME.remote;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const TIMEOUT_MS = 6000;
const CACHE_PREFIX = `${GAME.storagePrefix}c${GAME.dataVersion}_`;

// ============ Cache (localStorage con expiración) ============
export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > TTL_MS) { localStorage.removeItem(CACHE_PREFIX + key); return null; }
    return v;
  } catch { return null; }
}

export function cacheSet(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    purgeExpired(); // almacenamiento lleno: limpia y no insiste
  }
}

export function purgeExpired() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(GAME.storagePrefix)) continue;
      if (!k.startsWith(CACHE_PREFIX) && k !== `${GAME.storagePrefix}recent`) { localStorage.removeItem(k); continue; }
      if (!k.startsWith(CACHE_PREFIX)) continue;
      const { t } = JSON.parse(localStorage.getItem(k) || "{}");
      if (!t || Date.now() - t > TTL_MS) localStorage.removeItem(k);
    }
  } catch { /* ignorar */ }
}

// Deduplica peticiones idénticas en vuelo (evita consultas API duplicadas).
const inflight = new Map();

async function fetchJson(url) {
  if (inflight.has(url)) return inflight.get(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const p = fetch(url, { signal: ctrl.signal })
    .then((res) => {
      if (!res.ok) throw new Error(`La API respondió ${res.status}`);
      return res.json();
    })
    .catch((err) => {
      throw new Error(err.name === "AbortError" ? "La API tardó demasiado en responder." : "No se pudo conectar con la API.");
    })
    .finally(() => { clearTimeout(timer); inflight.delete(url); });
  inflight.set(url, p);
  return p;
}

const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();
export const remotePageUrl = (title) => R.pageBase + encodeURIComponent(title.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%27/g, "'");
export const remoteSearchUrl = (q) => `${R.pageBase.replace("/wiki/", "/w/index.php")}?search=${encodeURIComponent(`${R.namespace}${q}`)}`;

// ============ Proveedor remoto (MediaWiki / UESP) ============
async function remoteSearch(query) {
  const key = `s_${query.toLowerCase()}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  const params = new URLSearchParams({
    action: "query", list: "search", srsearch: query, srlimit: "20",
    srprop: "snippet", format: "json", formatversion: "2", origin: "*"
  });
  const data = await fetchJson(`${R.endpoint}?${params}`);
  const rows = (data?.query?.search || []).map((r) => ({
    title: r.title, snippet: stripHtml(r.snippet), url: remotePageUrl(r.title)
  }));
  // Prioriza el espacio de nombres de Skyrim; si no hay, deja lo demás.
  const inGame = rows.filter((r) => r.title.startsWith(R.namespace));
  const out = (inGame.length ? inGame : rows).slice(0, 8);
  cacheSet(key, out);
  return out;
}

async function remoteArticle(title) {
  const key = `a_${title}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  const params = new URLSearchParams({
    action: "query", prop: "extracts|pageimages", titles: `${R.namespace}${title}`,
    exintro: "1", explaintext: "1", exsentences: "4", piprop: "thumbnail", pithumbsize: "480",
    redirects: "1", format: "json", formatversion: "2", origin: "*"
  });
  const data = await fetchJson(`${R.endpoint}?${params}`);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  const out = {
    title: page.title,
    extract: page.extract ? page.extract.trim() : "",
    image: page.thumbnail?.source || "",
    url: remotePageUrl(page.title)
  };
  cacheSet(key, out);
  return out;
}

// ============ API pública ============

// Búsqueda combinada. `remote: false` devuelve solo lo local (autocompletado).
// Nunca lanza: si la API falla, devuelve lo local y `remoteError` con el motivo.
export async function searchSkyrim(query, filters = {}, { remote = true } = {}) {
  const q = String(query || "").trim();
  const local = searchLocal(q, filters);
  if (!remote || q.length < 2) return { local, remote: [], remoteError: null };
  try {
    const rows = await remoteSearch(q);
    // Quita resultados remotos que ya existen en la base local (mismo título).
    const names = new Set(local.map((i) => (i.uesp || i.name).toLowerCase()));
    const fresh = rows.filter((r) => !names.has(r.title.replace(R.namespace, "").toLowerCase()));
    return { local, remote: fresh, remoteError: null };
  } catch (err) {
    return { local, remote: [], remoteError: err.message };
  }
}

// Artículo local + enriquecimiento remoto opcional (extracto e imagen).
export async function getArticle(id, { remote = true } = {}) {
  const item = getItemById(id);
  if (!item) return null;
  let extra = null;
  let remoteError = null;
  if (remote && item.uesp) {
    try { extra = await remoteArticle(item.uesp); } catch (err) { remoteError = err.message; }
  }
  return { item, remote: extra, remoteError };
}

export async function getCategory(categoryId, filters = {}) {
  const f = { ...filters, cat: [categoryId] };
  return sortItems(applyFilters(ITEMS, f), f.sort);
}

export async function getDLC(dlcId, categoryId = null) {
  const f = { dlc: [dlcId], cat: categoryId ? [categoryId] : [] };
  return applyFilters(ITEMS, f);
}

export async function getFilteredData(filters = {}) {
  let items = applyFilters(ITEMS, filters);
  if (filters.q) {
    const ids = new Set(searchLocal(filters.q, filters).map((i) => i.id));
    items = items.filter((i) => ids.has(i.id));
  }
  return sortItems(items, filters.sort || "name");
}

// Elementos relacionados: los que este artículo enlaza + los que lo enlazan a él.
export async function getRelatedItems(id) {
  const item = getItemById(id);
  if (!item) return { outgoing: [], incoming: [] };
  const outgoing = (item.related || []).map(getItemById).filter(Boolean);
  const outIds = new Set(outgoing.map((i) => i.id));
  const incoming = ITEMS.filter((i) => i.id !== id && !outIds.has(i.id) && (i.related || []).includes(id));
  return { outgoing, incoming };
}

// Limpieza oportunista de cache vencida al cargar la wiki.
purgeExpired();
