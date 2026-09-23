// spotify.js
// Integración con Spotify usando el flujo OAuth "Authorization Code with PKCE" —
// la forma recomendada por Spotify para apps que corren en el navegador (sin
// backend propio), porque NO requiere exponer el Client Secret en el frontend.
// Cada usuario conecta su PROPIA cuenta de Spotify; OxygeNMedia nunca ve ni
// guarda su contraseña, solo un token de acceso que Spotify emite tras su
// autorización explícita.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

export const SPOTIFY_CLIENT_ID = "2c4874dc12db4fb29fc460fe60bb75a9";
const REDIRECT_URI = "https://oxygenmedia.online/spotify-callback";
const SCOPES = [
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-top-read"
].join(" ");

export const PRIVACIDAD_SPOTIFY = {
  PUBLICO: "publico",
  AMIGOS: "amigos",
  PRIVADO: "privado"
};

// ============ PKCE: generación de verifier/challenge ============
// PKCE evita que alguien intercepte el "code" de autorización y lo cambie por un
// token sin tener también este "verifier" secreto, generado nuevo en cada intento
// de conexión y nunca enviado a Spotify hasta el paso final del intercambio.

function generarCodeVerifier() {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generarCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ============ CONECTAR CUENTA ============

// Inicia el flujo: guarda el code_verifier en sessionStorage (solo dura esta pestaña)
// y redirige a Spotify para que el usuario autorice el acceso.
export async function iniciarConexionSpotify() {
  const verifier = generarCodeVerifier();
  const challenge = await generarCodeChallenge(verifier);
  sessionStorage.setItem("spotify_verifier", verifier);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge
  });

  location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

// Llamado desde spotify-callback/index.html tras volver de Spotify con un "code".
// Cambia ese code por un access_token + refresh_token, y los guarda en Firestore
// en un documento SEPARADO de "usuarios" (spotifyTokens), que solo el propio dueño
// puede leer — así el token nunca se mezcla con datos que otros usuarios consultan.
export async function completarConexionSpotify(code, uid) {
  const verifier = sessionStorage.getItem("spotify_verifier");
  if (!verifier) throw new Error("No se encontró la verificación de seguridad. Intenta conectar tu cuenta de nuevo.");

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  });

  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!resp.ok) throw new Error("Spotify rechazó la conexión. Intenta de nuevo.");
  const data = await resp.json();

  await setDoc(doc(db, "spotifyTokens", uid), {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiraEn: Date.now() + data.expires_in * 1000
  });

  await updateDoc(doc(db, "usuarios", uid), { spotifyConectado: true });
  sessionStorage.removeItem("spotify_verifier");
}

export async function desconectarSpotify(uid) {
  await deleteDoc(doc(db, "spotifyTokens", uid));
  await updateDoc(doc(db, "usuarios", uid), {
    spotifyConectado: false,
    cancionActual: null,
    topArtistas: null,
    topCanciones: null
  });
}

// ============ RENOVAR TOKEN (los access_token de Spotify expiran en 1 hora) ============

async function obtenerAccessTokenValido(uid) {
  const snap = await getDoc(doc(db, "spotifyTokens", uid));
  if (!snap.exists()) throw new Error("Esta cuenta no tiene Spotify conectado.");
  const data = snap.data();

  if (Date.now() < data.expiraEn - 60000) return data.accessToken; // sigue vigente

  // Expiró (o está por expirar) — lo renovamos con el refresh_token, que dura mucho más.
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: data.refreshToken
  });
  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!resp.ok) throw new Error("No se pudo renovar la conexión con Spotify. Vuelve a conectar tu cuenta.");
  const nuevo = await resp.json();

  await updateDoc(doc(db, "spotifyTokens", uid), {
    accessToken: nuevo.access_token,
    expiraEn: Date.now() + nuevo.expires_in * 1000,
    // Spotify no siempre devuelve un refresh_token nuevo; si no lo manda, se conserva el actual.
    refreshToken: nuevo.refresh_token || data.refreshToken
  });

  return nuevo.access_token;
}

// ============ QUÉ ESTÁ ESCUCHANDO AHORA ============

