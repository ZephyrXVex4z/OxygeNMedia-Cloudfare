// ia-recomendaciones.js
// Recomendaciones de canciones con IA, basadas en las estadísticas de
// Last.fm del usuario. La configuración de Gemini (key, endpoint, llamada
// base) vive en gemini-config.js — compartida también con el asistente
// virtual de /asistente, para no duplicar la key en dos archivos.
//
// ⚠️ INTERRUPTOR: comparte el mismo LASTFM_ACTIVO que lastfm.js, porque no
// tiene sentido sin datos de Last.fm. IA_ACTIVA controla específicamente
// esta función (puedes tener Last.fm mostrando stats sin la IA todavía).
export const IA_ACTIVA = false;

import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { llamarGemini } from "./gemini-config.js";

// Cuánto dura en caché una recomendación antes de considerarse "vieja" y
// permitir recalcular automáticamente. 6 horas: las stats de Last.fm no
// cambian tan rápido como para justificar recalcular más seguido sin que
// el usuario lo pida explícitamente con el botón.
const HORAS_VALIDEZ_CACHE = 6;

// Cooldown anti-spam del lado del cliente para el botón "forzar" — no evita
// que alguien use la key desde fuera (para eso está la restricción de
// dominio), pero evita que un usuario normal agote tu cuota diaria a punta
// de clics rápidos sobre el mismo botón.
const COOLDOWN_BOTON_MS = 60 * 1000;
let ultimoClicBoton = 0;

// Pide una recomendación nueva a Gemini y la guarda en el perfil del usuario
// para no recalcularla en cada visita. "forzado" = true cuando viene de un
// clic explícito del botón (se salta la caché de horas, pero respeta el
// cooldown de 60s entre clics).
export async function pedirRecomendacionIA(uid, stats, forzado = false) {
  if (!IA_ACTIVA) throw new Error("Las recomendaciones con IA todavía no están activas.");

  if (!forzado) {
    const cache = await obtenerRecomendacionCacheada(uid);
    if (cache) return cache;
  } else {
    const ahora = Date.now();
    if (ahora - ultimoClicBoton < COOLDOWN_BOTON_MS) {
      throw new Error("Espera un momento antes de pedir otra recomendación.");
    }
    ultimoClicBoton = Date.now();
  }

  const prompt = construirPrompt(stats);
  const recomendacion = await llamarGemini([{ parts: [{ text: prompt }] }]);

  await updateDoc(doc(db, "usuarios", uid), {
    iaRecomendacion: recomendacion,
    iaRecomendacionFecha: serverTimestamp()
  });

  return recomendacion;
}

function construirPrompt(stats) {
  const artistas = (stats.artistas || []).slice(0, 8).map(a => a.nombre).join(", ") || "ninguno";
  const canciones = (stats.canciones || []).slice(0, 8).map(t => `${t.nombre} (${t.artista})`).join(", ") || "ninguna";
  const albumes = (stats.albumes || []).slice(0, 5).map(al => `${al.nombre} (${al.artista})`).join(", ") || "ninguno";

  return `Eres un asistente de recomendaciones musicales dentro de una red social. ` +
    `Basado en estas estadísticas reales de escucha de Last.fm de un usuario:\n` +
    `- Artistas más escuchados: ${artistas}\n` +
    `- Canciones más escuchadas: ${canciones}\n` +
    `- Álbumes más escuchados: ${albumes}\n\n` +
    `Recomienda exactamente 5 canciones (de artistas DISTINTOS a los ya escuchados cuando sea posible, ` +
    `para descubrir música nueva) que probablemente le gusten, con una razón breve (máx 1 línea) por cada una. ` +
    `Responde en español, en una lista simple, formato:\n"Canción — Artista: razón breve"\nSin introducción ni cierre, solo la lista.`;
}

// Devuelve la recomendación guardada si todavía es "reciente" (dentro de
// HORAS_VALIDEZ_CACHE), o null si no existe o ya venció.
async function obtenerRecomendacionCacheada(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!data.iaRecomendacion || !data.iaRecomendacionFecha) return null;

  const horasTranscurridas = (Date.now() - data.iaRecomendacionFecha.toDate().getTime()) / (1000 * 60 * 60);
  if (horasTranscurridas > HORAS_VALIDEZ_CACHE) return null;

  return data.iaRecomendacion;
}

// Se llama automáticamente después de refrescar las stats de Last.fm (ver
// actualizarStatsLastfmEnPerfil en lastfm.js) — recalcula la recomendación
// SOLO si la caché ya venció, para no gastar cuota de Gemini sin necesidad.
export async function actualizarRecomendacionSiHaceFalta(uid, stats) {
  if (!IA_ACTIVA) return;
  try {
    const cache = await obtenerRecomendacionCacheada(uid);
    if (cache) return; // sigue vigente, no hace falta recalcular
    await pedirRecomendacionIA(uid, stats, false);
  } catch (e) {
    // No crítico: si falla, el usuario puede forzar manualmente con el botón.
  }
}
