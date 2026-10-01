// navigation.js
// Router por History API con URLs limpias bajo GAME.base, sin tocar rutas de OxygeNMedia.
//
// Rutas:
//   /Wiki/Skyrim/                      inicio
//   /Wiki/Skyrim/search?q=...          resultados de búsqueda
//   /Wiki/Skyrim/<dlc>                 página de DLC        (dawnguard, hearthfire, dragonborn, skyrim, anniversary)
//   /Wiki/Skyrim/<categoria>           página de categoría  (shouts, weapons, items, quests…)
//   /Wiki/Skyrim/<categoria>/<id>      artículo             (shouts/dragon-aspect)
//
// Hosting estático: un enlace directo a /Wiki/Skyrim/shouts/dragon-aspect lo sirve el 404.html
// raíz, que redirige a /Wiki/Skyrim/?p=/shouts/dragon-aspect (ver README). Aquí se
// restaura la URL limpia con replaceState.

import { GAME, DLCS, CATEGORIES } from "./data.js";

export const BASE = GAME.base.replace(/\/$/, "");
const DLC_IDS = new Set(DLCS.map((d) => d.id));
const CAT_IDS = new Set(CATEGORIES.map((c) => c.id));

// Construye una URL interna: href("shouts/dragon-aspect", "?dlc=dragonborn")
export function href(path = "", query = "") {
  const clean = String(path).replace(/^\/+|\/+$/g, "");
  return clean ? `${BASE}/${clean}${query}` : `${BASE}/${query}`;
}

export function parseRoute(pathname, search = "") {
  let rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  rest = rest.replace(/^\/+|\/+$/g, "");
  const parts = rest ? rest.split("/").map(decodeURIComponent) : [];
  const params = new URLSearchParams(search);
  const [a, b] = parts;

  if (!a || a === "index.html") return { name: "home", params };
  if (a === "search") return { name: "search", params };
  if (DLC_IDS.has(a) && parts.length === 1) return { name: "dlc", dlc: a, params };
  if (CAT_IDS.has(a)) {
    if (parts.length === 1) return { name: "category", category: a, params };
    if (parts.length === 2) return { name: "item", category: a, id: b, params };
  }
  return { name: "notfound", params };
}

let onRoute = () => {};

export function navigate(url, { replace = false, scroll = true } = {}) {
  const target = new URL(url, location.origin);
  if (target.origin !== location.origin) { location.href = target.href; return; }
  const same = target.pathname + target.search === location.pathname + location.search;
  if (replace || same) history.replaceState(null, "", target.pathname + target.search + target.hash);
  else history.pushState(null, "", target.pathname + target.search + target.hash);
  onRoute(parseRoute(target.pathname, target.search), { scroll });
}

export function currentRoute() {
  return parseRoute(location.pathname, location.search);
}

// Restaura la URL limpia cuando llegamos desde el 404.html con ?p=
function restoreFromRedirect() {
  const params = new URLSearchParams(location.search);
  const p = params.get("p");
  if (!p || !p.startsWith("/") || p.startsWith("//")) return;
  params.delete("p");
  const rest = params.toString();
  history.replaceState(null, "", BASE + p + (rest ? "?" + rest : "") + location.hash);
}

export function initRouter(handler) {
  onRoute = handler;
  restoreFromRedirect();

  window.addEventListener("popstate", () => handler(currentRoute(), { scroll: false }));

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a[data-link]");
    if (!a || a.target === "_blank") return;
    const u = new URL(a.href, location.origin);
    if (u.origin !== location.origin || !u.pathname.startsWith(BASE)) return;
    e.preventDefault();
    navigate(u.pathname + u.search + u.hash);
  });

  handler(currentRoute(), { scroll: false, initial: true });
}

// ============ SEO / metadatos ============
function setTag(selector, create, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) { el = document.createElement(create); document.head.appendChild(el); }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

export function setMeta({ title, description, path = location.pathname, image, type = "website", jsonld = null }) {
  const fullTitle = title ? `${title} — ${GAME.name} Wiki · OxygeNMedia` : `${GAME.name} Wiki — OxygeNMedia`;
  const desc = (description || `Explorador interactivo de ${GAME.title}: filtra por DLC y categoría, busca gritos, armas, NPCs, lugares y misiones.`).slice(0, 200);
  const url = location.origin + path;
  const img = image || `${location.origin}${BASE}/assets/images/og-default.svg`;

  document.title = fullTitle;
  setTag('meta[name="description"]', "meta", { name: "description", content: desc });
  setTag('link[rel="canonical"]', "link", { rel: "canonical", href: url });
  setTag('meta[property="og:title"]', "meta", { property: "og:title", content: fullTitle });
  setTag('meta[property="og:description"]', "meta", { property: "og:description", content: desc });
  setTag('meta[property="og:type"]', "meta", { property: "og:type", content: type });
  setTag('meta[property="og:url"]', "meta", { property: "og:url", content: url });
  setTag('meta[property="og:image"]', "meta", { property: "og:image", content: img });
  setTag('meta[name="twitter:card"]', "meta", { name: "twitter:card", content: "summary_large_image" });

  const old = document.getElementById("jsonld");
  if (old) old.remove();
  if (jsonld) {
    const s = document.createElement("script");
    s.id = "jsonld";
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(jsonld);
    document.head.appendChild(s);
  }
}
