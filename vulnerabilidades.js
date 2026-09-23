// vulnerabilidades.js
// Sistema de "bug bounty" interno: cualquier usuario puede reportar un problema técnico
// o una vulnerabilidad de seguridad (no confundir con reportes.js, que es para
// contenido/usuarios problemáticos — este es para fallas del propio sistema).
//
// A diferencia de recompensas.js (Ox2 gratis por actividad social, con cupo mensual
// fijo en MXN), aquí el Ox2 se otorga MANUALMENTE por un admin tras revisar el reporte,
// caso por caso, según qué tan grave sea el problema. No hay cupo ni catálogo fijo:
// un typo en la interfaz no vale lo mismo que un hueco que permite robar saldo ajeno,
// y el admin decide el monto con ese criterio, no una tabla automática.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, addDoc, collection, getDocs, query, where,
  orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { crearNotificacion } from "./notificaciones.js";
import { registrarLog } from "./logs.js";

export const GRAVEDAD = {
  BAJA: "baja",       // ej. un texto mal alineado, un typo
  MEDIA: "media",      // ej. un botón que no funciona, un ícono roto
  ALTA: "alta",        // ej. se puede ver contenido que no debería, un error que rompe una página
  CRITICA: "critica"   // ej. se puede robar saldo, acceder a cuentas ajenas, saltarse la moderación
};

// Un usuario aprobado reporta un problema. Todo el detalle técnico es texto libre —
// el formulario en vulnerabilidad.html guía qué escribir en cada campo, pero aquí
// solo se guarda tal cual lo mandó.
export async function reportarVulnerabilidad({
  reportanteUid, reportanteNombre,
  titulo, gravedadPercibida, dondeOcurre, comoReproducir, consecuencias, codigoRelacionado = ""
}) {
  if (!titulo || !dondeOcurre || !comoReproducir) {
    throw new Error("Completa al menos el título, dónde ocurre, y cómo reproducirlo.");
  }

  const ref = await addDoc(collection(db, "vulnerabilidades"), {
    reportanteUid, reportanteNombre,
    titulo,
    gravedadPercibida: gravedadPercibida || GRAVEDAD.MEDIA, // lo que el usuario CREE que es
    dondeOcurre,       // en qué página/función pasa
    comoReproducir,    // pasos para que el admin lo repita
    consecuencias,     // qué puede pasar si alguien lo explota
    codigoRelacionado, // opcional: fragmento de código, si el usuario lo identificó
    estado: "pendiente",        // "pendiente" | "confirmado" | "no_aplica" | "resuelto"
    gravedadConfirmada: null,   // la que el admin confirma tras revisar, puede diferir de la percibida
    recompensaOx2: 0,
    notaAdmin: "",
    adminUid: null,
    adminNombre: null,
    fecha: serverTimestamp(),
    fechaResolucion: null
  });

  return ref.id;
}

export async function listarVulnerabilidadesPendientes() {
  const snap = await getDocs(
    query(collection(db, "vulnerabilidades"), where("estado", "==", "pendiente"), orderBy("fecha", "asc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listarVulnerabilidadesResueltas(cantidad = 50) {
  const snap = await getDocs(
    query(collection(db, "vulnerabilidades"), where("estado", "!=", "pendiente"), orderBy("estado"), orderBy("fecha", "desc"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, cantidad);
}

// El admin resuelve el reporte: confirma (o no) que era un problema real, decide la
// gravedad real, y opcionalmente otorga Ox2 como recompensa. Si recompensaOx2 > 0,
// se suma directo al saldo del reportante en la misma operación.
export async function resolverVulnerabilidad(vulnId, adminUid, adminNombre, {
  estado, gravedadConfirmada, recompensaOx2 = 0, notaAdmin = "", reportanteUid
}) {
  await updateDoc(doc(db, "vulnerabilidades", vulnId), {
    estado,
    gravedadConfirmada: gravedadConfirmada || null,
    recompensaOx2,
    notaAdmin,
    adminUid, adminNombre,
    fechaResolucion: serverTimestamp()
  });

  if (recompensaOx2 > 0 && reportanteUid) {
    const refUsuario = doc(db, "usuarios", reportanteUid);
    const snap = await getDoc(refUsuario);
    const saldoActual = snap.exists() ? (snap.data().saldo || 0) : 0;
    await updateDoc(refUsuario, { saldo: saldoActual + recompensaOx2 });

    await addDoc(collection(db, "transacciones"), {
      tipo: "recompensa_vulnerabilidad",
      deUid: null, deNombre: "Admin",
      paraUid: reportanteUid, paraNombre: "",
      monto: recompensaOx2,
      motivo: "Recompensa por reportar una vulnerabilidad",
      adminUid,
      fecha: serverTimestamp()
    });

    await crearNotificacion({
      paraUid: reportanteUid,
      tipo: "recompensa_vulnerabilidad",
      deUid: adminUid,
      deNombre: adminNombre,
      texto: `🐞 Tu reporte de seguridad fue confirmado. Recibiste ${recompensaOx2} Ox2 de recompensa.`,
      dataExtra: {}
    });
  }

  await registrarLog({
    tipo: "vulnerabilidad_resuelta",
    adminUid, adminNombre,
    objetivoUid: reportanteUid || null,
    objetivoNombre: "",
    detalle: `Reporte de vulnerabilidad ${estado}${recompensaOx2 > 0 ? ` — ${recompensaOx2} Ox2 otorgados` : ""}`
  });
}
