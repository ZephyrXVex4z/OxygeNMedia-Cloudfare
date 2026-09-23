// lastfm.js
// Integración con Last.fm: a diferencia de Spotify, Last.fm NO requiere OAuth
// para leer estadísticas públicas de un usuario — solo se necesita su
// "username" de Last.fm (texto libre que el propio usuario escribe) y la
// API Key de la aplicación (pública, se expone en el cliente sin problema,
// igual que SPOTIFY_CLIENT_ID o el apiKey de Firebase).
//
// Complementa a Spotify (que ya cubre "escuchando ahora"): aquí solo se
// muestran estadísticas históricas (top artistas, álbumes, canciones, total
// de scrobbles), pensadas como insumo para una futura recomendación por IA.
//
// ⚠️ INTERRUPTOR GENERAL: LASTFM_ACTIVO controla si esta función se muestra
// en la UI. Queda en false hasta que la recomendación por IA esté lista —
// cámbialo a true en este único lugar para activar todo de golpe.
export const LASTFM_ACTIVO = true;

import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const LASTFM_API_KEY = "ab3234b4e907ceab3336dbfe7a5b4bd0";
const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

export const PRIVACIDAD_LASTFM = {
  PUBLICO: "publico",
  AMIGOS: "amigos",
  PRIVADO: "privado"
};

function urlLastfm(params) {
  const q = new URLSearchParams({ ...params, api_key: LASTFM_API_KEY, format: "json" });
  return `${LASTFM_BASE}?${q.toString()}`;
}

// ============ CONECTAR CUENTA (solo guarda el username, sin OAuth) ============

// Verifica que el username exista en Last.fm antes de guardarlo, para no dejar
// una conexión "conectada" apuntando a una cuenta que no existe.
export async function conectarLastfm(uid, username) {
  const limpio = username.trim().replace(/^@/, "");
  if (!limpio) throw new Error("Escribe tu nombre de usuario de Last.fm.");

  const resp = await fetch(urlLastfm({ method: "user.getinfo", user: limpio }));
  const data = await resp.json();
  if (data.error) throw new Error("No se encontró ese usuario en Last.fm. Revisa que esté bien escrito.");

  await updateDoc(doc(db, "usuarios", uid), {
    lastfmConectado: true,
    lastfmUsername: limpio
  });

  return limpio;
}

export async function desconectarLastfm(uid) {
  await updateDoc(doc(db, "usuarios", uid), {
    lastfmConectado: false,
    lastfmUsername: null,
    lastfmStats: null
  });
}

// ============ ESTADÍSTICAS ============

// Trae top artistas/álbumes/canciones + total de scrobbles del usuario.
// period: "7day" | "1month" | "3month" | "6month" | "12month" | "overall"
export async function obtenerEstadisticasLastfm(username, period = "overall", cantidad = 8) {
  const [topArtistasResp, topAlbumesResp, topCancionesResp, infoResp] = await Promise.all([
    fetch(urlLastfm({ method: "user.gettopartists", user: username, period, limit: cantidad })),
    fetch(urlLastfm({ method: "user.gettopalbums", user: username, period, limit: cantidad })),
    fetch(urlLastfm({ method: "user.gettoptracks", user: username, period, limit: cantidad })),
    fetch(urlLastfm({ method: "user.getinfo", user: username }))
  ]);

  const [topArtistas, topAlbumes, topCanciones, info] = await Promise.all([
    topArtistasResp.json(), topAlbumesResp.json(), topCancionesResp.json(), infoResp.json()
  ]);

  if (info.error) throw new Error("No se pudo consultar Last.fm para este usuario.");

  return {
    totalScrobbles: parseInt(info.user?.playcount || "0", 10),
    period,
    artistas: (topArtistas.topartists?.artist || []).map(a => ({
      nombre: a.name,
      reproducciones: parseInt(a.playcount || "0", 10),
      urlLastfm: a.url,
      imagenURL: a.image?.find(i => i.size === "extralarge")?.["#text"] || ""
    })),
    albumes: (topAlbumes.topalbums?.album || []).map(al => ({
      nombre: al.name,
      artista: al.artist?.name || "",
      reproducciones: parseInt(al.playcount || "0", 10),
      urlLastfm: al.url,
      imagenURL: al.image?.find(i => i.size === "extralarge")?.["#text"] || ""
    })),
    canciones: (topCanciones.toptracks?.track || []).map(t => ({
      nombre: t.name,
      artista: t.artist?.name || "",
      reproducciones: parseInt(t.playcount || "0", 10),
      urlLastfm: t.url
    }))
  };
}

// Actualiza el campo "lastfmStats" del perfil con las estadísticas frescas.
// Se llama periódicamente (patrón igual a actualizarTopEnPerfil de spotify.js),
// pero con mucha menor frecuencia — esto es historial, no cambia en minutos.
export async function actualizarStatsLastfmEnPerfil(uid) {
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    if (!snap.exists()) return;
    const perfil = snap.data();
    if (!perfil.lastfmConectado || !perfil.lastfmUsername) return;

    const stats = await obtenerEstadisticasLastfm(perfil.lastfmUsername);
    await updateDoc(doc(db, "usuarios", uid), { lastfmStats: stats });
  } catch (e) {
    // No crítico: si Last.fm falla o el usuario cambió su username ahí sin
    // avisar aquí, simplemente no se actualiza esta vez.
  }
}

// ============ PRIVACIDAD: mismo criterio que Spotify ============

export function puedeVerStatsLastfm(perfilDueño, uidObservador, esAmigo) {
  const nivel = perfilDueño.privacidadLastfm || PRIVACIDAD_LASTFM.AMIGOS;
  if (perfilDueño.uid === uidObservador) return true;
  if (nivel === PRIVACIDAD_LASTFM.PUBLICO) return true;
  if (nivel === PRIVACIDAD_LASTFM.AMIGOS) return esAmigo;
  return false;
}
