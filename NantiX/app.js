import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, query, orderBy,
  limit, startAfter, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = s => document.querySelector(s);
const PAGE = 24;
const TYPES = { text:"Texto corto", textarea:"Texto largo", number:"Número", date:"Fecha",
  boolean:"Verdadero o falso", select:"Lista desplegable", url:"URL" };
const S = { admin:false, fields:[], records:[], last:null, more:false };

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter(x => x != null));
  return el;
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3500);
}
function fail(e) {
  console.error(e);
  toast(e?.code === "permission-denied" ? "No tienes permiso para esta acción." : "Ocurrió un error: " + (e?.message || e));
}

/* ---------- Tema ---------- */
$("#themeBtn").onclick = () => {
  const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = n;
  try { localStorage.setItem("nx-theme", n); } catch {}
};

/* ---------- Diálogos ---------- */
const dlg = $("#dlg"), dlgForm = $("#dlgForm");
function openDlg(...nodes) { dlgForm.replaceChildren(...nodes); if (!dlg.open) dlg.showModal(); }
const closeDlg = () => dlg.open && dlg.close();
function confirmDlg(msg, okLabel = "Eliminar") {
  return new Promise(res => {
    openDlg(h("h2", {}, "Confirmar"), h("p", {}, msg), h("div", { class:"row" },
      h("button", { class:"btn", type:"button", onclick:() => { closeDlg(); res(false); } }, "Cancelar"),
      h("button", { class:"btn danger", type:"button", onclick:() => { closeDlg(); res(true); } }, okLabel)));
  });
}

/* ---------- Autenticación ---------- */
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = new FormData(e.target); $("#loginError").textContent = "";
  try { await signInWithEmailAndPassword(auth, f.get("email"), f.get("password")); }
  catch { $("#loginError").textContent = "Correo o contraseña incorrectos, o la cuenta no tiene acceso."; }
});
$("#resetBtn").onclick = async () => {
  const email = $("#loginForm").email.value.trim();
  if (!email) { $("#loginError").textContent = "Escribe tu correo para recuperar la contraseña."; return; }
  try { await sendPasswordResetEmail(auth, email); } catch {}
  $("#loginError").textContent = "Si la cuenta existe, se envió un correo de recuperación.";
};
$("#logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  $("#login").hidden = !!user; $("#app").hidden = !user;
  if (!user) return;
  try {
    const tok = await user.getIdTokenResult(true);
    S.admin = tok.claims.admin === true;
  } catch { S.admin = false; toast("La sesión caducó. Inicia sesión de nuevo."); return signOut(auth); }
  $("#who").textContent = `${user.email} · ${S.admin ? "Administrador" : "Lectura"}`;
  document.querySelectorAll(".admin-only").forEach(n => n.hidden = !S.admin);
  try { await loadFields(); await loadRecords(true); } catch (e) { fail(e); $("#loading").hidden = true; }
});

/* ---------- Definiciones de campos ---------- */
async function loadFields() {
  const snap = await getDocs(query(collection(db, "fieldDefinitions"), orderBy("order")));
  S.fields = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  const sel = $("#filterField"), cur = sel.value;
  sel.replaceChildren(h("option", { value:"" }, "Sin filtro"),
    ...S.fields.map(f => h("option", { value:f.id }, f.label)));
  sel.value = S.fields.some(f => f.id === cur) ? cur : "";
  renderFilterBox();
}
function renderFilterBox() {
  const f = S.fields.find(x => x.id === $("#filterField").value), box = $("#filterBox");
  if (!f) { box.replaceChildren(); return; }
  let c;
  if (f.type === "select") c = h("select", {}, h("option", { value:"" }, "Todos"), ...(f.options||[]).map(o => h("option", { value:o }, o)));
  else if (f.type === "boolean") c = h("select", {}, h("option", { value:"" }, "Todos"), h("option", { value:"true" }, "Sí"), h("option", { value:"false" }, "No"));
  else c = h("input", { type: f.type === "number" ? "number" : f.type === "date" ? "date" : "text",
    placeholder: f.type === "number" ? "Mínimo" : "Contiene", "aria-label":"Valor del filtro" });
  c.id = "filterVal"; c.addEventListener("input", renderGrid); box.replaceChildren(c);
}
$("#filterField").onchange = () => { renderFilterBox(); renderGrid(); };

