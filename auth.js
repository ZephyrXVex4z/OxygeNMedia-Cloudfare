// auth.js
// Maneja registro, login, logout y el estado de aprobación del usuario

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// Crea una cuenta nueva. REGISTRO ABIERTO (lanzamiento): la cuenta queda
// aprobada automáticamente, sin revisión manual de un admin. Antes de este
// cambio, toda cuenta nueva quedaba con aprobado:false hasta que un admin
// la revisaba desde el panel — eso ya no aplica.
export async function registrarUsuario(nombre, email, password, tokenRecaptcha = null) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  await setDoc(doc(db, "usuarios", uid), {
    nombre: nombre,
    email: email,
    rol: "estudiante",
    aprobado: true,
    fechaSolicitud: serverTimestamp(),
    recursosComprados: [],
    // Token de reCAPTCHA v3 del momento del registro, guardado tal cual para revisión
    // manual del admin. No se verifica del lado del servidor (el proyecto no tiene
    // backend propio para eso), así que esto NO bloquea registros de bots por sí solo
    // — es evidencia de auditoría, no un filtro automático. Con el registro abierto,
    // esta evidencia importa más que antes: es lo único que queda para detectar bots
    // después de que ya entraron, ya que nadie los revisa antes de dejarlos pasar.
    tokenRecaptchaRegistro: tokenRecaptcha || null
  });

  return uid;
}

// Inicia sesión con email y contraseña
export async function iniciarSesion(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Cierra sesión
export async function cerrarSesion() {
  limpiarPerfilCache();
  await signOut(auth);
}

// Envía un correo con enlace para restablecer la contraseña
export async function enviarCorreoRestablecer(email) {
  await sendPasswordResetEmail(auth, email);
}

// Trae el documento de Firestore del usuario actual (rol, aprobado, etc.)
export async function obtenerPerfilUsuario(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return null;
  return snap.data();
}

// --- Caché de perfil en sessionStorage ---
// Evita esperar el viaje a Firestore en cada cambio de página dentro de la misma
// pestaña/sesión del navegador. Se invalida sola al cerrar sesión o cerrar la pestaña.
const CLAVE_CACHE_PERFIL = "perfilCache_v1";

function leerPerfilCache(uid) {
  try {
    const raw = sessionStorage.getItem(CLAVE_CACHE_PERFIL);
    if (!raw) return null;
    const datos = JSON.parse(raw);
    if (datos.uid !== uid) return null; // cambió de usuario, no sirve el caché
    return datos.perfil;
  } catch {
    return null;
  }
}

function guardarPerfilCache(uid, perfil) {
  try {
    sessionStorage.setItem(CLAVE_CACHE_PERFIL, JSON.stringify({ uid, perfil }));
  } catch {
    // sessionStorage lleno o bloqueado (modo incógnito estricto) — no es crítico, seguimos sin caché
  }
}

export function limpiarPerfilCache() {
  try { sessionStorage.removeItem(CLAVE_CACHE_PERFIL); } catch {}
}

// Escucha cambios de sesión y ejecuta un callback con (user, perfil).
// Si hay un perfil cacheado de esta misma sesión, llama al callback INMEDIATAMENTE
// con esos datos (la página se siente instantánea), y luego vuelve a llamar con los
// datos frescos de Firestore en cuanto lleguen (por si algo cambió, ej. te aprobaron).
//
// REINTENTOS ante documento inexistente: justo después de registrarse,
// createUserWithEmailAndPassword ya deja al usuario autenticado (dispara este
// listener) ANTES de que el setDoc() del perfil en Firestore termine de
// escribirse — son dos operaciones asíncronas independientes, no hay garantía
// de orden entre "Auth ya tiene sesión" y "Firestore ya tiene el documento".
// Sin este reintento, esa ventana de milisegundos se interpretaba como
// "cuenta no aprobada todavía", causando el parpadeo entre pantallas que
// describías. Reintentar unas pocas veces con una espera corta absorbe esa
// carrera sin necesidad de sincronizar a mano el registro y el primer login.
const REINTENTOS_PERFIL_INEXISTENTE = 5;
const ESPERA_ENTRE_REINTENTOS_MS = 400;

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function observarSesion(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      limpiarPerfilCache();
      callback(null, null);
      return;
    }

    const cacheado = leerPerfilCache(user.uid);
    if (cacheado) {
      callback(user, cacheado);
    }

    let perfilFresco = await obtenerPerfilUsuario(user.uid);

    // Si no hay caché Y el documento todavía no existe, puede ser la carrera
    // de un registro recién hecho — reintenta unas pocas veces antes de
    // rendirse y tratarlo como una cuenta realmente sin perfil.
    if (!perfilFresco && !cacheado) {
      for (let intento = 0; intento < REINTENTOS_PERFIL_INEXISTENTE && !perfilFresco; intento++) {
        await esperar(ESPERA_ENTRE_REINTENTOS_MS);
        perfilFresco = await obtenerPerfilUsuario(user.uid);
      }
    }

    if (perfilFresco) guardarPerfilCache(user.uid, perfilFresco);

    // Evita re-renderizar de más si el perfil cacheado y el fresco son idénticos
    if (!cacheado || JSON.stringify(cacheado) !== JSON.stringify(perfilFresco)) {
      callback(user, perfilFresco);
    }
  });
}

// Determina si una cuenta debe tratarse como bloqueada: no aprobada, o suspendida
// (y si la suspensión es temporal, ya venció). Se usa en cada página para decidir
// si mostrar el contenido o una pantalla de acceso restringido.
export function cuentaBloqueada(perfil) {
  if (!perfil || perfil.aprobado !== true) return { bloqueada: true, motivo: "pendiente" };
  if (perfil.suspendido === true) {
    const hasta = perfil.suspensionHasta;
    const yaVencio = hasta && hasta.toDate && hasta.toDate().getTime() < Date.now();
    if (!yaVencio) return { bloqueada: true, motivo: "suspendido", detalle: perfil.suspensionMotivo || "" };
  }
  return { bloqueada: false };
}

// Revisa si el sitio está en modo mantenimiento. Los admins (rol === "admin")
// nunca se bloquean por mantenimiento, sin importar lo que devuelva esto.
// Se importa perezosamente para no crear un ciclo de imports con mantenimiento.js.
export async function verificarMantenimiento() {
  const { obtenerEstadoMantenimiento } = await import("./mantenimiento.js");
  return obtenerEstadoMantenimiento();
}

// Traduce errores comunes de Firebase Auth a mensajes en español
export function traducirErrorAuth(error) {
  const codigo = error.code || "";
  const mapa = {
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta registrada.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
    "auth/missing-email": "Escribe tu correo primero."
  };
  return mapa[codigo] || "Ocurrió un error. Intenta de nuevo.";
}
