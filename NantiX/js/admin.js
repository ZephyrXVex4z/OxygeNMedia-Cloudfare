import { CATS, KIND_FIELDS, SERVICES, detectService } from "./categories.js";
import { h, $, openDlg, closeDlg, toast, fail, confirmDlg, card } from "./ui.js";
import { savePost, sendReport, listReports, removeReport } from "./data.js";

const isHttp = u => { try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; } };

function ctl(d, v) {
  const id = "m_" + d.k; let c;
  if (d.type === "textarea") c = h("textarea", { id, maxlength: 4000 });
  else if (d.type === "select") c = h("select", { id }, h("option", { value: "" }, ""), ...d.opts.map(o => h("option", { value: o }, o)));
  else c = h("input", { id, type: d.type === "list" ? "text" : d.type, maxlength: 500, step: d.type === "number" ? "any" : null });
  c.value = Array.isArray(v) ? v.join(", ") : v ?? "";
  return h("label", {}, d.label + (d.type === "list" ? " (separados por comas)" : "") + (d.req ? " *" : ""), c);
}
function readMeta(kind) {
  const m = {};
  for (const d of KIND_FIELDS[kind] || []) {
    const raw = $("#m_" + d.k)?.value.trim(); if (!raw) continue;
    if (d.type === "list") m[d.k] = raw.split(",").map(s => s.trim()).filter(Boolean);
    else if (d.type === "number") { const n = Number(raw); if (Number.isFinite(n)) m[d.k] = n; }
    else m[d.k] = raw;
  }
  return m;
}
function dlRow(d = {}, list) {
  const f = (name, label, type = "text", v = "") => h("label", {}, label, h("input", { name, type, value: v, step: type === "number" ? "any" : null }));
  const url = h("input", { name: "url", type: "url", value: d.url || "", required: true });
  const svc = h("select", { name: "service" }, ...SERVICES.map(s => h("option", { value: s }, s)));
  svc.value = d.service || (d.url ? detectService(d.url) : "MEGA");
  url.oninput = () => { if (!svc.dataset.t) svc.value = detectService(url.value); };
  svc.onchange = () => { svc.dataset.t = 1; };
  const row = h("fieldset", { class: "dlrow" }, h("label", {}, "Enlace de descarga *", url), h("label", {}, "Servicio", svc),
    f("label", "Nombre o versión del archivo", "text", d.label || ""), f("format", "Formato", "text", d.format || ""),
    f("sizeMB", "Tamaño (MB)", "number", d.sizeBytes ? +(d.sizeBytes / 1048576).toFixed(2) : ""), f("fileName", "Nombre del archivo", "text", d.fileName || ""),
    h("button", { class: "btn danger", type: "button", onclick: () => row.remove() }, "Quitar enlace"));
  list.append(row);
}
function readDownloads(list) {
  return [...list.children].map(r => {
    const g = n => r.querySelector(`[name=${n}]`).value.trim(), d = { url: g("url"), service: g("service") };
    if (g("label")) d.label = g("label"); if (g("format")) d.format = g("format");
    if (g("fileName")) { d.fileName = g("fileName"); const e = d.fileName.split(".").pop(); if (e !== d.fileName) d.ext = e.toLowerCase(); }
    if (Number(g("sizeMB")) > 0) d.sizeBytes = Math.round(Number(g("sizeMB")) * 1048576);
    return d;
  });
}

