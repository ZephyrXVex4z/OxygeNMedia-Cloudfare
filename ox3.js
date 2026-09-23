// ox3.js
// Moneda OX3 — independiente de Ox2. Generada en Star Egg y otras
// actividades especiales. Solo sirve para personalizaciones cosméticas.
// Mismo patrón que wallet.js: runTransaction para atomicidad,
// transaccionesOx3 como historial inmutable, IDs determinísticos como
// candado de una sola vez.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, runTransaction, collection, addDoc, getDocs, query,
  where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// Tabla fija de hitos de Star Egg. DEBE coincidir exactamente con
// montoDeHito()/clicksDeHito() en firestore.rules — el monto real lo
// decide esa tabla en las reglas, esto es solo para que el cliente sepa
// qué mostrar y qué intentar reclamar.
export const HITOS_STAR_EGG = [
  { id: "starEgg_100", clicks: 100, monto: 3 },
  { id: "starEgg_500", clicks: 500, monto: 9 },
  { id: "starEgg_1000", clicks: 1000, monto: 15 },
  { id: "starEgg_5000", clicks: 5000, monto: 60 },
  { id: "starEgg_10000", clicks: 10000, monto: 150 }
];

// Tabla fija de boosters de Star Egg. DEBE coincidir con precioBooster() en
// firestore.rules — igual que con los hitos, el precio real lo decide la
// regla, esto es solo para que el cliente sepa qué mostrar y qué intentar.
export const BOOSTERS_STAR_EGG = [
  { id: "click_x2", nombre: "Click x2", desc: "Cada click vale el doble de energía.", precioEnergia: 150, icono: "⚡" },
  { id: "autoclicker", nombre: "Auto-Clicker", desc: "El huevo se hace clic solo, 1 vez por segundo.", precioEnergia: 300, icono: "🤖" }
];

/** Energía real de Star Egg (Firestore, ya no es solo un número visual). */
export async function obtenerEnergiaStarEgg(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? (snap.data().starEggEnergy || 0) : 0;
}

/** Boosters de Star Egg que el usuario ya tiene comprados. */
export async function obtenerBoostersStarEgg(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? (snap.data().starEggBoosters || []) : [];
}

/**
 * Sincroniza un lote de energía local al contador real en Firestore.
 * Las reglas rechazan lotes de más de 120 de una sola vez (más alto que
 * clicks porque con boosters activos un uso legítimo genera energía más
 * rápido); si hace falta, la partimos.
 */
export async function sincronizarEnergiaStarEgg(uid, incremento) {
  if (!incremento || incremento <= 0) return;
  let restante = Math.floor(incremento);
  const userRef = doc(db, "usuarios", uid);
  while (restante > 0) {
    const lote = Math.min(120, restante);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error("Usuario no encontrado.");
      const actual = snap.data().starEggEnergy || 0;
      tx.update(userRef, { starEggEnergy: actual + lote });
    });
    restante -= lote;
  }
}

/**
 * Compra un booster de Star Egg con ENERGÍA. Atómico: si ya lo tienes, o no
 * te alcanza, las reglas rechazan la escritura completa.
 */
export async function comprarBoosterStarEgg(uid, boosterId) {
  const booster = BOOSTERS_STAR_EGG.find(b => b.id === boosterId);
  if (!booster) throw new Error("Ese booster no existe.");

  const userRef = doc(db, "usuarios", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error("Usuario no encontrado.");
    const data = snap.data();
    const boosters = data.starEggBoosters || [];
    if (boosters.includes(boosterId)) throw new Error("Ya tienes este booster.");
    const energia = data.starEggEnergy || 0;
    if (energia < booster.precioEnergia) {
      throw new Error(`Te faltan ${booster.precioEnergia - energia} de energía.`);
    }
    tx.update(userRef, {
      starEggEnergy: energia - booster.precioEnergia,
      starEggBoosters: [...boosters, boosterId],
      ultimoBoosterComprado: boosterId
    });
  });
}

/**
 * Canjea ENERGÍA por OX3 a tasa fija: 100 energía = 2 Ox3. `bloques` es la
 * cantidad de bloques de 100 energía a canjear (mínimo 1).
 */