function fieldControl(f, val) {
  const common = { id:"fv_" + f.id, name:f.id, required: f.required && f.type !== "boolean" };
  let c;
  switch (f.type) {
    case "textarea": c = h("textarea", { ...common, maxlength:5000 }); c.value = val ?? ""; break;
    case "number": c = h("input", { ...common, type:"number", step:"any" }); c.value = val ?? ""; break;
    case "date": c = h("input", { ...common, type:"date" }); c.value = val ?? ""; break;
    case "url": c = h("input", { ...common, type:"url", maxlength:2000 }); c.value = val ?? ""; break;
    case "boolean": c = h("input", { ...common, type:"checkbox" }); c.checked = val === true;
      return h("label", { class:"chk" }, c, f.label);
    case "select": c = h("select", common, h("option", { value:"" }, ""), ...(f.options||[]).map(o => h("option", { value:o }, o))); c.value = val ?? ""; break;
    default: c = h("input", { ...common, type:"text", maxlength:500 }); c.value = val ?? "";
  }
  return h("label", {}, f.label + (f.required ? " *" : ""), c);
}
function readControl(f) {
  const el = $("#fv_" + f.id);
  if (f.type === "boolean") return el.checked;
  const v = el.value.trim();
  if (v === "") return null;
  return f.type === "number" ? Number(v) : v;
}

function openFieldForm(f) {
  const isNew = !f;
  const label = h("input", { name:"label", required:true, maxlength:80, value:f?.label ?? "" });
  const type = h("select", { name:"type" }, ...Object.entries(TYPES).map(([k, v]) => h("option", { value:k }, v)));
  type.value = f?.type ?? "text";
  const req = h("input", { type:"checkbox", checked: !!f?.required });
  const card = h("input", { type:"checkbox", checked: !!f?.showInCard });
  const opts = h("textarea", {}); opts.value = (f?.options || []).join("\n");
  const optsWrap = h("label", {}, "Opciones (una por línea)", opts);
  const sync = () => optsWrap.hidden = type.value !== "select"; type.onchange = sync; sync();
  openDlg(h("h2", {}, isNew ? "Añadir característica" : "Editar característica"),
    h("label", {}, "Nombre visible", label), h("label", {}, "Tipo de dato", type), optsWrap,
    h("label", { class:"chk" }, req, "Obligatorio"),
    h("label", { class:"chk" }, card, "Mostrar en la tarjeta"),
    h("div", { class:"row" },
      h("button", { class:"btn", type:"button", onclick:closeDlg }, "Cancelar"),
      h("button", { class:"btn primary", type:"button", onclick: async () => {
        if (!label.value.trim()) { label.focus(); return; }
        const options = opts.value.split("\n").map(s => s.trim()).filter(Boolean);
        if (type.value === "select" && !options.length) { toast("Añade al menos una opción."); return; }
        if (!isNew && f.type !== type.value &&
            !(await confirmDlg("Cambiar el tipo no modifica los valores ya guardados. Los que no sean compatibles con el nuevo tipo pueden mostrarse mal o quedar vacíos al editarse. ¿Continuar?", "Cambiar tipo"))) return;
        const data = { label:label.value.trim(), type:type.value, required:req.checked,
          showInCard:card.checked, options: type.value === "select" ? options : [] };
        try {
          if (isNew) await addDoc(collection(db, "fieldDefinitions"), { ...data, order: S.fields.length ? Math.max(...S.fields.map(x => x.order)) + 1 : 0 });
          else await updateDoc(doc(db, "fieldDefinitions", f.id), data);
          closeDlg(); toast("Característica guardada"); await loadFields(); renderGrid();
        } catch (e) { fail(e); }
      } }, "Guardar")));
  label.focus();
}
function openFieldManager() {
  const list = h("div", {});
  const move = async (i, d) => {
    const a = S.fields[i], b = S.fields[i + d]; if (!b) return;
    const bt = writeBatch(db);
    bt.update(doc(db, "fieldDefinitions", a.id), { order:b.order });
    bt.update(doc(db, "fieldDefinitions", b.id), { order:a.order });
    try { await bt.commit(); await loadFields(); openFieldManager(); renderGrid(); } catch (e) { fail(e); }
  };
  S.fields.forEach((f, i) => list.append(h("div", { class:"frow" }, h("span", {}, `${f.label} (${TYPES[f.type]})`),
    h("button", { class:"btn", type:"button", "aria-label":"Subir", onclick:() => move(i, -1) }, "↑"),
    h("button", { class:"btn", type:"button", "aria-label":"Bajar", onclick:() => move(i, 1) }, "↓"),
    h("button", { class:"btn", type:"button", onclick:() => openFieldForm(f) }, "Editar"),
    h("button", { class:"btn danger", type:"button", onclick: async () => {
      if (!(await confirmDlg(`Se eliminará la característica «${f.label}». Los valores ya guardados en las fichas permanecen en la base de datos pero dejarán de mostrarse. ¿Continuar?`))) return;
      try { await deleteDoc(doc(db, "fieldDefinitions", f.id)); await loadFields(); renderGrid(); toast("Característica eliminada"); openFieldManager(); } catch (e) { fail(e); }
    } }, "Eliminar"))));
  if (!S.fields.length) list.append(h("p", {}, "Aún no hay características definidas."));
  openDlg(h("h2", {}, "Características"), list, h("div", { class:"row" },
    h("button", { class:"btn", type:"button", onclick:() => openFieldForm() }, "+ Añadir característica"),
    h("button", { class:"btn primary", type:"button", onclick:closeDlg }, "Cerrar")));
}
$("#addField").onclick = () => openFieldForm();
$("#manageFields").onclick = openFieldManager;

