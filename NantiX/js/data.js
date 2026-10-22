import { db } from "../firebase-config.js";
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { keywords, norm } from "./categories.js";

const posts = collection(db, "posts");
const wrap = d => ({ id: d.id, ...d.data() });

export async function fetchPosts({ status = "published", filter, token, dir = "desc", cursor, size = 24 } = {}) {
  const cs = [where("status", "==", status)];
  if (filter) cs.push(where(filter.field, filter.op || "==", filter.value));
  if (token) cs.push(where("keywords", "array-contains", norm(token)));
  cs.push(orderBy("createdAt", dir), limit(size));
  if (cursor) cs.push(startAfter(cursor));
  const snap = await getDocs(query(posts, ...cs));
  return { items: snap.docs.map(wrap), last: snap.docs.at(-1) ?? cursor, more: snap.size === size };
}
export async function getPost(id) { const d = await getDoc(doc(posts, id)); return d.exists() ? wrap(d) : null; }
export async function savePost(id, data, user) {
  const base = { ...data, titleLower: data.title.toLowerCase(), keywords: keywords(data), updatedAt: serverTimestamp() };
  if (id) { await updateDoc(doc(posts, id), base); return id; }
  const r = await addDoc(posts, { ...base, createdAt: serverTimestamp(), createdBy: user.uid, authorName: (user.email || "").split("@")[0] });
  return r.id;
}
export const patchPost = (id, patch) => updateDoc(doc(posts, id), { ...patch, updatedAt: serverTimestamp() });
export const removePost = id => deleteDoc(doc(posts, id));

const reports = collection(db, "reports");
export const sendReport = r => addDoc(reports, { ...r, createdAt: serverTimestamp() });
export async function listReports() {
  const s = await getDocs(query(reports, orderBy("createdAt", "desc"), limit(50)));
  return s.docs.map(wrap);
}
export const removeReport = id => deleteDoc(doc(reports, id));