export async function canjearEnergiaPorOx3(uid, nombre, bloques) {
  bloques = Math.floor(Number(bloques));
  if (!Number.isFinite(bloques) || bloques <= 0) throw new Error("Cantidad inválida.");

  const energiaAGastar = bloques * 100;
  const ox3AGanar = bloques * 2;
  const userRef = doc(db, "usuarios", uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error("Usuario no encontrado.");
    const data = snap.data();
    const energiaActual = data.starEggEnergy || 0;
    if (energiaActual < energiaAGastar) throw new Error("No tienes suficiente energía.");
    tx.update(userRef, {
      starEggEnergy: energiaActual - energiaAGastar,
      ox3Balance: (data.ox3Balance || 0) + ox3AGanar
    });
  });

  await addDoc(collection(db, "transaccionesOx3"), {
    tipo: "canje_energia",
    deUid: uid, deNombre: nombre,
    paraUid: uid, paraNombre: nombre,
    monto: ox3AGanar,
    motivo: `Canjeó ${energiaAGastar} de energía`,
    fecha: serverTimestamp()
  });

  return ox3AGanar;
}

/** Saldo real de Ox3 (Firestore, nunca localStorage). */
export async function obtenerSaldoOx3(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? (snap.data().ox3Balance || 0) : 0;
}

/** Contador real de clicks de Star Egg (fuente de verdad de las recompensas). */
export async function obtenerClicksStarEgg(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? (snap.data().starEggClicks || 0) : 0;
}

/**
 * Sincroniza un lote de clicks locales al contador real en Firestore.
 * Las reglas rechazan lotes de más de 30 de una sola vez, así que aquí
 * los partimos si hace falta. Llamar cada cierto intervalo (no en cada
 * click individual) para no saturar de escrituras.
 */
export async function sincronizarClicksStarEgg(uid, incremento) {
  if (!incremento || incremento <= 0) return;
  let restante = Math.floor(incremento);
  const userRef = doc(db, "usuarios", uid);
  while (restante > 0) {
    const lote = Math.min(30, restante);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error("Usuario no encontrado.");
      const actual = snap.data().starEggClicks || 0;
      tx.update(userRef, { starEggClicks: actual + lote });
    });
    restante -= lote;
  }
}

/**
 * Intenta reclamar TODOS los hitos de Star Egg que el usuario ya alcanzó
 * y aún no había reclamado. Es seguro llamarla repetidamente: los hitos
 * ya reclamados simplemente se ignoran (el documento ya existe, la
 * creación falla, lo atrapamos y seguimos). Devuelve la lista de hitos
 * recién reclamados en esta llamada (para animar "REWARD CLAIMED").
 */
export async function reclamarRecompensasStarEgg(uid, nombre) {
  const clicksActuales = await obtenerClicksStarEgg(uid);
  const reclamados = [];

  for (const hito of HITOS_STAR_EGG) {
    if (clicksActuales < hito.clicks) continue;

    const recompensaRef = doc(db, "recompensasStarEgg", `${uid}_${hito.id}`);
    const yaExiste = await getDoc(recompensaRef);
    if (yaExiste.exists()) continue; // ya reclamado antes

    try {
      const userRef = doc(db, "usuarios", uid);
      await runTransaction(db, async (tx) => {
        const recompensaSnap = await tx.get(recompensaRef);
        if (recompensaSnap.exists()) return; // otra pestaña ya lo reclamó

        const userSnap = await tx.get(userRef);
        const saldoOx3Actual = userSnap.data().ox3Balance || 0;

        tx.set(recompensaRef, {
          uid, hito: hito.id, monto: hito.monto, fecha: serverTimestamp()
        });
        tx.update(userRef, {
          ox3Balance: saldoOx3Actual + hito.monto,
          ultimoHitoStarEgg: hito.id
        });
      });

      await addDoc(collection(db, "transaccionesOx3"), {
        tipo: "recompensa_staregg",
        deUid: uid, deNombre: nombre,
        paraUid: uid, paraNombre: nombre,
        monto: hito.monto,
        motivo: `Star Egg: ${hito.clicks.toLocaleString("es-MX")} clicks`,
        fecha: serverTimestamp()
      });

      reclamados.push(hito);
    } catch (err) {
      // Ya reclamado por otra pestaña/dispositivo, o las reglas lo rechazaron
      // (starEggClicks del servidor todavía no llega al umbral) — se ignora.
    }
  }

  return reclamados;
}

