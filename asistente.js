// asistente.js
// Asistente virtual conversacional en /asistente. Conoce el funcionamiento
// general de OxygeNMedia (vía un system prompt) pero permite charla libre —
// no está limitado a responder solo sobre el sitio. Recuerda el historial
// de la conversación mientras la pestaña siga abierta (en memoria; se
// reinicia al recargar la página, no se guarda en Firestore ni localStorage
// a propósito, para no acumular conversaciones privadas sin que el usuario
// lo sepa).
//
// La PERSONALIDAD elegida sí se guarda en el perfil (usuarios/{uid}.
// asistentePersonalidad) porque es una preferencia de configuración, no
// contenido de la conversación — se recuerda entre visitas.
//
// GENERACIÓN DE IMÁGENES: se hace con un generador embebido de Perchance
// (iframe), no con una API propia — Perchance no ofrece una API formal, solo
// la web pensada para insertarse así. Como ese contenido NO pasa por ningún
// filtro que controlemos nosotros, el acceso está detrás de una advertencia
// explícita que el usuario debe aceptar una sola vez (se recuerda en su
// perfil, igual que la personalidad) antes de poder ver el generador.

import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { observarSesion, cuentaBloqueada } from "./auth.js";
import { llamarGemini } from "./gemini-config.js";

// ⚠️ INTERRUPTOR: independiente de LASTFM_ACTIVO/IA_ACTIVA — el asistente
// general no depende de Last.fm para nada. Actívalo cuando la key de Gemini
// ya esté configurada y restringida por dominio.
export const ASISTENTE_ACTIVO = true;

// ⚠️ INTERRUPTOR SEPARADO para el generador de imágenes — así se puede
// activar el asistente de texto sin exponer todavía la parte de imágenes
// (o viceversa) mientras se decide si el filtrado de Perchance es aceptable
// para el público real del sitio.
export const GENERADOR_IMAGENES_ACTIVO = true;

// URL del generador de imágenes de Perchance a embeber. Se puede cambiar por
// cualquier otro generador de la comunidad de Perchance sin tocar el resto
// del archivo — solo esta constante.
export const URL_GENERADOR_PERCHANCE = "https://perchance.org/ai-text-to-image-generator";

const CLAVE_ADVERTENCIA_AVISO = "avisoGeneradorImagenesAceptado";

// Contexto de la plataforma, compartido por TODAS las personalidades — se
// mantiene deliberadamente corto: menos tokens de entrada en cada mensaje
// significa respuestas más rápidas de Gemini, sin perder lo esencial.
const CONTEXTO_PLATAFORMA = `Contexto de OxygeNMedia (red social): Muro (posts/likes/comentarios/hashtags),
Amigos y Seguidores (sistemas separados), Chat privado/grupal, Ox2 (moneda interna: se gana publicando
o con likes, se compra con tarjetas de regalo vía WhatsApp, se usa para recursos de pago, banners/efectos
de perfil, fuentes, o verificación dorada), Recursos (contenido de la comunidad, gratis o de pago),
Perfil (foto, bio, banners, Spotify/Last.fm), Juegos HTML subidos por usuarios, y Reportes de moderación.`;

// ============ CATÁLOGO DE PERSONALIDADES ============
export const PERSONALIDADES = {
  basica: {
    id: "basica",
    nombre: "Básica",
    emoji: "💬",
    descripcion: "Normal, directa y neutral.",
    systemPrompt: `Eres el asistente de OxygeNMedia. ${CONTEXTO_PLATAFORMA}
Responde en español, de forma clara, breve y natural — como una conversación normal.
También puedes hablar de cualquier otro tema con libertad.`
  },
  profesional: {
    id: "profesional",
    nombre: "Profesional",
    emoji: "💼",
    descripcion: "Formal, precisa, va al grano.",
    systemPrompt: `Eres el asistente de OxygeNMedia, con un tono profesional y formal en todo momento.
${CONTEXTO_PLATAFORMA}
Responde en español, con precisión y sin coloquialismos, usando un lenguaje cuidado y respetuoso — como
lo haría un asesor serio. Sé conciso, ve directo al punto, evita relleno innecesario.`
  },
  oxai: {
    id: "oxai",
    nombre: "OxAI",
    emoji: "🔥",
    descripcion: "Humor roto, memes, emojis, sin filtro (pero respetuoso).",
    systemPrompt: `Eres "OxAI", el asistente de OxygeNMedia con personalidad de niño random de TikTok con el
humor completamente roto. ${CONTEXTO_PLATAFORMA}
Responde en español, MUY informal, con muchísimos emojis, jerga de internet actual, referencias a memes
y a la cultura de TikTok, exagerado y chistoso en cada respuesta — pero SIN dejar de ser útil: si preguntan
algo en serio, responde bien la info aunque la envuelvas en humor. Nunca seas ofensivo, cruel, ni faltes
el respeto a nadie de verdad — el humor es sobre la forma de hablar, no para burlarte de la persona.`
  }
};
const PERSONALIDAD_DEFAULT = "basica";

