// app.js
// Punto de entrada: monta el buscador global, el selector de tema y las vistas
// (inicio, DLC, categoría, artículo, búsqueda). Toda la lectura de datos pasa por api.js.

import { GAME, DLCS, CATEGORIES, ITEMS, getItemById, getDlc as dlcById, getCategory as catById } from "./data.js";
import { searchSkyrim, getArticle, getFilteredData, getDLC, getRelatedItems, remoteSearchUrl } from "./api.js";
import { suggest, addRecent, getRecent, clearRecent, debounce } from "./search.js";
import { parseFilters, serializeFilters, renderFilterPanel, applyFilters } from "./filters.js";
import { initRouter, navigate, href, setMeta, currentRoute } from "./navigation.js";

const $ = (s, r = document) => r.querySelector(s);
const main = $("#app");
const searchHost = $("#searchHost");

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const truncate = (s, n = 110) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const TYPE_LABEL = {
  shout: "Grito", "weapon-set": "Conjunto de armas", "armor-set": "Conjunto de armadura", ingredient: "Ingrediente",
  spell: "Hechizo", dragon: "Dragón", creature: "Criatura", npc: "NPC", pet: "Mascota", mount: "Montura", place: "Lugar",
  quest: "Misión", faction: "Facción", artifact: "Artefacto", skill: "Habilidad", perk: "Ventaja", mechanic: "Mecánica",
  book: "Libro", key: "Llave", currency: "Moneda", item: "Objeto"
};

const itemUrl = (it) => href(`${it.category}/${it.id}`);
const dlcBadge = (id) => {
  const d = dlcById(id);
  return d ? `<span class="badge" style="--chip:${d.color}"><span aria-hidden="true">${d.emoji}</span> ${esc(d.id === "anniversary" ? "Anniversary" : d.name)}</span>` : "";
};

// ============ Estado de vista ============
let renderToken = 0;
let lastPath = null;
let scopeOff = false;       // el usuario quitó el alcance del buscador
let filtersOpen = false;    // panel de filtros desplegado en móvil

// ============ Tema (reutiliza el sistema de OxygeNMedia) ============
async function initTheme() {
  const sel = $("#themeSelect");
  try {
    const { TEMAS, aplicarTema, obtenerTemaGuardado } = await import("/temas.js");
    sel.innerHTML = Object.entries(TEMAS).map(([id, t]) => `<option value="${id}">${esc(t.emoji)} ${esc(t.nombre)}</option>`).join("");
    sel.value = obtenerTemaGuardado();
    sel.addEventListener("change", () => aplicarTema(sel.value));
    sel.hidden = false;
  } catch {
    sel.hidden = true; // si temas.js no está disponible, tema-inline.js ya aplicó el guardado
  }
}

// ============ Buscador global ============
function activeFilters() {
  if (scopeOff) return { dlc: [], cat: [], q: "", sort: "name" };
  const r = currentRoute();
  const f = parseFilters(r.params);
  if (r.name === "dlc") f.dlc = [r.dlc];
  if (r.name === "category" || r.name === "item") f.cat = [r.category];
  if (r.name === "item") f.cat = [];
  f.q = "";
  return f;
}

function scopeLabel(f) {
  const parts = [];
  if (f.dlc.length) parts.push(f.dlc.map((d) => dlcById(d)?.name).filter(Boolean).join(" + "));
  if (f.cat.length) parts.push(f.cat.map((c) => catById(c)?.name).filter(Boolean).join(" + "));
  return parts.join(", ");
}

