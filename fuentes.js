// fuentes.js
// Personalización de FUENTE para toda la web, independiente del tema de color
// (temas.js sigue controlando solo los colores). El usuario elige tema de color
// y fuente por separado; ambas preferencias conviven sin pisarse.
//
// Igual que los banners/efectos de personalizacion.js, algunas fuentes son
// gratis y otras se desbloquean con Ox2. La fuente equipada se guarda en el
// perfil (usuarios/{uid}.fuenteActiva) para poder cobrarla — no basta con
// localStorage, porque cualquiera podría "activarse" una fuente de pago sin
// comprarla si solo viviera en el navegador.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// "google" es el query string de Google Fonts (family=...), "css" es el
// font-family real a usar en --font-body/--font-display.
export const CATALOGO_FUENTES = [
  { id: "fuente-sistema",   nombre: "Predeterminada", costoOx2: 0,  google: null, css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { id: "fuente-inter",     nombre: "Inter",          costoOx2: 0,  google: "Inter:wght@400;500;600;700", css: "'Inter', sans-serif" },
  { id: "fuente-mono",      nombre: "Space Mono",     costoOx2: 0,  google: "Space+Mono:wght@400;700", css: "'Space Mono', monospace" },
  { id: "fuente-nunito",    nombre: "Nunito",         costoOx2: 0,  google: "Nunito:wght@400;600;700", css: "'Nunito', sans-serif" },
  { id: "fuente-playfair",  nombre: "Playfair Display", costoOx2: 10, google: "Playfair+Display:wght@500;700", css: "'Playfair Display', serif" },
  { id: "fuente-poppins",   nombre: "Poppins",        costoOx2: 15, google: "Poppins:wght@400;600;700", css: "'Poppins', sans-serif" },
  { id: "fuente-orbitron",  nombre: "Orbitron",       costoOx2: 25, google: "Orbitron:wght@500;700", css: "'Orbitron', sans-serif" },
  { id: "fuente-caveat",    nombre: "Caveat",         costoOx2: 40, google: "Caveat:wght@500;700", css: "'Caveat', cursive" }
];

const FUENTE_DEFAULT = "fuente-sistema";
const CLAVE_CACHE_FUENTE = "oxygenmedia_fuente_cache";

export function obtenerFuente(id) {
  return CATALOGO_FUENTES.find(f => f.id === id) || CATALOGO_FUENTES[0];
}

// Aplica la fuente a :root (--font-body y --font-display usan la misma fuente
// elegida, a diferencia de temas.js que a veces las separa) y carga su Google
// Font si hace falta. También refresca la caché local para el anti-flash.
export function aplicarFuente(fuenteId) {
  const fuente = obtenerFuente(fuenteId);
  const root = document.documentElement;
  root.style.setProperty("--font-body", fuente.css);
  root.style.setProperty("--font-display", fuente.css);

  if (fuente.google) cargarFuenteGoogle(fuente.id, fuente.google);

  try { localStorage.setItem(CLAVE_CACHE_FUENTE, fuenteId); } catch {}
}

function cargarFuenteGoogle(idFuente, query) {
  const idLink = "fuente-personalizada-google-font";
  const href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  let link = document.getElementById(idLink);
  if (link) {
    if (link.dataset.fuenteId === idFuente) return; // ya cargada
    link.href = href;
    link.dataset.fuenteId = idFuente;
  } else {
    link = document.createElement("link");
    link.id = idLink;
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.fuenteId = idFuente;
    document.head.appendChild(link);
  }
}

// Última fuente conocida (cache local, solo para evitar el flash antes de que
// cargue el perfil real desde Firestore — ver fuente-inline.js).
export function obtenerFuenteCache() {
  try { return localStorage.getItem(CLAVE_CACHE_FUENTE) || FUENTE_DEFAULT; } catch { return FUENTE_DEFAULT; }
}

// ============ DESBLOQUEAR CON OX2 ============

export async function comprarFuente(uid, fuenteId) {
  const fuente = CATALOGO_FUENTES.find(f => f.id === fuenteId);
  if (!fuente) throw new Error("Esa fuente no existe.");

  const refUsuario = doc(db, "usuarios", uid);
  const snap = await getDoc(refUsuario);
  if (!snap.exists()) throw new Error("Usuario no encontrado.");
  const data = snap.data();

  const yaLaTiene = (data.fuentesDesbloqueadas || []).includes(fuenteId);
  if (yaLaTiene) throw new Error("Ya tienes esta fuente desbloqueada.");

  const saldoActual = data.saldo || 0;
  if (fuente.costoOx2 > 0 && saldoActual < fuente.costoOx2) {
    throw new Error(`Te faltan Ox2. Necesitas ${fuente.costoOx2}, tienes ${saldoActual}.`);
  }

  await updateDoc(refUsuario, {
    saldo: saldoActual - fuente.costoOx2,
    fuentesDesbloqueadas: [...(data.fuentesDesbloqueadas || []), fuenteId]
  });

  if (fuente.costoOx2 > 0) {
    await addDoc(collection(db, "transacciones"), {
      tipo: "compra_fuente",
      deUid: uid, deNombre: "",
      paraUid: null, paraNombre: "",
      monto: fuente.costoOx2,
      motivo: `Desbloqueó la fuente: ${fuente.nombre}`,
      fecha: serverTimestamp()
    });
  }
}

// Equipa una fuente ya desbloqueada (o gratis) como la activa del usuario.
export async function equiparFuente(uid, fuenteId) {
  await updateDoc(doc(db, "usuarios", uid), { fuenteActiva: fuenteId });
  aplicarFuente(fuenteId);
}