// Historial de la sesión actual: array de { role: "user"|"model", parts: [{text}] }
// — formato que Gemini espera directamente para conversaciones multi-turno.
let historial = [];
let personalidadActual = PERSONALIDAD_DEFAULT;

const MAX_TURNOS_HISTORIAL = 12; // recortado (antes 20): menos contexto = respuestas más rápidas

export function obtenerHistorial() {
  return historial;
}

export function reiniciarConversacion() {
  historial = [];
}

export function obtenerPersonalidadActual() {
  return PERSONALIDADES[personalidadActual] || PERSONALIDADES[PERSONALIDAD_DEFAULT];
}

// Carga la personalidad guardada en el perfil del usuario (o la default si
// nunca eligió una). Se llama al entrar a /asistente.
export async function cargarPersonalidadGuardada(uid) {
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    const guardada = snap.exists() ? snap.data().asistentePersonalidad : null;
    personalidadActual = (guardada && PERSONALIDADES[guardada]) ? guardada : PERSONALIDAD_DEFAULT;
  } catch {
    personalidadActual = PERSONALIDAD_DEFAULT;
  }
  return obtenerPersonalidadActual();
}

// Cambia la personalidad activa y la guarda en el perfil para que se
// recuerde en futuras visitas. No reinicia el historial de la sesión actual
// a propósito — cambiar de tono a mitad de charla es válido y Gemini se
// adapta bien al nuevo systemInstruction desde el siguiente mensaje.
export async function elegirPersonalidad(uid, personalidadId) {
  if (!PERSONALIDADES[personalidadId]) throw new Error("Esa personalidad no existe.");
  personalidadActual = personalidadId;
  await updateDoc(doc(db, "usuarios", uid), { asistentePersonalidad: personalidadId });
}

// Envía un mensaje del usuario, agrega la respuesta de Gemini al historial,
// y devuelve el texto de la respuesta.
export async function enviarMensajeAsistente(texto) {
  if (!ASISTENTE_ACTIVO) throw new Error("El asistente todavía no está activo.");
  if (!texto || !texto.trim()) throw new Error("Escribe un mensaje primero.");

  historial.push({ role: "user", parts: [{ text: texto.trim() }] });

  // Si el historial crece demasiado, recorta los turnos más viejos (de a
  // pares usuario+modelo) para no inflar el prompt sin límite ni gastar
  // tokens de más en conversaciones muy largas — esto también ayuda a la
  // velocidad de respuesta, ya que Gemini procesa menos texto de entrada.
  if (historial.length > MAX_TURNOS_HISTORIAL * 2) {
    historial = historial.slice(-MAX_TURNOS_HISTORIAL * 2);
  }

  try {
    const respuesta = await llamarGemini(historial, {
      systemInstruction: obtenerPersonalidadActual().systemPrompt,
      temperature: 0.8,
      // Recortado de 800 a 400: respuestas más cortas terminan de generarse
      // más rápido (el tiempo de espera de Gemini escala con los tokens de
      // salida). Sigue siendo de sobra para una respuesta conversacional.
      maxOutputTokens: 400
    });

    historial.push({ role: "model", parts: [{ text: respuesta }] });
    return respuesta;
  } catch (err) {
    // Si Gemini falla, sacamos el mensaje del usuario que acabamos de meter
    // para que pueda reintentar sin que quede "colgado" en el historial sin
    // su respuesta correspondiente.
    historial.pop();
    throw err;
  }
}

// ============ GENERADOR DE IMÁGENES (Perchance embebido) ============

// El usuario debe aceptar la advertencia UNA SOLA VEZ — se guarda en su
// perfil (igual patrón que la personalidad), así no tiene que volver a
// aceptarla cada vez que visita la página, pero sí queda un registro claro
// de que fue informado antes de poder generar nada.
export async function yaAceptoAdvertenciaImagenes(uid) {
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    return snap.exists() ? !!snap.data()[CLAVE_ADVERTENCIA_AVISO] : false;
  } catch {
    return false;
  }
}

export async function aceptarAdvertenciaImagenes(uid) {
  await updateDoc(doc(db, "usuarios", uid), { [CLAVE_ADVERTENCIA_AVISO]: true });
}

// Control de acceso de la página: mismo patrón que el resto del sitio
// (sesión iniciada + cuenta aprobada y no suspendida).
export function protegerPaginaAsistente(callback) {
  observarSesion((user, perfil) => {
    if (!user || cuentaBloqueada(perfil).bloqueada) {
      document.body.innerHTML = "<div style='padding:60px;text-align:center;color:#8b96b0;'>Debes iniciar sesión y estar aprobado para usar el asistente. <br><br><a href='/' style='color:#5b8def;'>Volver al sitio</a></div>";
      return;
    }
    callback(user, perfil);
  });
}