function mountSearch() {
  searchHost.innerHTML = `
    <div class="sb" role="search">
      <label class="sr" for="gs">Buscar en ${esc(GAME.name)} Wiki</label>
      <div class="sb-box">
        <span class="sb-ico" aria-hidden="true">🔎</span>
        <input id="gs" type="search" role="combobox" aria-expanded="false" aria-controls="gs-list" aria-autocomplete="list"
               autocomplete="off" enterkeyhint="search" placeholder="Buscar: Serana, Arvak, Dragon Aspect, Solstheim…">
        <button class="btn sb-go" type="button" id="gs-go">Buscar</button>
      </div>
      <ul id="gs-list" class="sb-list" role="listbox" aria-label="Sugerencias" hidden></ul>
      <p id="gs-scope" class="sb-scope" hidden></p>
    </div>`;

  const input = $("#gs");
  const list = $("#gs-list");
  let options = [];
  let active = -1;

  const setActive = (i) => {
    active = i;
    list.querySelectorAll("[role=option]").forEach((el, idx) => {
      el.setAttribute("aria-selected", String(idx === i));
      el.classList.toggle("on", idx === i);
    });
    if (i >= 0) input.setAttribute("aria-activedescendant", `gs-o${i}`); else input.removeAttribute("aria-activedescendant");
  };
  const open = (html) => { list.innerHTML = html; list.hidden = false; input.setAttribute("aria-expanded", "true"); };
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); setActive(-1); };

  const go = (q) => {
    const text = (q ?? input.value).trim();
    if (!text) { input.focus(); return; }
    addRecent(text);
    close();
    const f = activeFilters();
    navigate(href("search", serializeFilters({ ...f, q: text }, ["sort"])));
  };

  const show = () => {
    const q = input.value.trim();
    options = [];
    if (!q) {
      const recent = getRecent();
      if (!recent.length) return close();
      options = recent.map((r) => ({ kind: "recent", q: r }));
      open(`<li class="sb-head" role="presentation">Búsquedas recientes <button type="button" class="link" id="gs-clear">Borrar</button></li>` +
        options.map((o, i) => `<li id="gs-o${i}" role="option" aria-selected="false" data-i="${i}">🕘 ${esc(o.q)}</li>`).join(""));
      const clr = $("#gs-clear");
      clr?.addEventListener("mousedown", (e) => { e.preventDefault(); clearRecent(); close(); });
    } else {
      let res = [];
      try { res = suggest(q, activeFilters(), 7); } catch { res = []; }
      options = res.map((item) => ({ kind: "item", item }));
      options.push({ kind: "all", q });
      open(options.map((o, i) => {
        if (o.kind === "item") {
          const c = catById(o.item.category);
          return `<li id="gs-o${i}" role="option" aria-selected="false" data-i="${i}"><span aria-hidden="true">${c?.icon || "•"}</span> <span class="sb-name">${esc(o.item.name)}</span> ${dlcBadge(o.item.dlc)}</li>`;
        }
        return `<li id="gs-o${i}" role="option" aria-selected="false" data-i="${i}" class="sb-all">${res.length ? "Ver todos los resultados" : "Sin coincidencias locales. Buscar también en UESP"}: «${esc(q)}»</li>`;
      }).join(""));
    }
    setActive(-1);
  };

  const choose = (i) => {
    const o = options[i];
    if (!o) return go();
    if (o.kind === "item") { addRecent(input.value); close(); input.value = ""; navigate(itemUrl(o.item)); }
    else if (o.kind === "recent") { input.value = o.q; go(o.q); }
    else go(o.q);
  };

  const debounced = debounce(show, 160);
  input.addEventListener("input", () => {
    if (input.value.trim()) open(`<li class="sb-head" role="presentation" aria-live="polite">Buscando…</li>`);
    debounced();
  });
  input.addEventListener("focus", show);
  input.addEventListener("keydown", (e) => {
    const n = options.length;
    if (e.key === "ArrowDown" && n) { e.preventDefault(); if (list.hidden) show(); setActive((active + 1) % n); }
    else if (e.key === "ArrowUp" && n) { e.preventDefault(); setActive((active - 1 + n) % n); }
    else if (e.key === "Enter") { e.preventDefault(); active >= 0 ? choose(active) : go(); }
    else if (e.key === "Escape") { close(); }
  });
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("[data-i]");
    if (li) { e.preventDefault(); choose(Number(li.dataset.i)); }
  });
  $("#gs-go").addEventListener("click", () => go());
  document.addEventListener("click", (e) => { if (!e.target.closest(".sb")) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
  });
}

function updateScope() {
  const el = $("#gs-scope");
  if (!el) return;
  const label = scopeLabel(activeFilters());
  if (!label) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `La búsqueda se limita a: <strong>${esc(label)}</strong> <button type="button" class="link" id="gs-unscope">Buscar en todo</button>`;
  $("#gs-unscope").addEventListener("click", () => { scopeOff = true; updateScope(); $("#gs").focus(); });
}