// Devuelve { cancion, artista, album, imagenURL, urlSpotify } o null si no está
// escuchando nada en este momento (Spotify cerrado, en pausa, etc.)
export async function obtenerCancionActual(uid) {
  const token = await obtenerAccessTokenValido(uid);
  const resp = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (resp.status === 204 || !resp.ok) return null; // 204 = nada sonando ahora
  const data = await resp.json();
  if (!data || !data.item) return null;

  return {
    cancion: data.item.name,
    artista: data.item.artists.map(a => a.name).join(", "),
    album: data.item.album.name,
    imagenURL: data.item.album.images[0]?.url || "",
    urlSpotify: data.item.external_urls.spotify,
    previewUrl: data.item.preview_url
  };
}

// Actualiza el campo "cancionActual" del perfil con lo que Spotify reporta ahora
// mismo. Se llama periódicamente (ver muro-app.js) mientras el usuario esté activo,
// para que otros vean algo razonablemente reciente sin tener que consultar Spotify
// en tiempo real cada vez que alguien visita ese perfil.
export async function actualizarCancionActualEnPerfil(uid) {
  try {
    const cancion = await obtenerCancionActual(uid);
    await updateDoc(doc(db, "usuarios", uid), { cancionActual: cancion });
  } catch (e) {
    // Si falla (token vencido sin refresh, cuenta desconectada, etc.), no rompemos
    // el resto de la app por esto — simplemente no se actualiza esta vez.
  }
}

// ============ TOP ARTISTAS / CANCIONES ============

export async function obtenerTopArtistas(uid, cantidad = 5) {
  const token = await obtenerAccessTokenValido(uid);
  const resp = await fetch(`https://api.spotify.com/v1/me/top/artists?limit=${cantidad}&time_range=short_term`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.items || []).map(a => ({
    nombre: a.name,
    imagenURL: a.images[0]?.url || "",
    urlSpotify: a.external_urls.spotify
  }));
}

export async function obtenerTopCanciones(uid, cantidad = 5) {
  const token = await obtenerAccessTokenValido(uid);
  const resp = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=${cantidad}&time_range=short_term`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.items || []).map(t => ({
    cancion: t.name,
    artista: t.artists.map(a => a.name).join(", "),
    imagenURL: t.album.images[0]?.url || "",
    urlSpotify: t.external_urls.spotify
  }));
}

// Actualiza los campos "topArtistas"/"topCanciones" del perfil. Se llama con menos
// frecuencia que la canción actual (esto cambia poco de un día a otro).
export async function actualizarTopEnPerfil(uid) {
  try {
    const [topArtistas, topCanciones] = await Promise.all([
      obtenerTopArtistas(uid),
      obtenerTopCanciones(uid)
    ]);
    await updateDoc(doc(db, "usuarios", uid), { topArtistas, topCanciones });
  } catch (e) { /* no crítico */ }
}

// ============ BUSCAR CANCIONES (para adjuntar a una publicación) ============

export async function buscarCanciones(uid, textoBusqueda) {
  if (!textoBusqueda || textoBusqueda.trim().length < 2) return [];
  const token = await obtenerAccessTokenValido(uid);
  const params = new URLSearchParams({ q: textoBusqueda, type: "track", limit: "8" });
  const resp = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.tracks?.items || []).map(t => ({
    cancion: t.name,
    artista: t.artists.map(a => a.name).join(", "),
    imagenURL: t.album.images[0]?.url || "",
    urlSpotify: t.external_urls.spotify,
    previewUrl: t.preview_url
  }));
}

// ============ PRIVACIDAD: quién puede ver qué ============

// "campo" es "cancionActual" o "topArtistas"/"topCanciones" — se maneja un solo nivel
// de privacidad para "actividad de escucha" en general (ver perfil.html), no uno
// distinto por cada campo individual, para no complicar la UI de configuración.
export function puedeVerActividadSpotify(perfilDueño, uidObservador, esAmigo) {
  const nivel = perfilDueño.privacidadSpotify || PRIVACIDAD_SPOTIFY.AMIGOS;
  if (perfilDueño.uid === uidObservador) return true; // siempre ves tu propia música
  if (nivel === PRIVACIDAD_SPOTIFY.PUBLICO) return true;
  if (nivel === PRIVACIDAD_SPOTIFY.AMIGOS) return esAmigo;
  return false; // privado
}
