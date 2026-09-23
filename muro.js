// muro.js
// Feed de publicaciones tipo red social: texto + imagen + cita de recurso, likes, comentarios.

import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, deleteDoc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit, startAfter, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { crearNotificacion } from "./notificaciones.js";
import { otorgarOxPorLike, otorgarOxPorPublicar } from "./recompensas.js";
import { incrementarContadorTema } from "./temas.js";

// Extrae hashtags (#tema) y menciones (@usuario) de un texto, en minÃºsculas y sin sÃ­mbolo
function extraerHashtags(texto) {
  const matches = texto.match(/#[\wÃ¡Ã©Ã­Ã³ÃºÃ±]+/gi) || [];
  return [...new Set(matches.map(h => h.slice(1).toLowerCase()))];
}
function extraerMenciones(texto) {
  const matches = texto.match(/@[\w.]+/gi) || [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

// Crea una publicaciÃ³n nueva
export async function crearPublicacion({ autorId, autorNombre, autorFotoURL, texto, imagenURL, recursoCitado, repostDe = null, temaSlug = null }) {
  const hashtags = extraerHashtags(texto || "");
  if (temaSlug && !hashtags.includes(temaSlug)) hashtags.push(temaSlug);
  const usernamesMencionados = extraerMenciones(texto || "");

  const ref = await addDoc(collection(db, "publicaciones"), {
    autorId,
    autorNombre,
    autorFotoURL: autorFotoURL || "",
    texto: texto || "",
    imagenURL: imagenURL || "",
    recursoCitado: recursoCitado || null,
    repostDe: repostDe || null, // { pubId, autorNombre, texto, imagenURL } â€” snapshot del post original
    temaSlug: temaSlug || null,
    hashtags,
    likesCount: 0,
    comentariosCount: 0,
    fecha: serverTimestamp()
  });

  if (temaSlug) {
    try { await incrementarContadorTema(temaSlug); } catch (e) { /* el post ya se creÃ³ igual */ }
  }

  // Resuelve menciones @username -> notificaciÃ³n a esa persona (si el username existe)
  if (usernamesMencionados.length > 0) {
    await notificarMenciones(usernamesMencionados, autorId, autorNombre, ref.id);
  }

  // Solo los posts ORIGINALES dan Ox2 de recompensa (no los reposts â€” si no, repostear en
  // bucle serÃ­a una forma trivial de farmear Ox2 gratis sin aportar contenido real).
  if (!repostDe) {
    try { await otorgarOxPorPublicar(autorId, ref.id); } catch (e) { /* si falla la recompensa, la publicaciÃ³n ya se creÃ³ igual */ }
  }

  return ref.id;
}

export async function notificarMenciones(usernames, autorId, autorNombre, pubId, contexto = "publicacion") {
  for (const username of usernames) {
    try {
      const snap = await getDocs(query(collection(db, "usuarios"), where("username", "==", username), limit(1)));
      if (snap.empty) continue;
      const uidMencionado = snap.docs[0].id;
      if (uidMencionado === autorId) continue; // no te notificas a ti mismo
      await crearNotificacion({
        paraUid: uidMencionado,
        tipo: contexto === "comentario" ? "mencion_comentario" : "mencion_publicacion",
        deUid: autorId,
        deNombre: autorNombre,
        texto: contexto === "comentario"
          ? `${autorNombre} te mencionÃ³ en un comentario`
          : `${autorNombre} te mencionÃ³ en una publicaciÃ³n`,
        dataExtra: { pubId }
      });
    } catch (e) { /* si falla una menciÃ³n no debe tumbar la publicaciÃ³n entera */ }
  }
}

// Comparte (reposta) una publicaciÃ³n existente a tu propio muro, con comentario opcional
export async function repostearPublicacion(pubOriginal, autorId, autorNombre, autorFotoURL, comentarioExtra) {
  return crearPublicacion({
    autorId, autorNombre, autorFotoURL,
    texto: comentarioExtra || "",
    imagenURL: "",
    recursoCitado: null,
    repostDe: {
      pubId: pubOriginal.id,
      autorNombre: pubOriginal.autorNombre,
      texto: pubOriginal.texto || "",
      imagenURL: pubOriginal.imagenURL || ""
    }
  });
}

// Edita el texto/imagen/cita de una publicaciÃ³n existente (el autor la sigue viendo como suya)
export async function editarPublicacion(pubId, { texto, imagenURL, recursoCitado }) {
  await updateDoc(doc(db, "publicaciones", pubId), {
    texto: texto || "",
    imagenURL: imagenURL || "",
    recursoCitado: recursoCitado || null,
    hashtags: extraerHashtags(texto || "")
  });
}

// Trae publicaciones para el feed, con soporte de paginaciÃ³n por cursor.
// Si se pasa uidsPermitidos (lista de UIDs de amigos + uno mismo), filtra solo esos autores.
// cursorUltimoDoc: el snapshot del Ãºltimo documento de la pÃ¡gina anterior (para "cargar mÃ¡s").
// Devuelve { publicaciones, ultimoDoc, hayMas } â€” ultimoDoc se pasa de vuelta para pedir la siguiente pÃ¡gina.
export async function obtenerFeed({ cantidad = 15, soloDeUids = null, cursorUltimoDoc = null, hashtag = null } = {}) {
  // Cuando se filtra por amigos o hashtag, pedimos de mÃ¡s porque luego filtramos en el cliente
  const filtrando = !!(soloDeUids || hashtag);
  const limiteQuery = filtrando ? cantidad * 3 : cantidad + 1;

  let q = query(collection(db, "publicaciones"), orderBy("fecha", "desc"), limit(limiteQuery));
  if (cursorUltimoDoc) {
    q = query(collection(db, "publicaciones"), orderBy("fecha", "desc"), startAfter(cursorUltimoDoc), limit(limiteQuery));
  }

  const snap = await getDocs(q);
  let docs = snap.docs;

  if (soloDeUids) {
    docs = docs.filter(d => soloDeUids.includes(d.data().autorId));
  }
  if (hashtag) {
    const tagLower = hashtag.toLowerCase();
    docs = docs.filter(d => (d.data().hashtags || []).includes(tagLower));
  }

  const hayMas = snap.docs.length === limiteQuery;
  const paginaDocs = docs.slice(0, cantidad);
  const ultimoDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return {
    publicaciones: paginaDocs.map(d => ({ id: d.id, ...d.data() })),
    ultimoDoc,
    hayMas: hayMas || docs.length > cantidad
  };
}

export async function borrarPublicacion(pubId) {
  await deleteDoc(doc(db, "publicaciones", pubId));
}

/**
 * BÃºsqueda de publicaciones por texto, autor o hashtag/tema. Igual que la
 * bÃºsqueda de usuarios por @username (ver ver-perfil.js): trae un lote
 * reciente y filtra en el navegador â€” funciona bien a la escala de este
 * proyecto sin depender de un buscador externo.
 */
export async function buscarPublicaciones(texto, cantidad = 30) {
  const t = texto.trim().toLowerCase();
  if (t.length < 2) return [];

  const snap = await getDocs(query(collection(db, "publicaciones"), orderBy("fecha", "desc"), limit(400)));
  const tSinArroba = t.replace(/^@/, "");

  const resultados = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p =>
      (p.texto && p.texto.toLowerCase().includes(t)) ||
      (p.autorNombre && p.autorNombre.toLowerCase().includes(tSinArroba)) ||
      (p.hashtags || []).some(h => h.includes(t.replace(/^#/, "")))
    );

  return resultados.slice(0, cantidad);
}

// ============ LIKES ============

// Devuelve true si el usuario ya le dio like a esta publicaciÃ³n
export async function yaDioLike(pubId, uid) {
  const snap = await getDoc(doc(db, "publicaciones", pubId, "likes", uid));
  return snap.exists();
}

// Trae la lista de nombres de quienes dieron like (para mostrar "A quiÃ©n le gustÃ³")
export async function listarQuienesDieronLike(pubId) {
  const snap = await getDocs(collection(db, "publicaciones", pubId, "likes"));
  const uids = snap.docs.map(d => d.id);
  const nombres = [];
  for (const uid of uids) {
    const uSnap = await getDoc(doc(db, "usuarios", uid));
    if (uSnap.exists()) nombres.push({ uid, nombre: uSnap.data().nombre });
  }
  return nombres;
}

// Alterna el like: si ya existe lo quita (y resta contador), si no existe lo crea (y suma).
// Usa runTransaction para que el contador y el documento de like cambien de forma atÃ³mica.
export async function alternarLike(pubId, uid, autorPubUid, autorPubNombre, miNombre) {
  const refLike = doc(db, "publicaciones", pubId, "likes", uid);
  const refPub = doc(db, "publicaciones", pubId);

  let seAgrego = false;
  let debeOtorgarRecompensa = false;

  await runTransaction(db, async (tx) => {
    const snapLike = await tx.get(refLike);
    const snapPub = await tx.get(refPub);
    if (!snapPub.exists()) throw new Error("Esta publicaciÃ³n ya no existe.");

    const likesActual = snapPub.data().likesCount || 0;

    if (snapLike.exists()) {
      tx.delete(refLike);
      tx.update(refPub, { likesCount: Math.max(0, likesActual - 1) });
      seAgrego = false;
    } else {
      tx.set(refLike, { fecha: serverTimestamp() });
      tx.update(refPub, { likesCount: likesActual + 1 });
      seAgrego = true;

      // El Ox2 de recompensa solo se otorga la PRIMERA vez que este uid le da like a
      // esta publicaciÃ³n â€” sin esto, dar like/quitar like en bucle sobre el mismo post
      // generarÃ­a Ox2 infinito (el documento de like se borra al quitar el like, asÃ­
      // que el candado no puede vivir ahÃ­; vive en la publicaciÃ³n, que nunca se borra
      // por un simple unlike).
      const yaDioRecompensa = (snapPub.data().uidsQueYaDieronOx || []).includes(uid);
      if (!yaDioRecompensa) {
        debeOtorgarRecompensa = true;
        tx.update(refPub, { uidsQueYaDieronOx: [...(snapPub.data().uidsQueYaDieronOx || []), uid] });
      }
    }
  });

  if (seAgrego && autorPubUid !== uid) {
    await crearNotificacion({
      paraUid: autorPubUid,
      tipo: "like_publicacion",
      deUid: uid,
      deNombre: miNombre,
      texto: `A ${miNombre} le gustÃ³ tu publicaciÃ³n`,
      dataExtra: { pubId }
    });
    // El Ox2 de recompensa es aparte de la notificaciÃ³n: si falla, el like ya quedÃ³
    // registrado igual (no queremos que un error de recompensa tumbe el like en sÃ­).
    if (debeOtorgarRecompensa) {
      try { await otorgarOxPorLike(autorPubUid, pubId); } catch (e) { /* no crÃ­tico */ }
    }
  }

  return seAgrego;
}

// ============ COMENTARIOS ============

export async function obtenerComentarios(pubId) {
  const snap = await getDocs(query(collection(db, "publicaciones", pubId, "comentarios"), orderBy("fecha", "asc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function agregarComentario(pubId, autorId, autorNombre, texto, autorPubUid, autorPubNombre) {
  const refPub = doc(db, "publicaciones", pubId);

  await addDoc(collection(db, "publicaciones", pubId, "comentarios"), {
    autorId, autorNombre, texto, fecha: serverTimestamp()
  });

  await runTransaction(db, async (tx) => {
    const snapPub = await tx.get(refPub);
    if (!snapPub.exists()) return;
    const actual = snapPub.data().comentariosCount || 0;
    tx.update(refPub, { comentariosCount: actual + 1 });
  });

  if (autorPubUid !== autorId) {
    await crearNotificacion({
      paraUid: autorPubUid,
      tipo: "comentario_publicacion",
      deUid: autorId,
      deNombre: autorNombre,
      texto: `${autorNombre} comentÃ³ tu publicaciÃ³n`,
      dataExtra: { pubId }
    });
  }

  const usernamesMencionados = extraerMenciones(texto || "");
  if (usernamesMencionados.length > 0) {
    await notificarMenciones(usernamesMencionados, autorId, autorNombre, pubId, "comentario");
  }
}

export async function borrarComentario(pubId, comentarioId) {
  await deleteDoc(doc(db, "publicaciones", pubId, "comentarios", comentarioId));

  const refPub = doc(db, "publicaciones", pubId);
  await runTransaction(db, async (tx) => {
    const snapPub = await tx.get(refPub);
    if (!snapPub.exists()) return;
    const actual = snapPub.data().comentariosCount || 0;
    tx.update(refPub, { comentariosCount: Math.max(0, actual - 1) });
  });
}