// estado-usuario.js
// Estado de presencia del usuario: "En línea"/"Desconectado" automático, más
// estados manuales que el usuario puede forzar (Jugando, No molestar, etc.)
// incluyendo uno personalizado con texto libre.
//
// ⚠️ SOBRE "EN LÍNEA" SIN BACKEND: Firestore no tiene un evento nativo de
// "se desconectó" (eso requiere Firebase Realtime Database + Cloud Functions,
// que este proyecto evita por completo por el tema de tarjetas). En su lugar,
// se usa un HEARTBEAT: mientras el usuario tiene una pestaña abierta, se
// actualiza ultimaActividad cada 30s. Cualquiera que vea el perfil calcula
// "en línea" si esa marca es de hace menos de 60s. Esto significa que cerrar
// la pestaña de golpe (sin cerrar sesión) tarda hasta ~60s en reflejarse como
// "desconectado" — limitación aceptada, no es un bug.

import { db } from "./firebase-config.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const INTERVALO_HEARTBEAT_MS = 30 * 1000;
const UMBRAL_EN_LINEA_MS = 60 * 1000; // más viejo que esto = se considera desconectado

// Catálogo de estados manuales seleccionables. "personalizado" es especial:
// además de estadoManual = "personalizado", se guarda un texto libre en
// estadoPersonalizadoTexto (ver elegirEstadoManual).
export const CATALOGO_ESTADOS = [
  { id: "jugando", emoji: "🎮", etiqueta: "Jugando", color: "#e0a941" },
  { id: "no-molestar", emoji: "⛔", etiqueta: "No molestar", color: "#e35d5d" },
  { id: "descansando", emoji: "😴", etiqueta: "Descansando", color: "#8b96b0" },
  { id: "personalizado", emoji: "✏️", etiqueta: "Personalizado", color: "#5b8def" }
];

let intervaloHeartbeat = null;

// Se llama una vez por página protegida (igual que inicializarPush) mientras
// el usuario tenga sesión — manda un heartbeat inmediato y luego uno cada
// 30s mientras la pestaña siga abierta. Se detiene solo si se llama
// detenerHeartbeat() (ej. al cerrar sesión).
export function iniciarHeartbeat(uid) {
  if (intervaloHeartbeat) return; // ya está corriendo, no duplicar
  const enviar = () => {
    updateDoc(doc(db, "usuarios", uid), { ultimaActividad: serverTimestamp() }).catch(() => {});
  };
  enviar();
  intervaloHeartbeat = setInterval(enviar, INTERVALO_HEARTBEAT_MS);
}

export function detenerHeartbeat() {
  if (intervaloHeartbeat) {
    clearInterval(intervaloHeartbeat);
    intervaloHeartbeat = null;
  }
}

// Fija (o quita) un estado manual. id = null para volver al automático
// (en línea/desconectado). Para "personalizado", pasa el texto que el
// usuario escribió; para los demás se ignora.
export async function elegirEstadoManual(uid, id, textoPersonalizado = "") {
  if (id === null) {
    await updateDoc(doc(db, "usuarios", uid), { estadoManual: null, estadoPersonalizadoTexto: null });
    return;
  }
  if (!CATALOGO_ESTADOS.find(e => e.id === id)) throw new Error("Ese estado no existe.");
  if (id === "personalizado" && !textoPersonalizado.trim()) {
    throw new Error("Escribe un texto para tu estado personalizado.");
  }
  await updateDoc(doc(db, "usuarios", uid), {
    estadoManual: id,
    estadoPersonalizadoTexto: id === "personalizado" ? textoPersonalizado.trim().slice(0, 40) : null
  });
}

// Calcula qué mostrar para un perfil dado: manual si existe, si no
// automático según ultimaActividad. Devuelve { emoji, etiqueta, color,
// esManual }. Se usa igual en perfil.js (para el usuario mismo) y en
// ver-perfil.js (para perfiles ajenos).
export function calcularEstadoVisible(perfil) {
  if (perfil.estadoManual) {
    const info = CATALOGO_ESTADOS.find(e => e.id === perfil.estadoManual);
    if (info) {
      const etiqueta = perfil.estadoManual === "personalizado" && perfil.estadoPersonalizadoTexto
        ? perfil.estadoPersonalizadoTexto
        : info.etiqueta;
      return { emoji: info.emoji, etiqueta, color: info.color, esManual: true };
    }
  }

  const ultima = perfil.ultimaActividad;
  const enLinea = ultima?.toDate && (Date.now() - ultima.toDate().getTime()) < UMBRAL_EN_LINEA_MS;

  return enLinea
    ? { emoji: "🟢", etiqueta: "En línea", color: "#4caf7d", esManual: false }
    : { emoji: "⚪", etiqueta: "Desconectado", color: "#8b96b0", esManual: false };
}
