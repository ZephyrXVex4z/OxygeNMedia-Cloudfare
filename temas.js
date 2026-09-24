// temas.js
// Personalización de TEMA DE COLOR para toda la web. La fuente vive aparte en
// fuentes.js — ambas preferencias conviven sin pisarse.
//
// A diferencia de las fuentes, los temas de color son gratis: cualquier
// usuario puede cambiar de tema sin desbloquear nada. El tema equipado se
// guarda en el perfil (usuarios/{uid}.temaActivo) para que viaje entre
// dispositivos, y también se cachea en localStorage bajo "oxygenmedia_tema"
// para que tema-inline.js pueda aplicarlo de forma síncrona antes de que
// cargue el perfil real (evita el flash de colores).
//
// NOTA DE RECONSTRUCCIÓN (18 sep 2026): este archivo se sobrescribió por
// error con un módulo distinto sin relación (temas del muro). Los 5 temas y
// sus valores exactos se recuperaron intactos desde la copia duplicada que
// ya vivía dentro de tema-inline.js (nunca se tocó). La FORMA de este
// archivo (nombres de función, exports) es una reconstrucción razonable
// calcada de fuentes.js, que sí sobrevivió intacto — si en algún lado del
// sitio ya había código llamando a funciones de este módulo con otros
// nombres, avisa para ajustarlo.
//
// IMPORTANTE: si agregas o cambias un tema aquí, actualiza también el objeto
// TEMAS_RAPIDO duplicado dentro de tema-inline.js — ese script no puede
// importar este módulo porque debe correr de forma síncrona en el <head>,
// antes de que el navegador pueda cargar módulos ES.

import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

export const CATALOGO_TEMAS = [
  {
    id: "terminal", nombre: "Terminal",
    vars: { "--bg": "#0A0E0A", "--card": "#0F1710", "--border": "#1F8C52", "--accent": "#3FFF8F", "--accent-hover": "#2FE07A", "--text": "#C9F5D8", "--text-dim": "#5C9C77", "--danger": "#FF5C5C", "--success": "#3FFF8F", "--warn": "#FFB627", "--radius": "2px", "--card-shadow": "none", "--font-weight-heading": "700", "--input-bg": "#050805" }
  },
  {
    id: "neobrutal", nombre: "Neobrutal",
    vars: { "--bg": "#FFF4E0", "--card": "#FFFFFF", "--border": "#16161A", "--accent": "#FF5C8A", "--accent-hover": "#E84577", "--text": "#16161A", "--text-dim": "#4A453D", "--danger": "#E84545", "--success": "#6FCF97", "--warn": "#FFD23F", "--radius": "10px", "--card-shadow": "5px 5px 0 var(--border)", "--font-weight-heading": "700", "--input-bg": "#FFF4E0" }
  },
  {
    id: "editorial", nombre: "Editorial",
    vars: { "--bg": "#EFE8DC", "--card": "#F8F4EB", "--border": "#D8CFBE", "--accent": "#A65B3F", "--accent-hover": "#8C4A32", "--text": "#2B2620", "--text-dim": "#6B6255", "--danger": "#B0473A", "--success": "#6B7A5E", "--warn": "#B8863B", "--radius": "2px", "--card-shadow": "none", "--font-weight-heading": "400", "--input-bg": "#EFE8DC" }
  },
  {
    id: "aurora", nombre: "Aurora",
    vars: { "--bg": "#0D0B1F", "--card": "rgba(255,255,255,0.06)", "--border": "rgba(255,255,255,0.14)", "--accent": "#B08CFF", "--accent-hover": "#9A6FFF", "--text": "#F0EEFF", "--text-dim": "#9C93C4", "--danger": "#FF7A9C", "--success": "#7CE8C4", "--warn": "#FFC98C", "--radius": "16px", "--card-shadow": "0 8px 32px rgba(120,80,255,0.15)", "--font-weight-heading": "700", "--input-bg": "rgba(255,255,255,0.05)" }
  },
  {
    id: "minimal", nombre: "Minimal",
    vars: { "--bg": "#FFFFFF", "--card": "#FFFFFF", "--border": "#E4E4E4", "--accent": "#111111", "--accent-hover": "#333333", "--text": "#111111", "--text-dim": "#8A8A8A", "--danger": "#D64545", "--success": "#2E9E5B", "--warn": "#B8862E", "--radius": "6px", "--card-shadow": "none", "--font-weight-heading": "600", "--input-bg": "#F7F7F7" }
  }
];

const TEMA_DEFAULT = "terminal";
const CLAVE_CACHE_TEMA = "oxygenmedia_tema";

export function obtenerTema(id) {
  return CATALOGO_TEMAS.find(t => t.id === id) || CATALOGO_TEMAS[0];
}

// Aplica el tema a :root (todas las variables de color de golpe) y refresca
// la caché local para el anti-flash de la próxima carga.
export function aplicarTema(temaId) {
  const tema = obtenerTema(temaId);
  const root = document.documentElement;
  for (const k in tema.vars) root.style.setProperty(k, tema.vars[k]);
  try { localStorage.setItem(CLAVE_CACHE_TEMA, tema.id); } catch { /* localStorage no disponible */ }
}

// Último tema conocido (cache local, solo para evitar el flash antes de que
// cargue el perfil real desde Firestore — ver tema-inline.js).
export function obtenerTemaCache() {
  try { return localStorage.getItem(CLAVE_CACHE_TEMA) || TEMA_DEFAULT; } catch { return TEMA_DEFAULT; }
}

export function listarTemas() {
  return CATALOGO_TEMAS;
}

// Equipa un tema como el activo del usuario: lo guarda en su perfil (para que
// viaje entre dispositivos) y lo aplica de inmediato.
export async function equiparTema(uid, temaId) {
  await updateDoc(doc(db, "usuarios", uid), { temaActivo: temaId });
  aplicarTema(temaId);
}

// Tema activo real del perfil (si el usuario ya inició sesión); si no hay
// perfil o no tiene nada guardado, cae al tema por defecto.
export async function obtenerTemaActivo(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? (snap.data().temaActivo || TEMA_DEFAULT) : TEMA_DEFAULT;
}