// ============ Piezas de UI ============
function card(it) {
  const c = catById(it.category);
  const d = dlcById(it.dlc);
  return `
    <li>
      <a class="card" data-link href="${itemUrl(it)}" style="--dlc:${d?.color || "var(--accent)"}">
        ${it.image
          ? `<img class="card-img" src="${esc(it.image)}" alt="${esc(it.name)}" loading="lazy" decoding="async">`
          : `<span class="card-ico" aria-hidden="true">${c?.icon || "📜"}</span>`}
        <span class="card-body">
          <span class="card-name">${esc(it.name)}</span>
          <span class="card-tags">${dlcBadge(it.dlc)} <span class="card-cat">${esc(c?.name || "")}</span></span>
          <span class="card-desc">${esc(truncate(it.effect || it.description))}</span>
        </span>
      </a>
    </li>`;
}

const resultsGrid = (items) => `<ul class="grid" aria-label="Resultados">${items.map(card).join("")}</ul>`;

function breadcrumb(trail) {
  return `<nav class="crumbs" aria-label="Ruta de navegación"><ol>${trail.map((t, i) =>
    i === trail.length - 1
      ? `<li aria-current="page">${esc(t.label)}</li>`
      : `<li><a data-link href="${t.href}">${esc(t.label)}</a></li>`).join("")}</ol></nav>`;
}

function emptyState({ title, text, actions = "" }) {
  return `<div class="empty" role="status"><p class="empty-t">${esc(title)}</p><p>${text}</p><div class="empty-a">${actions}</div></div>`;
}

// Inserta HTML conservando el foco del campo activo (útil al filtrar escribiendo).
function mount(html, { keepFocus = false } = {}) {
  const prev = document.activeElement;
  const prevId = keepFocus && prev && main.contains(prev) ? prev.id : "";
  const pos = prevId && prev.selectionStart != null ? prev.selectionStart : null;
  main.innerHTML = html;
  if (prevId) {
    const el = document.getElementById(prevId);
    if (el) { el.focus({ preventScroll: true }); if (pos != null && el.setSelectionRange) try { el.setSelectionRange(pos, pos); } catch { /* tipo sin selección */ } }
  }
}

function wireFilterToggle() {
  const btn = $("#toggleFilters");
  const aside = $("#filters");
  if (!btn || !aside) return;
  aside.classList.toggle("open", filtersOpen);
  btn.setAttribute("aria-expanded", String(filtersOpen));
  btn.addEventListener("click", () => {
    filtersOpen = !filtersOpen;
    aside.classList.toggle("open", filtersOpen);
    btn.setAttribute("aria-expanded", String(filtersOpen));
  });
}

// ============ Vista: inicio ============
function viewHome() {
  setMeta({ title: "", path: href("") });
  const quick = [
    ["shouts", "Todos los gritos"], ["pets", "Todas las mascotas"], ["mounts", "Todas las monturas"],
    ["artifacts", "Todos los artefactos"], ["weapons", "Todas las armas"], ["npcs", "Todos los NPCs"], ["quests", "Todas las misiones"]
  ];
  mount(`
    <section class="hero">
      <div class="hero-text">
        <h1 tabindex="-1">Skyrim Wiki</h1>
        <p>Explora ${esc(GAME.title)} por contenido y categoría: qué añadió cada expansión, dónde están las palabras de poder, qué armas, criaturas y misiones existen. Usa la búsqueda de arriba o filtra por DLC.</p>
        <p class="hero-stats">${plural(ITEMS.length, "artículo", "artículos")} en ${plural(CATEGORIES.length, "categoría", "categorías")} y ${plural(DLCS.length, "contenido", "contenidos")}.</p>
      </div>
      <a class="tablet" data-link href="${href("shouts/unrelenting-force")}" aria-label="Ver el grito Unrelenting Force: Fus Ro Dah">
        <span class="tablet-words" lang="und"><span>Fus</span><span>Ro</span><span>Dah</span></span>
        <span class="tablet-tr">Fuerza · Equilibrio · Empujar</span>
        <span class="tablet-cap">Unrelenting Force, el primer grito</span>
      </a>
    </section>

    <section aria-labelledby="h-dlc">
      <h2 id="h-dlc">Explorar Skyrim</h2>
      <ul class="dlc-grid">
        ${DLCS.map((d) => `
          <li><a class="dlc-card" data-link href="${href(d.id)}" style="--dlc:${d.color}">
            <span class="dlc-emoji" aria-hidden="true">${d.emoji}</span>
            <span class="dlc-name">${esc(d.name)}</span>
            <span class="dlc-tag">${esc(d.tagline)}</span>
            <span class="dlc-n">${plural(applyFilters(ITEMS, { dlc: [d.id] }).length, "artículo", "artículos")}</span>
          </a></li>`).join("")}
      </ul>
    </section>

    <section aria-labelledby="h-cat">
      <h2 id="h-cat">Explorar por categoría</h2>
      <ul class="cat-grid">
        ${CATEGORIES.map((c) => `
          <li><a class="cat-tile" data-link href="${href(c.id)}">
            <span class="cat-ico" aria-hidden="true">${c.icon}</span>
            <span class="cat-name">${esc(c.name)}</span>
            <span class="cat-n">${applyFilters(ITEMS, { cat: [c.id] }).length}</span>
          </a></li>`).join("")}
      </ul>
    </section>

    <section aria-labelledby="h-quick">
      <h2 id="h-quick">Exploración rápida</h2>
      <div class="quick">${quick.map(([id, label]) => `<a class="btn ghost" data-link href="${href(id)}">${esc(label)}</a>`).join("")}</div>
    </section>
  `);
}

