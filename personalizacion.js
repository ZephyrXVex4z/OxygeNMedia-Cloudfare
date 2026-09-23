// personalizacion.js
// Banners y "efectos de perfil" (animaciones ligeras tipo Discord Nitro) que el
// usuario puede desbloquear con Ox2 o ganar gratis por ciertas acciones. Todo se
// implementa en CSS puro o canvas 2D simple — nada de librerías externas ni video,
// para que no pese en el sitio.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { registrarLog } from "./logs.js";

// ============ CATÁLOGO DE BANNERS ============
// "tipo" define cómo se pinta: "gradiente" es un simple CSS background, "patron" usa
// un fondo repetido, "canvas" activa una animación en <canvas> (ver perfil-efectos.js).
export const CATALOGO_BANNERS = [
  { id: "banner-basico-azul",   nombre: "Azul básico",     costoOx2: 0,   costoOx3: 0,   tipo: "gradiente", valor: "linear-gradient(135deg, #1a2233, #2a3550)" },
  { id: "banner-basico-verde",  nombre: "Verde básico",    costoOx2: 0,   costoOx3: 0,   tipo: "gradiente", valor: "linear-gradient(135deg, #16321f, #244d33)" },
  { id: "banner-atardecer",     nombre: "Atardecer",       costoOx2: 120, costoOx3: 360, tipo: "gradiente", valor: "linear-gradient(135deg, #ff7e5f, #feb47b)" },
  { id: "banner-oceano",        nombre: "Océano profundo", costoOx2: 120, costoOx3: 360, tipo: "gradiente", valor: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)" },
  { id: "banner-neon",          nombre: "Neón",            costoOx2: 150, costoOx3: 450, tipo: "gradiente", valor: "linear-gradient(135deg, #ff00c8, #7000ff, #00e5ff)" },
  { id: "banner-dorado",        nombre: "Dorado",          costoOx2: 180, costoOx3: 540, tipo: "gradiente", valor: "linear-gradient(135deg, #7a5c1e, #e0a941, #7a5c1e)" },
  { id: "banner-galaxia",       nombre: "Galaxia",         costoOx2: 200, costoOx3: 600, tipo: "canvas",    valor: "galaxia" },
  // Este banner NO aparece en la tienda (no tiene costoOx2/costoOx3 comprable) — solo se
  // otorga automáticamente al seguir el perfil de Zephyr. Ver otorgarBannerSeguidorZephyr().
  { id: "banner-seguidor-zephyr", nombre: "Seguidor de Zephyr", costoOx2: null, costoOx3: null, tipo: "gradiente", valor: "linear-gradient(135deg, #5b8def, #8b5cf6, #5b8def)", exclusivo: true }
];

// ============ CATÁLOGO DE EFECTOS DE PERFIL ============
// Se muestran como una animación superpuesta sobre la tarjeta de perfil (ver
// perfil-efectos.js para la implementación real de cada uno). La mayoría son
// DOM+CSS (igual que el resto del sitio: ligeros, sin canvas ni requestAnimationFrame
// corriendo todo el tiempo); solo "fuego" y "galaxia" usan canvas porque ese estilo
// de partícula random se ve mejor así.
//
// Los efectos SIEMPRE se pueden combinar entre sí sin costo extra — el costo es por
// desbloquear cada uno individualmente, no por cuántos tengas activos a la vez.
export const CATALOGO_EFECTOS = [
  { id: "efecto-brillo",    nombre: "Brillo suave", costoOx2: 0,   costoOx3: 0,   tipo: "css-brillo" },
  { id: "efecto-lluvia",    nombre: "Lluvia",       costoOx2: 100, costoOx3: 300, tipo: "dom-lluvia" },
  { id: "efecto-nieve",     nombre: "Nieve",        costoOx2: 100, costoOx3: 300, tipo: "dom-nieve" },
  { id: "efecto-arcoiris",  nombre: "Arcoíris",     costoOx2: 150, costoOx3: 450, tipo: "css-arcoiris" },
  { id: "efecto-estrellas", nombre: "Estrellas",    costoOx2: 150, costoOx3: 450, tipo: "dom-estrellas" },
  { id: "efecto-fuego",     nombre: "Fuego",        costoOx2: 200, costoOx3: 600, tipo: "canvas-fuego" },
  { id: "efecto-humo",      nombre: "Humo",         costoOx2: 120, costoOx3: 360, tipo: "dom-humo" },
  { id: "efecto-particulas",nombre: "Partículas",   costoOx2: 100, costoOx3: 300, tipo: "dom-particulas" },
  { id: "efecto-burbujas",  nombre: "Burbujas",     costoOx2: 100, costoOx3: 300, tipo: "dom-burbujas" },
  { id: "efecto-hojas",     nombre: "Hojas de otoño", costoOx2: 120, costoOx3: 360, tipo: "dom-hojas" },
  { id: "efecto-petalos",   nombre: "Pétalos",      costoOx2: 120, costoOx3: 360, tipo: "dom-petalos" },
  { id: "efecto-confeti",   nombre: "Confeti",      costoOx2: 150, costoOx3: 450, tipo: "dom-confeti" },
  { id: "efecto-galaxia",   nombre: "Galaxia",      costoOx2: 180, costoOx3: 540, tipo: "canvas-galaxia" },
  { id: "efecto-rayos",     nombre: "Tormenta eléctrica", costoOx2: 180, costoOx3: 540, tipo: "dom-rayos" },
  { id: "efecto-matrix",    nombre: "Lluvia de código", costoOx2: 150, costoOx3: 450, tipo: "dom-matrix" },
  { id: "efecto-nyancat",   nombre: "Gato arcoíris", costoOx2: 200, costoOx3: 600, tipo: "dom-nyancat" }
];

