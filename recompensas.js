// recompensas.js
// Sistema de recompensas: los usuarios ganan Ox2 GRATIS por actividad (like recibido,
// publicar) y pueden canjearlos por tarjetas de regalo reales (Xbox, Microsoft Store, etc.).
// A diferencia de comprar-giftcard.js (que vende Ox2 a cambio de dinero real que SÍ entra),
// este Ox2 "gratis" no representa ningún ingreso — así que el canje por una tarjeta real
// es un GASTO real para el dueño del proyecto. Por eso todo este módulo gira alrededor de
// un límite: nunca gastar más de PRESUPUESTO_MENSUAL_MXN en un mismo mes calendario.
//
// Piezas:
// 1. Otorgar Ox2 por actividad (otorgarOxPorLike, otorgarOxPorPublicar) — con topes diarios
//    para que no sea explotable (spam de posts, o dar/quitar like en bucle).
// 2. Catálogo de recompensas (tarjetas) con su precio en Ox2, proporcional a su valor real.
// 3. Un contador mensual de gasto (colección "cupoRecompensas") que se resetea cada mes y
//    bloquea nuevos canjes en cuanto se llega al presupuesto — automático, sin que el admin
//    tenga que estar revisando a diario.
// 4. Cola de canjes pendientes para que el admin entregue el código real (Xbox/Microsoft
//    Store, etc.) manualmente, igual que ya hace con las gift cards de Ox2.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection, getDocs, query, where,
  orderBy, limit, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { crearNotificacion } from "./notificaciones.js";
import { registrarLog } from "./logs.js";

// ============ CONFIGURACIÓN (editar aquí cambia todo el sistema) ============

// Cuánto Ox2 gratis se puede ganar, y sus topes diarios anti-abuso.
export const OX_POR_LIKE_RECIBIDO = 1;
export const OX_POR_PUBLICAR = 10;
export const MAX_POSTS_QUE_CUENTAN_POR_DIA = 3; // más de esto, ya no da Ox2 (sigue publicando, solo no gana)

// Presupuesto real: nunca se gasta más de esto en tarjetas de regalo reales por mes.
export const PRESUPUESTO_MENSUAL_MXN = 150;

// Catálogo de recompensas. "costoOx2" proporcional al valor real (más caro que comprarlo
// directo en comprar-giftcard.js, para que comprar siga siendo lo más conveniente y así
// la venta de gift cards siga financiando este sistema).
export const CATALOGO_RECOMPENSAS = [
  { id: "xbox-20", nombre: "Tarjeta Xbox $20 MXN", valorMxn: 20, costoOx2: 400 },
  { id: "msstore-20", nombre: "Tarjeta Microsoft Store $20 MXN", valorMxn: 20, costoOx2: 400 },
  { id: "xbox-50", nombre: "Tarjeta Xbox $50 MXN", valorMxn: 50, costoOx2: 900 },
  { id: "msstore-50", nombre: "Tarjeta Microsoft Store $50 MXN", valorMxn: 50, costoOx2: 900 },
  { id: "xbox-100", nombre: "Tarjeta Xbox $100 MXN", valorMxn: 100, costoOx2: 1600 },
  { id: "msstore-100", nombre: "Tarjeta Microsoft Store $100 MXN", valorMxn: 100, costoOx2: 1600 },
];

function idMesActual() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
}

// ============ GANAR OX2 POR ACTIVIDAD ============

// Se llama desde muro.js cuando alguien recibe un like (solo si seAgrego === true y
// el autor no se dio like a sí mismo — esa validación ya la hace muro.js antes de llamar).
export async function otorgarOxPorLike(autorPubUid, pubId) {
  const refUsuario = doc(db, "usuarios", autorPubUid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(refUsuario);
    if (!snap.exists()) return;
    const saldoActual = snap.data().saldo || 0;
    tx.update(refUsuario, { saldo: saldoActual + OX_POR_LIKE_RECIBIDO });
  });

  await registrarOxGanado(autorPubUid, OX_POR_LIKE_RECIBIDO, "like_recibido", "Alguien le dio like a tu publicación", { pubId });
}

// Se llama desde muro.js al crear una publicación. Cuenta cuántos posts del autor ya
// "contaron" hoy (campo postsConRecompensaHoy + fecha del último reseteo) para no dar
// Ox2 infinito por spamear publicaciones.
export async function otorgarOxPorPublicar(autorId, pubId) {
  const refUsuario = doc(db, "usuarios", autorId);
  const hoyStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  let seOtorgo = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(refUsuario);
    if (!snap.exists()) return;
    const data = snap.data();

    const esMismoDia = data.fechaPostsRecompensa === hoyStr;
    const postsHoy = esMismoDia ? (data.postsConRecompensaHoy || 0) : 0;

    if (postsHoy >= MAX_POSTS_QUE_CUENTAN_POR_DIA) return; // ya llegó al tope de hoy, no da más

    tx.update(refUsuario, {
      saldo: (data.saldo || 0) + OX_POR_PUBLICAR,
      postsConRecompensaHoy: postsHoy + 1,
      fechaPostsRecompensa: hoyStr
    });
    seOtorgo = true;
  });

  if (seOtorgo) {
    await registrarOxGanado(autorId, OX_POR_PUBLICAR, "publicacion", "Publicaste algo nuevo", { pubId });
  }
}

