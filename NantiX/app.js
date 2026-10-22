import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { CATS, NAV, navLabel, navFilter, KIND_FIELDS, FILTERS, norm } from "./js/categories.js";
import { fetchPosts, getPost, setStatus, removePost } from "./js/data.js";
import { $, h, toast, fail, dlg, openDlg, closeDlg, confirmDlg, card, skeletons, showPost } from "./js/ui.js";
import { openPostForm, openReport, openReportsList } from "./js/admin.js";

const S = { user: null, key: "home", q: "", sig: "", items: [], cursor: null, more: false, sort: "desc", filters: {} };
let lastList = "#/home";
const main = $("#main");
const refresh = () => show(S.key, S.q, true);
const back = () => { location.hash = lastList; };
const err = e => {
  if (e?.code !== "failed-precondition") return fail(e);
  console.error(e);
  const u = (e.message || "").match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
  openDlg(h("h2", {}, "Falta un índice de Firestore"),
    h("p", {}, "Esta consulta necesita un índice. Toca el enlace, pulsa «Crear índice» en Firebase y espera a que termine (unos minutos). Luego recarga."),
    u ? h("p", {}, h("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, "Crear índice en Firebase")) : h("p", {}, "Crea los índices de firestore.indexes.json desde la consola de Firebase."),
    h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: closeDlg }, "Cerrar")));
};