// El UID de Zephyr — se rellena una sola vez, aquí, después de que la cuenta ya
// exista en producción. Mientras esté vacío, otorgarBannerSeguidorZephyr() no hace
// nada (para no romper nada si se despliega antes de tener el UID real).
export const UID_ZEPHYR = ""; // TODO: pegar aquí el UID real de la cuenta de Zephyr

// ============ DESBLOQUEAR CON OX2 ============

export async function comprarBanner(uid, bannerId) {
  const banner = CATALOGO_BANNERS.find(b => b.id === bannerId);
  if (!banner) throw new Error("Ese banner no existe.");
  if (banner.exclusivo) throw new Error("Este banner no está en venta — se obtiene de otra forma.");
  return desbloquearItem(uid, "banner", bannerId, banner.costoOx2);
}

export async function comprarEfecto(uid, efectoId) {
  const efecto = CATALOGO_EFECTOS.find(e => e.id === efectoId);
  if (!efecto) throw new Error("Ese efecto no existe.");
  return desbloquearItem(uid, "efecto", efectoId, efecto.costoOx2);
}

async function desbloquearItem(uid, tipoItem, itemId, costo) {
  const refUsuario = doc(db, "usuarios", uid);
  const snap = await getDoc(refUsuario);
  if (!snap.exists()) throw new Error("Usuario no encontrado.");
  const data = snap.data();

  const campoDesbloqueados = tipoItem === "banner" ? "bannersDesbloqueados" : "efectosDesbloqueados";
  const yaLoTiene = (data[campoDesbloqueados] || []).includes(itemId);
  if (yaLoTiene) throw new Error("Ya tienes esto desbloqueado.");

  const saldoActual = data.saldo || 0;
  if (costo > 0 && saldoActual < costo) {
    throw new Error(`Te faltan Ox2. Necesitas ${costo}, tienes ${saldoActual}.`);
  }

  await updateDoc(refUsuario, {
    saldo: saldoActual - costo,
    [campoDesbloqueados]: [...(data[campoDesbloqueados] || []), itemId]
  });

  if (costo > 0) {
    await addDoc(collection(db, "transacciones"), {
      tipo: `compra_${tipoItem}`,
      deUid: uid, deNombre: "",
      paraUid: null, paraNombre: "",
      monto: costo,
      motivo: `Desbloqueó ${tipoItem === "banner" ? "un banner" : "un efecto"}: ${itemId}`,
      fecha: serverTimestamp()
    });
  }
}

// ============ DESBLOQUEAR CON OX3 ============
// Independiente de la función de arriba (desbloquearItem, que usa Ox2): usa
// runTransaction para que sea atómico de verdad (la de Ox2 hace getDoc+updateDoc
// por separado, con una ventana de carrera — no la toco porque no me pidieron
// arreglar Ox2 todavía, pero para Ox3 sí uso el patrón correcto desde el inicio).

export async function comprarBannerConOx3(uid, bannerId) {
  const banner = CATALOGO_BANNERS.find(b => b.id === bannerId);
  if (!banner) throw new Error("Ese banner no existe.");
  if (banner.exclusivo) throw new Error("Este banner no está en venta — se obtiene de otra forma.");
  return desbloquearItemConOx3(uid, "banner", bannerId, banner.costoOx3);
}