// ============ Vista: categoría ============
async function viewCategory(route, token, keep) {
  const cat = catById(route.category);
  const state = { ...parseFilters(route.params), cat: [cat.id] };
  const items = await getFilteredData(state);
  if (token !== renderToken) return;

  const base = applyFilters(ITEMS, { cat: [cat.id] });
  setMeta({
    title: cat.name,
    description: `${cat.description} ${items.length} resultados en la base de ${GAME.name}.`,
    path: href(cat.id)
  });

  mount(`
    ${breadcrumb([{ label: "Skyrim Wiki", href: href("") }, { label: cat.name }])}
    <header class="page-head">
      <h1 tabindex="-1"><span aria-hidden="true">${cat.icon}</span> ${esc(cat.name)}</header>
  `.replace("</header>", "</h1><p>" + esc(cat.description) + "</p></header>") + `
    <div class="layout">
      <button type="button" class="btn ghost only-mobile" id="toggleFilters" aria-expanded="false" aria-controls="filters">Filtros${state.dlc.length || state.q ? " (activos)" : ""}</button>
      <aside id="filters" class="side" aria-label="Filtros"></aside>
      <section class="results" aria-labelledby="count">
        <p id="count" class="count" role="status" aria-live="polite">${plural(items.length, "resultado", "resultados")}${items.length !== base.length ? ` de ${base.length}` : ""}</p>
        ${items.length ? resultsGrid(items) : emptyState({
          title: "No hay artículos con estos filtros",
          text: base.length
            ? "Prueba con otro DLC o quita el texto de filtro."
            : `La base local aún no tiene artículos de ${esc(cat.name.toLowerCase())}. Puedes consultarlos en UESP.`,
          actions: `${state.dlc.length || state.q ? `<a class="btn" data-link href="${href(cat.id)}">Quitar filtros</a>` : ""}
                    <a class="btn ghost" href="${remoteSearchUrl(cat.name)}" target="_blank" rel="noopener">Buscar en UESP</a>`
        })}
      </section>
    </div>
  `, { keepFocus: keep });

  renderFilterPanel($("#filters"), state, (s) => navigate(href(cat.id, serializeFilters(s, ["cat"])), { replace: true, scroll: false }),
    { items: base, lockCategory: true });
  wireFilterToggle();
}