// Guarda una entrada en el historial de "Ox2 ganado gratis" del usuario — separado de
// "transacciones" (que es para transferencias/compras entre personas), porque esto es
// específicamente actividad que generó saldo sin que nadie más lo pagara. Se llama
// DESPUÉS de que el saldo ya se actualizó en su propia transacción, así que un fallo
// aquí (poco probable) nunca deja el saldo desincronizado del registro — en el peor
// caso, el usuario ganó el Ox2 pero esa ganancia específica no quedó anotada en su
// historial visible, lo cual no es grave.
async function registrarOxGanado(uid, cantidad, tipo, descripcion, dataExtra = {}) {
  try {
    await addDoc(collection(db, "historialOxGratis"), {
      uid, cantidad, tipo, descripcion, ...dataExtra,
      fecha: serverTimestamp()
    });
  } catch (e) { /* no crítico: el saldo ya se otorgó, esto es solo el registro visible */ }
}

export async function listarHistorialOxGratis(uid, cantidad = 50) {
  const snap = await getDocs(
    query(collection(db, "historialOxGratis"), where("uid", "==", uid), orderBy("fecha", "desc"), limit(cantidad))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============ CUPO MENSUAL (el candado real del presupuesto) ============

// Devuelve { gastadoMxn, restanteMxn, agotado } del mes actual.
export async function obtenerEstadoCupoMensual() {
  const snap = await getDoc(doc(db, "cupoRecompensas", idMesActual()));
  const gastadoMxn = snap.exists() ? (snap.data().gastadoMxn || 0) : 0;
  const restanteMxn = Math.max(0, PRESUPUESTO_MENSUAL_MXN - gastadoMxn);
  return { gastadoMxn, restanteMxn, agotado: restanteMxn <= 0 };
}

// ============ CANJEAR UNA RECOMPENSA ============

// El usuario canjea Ox2 por una recompensa del catálogo. Valida en una sola transacción:
// 1) que tenga saldo suficiente, 2) que el cupo mensual no esté agotado. Si algo falla,
// no se descuenta nada (todo o nada, igual que las demás operaciones de saldo del proyecto).
// Deja el canje en estado "pendiente" para que el admin entregue el código real a mano.
export async function canjearRecompensa(uid, nombre, recompensaId) {
  const recompensa = CATALOGO_RECOMPENSAS.find(r => r.id === recompensaId);
  if (!recompensa) throw new Error("Esa recompensa ya no está disponible.");

  const refUsuario = doc(db, "usuarios", uid);
  const refCupo = doc(db, "cupoRecompensas", idMesActual());

  // Antes, el saldo se descontaba DENTRO de esta transacción y la solicitud de canje
  // se creaba DESPUÉS, como una operación aparte. Si esa segunda escritura fallaba
  // (red inestable, permisos, cualquier error), el usuario ya había perdido el Ox2
  // pero nunca se generaba ninguna solicitud — el admin jamás se enteraba y el Ox2
  // quedaba perdido sin remedio. Ahora TODO ocurre dentro de la misma transacción
  // atómica: o se descuenta el saldo Y se crea la solicitud juntos, o no pasa
  // ninguna de las dos. No puede quedar una a medias.
  let idSolicitud = null;

  await runTransaction(db, async (tx) => {
    const snapUsuario = await tx.get(refUsuario);
    const snapCupo = await tx.get(refCupo);
    if (!snapUsuario.exists()) throw new Error("Usuario no encontrado.");

    const saldoActual = snapUsuario.data().saldo || 0;
    if (saldoActual < recompensa.costoOx2) {
      throw new Error(`Te faltan Ox2. Necesitas ${recompensa.costoOx2}, tienes ${saldoActual}.`);
    }

    const gastadoMxn = snapCupo.exists() ? (snapCupo.data().gastadoMxn || 0) : 0;
    if (gastadoMxn + recompensa.valorMxn > PRESUPUESTO_MENSUAL_MXN) {
      throw new Error("Se agotó el cupo de recompensas de este mes. Vuelve a intentar el próximo mes.");
    }

    const refSolicitud = doc(collection(db, "canjesRecompensas"));
    idSolicitud = refSolicitud.id;

    tx.update(refUsuario, { saldo: saldoActual - recompensa.costoOx2 });
    tx.set(refCupo, { gastadoMxn: gastadoMxn + recompensa.valorMxn }, { merge: true });
    tx.set(refSolicitud, {
      uid, nombre,
      recompensaId: recompensa.id,
      recompensaNombre: recompensa.nombre,
      valorMxn: recompensa.valorMxn,
      costoOx2: recompensa.costoOx2,
      estado: "pendiente", // "pendiente" | "entregado"
      codigoEntregado: null,
      fecha: serverTimestamp()
    });
  });

  return idSolicitud;
}

// ============ PANEL ADMIN: entregar canjes pendientes ============

export async function listarCanjesPendientes() {
  const snap = await getDocs(
    query(collection(db, "canjesRecompensas"), where("estado", "==", "pendiente"), orderBy("fecha", "asc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// El admin marca un canje como entregado, dejando el código real que le pasó al usuario
// (por WhatsApp u otro medio, igual que hace hoy con las gift cards de Ox2).
export async function marcarCanjeEntregado(canjeId, adminUid, adminNombre, codigoEntregado) {
  await updateDoc(doc(db, "canjesRecompensas", canjeId), {
    estado: "entregado",
    codigoEntregado: codigoEntregado || "",
    entregadoPor: adminNombre,
    fechaEntrega: serverTimestamp()
  });

  await registrarLog({
    tipo: "canje_recompensa_entregado",
    adminUid, adminNombre,
    objetivoUid: null, objetivoNombre: "",
    detalle: `Canje de recompensa entregado (${canjeId})`
  });
}