/* ---------- Fichas ---------- */
function fmt(f, v) {
  if (v == null || v === "") return "";
  if (f.type === "boolean") return v ? "Sí" : "No";
  return String(v);
}
function valueNode(f, v) {
  const t = fmt(f, v);
  if (f.type === "url" && /^https?:\/\//i.test(t)) return h("a", { href:t, target:"_blank", rel:"noopener noreferrer" }, t);
  return t;
}
async function loadRecords(reset) {
  $("#loading").hidden = false;
  if (reset) { S.records = []; S.last = null; }
  const term = $("#q").value.trim().toLowerCase();
  const [fld, dir] = $("#sort").value.split(":");
  const cs = [];
  if (term) cs.push(where("titleLower", ">=", term), where("titleLower", "<=", term + "\uf8ff"), orderBy("titleLower"));
  else cs.push(orderBy(fld, dir));
  if (S.last) cs.push(startAfter(S.last));
  cs.push(limit(PAGE));
  try {
    const snap = await getDocs(query(collection(db, "users"), ...cs));
    S.records.push(...snap.docs.map(d => ({ id:d.id, ...d.data() })));
    S.last = snap.docs.at(-1) ?? S.last; S.more = snap.size === PAGE;
  } catch (e) { fail(e); }
  $("#loading").hidden = true; renderGrid();
}
function passes(r) {
  const f = S.fields.find(x => x.id === $("#filterField").value), c = $("#filterVal");
  if (!f || !c || c.value === "") return true;
  const v = r.values?.[f.id];
  if (f.type === "number") return typeof v === "number" && v >= Number(c.value);
  if (f.type === "boolean") return String(v === true) === c.value;
  if (f.type === "select" || f.type === "date") return v === c.value;
  return String(v ?? "").toLowerCase().includes(c.value.toLowerCase());
}
function renderGrid() {
  const rows = S.records.filter(passes), grid = $("#grid");
  grid.replaceChildren(...rows.map(r => h("button", { class:"card", type:"button", onclick:() => openRecord(r) },
    h("h2", {}, r.title),
    h("dl", {}, ...S.fields.filter(f => f.showInCard).flatMap(f => [h("dt", {}, f.label), h("dd", {}, valueNode(f, r.values?.[f.id]))])))));
  $("#empty").hidden = rows.length > 0 || !$("#loading").hidden;
  $("#empty").textContent = S.records.length ? "Ninguna ficha coincide con el filtro." : "Todavía no hay fichas disponibles.";
  $("#moreBtn").hidden = !S.more;
}
$("#moreBtn").onclick = () => loadRecords(false);
$("#sort").onchange = () => loadRecords(true);
let qt; $("#q").oninput = () => { clearTimeout(qt); qt = setTimeout(() => loadRecords(true), 350); };

function openRecord(r) {
  openDlg(h("h2", {}, r.title),
    h("dl", {}, ...S.fields.flatMap(f => [h("dt", {}, f.label), h("dd", {}, valueNode(f, r.values?.[f.id]))])),
    h("div", { class:"row" },
      S.admin && h("button", { class:"btn danger", type:"button", onclick: async () => {
        if (!(await confirmDlg(`Se eliminará la ficha «${r.title}». Esta acción no se puede deshacer.`))) return;
        try { await deleteDoc(doc(db, "users", r.id)); toast("Ficha eliminada"); await loadRecords(true); } catch (e) { fail(e); }
      } }, "Eliminar"),
      S.admin && h("button", { class:"btn", type:"button", onclick:() => openRecordForm(r) }, "Editar"),
      h("button", { class:"btn primary", type:"button", onclick:closeDlg }, "Cerrar")));
}
function openRecordForm(r) {
  const isNew = !r;
  const title = h("input", { id:"fv_title", required:true, maxlength:200, value:r?.title ?? "" });
  openDlg(h("h2", {}, isNew ? "Añadir usuario" : "Editar ficha"),
    h("label", {}, "Título *", title), ...S.fields.map(f => fieldControl(f, r?.values?.[f.id])),
    h("p", { id:"formErr", class:"error", role:"alert" }),
    h("div", { class:"row" },
      h("button", { class:"btn", type:"button", onclick:closeDlg }, "Cancelar"),
      h("button", { class:"btn primary", type:"button", onclick: async () => {
        const t = title.value.trim(), values = {}; let bad = "";
        if (!t) bad = "El título es obligatorio.";
        for (const f of S.fields) {
          const v = readControl(f);
          if (f.required && f.type !== "boolean" && v == null) bad ||= `«${f.label}» es obligatorio.`;
          if (f.type === "number" && v != null && !Number.isFinite(v)) bad ||= `«${f.label}» debe ser un número.`;
          if (f.type === "url" && v != null && !/^https?:\/\/\S+$/i.test(v)) bad ||= `«${f.label}» debe ser una URL http(s) válida.`;
          if (v != null && !(f.type === "boolean" && v === false && !r?.values?.[f.id] && r === undefined)) values[f.id] = v;
        }
        if (bad) { $("#formErr").textContent = bad; return; }
        try {
          if (isNew) await addDoc(collection(db, "users"), { title:t, titleLower:t.toLowerCase(), values,
            createdAt:serverTimestamp(), updatedAt:serverTimestamp(), createdBy:auth.currentUser.uid });
          else await updateDoc(doc(db, "users", r.id), { title:t, titleLower:t.toLowerCase(), values, updatedAt:serverTimestamp() });
          closeDlg(); toast("Ficha guardada"); await loadRecords(true);
        } catch (e) { fail(e); }
      } }, "Guardar")));
  title.focus();
}
$("#addRecord").onclick = () => openRecordForm();
                                                                          
