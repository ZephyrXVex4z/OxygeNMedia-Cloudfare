// muro-temas.js
// (Antes llamado "temas.js" por error — ese nombre ya lo usa el sistema de
// temas VISUALES del sitio, tema-inline.js + temas.js. Este archivo es algo
// completamente distinto: "temas" con nombre propio creados por usuarios
// dentro del muro, no tiene nada que ver con colores.)
//
// Un tema de muro es, por dentro, el mismo hashtag que el muro ya sabía
// filtrar (misma colección "publicaciones", mismo campo "hashtags") — esto
// solo le pone un registro con nombre, creador y contador encima, para poder
// crearlos y listarlos aunque nadie haya publicado ahí todavía.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, runTransaction,
  collection, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// Mismo criterio de normalización que ya usa muro.js para extraer hashtags del texto.
export function normalizarSlugTema(nombre) {
  return (nombre || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/\s+/g, "")
    .replace(/[^\wáéíóúñ]/gi, "");
}

/**
 * Crea un tema nuevo. El slug (nombre normalizado) es el ID del documento,
 * así que es imposible crear dos temas con el mismo nombre — el segundo
 * intento simplemente falla al crear (igual que con las tarjetas de regalo).
 */
export async function crearTema(creadorId, creadorNombre, nombre, descripcion) {
  const slug = normalizarSlugTema(nombre);
  if (slug.length < 2) throw new Error("El nombre del tema debe tener al menos 2 caracteres.");

  const ref = doc(db, "temas", slug);
  const existente = await getDoc(ref);
  if (existente.exists()) {
    return { slug, nombre: existente.data().nombre, yaExistia: true };
  }

  await setDoc(ref, {
    slug,
    nombre: (nombre || "").trim().slice(0, 40),
    descripcion: (descripcion || "").trim().slice(0, 200),
    creadorId,
    creadorNombre,
    publicacionesCount: 0,
    fecha: serverTimestamp()
  });

  return { slug, nombre: (nombre || "").trim(), yaExistia: false };
}

export async function obtenerTema(slug) {
  const snap = await getDoc(doc(db, "temas", slug));
  return snap.exists() ? { slug, ...snap.data() } : null;
}

/** Temas más recientes o más activos, para mostrar en la barra de descubrimiento. */
export async function listarTemas(cantidad = 30) {
  const snap = await getDocs(query(collection(db, "temas"), orderBy("publicacionesCount", "desc"), limit(cantidad)));
  return snap.docs.map(d => ({ slug: d.id, ...d.data() }));
}

/** Búsqueda simple por nombre, para el autocompletado al publicar. */
export async function buscarTemas(texto) {
  const t = texto.trim().toLowerCase();
  if (t.length < 1) return [];
  const todos = await listarTemas(200);
  return todos.filter(tema =>
    tema.nombre.toLowerCase().includes(t) || tema.slug.includes(normalizarSlugTema(t))
  ).slice(0, 8);
}

/** Se llama cada vez que se publica algo en un tema (nuevo o existente). */
export async function incrementarContadorTema(slug) {
  const ref = doc(db, "temas", slug);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return; // el tema pudo haberse creado sin pasar por crearTema (raro, pero no debe tronar)
    tx.update(ref, { publicacionesCount: (snap.data().publicacionesCount || 0) + 1 });
  });
}