// ============ Vista: DLC ============
async function viewDlc(route, token, keep) {
  const dlc = dlcById(route.dlc);
  const catId = route.params.get("cat");
  const selected = CATEGORIES.find((c) => c.id === catId) || null;
  const all = await getDLC(dlc.id);
  const chosen = selected ? await getDLC(dlc.id, selected.id) : [];
  if (token !== renderToken) return;

  setMeta({ title: dlc.name, description: `${dlc.description}`, path: href(dlc.id) });

  const exclusives = all.filter((i) => i.type !== "mechanic").slice(0, 8);
  mount(`
    ${breadcrumb([{ label: "Skyrim Wiki", href: href("") }, { label: dlc.name }])}
    <header class="dlc-hero" style="--dlc:${dlc.color}">
      <span class="dlc-hero-ico" aria-hidden="true">${dlc.emoji}</span>
      <div>
        <h1 tabindex="-1">${esc(dlc.name)}</h1>
        <p class="dlc-hero-tag">${esc(dlc.tagline)} · ${esc(dlc.year)}</p>
        <p>${esc(dlc.description)}</p>
      </div>
    </header>

    <section aria-labelledby="h-mech">
      <h2 id="h-mech">Mecánicas y contenido</h2>
      <ul class="mech">${dlc.mechanics.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
    </section>

    <section aria-labelledby="h-cats">
      <h2 id="h-cats">Categorías de ${esc(dlc.name)}</h2>
      <ul class="cat-grid">
        ${CATEGORIES.map((c) => {
          const n = all.filter((i) => i.category === c.id).length;
          const on = selected?.id === c.id;
          return `<li><a class="cat-tile ${on ? "on" : ""} ${n ? "" : "zero"}" data-link href="${href(dlc.id, `?cat=${c.id}`)}#resultados" ${on ? 'aria-current="true"' : ""}>
            <span class="cat-ico" aria-hidden="true">${c.icon}</span><span class="cat-name">${esc(c.name)}</span><span class="cat-n">${n}</span></a></li>`;
        }).join("")}
      </ul>
    </section>

    <section id="resultados" aria-labelledby="h-res">
      ${selected ? `
        <h2 id="h-res">${selected.icon} ${esc(selected.name)} en ${esc(dlc.name)}</h2>
        <p class="count" role="status">${plural(chosen.length, "resultado", "resultados")}
          · <a data-link href="${href(selected.id, `?dlc=${dlc.id}`)}">Ver con más filtros</a> ·
          <a data-link href="${href(dlc.id)}">Quitar categoría</a></p>
        ${chosen.length ? resultsGrid(chosen) : emptyState({
          title: `${dlc.name} no tiene artículos de ${selected.name.toLowerCase()} en la base local`,
          text: "Puede que no existan en esta expansión o que aún no estén cargados. Consulta la fuente externa.",
          actions: `<a class="btn ghost" href="${remoteSearchUrl(`${dlc.name} ${selected.name}`)}" target="_blank" rel="noopener">Buscar en UESP</a>`
        })}`
      : `
        <h2 id="h-res">Contenido destacado</h2>
        ${exclusives.length ? resultsGrid(exclusives) : emptyState({ title: "Sin artículos todavía", text: "Este contenido aún no tiene artículos en la base local." })}
        <p class="more"><a class="btn ghost" data-link href="${href("search", `?q=&dlc=${dlc.id}`)}">Buscar dentro de ${esc(dlc.name)}</a></p>`}
    </section>
  `, { keepFocus: keep });
}

// ============ Vista: artículo ============
function wordsSection(it) {
  if (!it.words?.length) return "";
  const searchHref = it.uesp ? it.sources?.[0]?.url : remoteSearchUrl(it.name);
  return `
    <section aria-labelledby="h-words">
      <h2 id="h-words">Palabras de poder</h2>
      <ol class="words">
        ${it.words.map((w, i) => `
          <li class="word">
            <span class="word-n" aria-label="Palabra ${i + 1}">${i + 1}</span>
            <span class="word-main"><span class="word-dov" lang="und">${esc(w.word)}</span><span class="word-tr">${esc(w.translation || "Sin traducción registrada")}</span></span>
            <span class="word-loc">${w.location
              ? `<strong>Ubicación:</strong> ${esc(w.location)}`
              : `Ubicación aún no registrada en la base local. <a href="${esc(searchHref)}" target="_blank" rel="noopener">Consultar en UESP</a>`}
              ${w.description ? `<br>${esc(w.description)}` : ""}</span>
          </li>`).join("")}
      </ol>
    </section>`;
}

