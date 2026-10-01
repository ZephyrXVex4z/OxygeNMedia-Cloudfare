// filters.js
// Estado de filtros (en la URL, compartible), aplicación sobre listas, orden, conteos
// por faceta y el panel de filtros (DOM).
//
// Estado: { dlc: string[], cat: string[], q: string, sort: "name"|"dlc"|"location"|"type" }
// dlc vacío = todos los contenidos.

import { DLCS, CATEGORIES } from "./data.js";

export const SORTS = [
  { id: "name", label: "Nombre" },
  { id: "dlc", label: "DLC" },
  { id: "location", label: "Ubicación" },
  { id: "type", label: "Tipo" }
];

const DLC_IDS = new Set(DLCS.map((d) => d.id));
const CAT_IDS = new Set(CATEGORIES.map((c) => c.id));
const SORT_IDS = new Set(SORTS.map((s) => s.id));

const list = (v) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []);

export function parseFilters(params) {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params || "");
  const sort = p.get("sort");
  return {
    dlc: list(p.get("dlc")).filter((d) => DLC_IDS.has(d)),
    cat: list(p.get("cat")).filter((c) => CAT_IDS.has(c)),
    q: (p.get("q") || "").slice(0, 120),
    sort: SORT_IDS.has(sort) ? sort : "name"
  };
}

// Devuelve "?a=b&c=d" (o "" si no hay nada que serializar). `omit` excluye claves.
export function serializeFilters(f, omit = []) {
  const p = new URLSearchParams();
  if (f.dlc?.length && !omit.includes("dlc")) p.set("dlc", f.dlc.join(","));
  if (f.cat?.length && !omit.includes("cat")) p.set("cat", f.cat.join(","));
  if (f.q && !omit.includes("q")) p.set("q", f.q);
  if (f.sort && f.sort !== "name" && !omit.includes("sort")) p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function applyFilters(items, f = {}) {
  const dlc = f.dlc || [];
  const cat = f.cat || [];
  return items.filter((i) => (!dlc.length || dlc.includes(i.dlc)) && (!cat.length || cat.includes(i.category)));
}

export function sortItems(items, sort = "name") {
  const dlcOrder = new Map(DLCS.map((d, i) => [d.id, i]));
  const byName = (a, b) => a.name.localeCompare(b.name, "es");
  const cmp = {
    name: byName,
    dlc: (a, b) => (dlcOrder.get(a.dlc) - dlcOrder.get(b.dlc)) || byName(a, b),
    location: (a, b) => {
      const la = a.location || "\uffff"; // sin ubicación al final
      const lb = b.location || "\uffff";
      return la.localeCompare(lb, "es") || byName(a, b);
    },
    type: (a, b) => (a.type || "").localeCompare(b.type || "") || byName(a, b)
  }[sort] || byName;
  return [...items].sort(cmp);
}

// Conteo por DLC y por categoría, calculado ignorando la propia faceta
// (así el usuario ve cuántos resultados tendría al activarla).
export function facetCounts(items, f = {}) {
  const dlc = {};
  const cat = {};
  applyFilters(items, { cat: f.cat }).forEach((i) => { dlc[i.dlc] = (dlc[i.dlc] || 0) + 1; });
  applyFilters(items, { dlc: f.dlc }).forEach((i) => { cat[i.category] = (cat[i.category] || 0) + 1; });
  return { dlc, cat };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ============ Panel de filtros ============
// opts: { lockCategory?: boolean, showSearch?: boolean, showCategory?: boolean, items }
// onChange(nuevoEstado) se llama con el estado completo tras cada cambio.
export function renderFilterPanel(container, state, onChange, opts = {}) {
  const { items = [], lockCategory = false, showCategory = true, showSearch = true } = opts;
  const counts = facetCounts(items, state);
  const emit = (patch) => onChange({ ...state, ...patch });

  container.innerHTML = `
    <form class="fp" role="search" aria-label="Filtros" onsubmit="return false">
      ${showSearch ? `
      <div class="fp-group">
        <label class="fp-label" for="fp-q">Filtrar por texto</label>
        <input id="fp-q" class="fp-input" type="search" inputmode="search" autocomplete="off" placeholder="Nombre, efecto, lugar…" value="${esc(state.q)}">
      </div>` : ""}

      <fieldset class="fp-group">
        <legend class="fp-label">Contenido</legend>
        <div class="fp-chips" role="group" aria-label="Filtrar por DLC">
          <button type="button" class="chip ${state.dlc.length ? "" : "on"}" data-dlc="" aria-pressed="${!state.dlc.length}">Todo</button>
          ${DLCS.map((d) => `
            <button type="button" class="chip ${state.dlc.includes(d.id) ? "on" : ""}" data-dlc="${d.id}" aria-pressed="${state.dlc.includes(d.id)}" style="--chip:${d.color}">
              <span aria-hidden="true">${d.emoji}</span> ${esc(d.id === "anniversary" ? "Anniversary" : d.name)}
              <span class="chip-n">${counts.dlc[d.id] || 0}</span>
            </button>`).join("")}
        </div>
      </fieldset>

      ${showCategory && !lockCategory ? `
      <div class="fp-group">
        <label class="fp-label" for="fp-cat">Categoría</label>
        <select id="fp-cat" class="fp-input">
          <option value="">Todas las categorías</option>
          ${CATEGORIES.map((c) => `<option value="${c.id}" ${state.cat[0] === c.id ? "selected" : ""}>${c.icon} ${esc(c.name)} (${counts.cat[c.id] || 0})</option>`).join("")}
        </select>
      </div>` : ""}

      <div class="fp-group">
        <label class="fp-label" for="fp-sort">Ordenar por</label>
        <select id="fp-sort" class="fp-input">
          ${SORTS.map((s) => `<option value="${s.id}" ${state.sort === s.id ? "selected" : ""}>${s.label}</option>`).join("")}
        </select>
      </div>

      <button type="button" class="btn ghost fp-reset" ${state.dlc.length || state.q || (!lockCategory && state.cat.length) ? "" : "disabled"}>Limpiar filtros</button>
    </form>`;

  container.querySelectorAll("[data-dlc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.dlc;
      if (!id) return emit({ dlc: [] });
      const dlc = state.dlc.includes(id) ? state.dlc.filter((d) => d !== id) : [...state.dlc, id];
      emit({ dlc });
    });
  });

  const cat = container.querySelector("#fp-cat");
  if (cat) cat.addEventListener("change", () => emit({ cat: cat.value ? [cat.value] : [] }));
  container.querySelector("#fp-sort").addEventListener("change", (e) => emit({ sort: e.target.value }));

  const q = container.querySelector("#fp-q");
  if (q) {
    let t;
    q.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => emit({ q: q.value.trim() }), 220);
    });
  }

  container.querySelector(".fp-reset").addEventListener("click", () => {
    emit({ dlc: [], q: "", cat: lockCategory ? state.cat : [] });
  });
}
