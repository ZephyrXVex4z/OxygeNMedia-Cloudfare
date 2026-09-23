// afiliados.js
// Links de afiliado/promo: un admin crea un código (ej. "lanzamiento2026") que
// se comparte como https://oxygenmedia.online/?ref=lanzamiento2026. Quien
// entra con ese link y luego inicia sesión o se registra recibe una
// recompensa configurable (Ox2 y/o personalizaciones ya existentes: banners,
// efectos, fuentes) — con un combo DISTINTO según si la cuenta es nueva o ya
// existía. Cada usuario solo puede reclamar un mismo link UNA VEZ en su vida,
// sin importar cuántas veces vuelva a entrar con ese link después.
//
// Un link puede tener un límite de usos (ej. "primeras 50 personas") o ser
// ilimitado hasta que el admin lo desactive manualmente.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query,
  orderBy, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { registrarLog } from "./logs.js";

// Estructura de una recompensa (se usa igual para "nuevo" y "existente"):
// { ox2: number, banners: [id...], efectos: [id...], fuentes: [id...] }
function recompensaVacia() {
  return { ox2: 0, banners: [], efectos: [], fuentes: [] };
}

// ============ CLAVE DE SESIÓN: qué código de referido trae el visitante ============
// Se guarda en sessionStorage al llegar con ?ref=... en la URL (ver index.html),
// y se consume (borra) justo después de intentar reclamarlo, para no volver a
// intentarlo en cada recarga de la misma pestaña.
const CLAVE_REF_SESION = "oxygenmedia_ref_pendiente";

export function guardarCodigoReferidoDeUrl() {
  const params = new URLSearchParams(location.search);
  const ref = params.get("ref");
  if (ref) {
    try { sessionStorage.setItem(CLAVE_REF_SESION, ref.trim()); } catch {}
  }
}

export function obtenerCodigoReferidoPendiente() {
  try { return sessionStorage.getItem(CLAVE_REF_SESION); } catch { return null; }
}

export function limpiarCodigoReferidoPendiente() {
  try { sessionStorage.removeItem(CLAVE_REF_SESION); } catch {}
}

// ============ PANEL ADMIN: crear / editar / listar / borrar links ============

export async function crearLinkAfiliado({ codigo, nombre, limiteUsos, recompensaNuevo, recompensaExistente, adminUid, adminNombre }) {
  const codigoLimpio = codigo.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
  if (!codigoLimpio) throw new Error("El código solo puede tener letras, números, guiones y guiones bajos.");

  const ref = doc(db, "linksAfiliado", codigoLimpio);
  const yaExiste = await getDoc(ref);
  if (yaExiste.exists()) throw new Error("Ya existe un link con ese código.");

  await setDoc(ref, {
    codigo: codigoLimpio,
    nombre: nombre || codigoLimpio,
    activo: true,
    limiteUsos: limiteUsos > 0 ? limiteUsos : null, // null = ilimitado
    usosActuales: 0,
    recompensaNuevo: recompensaNuevo || recompensaVacia(),
    recompensaExistente: recompensaExistente || recompensaVacia(),
    creadoPor: adminUid,
    creadoPorNombre: adminNombre,
    fecha: serverTimestamp()
  });

  await registrarLog({
    tipo: "link_afiliado_creado",
    adminUid, adminNombre,
    objetivoUid: null, objetivoNombre: "",
    detalle: `Link de afiliado creado: ${codigoLimpio}`
  });

  return codigoLimpio;
}

export async function editarLinkAfiliado(codigo, { nombre, limiteUsos, recompensaNuevo, recompensaExistente }) {
  await updateDoc(doc(db, "linksAfiliado", codigo), {
    nombre, limiteUsos: limiteUsos > 0 ? limiteUsos : null,
    recompensaNuevo, recompensaExistente
  });
}

export async function alternarActivoLinkAfiliado(codigo, activo) {
  await updateDoc(doc(db, "linksAfiliado", codigo), { activo });
}

export async function borrarLinkAfiliado(codigo) {
  await deleteDoc(doc(db, "linksAfiliado", codigo));
}