function infoRows(it) {
  const c = catById(it.category);
  const d = dlcById(it.dlc);
  const rows = [
    ["Categoría", `<a data-link href="${href(it.category)}">${esc(c.name)}</a>`],
    ["Contenido", `<a data-link href="${href(d.id)}">${esc(d.name)}</a>`],
    ["Tipo", esc(TYPE_LABEL[it.type] || it.type)]
  ];
  if (it.type === "shout") {
    rows.push(["Tiempo de reutilización", it.cooldown ? esc(it.cooldown) : "Varía según la palabra desbloqueada"]);
    rows.push(["Alma de dragón", esc(it.dragonSoulCost || "—")]);
  }
  if (it.location) rows.push(["Ubicación", esc(it.location)]);
  if (it.requirements) rows.push(["Requisitos", esc(it.requirements)]);
  return rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

function linkChips(list) {
  return `<ul class="chips">${list.map((r) => `<li><a class="chip-link" data-link href="${itemUrl(r)}"><span aria-hidden="true">${catById(r.category)?.icon || ""}</span> ${esc(r.name)}</a></li>`).join("")}</ul>`;
}

async function viewItem(route, token) {
  const art = await getArticle(route.id, { remote: false });
  if (!art || art.item.category !== route.category) return viewNotFound(token);
  const it = art.item;
  const c = catById(it.category);
  const { outgoing, incoming } = await getRelatedItems(it.id);
  if (token !== renderToken) return;

  const places = outgoing.filter((r) => r.category === "places" || r.category === "houses");
  const quests = outgoing.filter((r) => r.category === "quests");
  const questNames = (it.quests || []).filter((q) => !getItemById(q));
  const others = outgoing.filter((r) => !places.includes(r) && !quests.includes(r));
  const searchUrl = it.sources[0]?.url || remoteSearchUrl(it.name);

  setMeta({
    title: it.name,
    description: `${it.name} (${c.name}, ${dlcById(it.dlc).name}): ${it.effect || it.description}`,
    path: itemUrl(it),
    image: it.image ? new URL(it.image, location.origin).href : undefined,
    type: "article",
    jsonld: {
      "@context": "https://schema.org", "@type": "Article", headline: it.name, description: it.description,
      about: GAME.title, url: location.origin + itemUrl(it), inLanguage: "es", isPartOf: { "@type": "WebSite", name: "OxygeNMedia", url: GAME.home }
    }
  });

  mount(`
    ${breadcrumb([{ label: "Skyrim Wiki", href: href("") }, { label: c.name, href: href(c.id) }, { label: it.name }])}
    <article class="article" itemscope itemtype="https://schema.org/Article">
      <header class="art-head" style="--dlc:${dlcById(it.dlc).color}">
        ${it.image ? `<img class="art-img" src="${esc(it.image)}" alt="${esc(it.name)}" loading="lazy" decoding="async">` : `<span class="art-ico" aria-hidden="true">${c.icon}</span>`}
        <div>
          <h1 tabindex="-1" itemprop="headline">${esc(it.name)}</h1>
          <p class="art-tags">
            <a class="badge plain" data-link href="${href(c.id)}">${c.icon} ${esc(c.name)}</a>
            <a class="badge-link" data-link href="${href(it.dlc)}">${dlcBadge(it.dlc)}</a>
          </p>
        </div>
      </header>

      <div class="art-grid">
        <div class="art-main">
          <section class="parchment" aria-labelledby="h-desc">
            <h2 id="h-desc" class="sr">Descripción</h2>
            <p itemprop="description">${esc(it.description)}</p>
          </section>

          ${it.effect ? `<section aria-labelledby="h-eff"><h2 id="h-eff">Efecto</h2><p>${esc(it.effect)}</p></section>` : ""}
          ${wordsSection(it)}

          ${places.length ? `<section aria-labelledby="h-pl"><h2 id="h-pl">Lugares relacionados</h2>${linkChips(places)}</section>` : ""}
          ${quests.length || questNames.length ? `<section aria-labelledby="h-q"><h2 id="h-q">Misiones relacionadas</h2>
            ${quests.length ? linkChips(quests) : ""}${questNames.length ? `<p>${questNames.map(esc).join(", ")}</p>` : ""}</section>` : ""}
          ${others.length || incoming.length ? `<section aria-labelledby="h-rel"><h2 id="h-rel">Relacionado con</h2>
            ${others.length ? linkChips(others) : ""}
            ${incoming.length ? `<p class="sub">Artículos que lo mencionan</p>${linkChips(incoming)}` : ""}</section>` : ""}

          <div id="remote-slot" aria-live="polite">${it.uesp ? `<p class="muted">Cargando extracto de UESP…</p>` : ""}</div>

          <section class="sources" aria-labelledby="h-src">
            <h2 id="h-src">Fuentes</h2>
            <ul>
              ${it.sources.length
                ? it.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a> (${esc(s.license)})</li>`).join("")
                : `<li>Dato editorial de la base local de OxygeNMedia. <a href="${esc(searchUrl)}" target="_blank" rel="noopener">Verificar en UESP</a></li>`}
            </ul>
            <p class="muted">Los datos locales son un resumen propio. Comprueba siempre cifras y ubicaciones exactas en la fuente.</p>
          </section>
        </div>

        <aside class="art-side" aria-label="Información">
          <h2>Información</h2>
          <dl class="info">${infoRows(it)}</dl>
          <a class="btn ghost" data-link href="${href(c.id, `?dlc=${it.dlc}`)}">Más de ${esc(c.name.toLowerCase())} en ${esc(dlcById(it.dlc).name)}</a>
        </aside>
      </div>
    </article>
  `);

  // Enriquecimiento remoto (no bloquea la página).
  if (it.uesp) {
    const { remote, remoteError } = await getArticle(it.id, { remote: true });
    if (token !== renderToken) return;
    const slot = $("#remote-slot");
    if (!slot) return;
    if (remote?.extract) {
      slot.innerHTML = `
        <section class="remote" aria-labelledby="h-uesp">
          <h2 id="h-uesp">Según UESP</h2>
          ${remote.image ? `<img class="remote-img" src="${esc(remote.image)}" alt="${esc(it.name)}" loading="lazy" decoding="async">` : ""}
          <p>${esc(remote.extract)}</p>
          <p class="muted">Extracto de <a href="${esc(remote.url)}" target="_blank" rel="noopener">${esc(remote.title)}</a> en ${esc(GAME.remote.name)}, bajo licencia <a href="${GAME.remote.licenseUrl}" target="_blank" rel="noopener">${esc(GAME.remote.license)}</a>. Contenido de terceros, no creado por OxygeNMedia.</p>
        </section>`;
    } else {
      slot.innerHTML = remoteError
        ? `<p class="muted">No se pudo cargar el extracto de UESP (${esc(remoteError)}). La información local sigue disponible.</p>`
        : `<p class="muted"><a href="${esc(searchUrl)}" target="_blank" rel="noopener">Ver más en UESP</a></p>`;
    }
  }
}

// ============ Vista: búsqueda ============
async function viewSearch(route, token, keep) {
  const state = parseFilters(route.params);
  const q = state.q;
  setMeta({ title: q ? `Buscar: ${q}` : "Buscar", path: href("search"), description: q ? `Resultados para «${q}» en ${GAME.title}.` : undefined });

  const header = `
    ${breadcrumb([{ label: "Skyrim Wiki", href: href("") }, { label: "Búsqueda" }])}
    <header class="page-head"><h1 tabindex="-1">${q ? `Resultados para «${esc(q)}»` : "Buscar en Skyrim Wiki"}</h1></header>`;

  const onChange = (s) => navigate(href("search", serializeFilters(s)), { replace: true, scroll: false });

  if (!q) {
    const recent = getRecent();
    mount(`${header}
      <div class="layout">
        <button type="button" class="btn ghost only-mobile" id="toggleFilters" aria-expanded="false" aria-controls="filters">Filtros</button>
        <aside id="filters" class="side" aria-label="Filtros"></aside>
        <section class="results">
          ${emptyState({ title: "Escribe qué quieres encontrar", text: "Prueba con un personaje, un grito, un lugar o un objeto. Puedes filtrar por DLC antes de buscar." })}
          ${recent.length ? `<p class="sub">Búsquedas recientes</p><ul class="chips">${recent.map((r) => `<li><a class="chip-link" data-link href="${href("search", serializeFilters({ ...state, q: r }))}">${esc(r)}</a></li>`).join("")}</ul>` : ""}
        </section>
      </div>`, { keepFocus: keep });
    renderFilterPanel($("#filters"), state, onChange, { items: ITEMS, showSearch: false });
    wireFilterToggle();
    return;
  }

  const localOnly = await searchSkyrim(q, state, { remote: false });
  if (token !== renderToken) return;
  const local = localOnly.local;

  mount(`${header}
    <div class="layout">
      <button type="button" class="btn ghost only-mobile" id="toggleFilters" aria-expanded="false" aria-controls="filters">Filtros${state.dlc.length || state.cat.length ? " (activos)" : ""}</button>
      <aside id="filters" class="side" aria-label="Filtros"></aside>
      <section class="results" aria-labelledby="count">
        <p id="count" class="count" role="status" aria-live="polite">${plural(local.length, "resultado local", "resultados locales")}</p>
        ${local.length ? resultsGrid(local) : emptyState({
          title: "Sin resultados locales",
          text: state.dlc.length || state.cat.length ? "Prueba a quitar filtros, o mira los resultados de UESP más abajo." : "Mira los resultados de UESP más abajo.",
          actions: state.dlc.length || state.cat.length ? `<a class="btn" data-link href="${href("search", serializeFilters({ ...state, dlc: [], cat: [] }))}">Quitar filtros</a>` : ""
        })}
        <section id="remote-results" aria-labelledby="h-remote" aria-live="polite">
          <h2 id="h-remote">Más resultados en UESP</h2>
          <p class="muted loading">Buscando en UESP…</p>
        </section>
      </section>
    </div>`, { keepFocus: keep });
  renderFilterPanel($("#filters"), state, onChange, { items: ITEMS, showSearch: false });
  wireFilterToggle();

  const { remote, remoteError } = await searchSkyrim(q, state, { remote: true });
  if (token !== renderToken) return;
  const box = $("#remote-results");
  if (!box) return;
  const body = remoteError
    ? `<p class="muted">No se pudo consultar UESP (${esc(remoteError)}). Los resultados locales siguen disponibles.</p>`
    : remote.length
      ? `<ul class="remote-list">${remote.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><p>${esc(r.snippet)}</p></li>`).join("")}</ul>
         <p class="muted">Resultados de ${esc(GAME.remote.name)} (${esc(GAME.remote.license)}). Contenido de terceros.</p>`
      : `<p class="muted">UESP no devolvió resultados adicionales para «${esc(q)}».</p>`;
  box.innerHTML = `<h2 id="h-remote">Más resultados en UESP</h2>${body}`;
}

// ============ Vista: 404 interna ============
function viewNotFound() {
  setMeta({ title: "Página no encontrada", path: location.pathname });
  mount(`
    <div class="empty" role="status">
      <h1 tabindex="-1" class="empty-t">No encontramos esta página de la wiki</h1>
      <p>El enlace puede estar mal escrito o el artículo aún no existe en la base local.</p>
      <div class="empty-a"><a class="btn" data-link href="${href("")}">Ir al inicio de Skyrim Wiki</a>
      <a class="btn ghost" data-link href="${href("search")}">Buscar</a></div>
    </div>`);
}

// ============ Enrutado ============
async function render(route, opts = {}) {
  const token = ++renderToken;
  const path = location.pathname;
  const samePage = path === lastPath;
  lastPath = path;
  if (!samePage) { scopeOff = false; filtersOpen = false; }

  try {
    if (route.name === "home") viewHome();
    else if (route.name === "category") await viewCategory(route, token, samePage);
    else if (route.name === "dlc") await viewDlc(route, token, samePage);
    else if (route.name === "item") await viewItem(route, token);
    else if (route.name === "search") await viewSearch(route, token, samePage);
    else viewNotFound();
  } catch (err) {
    console.error(err);
    if (token === renderToken) {
      mount(emptyState({
        title: "Algo salió mal al cargar esta página",
        text: "Recarga la página o vuelve al inicio.",
        actions: `<a class="btn" data-link href="${href("")}">Volver al inicio</a>`
      }));
    }
  }
  if (token !== renderToken) return;

  updateScope();
  if (!samePage) {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else if (opts.scroll !== false) window.scrollTo({ top: 0 });
    if (!opts.initial) $("h1", main)?.focus({ preventScroll: true });
  }
}

// Imágenes rotas → placeholder (una sola vez por imagen).
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName !== "IMG" || img.dataset.fb) return;
  img.dataset.fb = "1";
  img.src = `${GAME.base}/assets/images/placeholder.svg`;
}, true);

mountSearch();
initTheme();
initRouter(render);