/** Transfiere Ox3 de un usuario a otro. Atómica vía transferenciasOx3 + reglas cruzadas. */
export async function transferirOx3(deUid, deNombre, paraUid, paraNombre, monto, motivo) {
  monto = Math.floor(Number(monto));
  if (!Number.isFinite(monto) || monto <= 0) throw new Error("Monto inválido.");
  if (deUid === paraUid) throw new Error("No puedes transferirte Ox3 a ti mismo.");

  const deRef = doc(db, "usuarios", deUid);
  const paraRef = doc(db, "usuarios", paraUid);

  const transferRef = doc(collection(db, "transferenciasOx3"));

  await runTransaction(db, async (tx) => {
    const deSnap = await tx.get(deRef);
    const paraSnap = await tx.get(paraRef);
    if (!deSnap.exists() || !paraSnap.exists()) throw new Error("Usuario no encontrado.");

    const saldoDe = deSnap.data().ox3Balance || 0;
    if (saldoDe < monto) throw new Error("No tienes suficiente Ox3.");

    const saldoPara = paraSnap.data().ox3Balance || 0;

    tx.set(transferRef, {
      deUid, paraUid, monto, motivo: motivo || "", fecha: serverTimestamp()
    });
    tx.update(deRef, { ox3Balance: saldoDe - monto });
    tx.update(paraRef, {
      ox3Balance: saldoPara + monto,
      ultimaTransferenciaOx3Id: transferRef.id
    });
  });

  await addDoc(collection(db, "transaccionesOx3"), {
    tipo: "transferencia", deUid, deNombre, paraUid, paraNombre, monto,
    motivo: motivo || "", fecha: serverTimestamp()
  });
}

/** Ajuste administrativo (dar o quitar Ox3). Solo pasa las reglas si rol == "admin". */
export async function adminAjustarOx3(adminUid, adminNombre, objetivoUid, objetivoNombre, monto, motivo) {
  monto = Math.floor(Number(monto));
  if (!Number.isFinite(monto) || monto === 0) throw new Error("Monto inválido.");

  const objetivoRef = doc(db, "usuarios", objetivoUid);
  let saldoAnterior = 0, saldoNuevo = 0;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(objetivoRef);
    if (!snap.exists()) throw new Error("Usuario no encontrado.");
    saldoAnterior = snap.data().ox3Balance || 0;
    saldoNuevo = Math.max(0, saldoAnterior + monto);
    tx.update(objetivoRef, { ox3Balance: saldoNuevo });
  });

  await addDoc(collection(db, "transaccionesOx3"), {
    tipo: monto > 0 ? "admin_dar" : "admin_quitar",
    deUid: adminUid, deNombre: adminNombre,
    paraUid: objetivoUid, paraNombre: objetivoNombre,
    monto: Math.abs(monto),
    balanceAnterior: saldoAnterior, balanceNuevo: saldoNuevo,
    motivo: motivo || "", fecha: serverTimestamp()
  });

  return saldoNuevo;
}

/**
 * Compra una personalización con Ox3. El producto (id, precio) debe venir
 * del catálogo local en personalizacion.js — el cliente NUNCA envía el
 * precio, solo el id; el precio que se descuenta es el que el catálogo ya
 * tiene fijado en este archivo cargado por la app, no algo que llegue del
 * servidor en esta versión sin backend (ver README: seguridad real = rules).
 */
export async function comprarConOx3(uid, costoOx3, camposDesbloqueo) {
  const userRef = doc(db, "usuarios", uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) throw new Error("Usuario no encontrado.");
    const saldo = snap.data().ox3Balance || 0;
    if (saldo < costoOx3) throw new Error("No tienes suficiente Ox3.");
    tx.update(userRef, { ox3Balance: saldo - costoOx3, ...camposDesbloqueo });
  });
}

/** Historial de movimientos de Ox3 (enviados o recibidos), más recientes primero. */
export async function obtenerHistorialOx3(uid, cantidad = 50) {
  const [enviados, recibidos] = await Promise.all([
    getDocs(query(collection(db, "transaccionesOx3"), where("deUid", "==", uid))),
    getDocs(query(collection(db, "transaccionesOx3"), where("paraUid", "==", uid)))
  ]);

  const vistos = new Set();
  const historial = [];
  [...enviados.docs, ...recibidos.docs].forEach(d => {
    if (vistos.has(d.id)) return;
    vistos.add(d.id);
    historial.push({ id: d.id, ...d.data() });
  });

  historial.sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
  return historial.slice(0, cantidad);
}