export async function comprarEfectoConOx3(uid, efectoId) {
  const efecto = CATALOGO_EFECTOS.find(e => e.id === efectoId);
  if (!efecto) throw new Error("Ese efecto no existe.");
  return desbloquearItemConOx3(uid, "efecto", efectoId, efecto.costoOx3);
}

async function desbloquearItemConOx3(uid, tipoItem, itemId, costo) {
  const refUsuario = doc(db, "usuarios", uid);
  const campoDesbloqueados = tipoItem === "banner" ? "bannersDesbloqueados" : "efectosDesbloqueados";

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(refUsuario);
    if (!snap.exists()) throw new Error("Usuario no encontrado.");
    const data = snap.data();

    if ((data[campoDesbloqueados] || []).includes(itemId)) {
      throw new Error("Ya tienes esto desbloqueado.");
    }

    const saldoOx3 = data.ox3Balance || 0;
    if (costo > 0 && saldoOx3 < costo) {
      throw new Error(`Te faltan Ox3. Necesitas ${costo}, tienes ${saldoOx3}.`);
    }

    tx.update(refUsuario, {
      ox3Balance: saldoOx3 - costo,
      [campoDesbloqueados]: [...(data[campoDesbloqueados] || []), itemId]
    });
  });

  if (costo > 0) {
    await addDoc(collection(db, "transaccionesOx3"), {
      tipo: "compra_personalizacion",
      deUid: uid, deNombre: "",
      paraUid: uid, paraNombre: "",
      monto: costo,
      motivo: `Desbloqueó ${tipoItem === "banner" ? "un banner" : "un efecto"} con Ox3: ${itemId}`,
      fecha: serverTimestamp()
    });
  }
}

// ============ ELEGIR (equipar) BANNER / EFECTO YA DESBLOQUEADO ============

// ID reservado para "mi banner es una imagen que subí yo", en vez de uno de
// los banners del catálogo — no tiene entrada en CATALOGO_BANNERS a propósito;
// el código de render (perfil.js, ver-perfil.js) revisa este caso primero y,
// si aplica, usa bannerPersonalizadoURL del perfil en vez de buscar un id ahí.
export const BANNER_PERSONALIZADO_ID = "banner-personalizado";

export async function equiparBanner(uid, bannerId) {
  await updateDoc(doc(db, "usuarios", uid), { bannerActivo: bannerId });
}

// Guarda la URL de la imagen de banner personalizada (ya subida a R2 vía
// subir-imagen.js) y la equipa de una vez como banner activo.
export async function equiparBannerPersonalizado(uid, url) {
  await updateDoc(doc(db, "usuarios", uid), {
    bannerActivo: BANNER_PERSONALIZADO_ID,
    bannerPersonalizadoURL: url
  });
}

// Los efectos se combinan libremente — "activarlos" agrega/quita del array
// "efectosActivos" en vez de reemplazar un único valor. Alternar (toggle): si ya
// estaba activo, se quita; si no, se agrega.
export async function alternarEfectoActivo(uid, efectoId) {
  const refUsuario = doc(db, "usuarios", uid);
  const snap = await getDoc(refUsuario);
  if (!snap.exists()) return;
  const activos = snap.data().efectosActivos || [];
  const nuevo = activos.includes(efectoId)
    ? activos.filter(id => id !== efectoId)
    : [...activos, efectoId];
  await updateDoc(refUsuario, { efectosActivos: nuevo });
  return nuevo;
}

// ============ BANNER EXCLUSIVO POR SEGUIR A ZEPHYR ============

// Se llama desde seguidores.js cada vez que alguien sigue a un perfil. Si el
// perfil seguido es Zephyr, y quien sigue no lo tenía ya desbloqueado, se le
// otorga automáticamente — sin costo, y sin que pueda comprarse de otra forma.
export async function otorgarBannerSeguidorZephyrSiAplica(miUid, otroUid) {
  if (!UID_ZEPHYR || otroUid !== UID_ZEPHYR) return;

  const refUsuario = doc(db, "usuarios", miUid);
  const snap = await getDoc(refUsuario);
  if (!snap.exists()) return;
  const data = snap.data();

  const yaLoTiene = (data.bannersDesbloqueados || []).includes("banner-seguidor-zephyr");
  if (yaLoTiene) return;

  await updateDoc(refUsuario, {
    bannersDesbloqueados: [...(data.bannersDesbloqueados || []), "banner-seguidor-zephyr"]
  });
}