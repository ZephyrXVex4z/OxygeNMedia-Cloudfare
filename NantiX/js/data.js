import { db } from "../firebase-config.js";
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, query, where, orderBy, limit, startAfter, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { keywords, norm } from "./categories.js";

// Publicadas: colección pública "posts". Borradores: colección "drafts" (solo con sesión).
const colFor = status => collection(db, status === "draft" ? "drafts" : "posts");
const wrap = d => ({ id: d.id, ...d.data() });

// "scopes" permite filtrar por categoría, grupo, destacado y palabra con UNA sola
// consulta (array-contains + orden por fecha) → un único índice de 2 campos.
export function scopesFor(p) {
  const g = p.group || p.category, c = p.category, s = ["group:" + g, "cat:" + c];
  if (p.featured) s.push("featured");
  for (const t of keywords(p)) s.push("t:" + t, `group:${g}:t:${t}`, `cat:${c}:t:${t}`);
  return s.slice(0, 190);
}

export async function fetchPosts({ status = "published", filter, token, dir = "desc", cursor, size = 24 } = {}) {
  const cs = [];
  let scope = filter?.scope;
  if (token) scope = (scope ? scope + ":" : "") + "t:" + norm(token);
  if (scope) cs.push(where("scopes", "array-contains", scope));
  else if (filter?.any) cs.push(where("scopes", "array-contains-any", filter.any));
  cs.push(orderBy("createdAt", dir), limit(size));
  if (cursor) cs.push(startAfter(cursor));
  const snap = await getDocs(query(colFor(status), ...cs));
  return { items: snap.docs.map(wrap), last: snap.docs.at(-1) ?? cursor, more: snap.size === size };
}
export async function getPost(id) {
  for (const s of ["published", "draft"]) {
    try { const d = await getDoc(doc(colFor(s), id)); if (d.exists()) return wrap(d); } catch {}
  }
  return null;
}
async function move(prev, patch) {
  const { id, ...rest } = prev, b = writeBatch(db);
  b.set(doc(colFor(patch.status), id), { ...rest, ...patch, updatedAt: serverTimestamp() });
  b.delete(doc(colFor(prev.status), id));
  await b.commit(); return id;
}
export async function savePost(prev, data, user) {
  const base = { ...data, titleLower: data.title.toLowerCase(), scopes: scopesFor(data), updatedAt: serverTimestamp() };
  if (!prev) {
    const r = await addDoc(colFor(data.status), { ...base, createdAt: serverTimestamp(), createdBy: user.uid, authorName: (user.email || "").split("@")[0] });
    return r.id;
  }
  if (prev.status === data.status) { await updateDoc(doc(colFor(data.status), prev.id), base); return prev.id; }
  return move(prev, base);
}
export const setStatus = (p, status) => move(p, { status });
export const removePost = p => deleteDoc(doc(colFor(p.status), p.id));

const reports = collection(db, "reports");
export const sendReport = r => addDoc(reports, { ...r, createdAt: serverTimestamp() });
export async function listReports() {
  const s = await getDocs(query(reports, orderBy("createdAt", "desc"), limit(50)));
  return s.docs.map(wrap);
}
export const removeReport = id => deleteDoc(doc(reports, id));
