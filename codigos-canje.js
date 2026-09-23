// codigos-canje.js
// Un recurso puede configurarse (solo el admin, al crearlo/editarlo) para que, al
// comprarse con Ox2, genere automáticamente un código de canje — pensado para
// recursos que representan algo externo al sitio (un cupón, acceso a un Discord
// privado, un código de descuento, lo que el admin quiera). El admin escribe QUÉ
// representa ese código al configurar el recurso ("¿Qué código otorga?"); el
// sistema solo se encarga de generarlo al azar y mostrárselo a quien lo compró,
// dejando registro de quién lo obtuvo y cuándo — no interpreta ni valida el código
// en ningún otro sistema externo, es responsabilidad del admin qué hacer con él.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// Genera un código legible tipo "OXY-7F3K-9QRT" (fácil de escribir/dictar a mano,
// evita caracteres ambiguos como 0/O, 1/I/L).
function generarCodigoAleatorio() {
  const alfabeto = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const grupo = () => Array.from({ length: 4 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join("");
  return `OXY-${grupo()}-${grupo()}`;
}

// Se llama automáticamente desde wallet.js justo después de que una compra con Ox2
// se completó con éxito — solo si el recurso tiene "otorgaCodigoCanje: true". El
// texto que representa el código ("descripcionCodigo", ej. "Código de Discord VIP")
// lo definió el admin al configurar el recurso, no se pide en este momento.
export async function generarCodigoTrasCompra(recursoId, tituloRecurso, descripcionCodigo, compradorUid, compradorNombre) {
  let codigo;
  let intentos = 0;
  do {
    codigo = generarCodigoAleatorio();
    const snap = await getDoc(doc(db, "codigosCanje", codigo));
    if (!snap.exists()) break;
    intentos++;
  } while (intentos < 5);

  await setDoc(doc(db, "codigosCanje", codigo), {
    recursoId,
    tituloRecurso,
    descripcionCodigo: descripcionCodigo || "",
    compradorUid,
    compradorNombre,
    fecha: serverTimestamp()
  });

  return codigo;
}

// ============ PANEL ADMIN: ver historial de códigos entregados ============

export async function listarTodosLosCodigos() {
  const snap = await getDocs(query(collection(db, "codigosCanje"), orderBy("fecha", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