export async function listarLinksAfiliado() {
  const snap = await getDocs(query(collection(db, "linksAfiliado"), orderBy("fecha", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============ RECLAMAR UN LINK (llamado tras login/registro) ============

// esCuentaNueva: true si el usuario acaba de registrarse en esta misma
// sesión (ver auth.js/index.html), false si ya existía. Devuelve un resumen
// de lo otorgado (para mostrar un mensaje al usuario), o null si el link no
// existe, está inactivo, agotado, o ya fue reclamado antes por este usuario.
export async function reclamarLinkAfiliado(codigo, uid, esCuentaNueva) {
  const refLink = doc(db, "linksAfiliado", codigo);
  const refReclamo = doc(db, "linksAfiliado", codigo, "reclamos", uid);
  const refUsuario = doc(db, "usuarios", uid);

  let recompensaOtorgada = null;

  await runTransaction(db, async (tx) => {
    const snapLink = await tx.get(refLink);
    if (!snapLink.exists()) return; // link no existe, no hace nada

    const link = snapLink.data();
    if (!link.activo) return;

    const snapReclamo = await tx.get(refReclamo);
    if (snapReclamo.exists()) return; // ya lo reclamó antes, no repetir

    if (link.limiteUsos !== null && link.usosActuales >= link.limiteUsos) return; // agotado

    const snapUsuario = await tx.get(refUsuario);
    if (!snapUsuario.exists()) return;
    const datosUsuario = snapUsuario.data();

    const recompensa = esCuentaNueva ? link.recompensaNuevo : link.recompensaExistente;
    if (!recompensa) return;

    // Aplica Ox2 y personalizaciones directamente al documento del usuario,
    // igual que hace personalizacion.js/wallet.js — todo dentro de la misma
    // transacción para que "ya lo reclamó" y "ya recibió su recompensa"
    // ocurran siempre juntos, nunca uno sin el otro.
    const actualizaciones = {};
    if (recompensa.ox2 > 0) {
      actualizaciones.saldo = (datosUsuario.saldo || 0) + recompensa.ox2;
    }
    if (recompensa.banners?.length) {
      const actuales = datosUsuario.bannersDesbloqueados || [];
      actualizaciones.bannersDesbloqueados = [...new Set([...actuales, ...recompensa.banners])];
    }
    if (recompensa.efectos?.length) {
      const actuales = datosUsuario.efectosDesbloqueados || [];
      actualizaciones.efectosDesbloqueados = [...new Set([...actuales, ...recompensa.efectos])];
    }
    if (recompensa.fuentes?.length) {
      const actuales = datosUsuario.fuentesDesbloqueadas || [];
      actualizaciones.fuentesDesbloqueadas = [...new Set([...actuales, ...recompensa.fuentes])];
    }

    if (Object.keys(actualizaciones).length > 0) {
      tx.update(refUsuario, actualizaciones);
    }

    tx.set(refReclamo, { fecha: serverTimestamp(), esCuentaNueva });
    tx.update(refLink, { usosActuales: (link.usosActuales || 0) + 1 });

    recompensaOtorgada = recompensa;
  });

  return recompensaOtorgada;
}

// Texto amigable para mostrarle al usuario qué recibió (usa los catálogos ya
// existentes solo para los nombres — se importan de forma perezosa para
// evitar un ciclo de imports si personalizacion.js algún día importa esto).
export async function describirRecompensa(recompensa) {
  if (!recompensa) return "";
  const partes = [];
  if (recompensa.ox2 > 0) partes.push(`${recompensa.ox2} Ox2`);

  if (recompensa.banners?.length || recompensa.efectos?.length) {
    const { CATALOGO_BANNERS, CATALOGO_EFECTOS } = await import("./personalizacion.js");
    recompensa.banners?.forEach(id => {
      const b = CATALOGO_BANNERS.find(x => x.id === id);
      if (b) partes.push(`banner "${b.nombre}"`);
    });
    recompensa.efectos?.forEach(id => {
      const e = CATALOGO_EFECTOS.find(x => x.id === id);
      if (e) partes.push(`efecto "${e.nombre}"`);
    });
  }

  if (recompensa.fuentes?.length) {
    const { CATALOGO_FUENTES } = await import("./fuentes.js");
    recompensa.fuentes.forEach(id => {
      const f = CATALOGO_FUENTES.find(x => x.id === id);
      if (f) partes.push(`fuente "${f.nombre}"`);
    });
  }

  return partes.join(", ");
}