/* ---------- Cabecera, tema, sesión ---------- */
$("#themeBtn").onclick = () => {
  const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = n; try { localStorage.setItem("nx-theme", n); } catch {}
};
$("#logoutBtn").onclick = () => signOut(auth);
$("#menuBtn").onclick = e => { const o = $("#side").classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", o); };
$("#searchForm").addEventListener("submit", e => {
  e.preventDefault(); const t = $("#q").value.trim();
  location.hash = "#/c/" + (S.key === "home" ? "all" : S.key) + (t ? "?q=" + encodeURIComponent(t) : "");
});
$("#reportGen").onclick = () => openReport(null);
dlg.addEventListener("close", () => { if (location.hash.startsWith("#/p/")) back(); });

onAuthStateChanged(auth, u => {
  S.user = u; $("#who").textContent = u?.email || ""; $("#logoutBtn").hidden = !u; $("#loginLink").hidden = !!u;
  S.sig = ""; route();
});

/* ---------- Menú ---------- */
const href = k => k === "home" ? "#/home" : "#/c/" + k;
function renderNav() {
  $("#side").replaceChildren(
    ...NAV.map(g => h("div", { class: "ng" }, h("h4", {}, g.title),
      ...g.items.map(([k, l, i]) => h("a", { href: href(k), "aria-current": k === S.key ? "page" : null }, h("span", { "aria-hidden": "true" }, i), l)))),
    S.user && h("div", { class: "ng" }, h("h4", {}, "Administración"),
      h("button", { class: "btn primary", type: "button", onclick: () => openPostForm(null, refresh, S.user) }, "+ Nueva publicación"),
      h("a", { href: "#/c/drafts", "aria-current": S.key === "drafts" ? "page" : null }, h("span", { "aria-hidden": "true" }, "📝"), "Borradores"),
      h("button", { class: "btn", type: "button", onclick: openReportsList }, "Reportes")));
}

/* ---------- Rutas ---------- */
async function route() {
  const hash = location.hash || "#/home", [path, qs] = hash.slice(1).split("?"), parts = path.split("/").filter(Boolean);
  if (parts[0] === "p") { if (!S.sig) await show("home", ""); return openById(parts[1]); }
  if (dlg.open) closeDlg();
  lastList = hash;
  show(parts[0] === "c" ? parts[1] || "home" : "home", new URLSearchParams(qs).get("q") || "");
}
window.addEventListener("hashchange", route);

const ctx = {
  get admin() { return !!S.user; },
  edit: p => openPostForm(p, refresh, S.user),
  report: p => openReport(p),
  share: async p => { try { await navigator.clipboard.writeText(location.origin + location.pathname + "#/p/" + p.id); toast("Enlace copiado"); } catch { toast("No se pudo copiar el enlace."); } },
  remove: async p => { if (!(await confirmDlg(`Se eliminará «${p.title}». Esta acción no se puede deshacer.`))) return; try { await removePost(p); closeDlg(); toast("Publicación eliminada"); refresh(); } catch (e) { fail(e); } },
  toggle: async p => { try { await setStatus(p, p.status === "published" ? "draft" : "published"); closeDlg(); toast("Estado actualizado"); refresh(); } catch (e) { fail(e); } }
};
async function openById(id) {
  try {
    const p = await getPost(id);
    if (!p) { toast("Publicación no encontrada."); return back(); }
    document.title = p.title + " · NantiX"; showPost(p, ctx);
  } catch { toast("Publicación no disponible."); back(); }
}
async function show(key, q, force) {
  const sig = [key, q, !!S.user].join("|");
  if (sig === S.sig && !force) return;
  Object.assign(S, { key, q, sig, filters: {}, sort: "desc" });
  $("#q").value = q; renderNav(); $("#side").classList.remove("open");
  document.title = (key === "home" ? "" : (key === "drafts" ? "Borradores" : navLabel(key)) + " · ") + "NantiX";
  key === "home" && !q ? home() : list(true);
}

/* ---------- Inicio ---------- */
const SECTIONS = [
  ["Destacados", { scope: "featured" }, null],
  ["Publicaciones recientes", null, "all"],
  ["Música reciente", { scope: "group:music" }, "music"],
  ["Juegos y aplicaciones", { any: ["android", "ios", "pc", "consoles", "apps"].map(g => "group:" + g) }, null],
  ["Emuladores y herramientas", { any: ["emulators", "tools"].map(g => "group:" + g) }, "emulators"]
];
async function home() {
  const sig = S.sig;
  main.replaceChildren(h("h1", {}, "Biblioteca digital"), h("p", { class: "mute" }, "Enlaces de descarga organizados por categoría."),
    h("nav", { class: "chips", "aria-label": "Categorías" }, ...NAV.slice(1).flatMap(g => g.items).filter(i => i[0] !== "music").map(([k, l, i]) => h("a", { class: "chip", href: href(k) }, i + " " + l))),
    h("div", { id: "secs" }, h("div", { class: "grid" }, ...skeletons(6))));
  let res;
  try { res = await Promise.all(SECTIONS.map(s => fetchPosts({ filter: s[1], size: 8 }).then(r => r.items))); } catch (e) { err(e); res = []; }
  if (sig !== S.sig) return;
  const secs = SECTIONS.map((s, i) => res[i]?.length && h("section", { class: "sec" },
    h("div", { class: "sech" }, h("h2", {}, s[0]), s[2] && h("a", { href: href(s[2]) }, "Ver todo")), h("div", { class: "grid" }, ...res[i].map(card)))).filter(Boolean);
  $("#secs").replaceChildren(...(secs.length ? secs : [h("div", { class: "empty" }, "Todavía no hay publicaciones.")]));
}

/* ---------- Listados ---------- */
const kindOf = k => k === "music" ? "music" : CATS[k]?.kind;
async function list(reset) {
  const sig = S.sig, tok = norm(S.q).split(/[^a-z0-9]+/).filter(t => t.length >= 2)[0] || "";
  if (reset) {
    Object.assign(S, { items: [], cursor: null, more: false });
    main.replaceChildren(h("h1", {}, (S.key === "drafts" ? "Borradores" : navLabel(S.key)) + (S.q ? ` · «${S.q}»` : "")), h("div", { id: "tools", class: "tools" }),
      h("div", { id: "grid", class: "grid" }, ...skeletons(8)), h("p", { id: "state", class: "empty", hidden: true }),
      h("div", { class: "more" }, h("button", { class: "btn", id: "moreBtn", type: "button", hidden: true, onclick: () => list(false) }, "Cargar más")));
  }
  try {
    const r = await fetchPosts({ status: S.key === "drafts" ? "draft" : "published", filter: navFilter(S.key), token: tok, dir: S.sort === "asc" ? "asc" : "desc", cursor: S.cursor });
    if (sig !== S.sig) return;
    S.items.push(...r.items); S.cursor = r.last; S.more = r.more;
  } catch (e) { err(e); S.more = false; }
  paintTools(); paintGrid();
}
const hasVal = (m, f, v) => { const x = m?.[f]; return Array.isArray(x) ? x.map(String).includes(v) : String(x ?? "") === v; };
function paintTools() {
  const kind = kindOf(S.key), box = $("#tools"); if (!box) return;
  const sort = h("select", { "aria-label": "Ordenar" }, h("option", { value: "desc" }, "Más recientes"), h("option", { value: "asc" }, "Más antiguos"), h("option", { value: "az" }, "Alfabético (cargados)"));
  sort.value = S.sort;
  sort.onchange = () => { const old = S.sort; S.sort = sort.value; if (old === "az" || S.sort === "az") paintGrid(); else list(true); };
  const sels = (FILTERS[kind] || []).map(f => {
    const def = KIND_FIELDS[kind].find(d => d.k === f), vals = new Set();
    S.items.forEach(p => { const x = p.meta?.[f]; (Array.isArray(x) ? x : x != null && x !== "" ? [x] : []).forEach(v => vals.add(String(v))); });
    if (!vals.size) return null;
    const s = h("select", { "aria-label": def.label }, h("option", { value: "" }, def.label + ": todos"), ...[...vals].sort().map(v => h("option", { value: v }, v)));
    s.value = S.filters[f] || ""; s.onchange = () => { S.filters[f] = s.value; paintGrid(); }; return s;
  }).filter(Boolean);
  box.replaceChildren(sort, ...sels);
}
function paintGrid() {
  const rest = S.q.split(/\s+/).slice(1).map(norm).filter(Boolean);
  let rows = S.items.filter(p => Object.entries(S.filters).every(([f, v]) => !v || hasVal(p.meta, f, v)) &&
    rest.every(w => norm(p.title + " " + JSON.stringify(p.meta || {})).includes(w)));
  if (S.sort === "az") rows = [...rows].sort((a, b) => a.title.localeCompare(b.title, "es"));
  $("#grid").replaceChildren(...rows.map(card));
  const st = $("#state"); st.hidden = rows.length > 0 || S.more;
  st.textContent = S.items.length ? "Ninguna publicación coincide con los filtros." : S.q ? "Sin resultados para la búsqueda." : "Todavía no hay publicaciones en esta sección.";
  $("#moreBtn").hidden = !S.more;
}
