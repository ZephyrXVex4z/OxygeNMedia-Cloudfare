import { CATS, KIND_FIELDS, cardLines, fmtDate, fmtSize, serviceName } from "./categories.js";

export const $ = s => document.querySelector(s);
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter(x => x != null && x !== false));
  return el;
}
export function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3500);
}
export function fail(e) {
  console.error(e);
  toast(e?.code === "permission-denied" ? "No tienes permiso para esta acción." : "Ocurrió un error: " + (e?.message || e));
}
export const dlg = $("#dlg"), dlgForm = $("#dlgForm");
export function openDlg(...nodes) { dlgForm.replaceChildren(...nodes); if (!dlg.open) dlg.showModal(); }
export const closeDlg = () => dlg.open && dlg.close();
export function confirmDlg(msg, ok = "Eliminar") {
  return new Promise(res => openDlg(h("h2", {}, "Confirmar"), h("p", {}, msg), h("div", { class: "row" },
    h("button", { class: "btn", type: "button", onclick: () => { closeDlg(); res(false); } }, "Cancelar"),
    h("button", { class: "btn danger", type: "button", onclick: () => { closeDlg(); res(true); } }, ok))));
}

export function coverEl(p, big) {
  const c = CATS[p.category] || CATS.other, el = h("div", { class: "cover" + (c.kind === "music" ? " sq" : "") + (big ? " big" : "") });
  const ph = () => el.replaceChildren(h("span", { class: "ph", "aria-hidden": "true" }, c.icon));
  if (/^https?:\/\//i.test(p.cover || "")) {
    const im = h("img", { src: p.cover, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }); im.onerror = ph; el.append(im);
  } else ph();
  return el;
}
export function card(p) {
  const c = CATS[p.category] || CATS.other;
  return h("a", { class: "card", href: "#/p/" + p.id },
    coverEl(p),
    h("div", { class: "cb" },
      h("div", {}, h("span", { class: "tag" }, c.label), p.status === "draft" && h("span", { class: "tag warn" }, "Borrador")),
      h("h3", {}, p.title),
      ...cardLines(p).filter(Boolean).slice(0, 3).map(l => h("p", { class: "ln" }, l))));
}
export const skeletons = n => Array.from({ length: n }, () => h("div", { class: "card sk" }, h("div", { class: "cover" }), h("div", { class: "cb" }, h("p", { class: "ln" }, "\u00a0"))));

const val = (def, v) => Array.isArray(v) ? v.join(", ") : def.type === "date" ? fmtDate(v) : v;
export function showPost(p, ctx) {
  const c = CATS[p.category] || CATS.other, m = p.meta || {}, who = m.artist || m.developer || m.author;
  const rows = (KIND_FIELDS[c.kind] || []).filter(d => d.type !== "textarea" && m[d.k] != null && m[d.k] !== "" && !(Array.isArray(m[d.k]) && !m[d.k].length))
    .flatMap(d => [h("dt", {}, d.label), h("dd", {}, d.type === "url" ? h("a", { href: m[d.k], target: "_blank", rel: "noopener noreferrer" }, m[d.k]) : String(val(d, m[d.k])))]);
  const longs = (KIND_FIELDS[c.kind] || []).filter(d => d.type === "textarea" && m[d.k]).map(d => h("div", {}, h("h4", {}, d.label), h("p", { class: "pre" }, m[d.k])));
  const dls = (p.downloads || []).map(d => h("div", { class: "dl" },
    h("div", {}, h("strong", {}, d.label || d.fileName || "Archivo"),
      h("small", {}, [d.format, d.ext && d.ext !== d.format ? d.ext : "", fmtSize(d.sizeBytes), serviceName(d)].filter(Boolean).join(" · "))),
    h("a", { class: "btn primary", href: d.url, target: "_blank", rel: "noopener noreferrer" }, "Descargar")));
  const date = fmtDate(p.createdAt);
  openDlg(
    h("div", { class: "detail" },
      h("section", { class: "blk head" }, coverEl(p, true),
        h("div", {}, h("span", { class: "tag" }, c.full), p.status === "draft" && h("span", { class: "tag warn" }, "Borrador"),
          h("h2", {}, p.title), who && h("p", { class: "who2" }, who),
          p.description && h("p", { class: "pre" }, p.description),
          h("dl", {}, rows), longs,
          p.tags?.length && h("p", { class: "tags" }, p.tags.map(t => h("span", { class: "tag" }, t))))),
      dls.length ? h("section", { class: "blk" }, h("h3", {}, "Archivo y descarga"), dls,
        h("small", { class: "mute" }, "Los archivos están alojados en servicios externos; NantiX no los aloja.")) : null,
      h("section", { class: "blk" }, h("h3", {}, "Publicación"),
        h("dl", {}, date && [h("dt", {}, "Publicado en NantiX"), h("dd", {}, date)],
          p.authorName && [h("dt", {}, "Publicado por"), h("dd", {}, p.authorName)],
          ctx.admin && [h("dt", {}, "ID"), h("dd", {}, p.id)])),
      h("div", { class: "row" },
        ctx.admin && h("button", { class: "btn danger", type: "button", onclick: () => ctx.remove(p) }, "Eliminar"),
        ctx.admin && h("button", { class: "btn", type: "button", onclick: () => ctx.toggle(p) }, p.status === "published" ? "Despublicar" : "Publicar"),
        ctx.admin && h("button", { class: "btn", type: "button", onclick: () => ctx.edit(p) }, "Editar"),
        h("button", { class: "btn", type: "button", onclick: () => ctx.share(p) }, "Copiar enlace"),
        h("button", { class: "btn", type: "button", onclick: () => ctx.report(p) }, "Reportar"),
        h("button", { class: "btn", type: "button", onclick: closeDlg }, "Cerrar"))));
}