export function openPostForm(p, onSaved, user) {
  const isNew = !p, m0 = { ...(p?.meta || {}) };
  const cat = h("select", { id: "f_cat" }, ...Object.entries(CATS).map(([k, c]) => h("option", { value: k }, c.full)));
  cat.value = p?.category || "music-album";
  const title = h("input", { id: "f_title", required: true, maxlength: 200, value: p?.title ?? "" });
  const desc = h("textarea", { id: "f_desc", maxlength: 4000 }); desc.value = p?.description ?? "";
  const cover = h("input", { id: "f_cover", type: "url", value: p?.cover ?? "" });
  const tags = h("input", { id: "f_tags", value: (p?.tags || []).join(", ") });
  const status = h("select", { id: "f_status" }, h("option", { value: "published" }, "Publicada"), h("option", { value: "draft" }, "Borrador")); status.value = p?.status || "published";
  const feat = h("input", { type: "checkbox", id: "f_feat", checked: !!p?.featured });
  const metaBox = h("div", { class: "metabox" }), dls = h("div", {}), prev = h("div", { id: "prev" }), err = h("p", { class: "error", role: "alert" });
  const drawMeta = () => { metaBox.replaceChildren(...(KIND_FIELDS[CATS[cat.value].kind] || []).map(d => ctl(d, m0[d.k]))); };
  cat.onchange = () => { Object.assign(m0, readMeta(CATS[cat.dataset.prev || cat.value]?.kind)); cat.dataset.prev = cat.value; drawMeta(); };
  cat.dataset.prev = cat.value; drawMeta();
  (p?.downloads?.length ? p.downloads : []).forEach(d => dlRow(d, dls));

  const build = () => {
    const c = CATS[cat.value], meta = readMeta(c.kind), downloads = readDownloads(dls);
    if (!title.value.trim()) return { error: "El título es obligatorio." };
    for (const d of KIND_FIELDS[c.kind] || []) if (d.req && !meta[d.k]) return { error: `«${d.label}» es obligatorio en esta categoría.` };
    for (const d of KIND_FIELDS[c.kind] || []) if (d.type === "url" && meta[d.k] && !isHttp(meta[d.k])) return { error: `«${d.label}» debe ser una URL http(s).` };
    if (cover.value.trim() && !isHttp(cover.value.trim())) return { error: "La portada debe ser una URL http(s)." };
    if (downloads.some(d => !isHttp(d.url))) return { error: "Cada enlace de descarga debe ser una URL http(s) válida." };
    if (status.value === "published" && !downloads.length) return { error: "Una publicación pública necesita al menos un enlace de descarga (o guárdala como borrador)." };
    return { data: { title: title.value.trim(), category: cat.value, group: c.group, description: desc.value.trim(), cover: cover.value.trim(),
      tags: tags.value.split(",").map(s => s.trim()).filter(Boolean), featured: feat.checked, status: status.value, meta, downloads } };
  };
  const save = h("button", { class: "btn primary", type: "button", onclick: async () => {
    const r = build(); err.textContent = r.error || ""; if (r.error) return;
    save.disabled = true; save.textContent = "Guardando…";
    try { await savePost(p?.id, r.data, user); closeDlg(); toast("Publicación guardada"); onSaved(); }
    catch (e) { fail(e); save.disabled = false; save.textContent = "Guardar"; }
  } }, "Guardar");
  openDlg(h("h2", {}, isNew ? "Nueva publicación" : "Editar publicación"),
    h("label", {}, "Categoría", cat), h("label", {}, "Título *", title),
    h("label", {}, "Descripción", desc), h("label", {}, "Portada o miniatura (URL de imagen)", cover), h("label", {}, "Etiquetas (separadas por comas)", tags),
    metaBox, h("h3", {}, "Enlaces de descarga"), dls,
    h("button", { class: "btn", type: "button", onclick: () => dlRow({}, dls) }, "+ Añadir enlace"),
    h("label", {}, "Estado", status), h("label", { class: "chk" }, feat, "Destacada en Inicio"),
    prev, err,
    h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: closeDlg }, "Cancelar"),
      h("button", { class: "btn", type: "button", onclick: () => {
        const r = build(); err.textContent = r.error || ""; if (r.error) return;
        const c = card({ ...r.data, id: "preview" }); c.addEventListener("click", e => e.preventDefault());
        prev.replaceChildren(h("h3", {}, "Vista previa"), h("div", { class: "grid one" }, c));
      } }, "Vista previa"), save));
  title.focus();
}

export function openReport(p) {
  const reason = h("select", { id: "r_reason" }, ...["Enlace roto", "Contenido publicado sin autorización", "Otro"].map(o => h("option", { value: o }, o)));
  const msg = h("textarea", { id: "r_msg", maxlength: 500 });
  openDlg(h("h2", {}, "Reportar"), p && h("p", {}, p.title), h("label", {}, "Motivo", reason), h("label", {}, "Detalles (opcional)", msg),
    h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: closeDlg }, "Cancelar"),
      h("button", { class: "btn primary", type: "button", onclick: async () => {
        try { await sendReport({ postId: p?.id || "", postTitle: (p?.title || "").slice(0, 200), reason: reason.value, message: msg.value.trim() }); closeDlg(); toast("Reporte enviado. Gracias."); }
        catch (e) { fail(e); }
      } }, "Enviar")));
}
export async function openReportsList() {
  openDlg(h("h2", {}, "Reportes"), h("p", {}, "Cargando…"));
  try {
    const rs = await listReports(), list = h("div", {});
    rs.forEach(r => list.append(h("div", { class: "frow" }, h("span", {}, h("strong", {}, r.reason), " — ", r.postId ? h("a", { href: "#/p/" + r.postId, onclick: () => closeDlg() }, r.postTitle || r.postId) : "General", r.message && h("small", { class: "block" }, r.message)),
      h("button", { class: "btn danger", type: "button", onclick: async e => { if (await confirmDlg("¿Eliminar este reporte?")) { try { await removeReport(r.id); } catch (x) { fail(x); } } openReportsList(); } }, "Eliminar"))));
    openDlg(h("h2", {}, "Reportes"), rs.length ? list : h("p", {}, "No hay reportes."), h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: closeDlg }, "Cerrar")));
  } catch (e) { fail(e); closeDlg(); }
}
