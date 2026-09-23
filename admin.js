// admin.js
// Lógica del panel de administración: CRUD de recursos, aprobación de usuarios

import { db } from "./firebase-config.js";
import { observarSesion, cerrarSesion } from "./auth.js";
import { registrarLog, obtenerLogsRecientes } from "./logs.js";
import { adminAjustarSaldo, crearTarjetaRegalo, listarTarjetasRegalo } from "./wallet.js";
import { publicarActualizacion, editarActualizacion, borrarActualizacion, listarActualizaciones } from "./actualizaciones.js";
import { activarMantenimiento, desactivarMantenimiento, obtenerEstadoMantenimiento } from "./mantenimiento.js";
import { listarReportesPendientes, listarReportesResueltos, resolverReporte, descartarReporte } from "./reportes.js";
import { adminOtorgarVerificacionDorada, adminOtorgarVerificacionAzul, insigniaVerificado } from "./verificados.js";
import { borrarPublicacion, borrarComentario } from "./muro.js";
import { iniciarAyudaImagen } from "./ayuda-imagen.js";
import { listarCanjesPendientes, marcarCanjeEntregado, obtenerEstadoCupoMensual, PRESUPUESTO_MENSUAL_MXN } from "./recompensas.js";
import { listarVulnerabilidadesPendientes, listarVulnerabilidadesResueltas, resolverVulnerabilidad, GRAVEDAD } from "./vulnerabilidades.js";
import { listarTodosLosCodigos } from "./codigos-canje.js";
import { crearLinkAfiliado, editarLinkAfiliado, alternarActivoLinkAfiliado, borrarLinkAfiliado, listarLinksAfiliado } from "./afiliados.js";
import { CATALOGO_BANNERS, CATALOGO_EFECTOS } from "./personalizacion.js";
import { CATALOGO_FUENTES } from "./fuentes.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, setDoc,
  query, where, orderBy, serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const deniedView = document.getElementById("deniedView");
const adminPanel = document.getElementById("adminPanel");
let adminActual = null;

document.getElementById("btnLogout").addEventListener("click", cerrarSesion);

// --- Control de acceso: solo admin puede ver este panel ---
observarSesion((user, perfil) => {
  if (!user || !perfil || perfil.rol !== "admin") {
    deniedView.classList.remove("hidden");
    adminPanel.classList.add("hidden");
    return;
  }
  adminActual = { uid: user.uid, ...perfil };
  deniedView.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  cargarRecursos();
  cargarPendientes();
  cargarTodos();
  cargarRolesPendientes();
  cargarJuegosPendientesAdmin();
  cargarLogs();
  cargarTarjetas();
  cargarNovedadesAdmin();
  cargarEstadoMantenimiento();
  cargarReportes();
  cargarVerificados();
  iniciarAyudaImagen();
  cargarRecompensasAdmin();
  cargarVulnerabilidadesAdmin();
  cargarHistorialCodigosCanje();
  cargarLinksAfiliadoAdmin();
});

// --- Tabs ---
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tabRecursos").classList.add("hidden");
    document.getElementById("tabUsuarios").classList.add("hidden");
    document.getElementById("tabTodos").classList.add("hidden");
    document.getElementById("tabRoles").classList.add("hidden");
    document.getElementById("tabJuegos").classList.add("hidden");
    document.getElementById("tabRegistro").classList.add("hidden");
    document.getElementById("tabTarjetas").classList.add("hidden");
    document.getElementById("tabNovedades").classList.add("hidden");
    document.getElementById("tabReportes").classList.add("hidden");
    document.getElementById("tabVerificaciones").classList.add("hidden");
    document.getElementById("tabRecompensas").classList.add("hidden");
    document.getElementById("tabVulnerabilidades").classList.add("hidden");
    document.getElementById("tabCodigosCanje").classList.add("hidden");
    document.getElementById("tabMantenimiento").classList.add("hidden");
    document.getElementById("tabAfiliados").classList.add("hidden");
    document.getElementById("tab" + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.remove("hidden");

    // Antes, estas secciones solo cargaban sus datos UNA VEZ al iniciar sesión —
    // si algo nuevo se generaba mientras el admin ya tenía la página abierta (ej.
    // un código de canje entregado tras una compra reciente), la pestaña seguía
    // mostrando los datos viejos hasta recargar la página entera. Ahora se
    // refrescan cada vez que se abre la pestaña, para que siempre estén al día.
    if (tab.dataset.tab === "codigos-canje") cargarHistorialCodigosCanje();
    if (tab.dataset.tab === "recompensas") cargarRecompensasAdmin();
    if (tab.dataset.tab === "vulnerabilidades") cargarVulnerabilidadesAdmin();
    if (tab.dataset.tab === "reportes") cargarReportes();
    if (tab.dataset.tab === "afiliados") cargarLinksAfiliadoAdmin();
  });
});

// ============ RECURSOS ============

const rTitulo = document.getElementById("rTitulo");
const rDescripcion = document.getElementById("rDescripcion");
const rContenido = document.getElementById("rContenido");
const rCategoria = document.getElementById("rCategoria");
const rPrecio = document.getElementById("rPrecio");
const rOtorgaCodigoCanje = document.getElementById("rOtorgaCodigoCanje");
const campoDescripcionCodigoCanje = document.getElementById("campoDescripcionCodigoCanje");
const rDescripcionCodigoCanje = document.getElementById("rDescripcionCodigoCanje");
const rImagenURL = document.getElementById("rImagenURL");
const rImagenPreview = document.getElementById("rImagenPreview");
const rImagenContenidoURL = document.getElementById("rImagenContenidoURL");
const rImagenContenidoPreview = document.getElementById("rImagenContenidoPreview");
const rGratis = document.getElementById("rGratis");
const rPublico = document.getElementById("rPublico");
const rVisible = document.getElementById("rVisible");
const recursoId = document.getElementById("recursoId");
const formTitulo = document.getElementById("formTitulo");
const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
const msgRecurso = document.getElementById("msgRecurso");

function mostrarMsg(el, texto, tipo) {
  el.textContent = texto;
  el.className = "msg " + tipo;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3000);
}

const rImagenURL_input = rImagenURL;
rImagenURL_input.addEventListener("input", () => {
  const url = rImagenURL_input.value.trim();
  if (url) {
    rImagenPreview.src = url;
    rImagenPreview.classList.remove("hidden");
  } else {
    rImagenPreview.classList.add("hidden");
  }
});

rImagenContenidoURL.addEventListener("input", () => {
  const url = rImagenContenidoURL.value.trim();
  if (url) {
    rImagenContenidoPreview.src = url;
    rImagenContenidoPreview.classList.remove("hidden");
  } else {
    rImagenContenidoPreview.classList.add("hidden");
  }
});

rOtorgaCodigoCanje.addEventListener("change", () => {
  campoDescripcionCodigoCanje.classList.toggle("hidden", !rOtorgaCodigoCanje.checked);
});

function limpiarFormRecurso() {
  recursoId.value = "";
  rTitulo.value = "";
  rDescripcion.value = "";
  rContenido.value = "";
  rCategoria.value = "";
  rPrecio.value = "";
  rOtorgaCodigoCanje.checked = false;
  rDescripcionCodigoCanje.value = "";
  campoDescripcionCodigoCanje.classList.add("hidden");
  rImagenURL.value = "";
  rImagenPreview.classList.add("hidden");
  rImagenContenidoURL.value = "";
  rImagenContenidoPreview.classList.add("hidden");
  rGratis.checked = false;
  rPublico.checked = false;
  rVisible.checked = true;
  formTitulo.textContent = "Nuevo recurso";
  btnCancelarEdicion.classList.add("hidden");
}

btnCancelarEdicion.addEventListener("click", limpiarFormRecurso);

document.getElementById("btnGuardarRecurso").addEventListener("click", async () => {
  if (!rTitulo.value.trim()) {
    mostrarMsg(msgRecurso, "El título es obligatorio.", "err");
    return;
  }

  const dataPublica = {
    titulo: rTitulo.value.trim(),
    descripcion: rDescripcion.value.trim(),
    categoria: rCategoria.value.trim() || "General",
    precio: Number(rPrecio.value) || 0,
    otorgaCodigoCanje: !rGratis.checked && rOtorgaCodigoCanje.checked,
    descripcionCodigoCanje: rDescripcionCodigoCanje.value.trim(),
    imagenURL: rImagenURL.value.trim(),
    esGratis: rGratis.checked,
    esPublico: rPublico.checked,
    visible: rVisible.checked
  };

  const dataProtegida = {
    contenido: rContenido.value.trim(),
    imagenContenidoURL: rImagenContenidoURL.value.trim()
  };

  try {
    let idUsado = recursoId.value;
    if (idUsado) {
      await updateDoc(doc(db, "recursos", idUsado), dataPublica);
      mostrarMsg(msgRecurso, "Recurso actualizado.", "ok");
    } else {
      dataPublica.fechaSubida = serverTimestamp();
      dataPublica.compradoPor = [];
      dataPublica.subidoPor = adminActual.uid;
      dataPublica.subidoPorNombre = adminActual.nombre;
      const ref = await addDoc(collection(db, "recursos"), dataPublica);
      idUsado = ref.id;
      mostrarMsg(msgRecurso, "Recurso creado.", "ok");
    }
    // El contenido protegido siempre vive en el mismo documento fijo "data" dentro de la subcolección
    await setDoc(doc(db, "recursos", idUsado, "contenidoProtegido", "data"), dataProtegida);

    limpiarFormRecurso();
    cargarRecursos();
  } catch (err) {
    mostrarMsg(msgRecurso, "Error: " + err.message, "err");
  }
});

async function cargarRecursos() {
  const snap = await getDocs(query(collection(db, "recursos"), orderBy("fechaSubida", "desc")));
  const tbody = document.getElementById("tablaRecursos");
  const empty = document.getElementById("emptyRecursos");
  tbody.innerHTML = "";

  if (snap.empty) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  snap.forEach(docSnap => {
    const r = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.titulo}</td>
      <td>${r.categoria || ""}</td>
      <td><span class="badge ${r.esGratis ? "gratis" : "pago"}">${r.esGratis ? "Gratis" : r.precio + " Ox2"}</span></td>
      <td><span class="badge ${r.esPublico ? "publico" : "privado"}">${r.esPublico ? "Público" : "Privado"}</span> ${!r.visible ? "<span class='badge privado'>Oculto</span>" : ""}</td>
      <td class="row-actions">
        <button class="secondary" data-edit="${docSnap.id}">Editar</button>
        <button class="danger" data-del="${docSnap.id}"><img src="/borrar-32.png" class="icon-inline-sm-admin" alt=""> Borrar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const snap2 = await getDocs(query(collection(db, "recursos"), where("__name__", "==", btn.dataset.edit)));
      for (const d of snap2.docs) {
        const r = d.data();
        recursoId.value = d.id;
        rTitulo.value = r.titulo || "";
        rDescripcion.value = r.descripcion || "";
        rCategoria.value = r.categoria || "";
        rPrecio.value = r.precio || "";
        rOtorgaCodigoCanje.checked = r.otorgaCodigoCanje || false;
        rDescripcionCodigoCanje.value = r.descripcionCodigoCanje || "";
        campoDescripcionCodigoCanje.classList.toggle("hidden", !rOtorgaCodigoCanje.checked);
        rImagenURL.value = r.imagenURL || "";
        if (r.imagenURL) {
          rImagenPreview.src = r.imagenURL;
          rImagenPreview.classList.remove("hidden");
        } else {
          rImagenPreview.classList.add("hidden");
        }

        // El contenido protegido vive en una subcolección aparte
        const protegidoSnap = await getDoc(doc(db, "recursos", d.id, "contenidoProtegido", "data"));
        const protegido = protegidoSnap.exists() ? protegidoSnap.data() : {};
        rContenido.value = protegido.contenido || "";
        rImagenContenidoURL.value = protegido.imagenContenidoURL || "";
        if (protegido.imagenContenidoURL) {
          rImagenContenidoPreview.src = protegido.imagenContenidoURL;
          rImagenContenidoPreview.classList.remove("hidden");
        } else {
          rImagenContenidoPreview.classList.add("hidden");
        }

        rGratis.checked = !!r.esGratis;
        rPublico.checked = !!r.esPublico;
        rVisible.checked = r.visible !== false;
        formTitulo.textContent = "Editando: " + r.titulo;
        btnCancelarEdicion.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });


  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Borrar este recurso permanentemente?")) return;
      await deleteDoc(doc(db, "recursos", btn.dataset.del));
      cargarRecursos();
    });
  });
}

// ============ USUARIOS PENDIENTES ============

async function cargarPendientes() {
  const snap = await getDocs(query(collection(db, "usuarios"), where("aprobado", "==", false)));
  const tbody = document.getElementById("tablaPendientes");
  const empty = document.getElementById("emptyPendientes");
  tbody.innerHTML = "";

  if (snap.empty) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  snap.forEach(docSnap => {
    const u = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.nombre}</td>
      <td>${u.email}</td>
      <td class="row-actions">
        <button class="success" data-approve="${docSnap.id}"><img src="/aprobar-32.png" class="icon-inline-sm-admin" alt=""> Aprobar</button>
        <button class="danger" data-reject="${docSnap.id}"><img src="/rechazar-32.png" class="icon-inline-sm-admin" alt=""> Rechazar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-approve]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "usuarios", btn.dataset.approve), { aprobado: true });
      cargarPendientes();
      cargarTodos();
    });
  });

  tbody.querySelectorAll("[data-reject]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Rechazar y borrar esta solicitud?")) return;
      await deleteDoc(doc(db, "usuarios", btn.dataset.reject));
      cargarPendientes();
      cargarTodos();
    });
  });
}

// ============ TODOS LOS USUARIOS ============

async function cargarTodos() {
  const snap = await getDocs(collection(db, "usuarios"));
  const tbody = document.getElementById("tablaTodos");
  tbody.innerHTML = "";

  snap.forEach(docSnap => {
    const u = docSnap.data();
    const estaSuspendido = u.suspendido === true;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.nombre}</td>
      <td>${u.email}</td>
      <td>${u.rol}</td>
      <td>
        <span class="badge ${u.aprobado ? "gratis" : "pago"}">${u.aprobado ? "Aprobado" : "Pendiente"}</span>
        ${estaSuspendido ? `<span class="badge pago" style="background:rgba(227,93,93,0.15); color:var(--danger);">Suspendido</span>` : ""}
      </td>
      <td style="font-weight:600; color:var(--success);">$${u.saldo || 0}</td>
      <td class="row-actions">
        <button class="secondary" data-pagos="${docSnap.id}">Pagos</button>
        <button class="secondary" data-saldo="${docSnap.id}" data-nombre-saldo="${u.nombre}" data-saldo-actual="${u.saldo || 0}">💰 Saldo</button>
        ${u.rol !== "admin"
          ? `<button class="secondary" data-makeadmin="${docSnap.id}">Hacer admin</button>`
          : ""}
        ${estaSuspendido
          ? `<button class="success" data-reactivar="${docSnap.id}" data-nombre="${u.nombre}"><img src="/aprobar-32.png" class="icon-inline-sm-admin" alt=""> Reactivar</button>`
          : `<button class="danger" data-suspender="${docSnap.id}" data-nombre="${u.nombre}"><img src="/suspender-32.png" class="icon-inline-sm-admin" alt=""> Suspender</button>`}
        <button class="danger" data-deluser="${docSnap.id}"><img src="/borrar-32.png" class="icon-inline-sm-admin" alt=""> Borrar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-saldo]").forEach(btn => {
    btn.addEventListener("click", () => abrirModalSaldo(btn.dataset.saldo, btn.dataset.nombreSaldo, Number(btn.dataset.saldoActual)));
  });
  tbody.querySelectorAll("[data-pagos]").forEach(btn => {
    btn.addEventListener("click", () => abrirModalPagos(btn.dataset.pagos, btn.closest("tr")));
  });

  tbody.querySelectorAll("[data-makeadmin]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Convertir a este usuario en administrador?")) return;
      await updateDoc(doc(db, "usuarios", btn.dataset.makeadmin), { rol: "admin" });
      cargarTodos();
    });
  });

  tbody.querySelectorAll("[data-suspender]").forEach(btn => {
    btn.addEventListener("click", () => { reporteEnSuspensionActual = null; abrirModalSuspender(btn.dataset.suspender, btn.dataset.nombre); });
  });

  tbody.querySelectorAll("[data-reactivar]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Reactivar la cuenta de " + btn.dataset.nombre + "?")) return;
      await updateDoc(doc(db, "usuarios", btn.dataset.reactivar), {
        suspendido: false,
        suspensionMotivo: "",
        suspensionHasta: null
      });
      await registrarLog({
        tipo: "levantar_suspension",
        adminUid: adminActual.uid,
        adminNombre: adminActual.nombre,
        objetivoUid: btn.dataset.reactivar,
        objetivoNombre: btn.dataset.nombre,
        detalle: "Cuenta reactivada"
      });
      cargarTodos();
    });
  });

  tbody.querySelectorAll("[data-deluser]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Borrar este usuario? (Esto no borra su cuenta de acceso, solo su perfil)")) return;
      await deleteDoc(doc(db, "usuarios", btn.dataset.deluser));
      cargarTodos();
    });
  });
}

// ============ SUSPENSIÓN DE CUENTAS ============

const modalSuspender = document.getElementById("modalSuspender");
const suspenderUsuarioNombre = document.getElementById("suspenderUsuarioNombre");
const suspenderMotivo = document.getElementById("suspenderMotivo");
const suspenderDuracion = document.getElementById("suspenderDuracion");
let usuarioASuspenderId = null;
let usuarioASuspenderNombre = null;
// Si la suspensión se abrió desde la pestaña de Reportes, guarda qué reporte
// resolver también al confirmar (se limpia siempre al abrir el modal de otro lado).
let reporteEnSuspensionActual = null;

function abrirModalSuspender(uid, nombre) {
  usuarioASuspenderId = uid;
  usuarioASuspenderNombre = nombre;
  suspenderUsuarioNombre.textContent = "Suspender a " + nombre;
  suspenderMotivo.value = "";
  suspenderDuracion.value = "7";
  modalSuspender.classList.remove("hidden");
}

document.getElementById("btnCancelarSuspender").addEventListener("click", () => {
  modalSuspender.classList.add("hidden");
  reporteEnSuspensionActual = null;
});

document.getElementById("btnConfirmarSuspender").addEventListener("click", async () => {
  if (!usuarioASuspenderId) return;
  const motivo = suspenderMotivo.value.trim();
  const duracion = suspenderDuracion.value;

  let hasta = null;
  if (duracion !== "permanente") {
    const dias = Number(duracion);
    hasta = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  }

  try {
    await updateDoc(doc(db, "usuarios", usuarioASuspenderId), {
      suspendido: true,
      suspensionMotivo: motivo,
      suspensionHasta: hasta
    });

    await registrarLog({
      tipo: "suspension",
      adminUid: adminActual.uid,
      adminNombre: adminActual.nombre,
      objetivoUid: usuarioASuspenderId,
      objetivoNombre: usuarioASuspenderNombre,
      detalle: (duracion === "permanente" ? "Suspensión permanente" : `Suspensión por ${duracion} días`) +
               (motivo ? ` — Motivo: ${motivo}` : "")
    });

    // Si esta suspensión vino de resolver un reporte, márcalo como resuelto también
    if (reporteEnSuspensionActual) {
      await resolverReporte(
        reporteEnSuspensionActual, adminActual.uid, adminActual.nombre,
        `Usuario suspendido${motivo ? " — Motivo: " + motivo : ""}.`
      );
      reporteEnSuspensionActual = null;
      cargarReportes();
    }

    modalSuspender.classList.add("hidden");
    cargarTodos();
  } catch (err) {
    alert("Error al suspender: " + err.message);
  }
});

// ============ PAGOS (recursosComprados) ============

const modalPagos = document.getElementById("modalPagos");
const listaPagos = document.getElementById("listaPagos");
const pagosUsuarioNombre = document.getElementById("pagosUsuarioNombre");
const btnGuardarPagos = document.getElementById("btnGuardarPagos");
const btnCerrarPagos = document.getElementById("btnCerrarPagos");

let usuarioPagosActualId = null;
let usuarioPagosComprasAnteriores = [];

async function abrirModalPagos(userId, filaTr) {
  usuarioPagosActualId = userId;

  // Datos del usuario: nombre y sus compras actuales
  const usuarioSnap = await getDocs(query(collection(db, "usuarios"), where("__name__", "==", userId)));
  let usuarioData = null;
  usuarioSnap.forEach(d => usuarioData = d.data());
  if (!usuarioData) return;

  pagosUsuarioNombre.textContent = "Otorgar acceso manual — " + usuarioData.nombre;
  const comprados = usuarioData.recursosComprados || [];
  usuarioPagosComprasAnteriores = comprados;

  // Solo recursos de paga (esGratis === false)
  const recursosSnap = await getDocs(query(collection(db, "recursos"), where("esGratis", "==", false)));

  if (recursosSnap.empty) {
    listaPagos.innerHTML = "<p style='color:var(--text-dim); font-size:13px;'>No hay recursos de paga creados todavía.</p>";
  } else {
    listaPagos.innerHTML = "";
    recursosSnap.forEach(docSnap => {
      const r = docSnap.data();
      const marcado = comprados.includes(docSnap.id);
      const row = document.createElement("div");
      row.className = "checkbox-row";
      row.innerHTML = `
        <input type="checkbox" id="pago_${docSnap.id}" value="${docSnap.id}" ${marcado ? "checked" : ""}>
        <label style="margin:0" for="pago_${docSnap.id}">${r.titulo} — ${r.precio} Ox2</label>
      `;
      listaPagos.appendChild(row);
    });
  }

  modalPagos.classList.remove("hidden");
}

btnCerrarPagos.addEventListener("click", () => {
  modalPagos.classList.add("hidden");
  usuarioPagosActualId = null;
});

btnGuardarPagos.addEventListener("click", async () => {
  if (!usuarioPagosActualId) return;
  const seleccionados = [...listaPagos.querySelectorAll("input[type=checkbox]:checked")].map(el => el.value);
  const anteriores = usuarioPagosComprasAnteriores || [];

  const agregados = seleccionados.filter(id => !anteriores.includes(id));
  const quitados = anteriores.filter(id => !seleccionados.includes(id));

  try {
    // 1. Actualiza el array del usuario (para que el admin vea fácil qué compró)
    await updateDoc(doc(db, "usuarios", usuarioPagosActualId), { recursosComprados: seleccionados });

    // 2. Actualiza compradoPor en cada recurso afectado (esto es lo que valida la regla de seguridad)
    for (const recursoId of agregados) {
      await updateDoc(doc(db, "recursos", recursoId), { compradoPor: arrayUnion(usuarioPagosActualId) });
    }
    for (const recursoId of quitados) {
      await updateDoc(doc(db, "recursos", recursoId), { compradoPor: arrayRemove(usuarioPagosActualId) });
    }

    modalPagos.classList.add("hidden");
    usuarioPagosActualId = null;
  } catch (err) {
    alert("Error al guardar: " + err.message);
  }
});

// ============ ROLES PENDIENTES ============

async function cargarRolesPendientes() {
  const snap = await getDocs(query(collection(db, "rolesDisponibles"), where("aprobado", "==", false)));
  const tbody = document.getElementById("tablaRolesPendientes");
  const empty = document.getElementById("emptyRoles");
  tbody.innerHTML = "";

  if (snap.empty) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  snap.forEach(docSnap => {
    const r = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.nombre}</td>
      <td class="row-actions">
        <button class="success" data-approve-rol="${docSnap.id}"><img src="/aprobar-32.png" class="icon-inline-sm-admin" alt=""> Aprobar</button>
        <button class="danger" data-reject-rol="${docSnap.id}"><img src="/rechazar-32.png" class="icon-inline-sm-admin" alt=""> Rechazar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-approve-rol]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "rolesDisponibles", btn.dataset.approveRol), { aprobado: true });
      cargarRolesPendientes();
    });
  });

  tbody.querySelectorAll("[data-reject-rol]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Rechazar este rol propuesto?")) return;
      await deleteDoc(doc(db, "rolesDisponibles", btn.dataset.rejectRol));
      cargarRolesPendientes();
    });
  });
}

// ============ JUEGOS PENDIENTES ============

async function cargarJuegosPendientesAdmin() {
  const snap = await getDocs(query(collection(db, "juegos"), where("aprobado", "==", false)));
  const tbody = document.getElementById("tablaJuegosPendientes");
  const empty = document.getElementById("emptyJuegosAdmin");
  tbody.innerHTML = "";

  if (snap.empty) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  snap.forEach(docSnap => {
    const j = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${j.nombre}</td>
      <td>${j.subidoPorNombre}</td>
      <td class="row-actions">
        <button class="secondary" data-probar-juego="${docSnap.id}">Probar</button>
        <button class="success" data-approve-juego="${docSnap.id}"><img src="/aprobar-32.png" class="icon-inline-sm-admin" alt=""> Aprobar</button>
        <button class="danger" data-reject-juego="${docSnap.id}"><img src="/rechazar-32.png" class="icon-inline-sm-admin" alt=""> Rechazar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-probar-juego]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const snap2 = await getDocs(query(collection(db, "juegos"), where("__name__", "==", btn.dataset.probarJuego)));
      snap2.forEach(d => {
        const j = d.data();
        const w = window.open("", "_blank");
        w.document.write(j.html);
      });
    });
  });

  tbody.querySelectorAll("[data-approve-juego]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "juegos", btn.dataset.approveJuego), { aprobado: true });
      cargarJuegosPendientesAdmin();
    });
  });

  tbody.querySelectorAll("[data-reject-juego]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Rechazar y borrar este juego?")) return;
      await deleteDoc(doc(db, "juegos", btn.dataset.rejectJuego));
      cargarJuegosPendientesAdmin();
    });
  });
}

// ============ REGISTRO DE MODERACIÓN (LOGS) ============

const ETIQUETAS_TIPO_LOG = {
  suspension: "🚫 Suspensión",
  levantar_suspension: "✅ Reactivación",
  aprobacion_usuario: "👤 Usuario aprobado",
  borrado_mensaje: "🗑️ Mensaje borrado",
  borrado_sugerencia: "🗑️ Sugerencia borrada",
  borrado_recurso: "🗑️ Recurso borrado",
  admin_dar: "💰 Saldo otorgado",
  admin_quitar: "💸 Saldo removido",
  tarjeta_creada: "🎁 Tarjeta de regalo creada",
  mantenimiento_activado: "🛠️ Mantenimiento activado",
  mantenimiento_desactivado: "✅ Mantenimiento desactivado"
};

async function cargarLogs() {
  const logs = await obtenerLogsRecientes(100);
  const tbody = document.getElementById("tablaLogs");
  const empty = document.getElementById("emptyLogs");
  tbody.innerHTML = "";

  if (logs.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  logs.forEach(log => {
    const fecha = log.fecha ? log.fecha.toDate().toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fecha}</td>
      <td>${log.adminNombre}</td>
      <td>${ETIQUETAS_TIPO_LOG[log.tipo] || log.tipo}${log.objetivoNombre ? " — " + log.objetivoNombre : ""}</td>
      <td style="font-size:12px; color:var(--text-dim);">${log.detalle || ""}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ============ GESTIÓN DE SALDO (ADMIN) ============

const modalSaldo = document.getElementById("modalSaldo");
const saldoUsuarioNombre = document.getElementById("saldoUsuarioNombre");
const saldoUsuarioActual = document.getElementById("saldoUsuarioActual");
const saldoMonto = document.getElementById("saldoMonto");
const saldoMotivo = document.getElementById("saldoMotivo");
const msgSaldo = document.getElementById("msgSaldo");

let usuarioSaldoId = null;
let usuarioSaldoNombre = null;

function abrirModalSaldo(uid, nombre, saldoActual) {
  usuarioSaldoId = uid;
  usuarioSaldoNombre = nombre;
  saldoUsuarioNombre.textContent = "Gestionar saldo — " + nombre;
  saldoUsuarioActual.textContent = "Saldo actual: " + saldoActual + " Ox2";
  saldoMonto.value = "";
  saldoMotivo.value = "";
  msgSaldo.style.display = "none";
  modalSaldo.classList.remove("hidden");
}

document.getElementById("btnCerrarSaldo").addEventListener("click", () => {
  modalSaldo.classList.add("hidden");
});

async function procesarAjusteSaldo(signo) {
  const monto = Number(saldoMonto.value);
  if (!monto || monto <= 0) {
    msgSaldo.textContent = "Escribe un monto válido.";
    msgSaldo.className = "msg error";
    msgSaldo.style.display = "block";
    return;
  }

  try {
    await adminAjustarSaldo(
      adminActual.uid, adminActual.nombre,
      usuarioSaldoId, usuarioSaldoNombre,
      monto * signo, saldoMotivo.value.trim()
    );

    await registrarLog({
      tipo: signo > 0 ? "admin_dar" : "admin_quitar",
      adminUid: adminActual.uid,
      adminNombre: adminActual.nombre,
      objetivoUid: usuarioSaldoId,
      objetivoNombre: usuarioSaldoNombre,
      detalle: `${signo > 0 ? "Dio" : "Quitó"} $${monto}${saldoMotivo.value.trim() ? " — " + saldoMotivo.value.trim() : ""}`
    });

    modalSaldo.classList.add("hidden");
    cargarTodos();
  } catch (err) {
    msgSaldo.textContent = err.message;
    msgSaldo.className = "msg error";
    msgSaldo.style.display = "block";
  }
}

document.getElementById("btnDarSaldo").addEventListener("click", () => procesarAjusteSaldo(1));
document.getElementById("btnQuitarSaldo").addEventListener("click", () => procesarAjusteSaldo(-1));

// ============ TARJETAS DE REGALO ============

const montoNuevaTarjeta = document.getElementById("montoNuevaTarjeta");
const btnCrearTarjeta = document.getElementById("btnCrearTarjeta");
const codigoGeneradoBox = document.getElementById("codigoGeneradoBox");
const codigoGeneradoTexto = document.getElementById("codigoGeneradoTexto");

btnCrearTarjeta.addEventListener("click", async () => {
  const monto = Number(montoNuevaTarjeta.value);
  if (!monto || monto <= 0) {
    alert("Escribe un monto válido.");
    return;
  }

  btnCrearTarjeta.disabled = true;
  try {
    const codigo = await crearTarjetaRegalo(adminActual.uid, adminActual.nombre, monto);
    codigoGeneradoTexto.textContent = codigo;
    codigoGeneradoBox.classList.remove("hidden");
    montoNuevaTarjeta.value = "";

    await registrarLog({
      tipo: "tarjeta_creada",
      adminUid: adminActual.uid,
      adminNombre: adminActual.nombre,
      objetivoUid: null,
      objetivoNombre: "",
      detalle: `Tarjeta ${codigo} por $${monto}`
    });

    cargarTarjetas();
  } catch (err) {
    alert("Error al crear la tarjeta: " + err.message);
  }
  btnCrearTarjeta.disabled = false;
});

async function cargarTarjetas() {
  const tarjetas = await listarTarjetasRegalo();
  const tbody = document.getElementById("tablaTarjetas");
  const empty = document.getElementById("emptyTarjetas");
  tbody.innerHTML = "";

  if (tarjetas.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  tarjetas.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-family:monospace; font-size:12px;">${t.id}</td>
      <td>$${t.monto}</td>
      <td><span class="badge ${t.canjeada ? "pago" : "gratis"}" style="${t.canjeada ? "background:rgba(224,169,65,0.15); color:var(--warn);" : ""}">${t.canjeada ? "Canjeada" : "Disponible"}</span></td>
      <td style="font-size:12px; color:var(--text-dim);">${t.canjeadaPorNombre || "—"}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ============ NOVEDADES / REGISTRO DE ACTUALIZACIONES ============

const ETIQUETAS_TIPO_NOVEDAD = {
  nueva_funcion: "✨ Nueva función",
  mejora: "⚙️ Mejora",
  arreglo: "🛠️ Arreglo"
};

const novedadEditId = document.getElementById("novedadEditId");
const novedadTipo = document.getElementById("novedadTipo");
const novedadTitulo = document.getElementById("novedadTitulo");
const novedadDescripcion = document.getElementById("novedadDescripcion");
const novedadVersion = document.getElementById("novedadVersion");
const novedadFormTitulo = document.getElementById("novedadFormTitulo");
const btnPublicarNovedad = document.getElementById("btnPublicarNovedad");
const btnCancelarEdicionNovedad = document.getElementById("btnCancelarEdicionNovedad");
const msgNovedad = document.getElementById("msgNovedad");

function limpiarFormNovedad() {
  novedadEditId.value = "";
  novedadTipo.value = "mejora";
  novedadTitulo.value = "";
  novedadDescripcion.value = "";
  novedadVersion.value = "";
  novedadFormTitulo.textContent = "Publicar novedad";
  btnPublicarNovedad.textContent = "Publicar";
  btnCancelarEdicionNovedad.classList.add("hidden");
}

btnCancelarEdicionNovedad.addEventListener("click", limpiarFormNovedad);

btnPublicarNovedad.addEventListener("click", async () => {
  const titulo = novedadTitulo.value.trim();
  if (!titulo) {
    mostrarMsgNovedad("El título es obligatorio.", "error");
    return;
  }

  btnPublicarNovedad.disabled = true;
  try {
    if (novedadEditId.value) {
      await editarActualizacion(novedadEditId.value, {
        titulo,
        descripcion: novedadDescripcion.value.trim(),
        version: novedadVersion.value.trim(),
        tipo: novedadTipo.value
      });
      mostrarMsgNovedad("Novedad actualizada.", "ok");
    } else {
      await publicarActualizacion({
        titulo,
        descripcion: novedadDescripcion.value.trim(),
        version: novedadVersion.value.trim(),
        tipo: novedadTipo.value,
        adminUid: adminActual.uid,
        adminNombre: adminActual.nombre
      });
      mostrarMsgNovedad("Novedad publicada.", "ok");
    }
    limpiarFormNovedad();
    cargarNovedadesAdmin();
  } catch (err) {
    mostrarMsgNovedad("Error: " + err.message, "error");
  }
  btnPublicarNovedad.disabled = false;
});

function mostrarMsgNovedad(texto, tipo) {
  msgNovedad.textContent = texto;
  msgNovedad.className = "msg " + tipo;
  msgNovedad.style.display = "block";
  setTimeout(() => { msgNovedad.style.display = "none"; }, 3000);
}

async function cargarNovedadesAdmin() {
  const lista = await listarActualizaciones();
  const tbody = document.getElementById("tablaNovedades");
  const empty = document.getElementById("emptyNovedades");
  tbody.innerHTML = "";

  if (lista.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  lista.forEach(a => {
    const fecha = a.fecha ? a.fecha.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-size:12px; color:var(--text-dim);">${fecha}</td>
      <td>${ETIQUETAS_TIPO_NOVEDAD[a.tipo] || a.tipo}</td>
      <td>${a.titulo}${a.version ? ` <span style="color:var(--text-dim); font-size:11px;">(${a.version})</span>` : ""}</td>
      <td class="row-actions">
        <button class="secondary" data-editar-novedad="${a.id}">Editar</button>
        <button class="danger" data-borrar-novedad="${a.id}">Borrar</button>
      </td>
    `;
    tbody.appendChild(tr);

    tr.querySelector("[data-editar-novedad]").addEventListener("click", () => {
      novedadEditId.value = a.id;
      novedadTipo.value = a.tipo || "mejora";
      novedadTitulo.value = a.titulo || "";
      novedadDescripcion.value = a.descripcion || "";
      novedadVersion.value = a.version || "";
      novedadFormTitulo.textContent = "Editando: " + a.titulo;
      btnPublicarNovedad.textContent = "Guardar cambios";
      btnCancelarEdicionNovedad.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    tr.querySelector("[data-borrar-novedad]").addEventListener("click", async () => {
      if (!confirm("¿Borrar esta novedad?")) return;
      await borrarActualizacion(a.id);
      cargarNovedadesAdmin();
    });
  });
}

// ============ REPORTES ============

const tablaReportes = document.getElementById("tablaReportes");
const emptyReportes = document.getElementById("emptyReportes");
const tablaReportesResueltos = document.getElementById("tablaReportesResueltos");
const emptyReportesResueltos = document.getElementById("emptyReportesResueltos");

const ETIQUETA_TIPO_REPORTE = { usuario: "👤 Usuario", publicacion: "📝 Publicación", comentario: "💬 Comentario" };

async function cargarReportes() {
  const reportes = await listarReportesPendientes();
  emptyReportes.classList.toggle("hidden", reportes.length > 0);

  tablaReportes.innerHTML = reportes.map(r => {
    const fecha = r.fecha ? r.fecha.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    let accionesContenido = "";

    if (r.objetivoTipo === "publicacion") {
      accionesContenido = `<button class="danger" data-borrar-pub-reporte="${r.id}" data-pub-id="${r.objetivoId}">Borrar publicación</button>`;
    } else if (r.objetivoTipo === "comentario") {
      accionesContenido = `<button class="danger" data-borrar-com-reporte="${r.id}" data-pub-id="${r.objetivoExtraId}" data-com-id="${r.objetivoId}">Borrar comentario</button>`;
    }

    return `
      <tr>
        <td>${fecha}</td>
        <td>${ETIQUETA_TIPO_REPORTE[r.objetivoTipo] || r.objetivoTipo}</td>
        <td>${r.objetivoAutorNombre || "—"}</td>
        <td>${r.reportanteNombre}</td>
        <td>${r.motivo}</td>
        <td style="max-width:200px; font-size:12px; color:var(--text-dim);">${r.infoAdicional || "—"}</td>
        <td style="display:flex; flex-direction:column; gap:4px; min-width:150px;">
          ${accionesContenido}
          <button class="danger" data-suspender-reporte="${r.id}" data-uid="${r.objetivoAutorUid}" data-nombre="${r.objetivoAutorNombre}">Suspender usuario</button>
          <button class="secondary" data-descartar-reporte="${r.id}">Descartar</button>
        </td>
      </tr>
    `;
  }).join("");

  tablaReportes.querySelectorAll("[data-borrar-pub-reporte]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Borrar esta publicación? Esta acción no se puede deshacer.")) return;
      try {
        await borrarPublicacion(btn.dataset.pubId);
        await resolverReporte(btn.dataset.borrarPubReporte, adminActual.uid, adminActual.nombre, "Publicación borrada por un administrador.");
        cargarReportes();
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  });

  tablaReportes.querySelectorAll("[data-borrar-com-reporte]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Borrar este comentario? Esta acción no se puede deshacer.")) return;
      try {
        await borrarComentario(btn.dataset.pubId, btn.dataset.comId);
        await resolverReporte(btn.dataset.borrarComReporte, adminActual.uid, adminActual.nombre, "Comentario borrado por un administrador.");
        cargarReportes();
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  });

  // Suspender usuario: reutiliza el mismo modal que ya existe en la pestaña
  // "Todos los usuarios". Al confirmar la suspensión ahí, marcamos el reporte
  // como resuelto por separado (el modal no sabe que viene de un reporte).
  tablaReportes.querySelectorAll("[data-suspender-reporte]").forEach(btn => {
    btn.addEventListener("click", () => {
      reporteEnSuspensionActual = btn.dataset.suspenderReporte;
      abrirModalSuspender(btn.dataset.uid, btn.dataset.nombre);
    });
  });

  tablaReportes.querySelectorAll("[data-descartar-reporte]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Descartar este reporte sin tomar ninguna acción?")) return;
      await descartarReporte(btn.dataset.descartarReporte, adminActual.uid, adminActual.nombre);
      cargarReportes();
    });
  });

  cargarReportesResueltos();
}

async function cargarReportesResueltos() {
  const reportes = await listarReportesResueltos(50);
  emptyReportesResueltos.classList.toggle("hidden", reportes.length > 0);

  tablaReportesResueltos.innerHTML = reportes.map(r => {
    const fecha = r.fechaResolucion ? r.fechaResolucion.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "";
    return `
      <tr>
        <td>${fecha}</td>
        <td>${ETIQUETA_TIPO_REPORTE[r.objetivoTipo] || r.objetivoTipo}</td>
        <td>${r.objetivoAutorNombre || "—"}</td>
        <td>${r.motivo}</td>
        <td style="font-size:12px;">${r.resolucion || "—"}</td>
        <td style="font-size:12px; color:var(--text-dim);">${r.adminNombre || "—"}</td>
      </tr>
    `;
  }).join("");
}

// ============ VERIFICACIONES ============

const buscarUsuarioVerificar = document.getElementById("buscarUsuarioVerificar");
const resultadosVerificar = document.getElementById("resultadosVerificar");
const tablaVerificados = document.getElementById("tablaVerificados");
const emptyVerificados = document.getElementById("emptyVerificados");
let todosLosUsuariosCache = null;

let debounceBusquedaVerificar = null;
buscarUsuarioVerificar.addEventListener("input", () => {
  clearTimeout(debounceBusquedaVerificar);
  const texto = buscarUsuarioVerificar.value.trim().replace(/^@/, "").toLowerCase();
  if (texto.length < 2) { resultadosVerificar.innerHTML = ""; return; }
  debounceBusquedaVerificar = setTimeout(() => buscarUsuariosParaVerificar(texto), 250);
});

async function buscarUsuariosParaVerificar(texto) {
  if (!todosLosUsuariosCache) {
    const snap = await getDocs(collection(db, "usuarios"));
    todosLosUsuariosCache = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  }

  const resultados = todosLosUsuariosCache.filter(u =>
    (u.username && u.username.toLowerCase().includes(texto)) ||
    (u.nombre && u.nombre.toLowerCase().includes(texto))
  );

  resultadosVerificar.innerHTML = resultados.length === 0
    ? "<div class='empty'>No se encontraron usuarios.</div>"
    : resultados.map(u => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 0; border-bottom:1px solid var(--border);">
          <div>
            <strong>${u.nombre}</strong> ${insigniaVerificado(u)}
            <div style="font-size:12px; color:var(--text-dim);">@${u.username || "—"}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="${u.verificadoDorado ? "danger" : "success"}" data-toggle-dorada="${u.uid}" data-nombre="${u.nombre}" data-estado="${u.verificadoDorado ? "quitar" : "dar"}">
              ${u.verificadoDorado ? "Quitar 🥇" : "Dar 🥇"}
            </button>
            <button class="${u.verificadoAzul ? "danger" : "success"}" data-toggle-azul="${u.uid}" data-nombre="${u.nombre}" data-estado="${u.verificadoAzul ? "quitar" : "dar"}">
              ${u.verificadoAzul ? "Quitar ✅" : "Dar ✅"}
            </button>
          </div>
        </div>
      `).join("");

  resultadosVerificar.querySelectorAll("[data-toggle-dorada]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const otorgar = btn.dataset.estado === "dar";
      try {
        await adminOtorgarVerificacionDorada(adminActual.uid, adminActual.nombre, btn.dataset.toggleDorada, btn.dataset.nombre, otorgar);
        todosLosUsuariosCache = null;
        buscarUsuariosParaVerificar(buscarUsuarioVerificar.value.trim().replace(/^@/, "").toLowerCase());
        cargarVerificados();
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  });

  resultadosVerificar.querySelectorAll("[data-toggle-azul]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const otorgar = btn.dataset.estado === "dar";
      try {
        await adminOtorgarVerificacionAzul(adminActual.uid, adminActual.nombre, btn.dataset.toggleAzul, btn.dataset.nombre, otorgar);
        todosLosUsuariosCache = null;
        buscarUsuariosParaVerificar(buscarUsuarioVerificar.value.trim().replace(/^@/, "").toLowerCase());
        cargarVerificados();
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  });
}

async function cargarVerificados() {
  const snap = await getDocs(
    query(collection(db, "usuarios"), where("verificadoDorado", "==", true))
  );
  const snapAzul = await getDocs(
    query(collection(db, "usuarios"), where("verificadoAzul", "==", true))
  );

  const mapa = new Map();
  snap.docs.forEach(d => mapa.set(d.id, { uid: d.id, ...d.data() }));
  snapAzul.docs.forEach(d => mapa.set(d.id, { uid: d.id, ...d.data() }));
  const verificados = [...mapa.values()];

  emptyVerificados.classList.toggle("hidden", verificados.length > 0);
  tablaVerificados.innerHTML = verificados.map(u => `
    <tr>
      <td>${u.nombre} <span style="font-size:11px; color:var(--text-dim);">@${u.username || "—"}</span></td>
      <td>${u.verificadoDorado ? "🥇 Sí" : "—"}</td>
      <td>${u.verificadoAzul ? "✅ Sí" : "—"}</td>
      <td style="display:flex; gap:6px;">
        ${u.verificadoDorado ? `<button class="danger" data-quitar-dorada-tabla="${u.uid}" data-nombre="${u.nombre}">Quitar 🥇</button>` : ""}
        ${u.verificadoAzul ? `<button class="danger" data-quitar-azul-tabla="${u.uid}" data-nombre="${u.nombre}">Quitar ✅</button>` : ""}
      </td>
    </tr>
  `).join("");

  tablaVerificados.querySelectorAll("[data-quitar-dorada-tabla]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await adminOtorgarVerificacionDorada(adminActual.uid, adminActual.nombre, btn.dataset.quitarDoradaTabla, btn.dataset.nombre, false);
      todosLosUsuariosCache = null;
      cargarVerificados();
    });
  });
  tablaVerificados.querySelectorAll("[data-quitar-azul-tabla]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await adminOtorgarVerificacionAzul(adminActual.uid, adminActual.nombre, btn.dataset.quitarAzulTabla, btn.dataset.nombre, false);
      todosLosUsuariosCache = null;
      cargarVerificados();
    });
  });
}

// ============ MODO MANTENIMIENTO ============

const mantMotivo = document.getElementById("mantMotivo");
const mantHorario = document.getElementById("mantHorario");
const btnActivarMantenimiento = document.getElementById("btnActivarMantenimiento");
const btnDesactivarMantenimiento = document.getElementById("btnDesactivarMantenimiento");
const msgMantenimiento = document.getElementById("msgMantenimiento");
const estadoMantenimientoBox = document.getElementById("estadoMantenimientoBox");
const estadoMantenimientoIcono = document.getElementById("estadoMantenimientoIcono");
const estadoMantenimientoTexto = document.getElementById("estadoMantenimientoTexto");

async function cargarEstadoMantenimiento() {
  const estado = await obtenerEstadoMantenimiento();
  renderEstadoMantenimiento(estado);
}

function renderEstadoMantenimiento(estado) {
  if (estado.activo) {
    estadoMantenimientoBox.style.background = "rgba(227,93,93,0.12)";
    estadoMantenimientoBox.style.border = "1px solid var(--danger)";
    estadoMantenimientoIcono.textContent = "🛠️";
    let detalle = estado.motivo ? `Motivo: ${estado.motivo}` : "";
    if (estado.horario) detalle += (detalle ? " — " : "") + estado.horario;
    if (estado.activadoPorNombre) detalle += (detalle ? " — " : "") + "Activado por " + estado.activadoPorNombre;
    estadoMantenimientoTexto.textContent = "Mantenimiento ACTIVO" + (detalle ? " · " + detalle : "");
  } else {
    estadoMantenimientoBox.style.background = "rgba(76,175,125,0.12)";
    estadoMantenimientoBox.style.border = "1px solid var(--success)";
    estadoMantenimientoIcono.textContent = "✅";
    estadoMantenimientoTexto.textContent = "El sitio está funcionando normalmente";
  }
}

btnActivarMantenimiento.addEventListener("click", async () => {
  const motivo = mantMotivo.value.trim();
  if (!motivo) {
    mostrarMsgMantenimiento("Escribe un motivo (ej. Arreglar bugs).", "error");
    return;
  }

  btnActivarMantenimiento.disabled = true;
  try {
    await activarMantenimiento({
      motivo,
      horario: mantHorario.value.trim(),
      adminUid: adminActual.uid,
      adminNombre: adminActual.nombre
    });

    await registrarLog({
      tipo: "mantenimiento_activado",
      adminUid: adminActual.uid,
      adminNombre: adminActual.nombre,
      objetivoUid: null,
      objetivoNombre: "",
      detalle: motivo + (mantHorario.value.trim() ? " — " + mantHorario.value.trim() : "")
    });

    mostrarMsgMantenimiento("Modo mantenimiento activado.", "ok");
    cargarEstadoMantenimiento();
  } catch (err) {
    mostrarMsgMantenimiento("Error: " + err.message, "error");
  }
  btnActivarMantenimiento.disabled = false;
});

btnDesactivarMantenimiento.addEventListener("click", async () => {
  btnDesactivarMantenimiento.disabled = true;
  try {
    await desactivarMantenimiento();

    await registrarLog({
      tipo: "mantenimiento_desactivado",
      adminUid: adminActual.uid,
      adminNombre: adminActual.nombre,
      objetivoUid: null,
      objetivoNombre: "",
      detalle: "Mantenimiento desactivado"
    });

    mostrarMsgMantenimiento("Modo mantenimiento desactivado.", "ok");
    mantMotivo.value = "";
    mantHorario.value = "";
    cargarEstadoMantenimiento();
  } catch (err) {
    mostrarMsgMantenimiento("Error: " + err.message, "error");
  }
  btnDesactivarMantenimiento.disabled = false;
});

function mostrarMsgMantenimiento(texto, tipo) {
  msgMantenimiento.textContent = texto;
  msgMantenimiento.className = "msg " + tipo;
  msgMantenimiento.style.display = "block";
  setTimeout(() => { msgMantenimiento.style.display = "none"; }, 3500);
}

// ============ RECOMPENSAS (Ox2 gratis -> tarjetas de regalo reales) ============

const estadoCupoAdmin = document.getElementById("estadoCupoAdmin");
const tablaCanjesPendientes = document.getElementById("tablaCanjesPendientes");
const emptyCanjesPendientes = document.getElementById("emptyCanjesPendientes");

async function cargarRecompensasAdmin() {
  const { gastadoMxn, restanteMxn, agotado } = await obtenerEstadoCupoMensual();
  estadoCupoAdmin.innerHTML = agotado
    ? `<span style="color:var(--danger);">🔴 Cupo agotado: $${gastadoMxn} / $${PRESUPUESTO_MENSUAL_MXN} MXN este mes</span>`
    : `<span style="color:var(--success);">🟢 $${gastadoMxn} / $${PRESUPUESTO_MENSUAL_MXN} MXN gastados este mes (quedan $${restanteMxn})</span>`;

  const canjes = await listarCanjesPendientes();
  emptyCanjesPendientes.classList.toggle("hidden", canjes.length > 0);

  tablaCanjesPendientes.innerHTML = canjes.map(c => {
    const fecha = c.fecha ? c.fecha.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "";
    return `
      <tr>
        <td>${fecha}</td>
        <td>${c.nombre}</td>
        <td>${c.recompensaNombre}</td>
        <td>${c.costoOx2} Ox2</td>
        <td><button class="success" data-entregar-canje="${c.id}" data-nombre="${c.nombre}" data-recompensa="${c.recompensaNombre}">Marcar entregado</button></td>
      </tr>
    `;
  }).join("");

  tablaCanjesPendientes.querySelectorAll("[data-entregar-canje]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const codigo = prompt(`Código que le entregaste a ${btn.dataset.nombre} para "${btn.dataset.recompensa}" (opcional, para tu registro):`);
      if (codigo === null) return; // canceló
      await marcarCanjeEntregado(btn.dataset.entregarCanje, adminActual.uid, adminActual.nombre, codigo);
      cargarRecompensasAdmin();
    });
  });
}

// ============ VULNERABILIDADES (bug bounty interno) ============

const listaVulnerabilidadesPendientes = document.getElementById("listaVulnerabilidadesPendientes");
const emptyVulnerabilidades = document.getElementById("emptyVulnerabilidades");
const tablaVulnerabilidadesResueltas = document.getElementById("tablaVulnerabilidadesResueltas");
const emptyVulnerabilidadesResueltas = document.getElementById("emptyVulnerabilidadesResueltas");

const ETIQUETA_GRAVEDAD = { baja: "🔵 Baja", media: "🟡 Media", alta: "🟠 Alta", critica: "🔴 Crítica" };

async function cargarVulnerabilidadesAdmin() {
  const reportes = await listarVulnerabilidadesPendientes();
  emptyVulnerabilidades.classList.toggle("hidden", reportes.length > 0);

  listaVulnerabilidadesPendientes.innerHTML = reportes.map(v => {
    const fecha = v.fecha ? v.fecha.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    return `
      <div style="border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
          <div>
            <strong>${v.titulo}</strong>
            <div style="font-size:12px; color:var(--text-dim);">${fecha} — reportado por ${v.reportanteNombre}</div>
          </div>
          <span style="font-size:12px; white-space:nowrap;">${ETIQUETA_GRAVEDAD[v.gravedadPercibida] || v.gravedadPercibida}</span>
        </div>

        <div style="font-size:13px; margin-bottom:6px;"><strong>Dónde:</strong> ${v.dondeOcurre}</div>
        <div style="font-size:13px; margin-bottom:6px; white-space:pre-wrap;"><strong>Cómo reproducirlo:</strong><br>${v.comoReproducir}</div>
        ${v.consecuencias ? `<div style="font-size:13px; margin-bottom:6px; white-space:pre-wrap;"><strong>Consecuencias:</strong><br>${v.consecuencias}</div>` : ""}
        ${v.codigoRelacionado ? `<div style="font-size:12px; margin-bottom:10px;"><strong>Código:</strong><pre style="background:var(--input-bg); padding:10px; border-radius:8px; overflow-x:auto; white-space:pre-wrap;">${v.codigoRelacionado.replace(/</g, "&lt;")}</pre></div>` : ""}

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; align-items:center;">
          <select id="gravedad-${v.id}" style="width:auto; font-size:12px; padding:6px 8px;">
            <option value="baja">Confirmar: Baja</option>
            <option value="media" selected>Confirmar: Media</option>
            <option value="alta">Confirmar: Alta</option>
            <option value="critica">Confirmar: Crítica</option>
          </select>
          <input type="number" id="ox2-${v.id}" placeholder="Ox2 a dar" min="0" style="width:110px; font-size:12px; padding:6px 8px;">
          <button class="success" data-confirmar-vuln="${v.id}" data-uid="${v.reportanteUid}">Confirmar y recompensar</button>
          <button class="secondary" data-no-aplica-vuln="${v.id}">No aplica</button>
        </div>
      </div>
    `;
  }).join("");

  listaVulnerabilidadesPendientes.querySelectorAll("[data-confirmar-vuln]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.confirmarVuln;
      const gravedadConfirmada = document.getElementById(`gravedad-${id}`).value;
      const recompensaOx2 = parseInt(document.getElementById(`ox2-${id}`).value, 10) || 0;

      btn.disabled = true;
      try {
        await resolverVulnerabilidad(id, adminActual.uid, adminActual.nombre, {
          estado: "confirmado",
          gravedadConfirmada,
          recompensaOx2,
          reportanteUid: btn.dataset.uid
        });
        cargarVulnerabilidadesAdmin();
      } catch (err) {
        alert("Error: " + err.message);
        btn.disabled = false;
      }
    });
  });

  listaVulnerabilidadesPendientes.querySelectorAll("[data-no-aplica-vuln]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Marcar este reporte como 'no aplica'? No se dará recompensa.")) return;
      await resolverVulnerabilidad(btn.dataset.noAplicaVuln, adminActual.uid, adminActual.nombre, {
        estado: "no_aplica"
      });
      cargarVulnerabilidadesAdmin();
    });
  });

  cargarVulnerabilidadesResueltasAdmin();
}

async function cargarVulnerabilidadesResueltasAdmin() {
  const reportes = await listarVulnerabilidadesResueltas(50);
  emptyVulnerabilidadesResueltas.classList.toggle("hidden", reportes.length > 0);

  tablaVulnerabilidadesResueltas.innerHTML = reportes.map(v => {
    const fecha = v.fechaResolucion ? v.fechaResolucion.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "";
    return `
      <tr>
        <td>${fecha}</td>
        <td>${v.titulo}</td>
        <td>${v.reportanteNombre}</td>
        <td>${ETIQUETA_GRAVEDAD[v.gravedadConfirmada] || "—"}</td>
        <td>${v.recompensaOx2 || 0}</td>
        <td>${v.estado === "no_aplica" ? "No aplica" : "Confirmado"}</td>
      </tr>
    `;
  }).join("");
}

// ============ CÓDIGOS DE CANJE (generados automáticamente al comprar un recurso configurado) ============

const tablaCodigosCanje = document.getElementById("tablaCodigosCanje");
const emptyCodigosCanje = document.getElementById("emptyCodigosCanje");

async function cargarHistorialCodigosCanje() {
  const codigos = await listarTodosLosCodigos();
  emptyCodigosCanje.classList.toggle("hidden", codigos.length > 0);

  tablaCodigosCanje.innerHTML = codigos.map(c => {
    const fecha = c.fecha ? c.fecha.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    return `
      <tr>
        <td style="font-family:monospace; font-size:12px;">${c.id}</td>
        <td>${c.tituloRecurso}</td>
        <td>${c.descripcionCodigo || "—"}</td>
        <td>${c.compradorNombre || "—"}</td>
        <td>${fecha}</td>
      </tr>
    `;
  }).join("");
}

// ============ LINKS DE AFILIADO (Ox2 + personalizaciones gratis al entrar con un ?ref=...) ============

const linkEditCodigo = document.getElementById("linkEditCodigo");
const linkCodigo = document.getElementById("linkCodigo");
const linkNombre = document.getElementById("linkNombre");
const linkLimiteUsos = document.getElementById("linkLimiteUsos");
const linkFormTitulo = document.getElementById("linkFormTitulo");
const btnGuardarLink = document.getElementById("btnGuardarLink");
const btnCancelarEdicionLink = document.getElementById("btnCancelarEdicionLink");
const msgLink = document.getElementById("msgLink");

// Construye el bloque de checkboxes de un combo de recompensa (nuevo o
// existente) reutilizando los catálogos ya definidos en personalizacion.js
// y fuentes.js — así el admin nunca escribe IDs a mano.
function construirSelectorRecompensa(prefijo) {
  const cont = document.getElementById(`recompensa${prefijo}`);
  cont.innerHTML = `
    <label style="margin-top:10px;">Ox2 a otorgar</label>
    <input type="number" id="ox2${prefijo}" min="0" placeholder="0" style="margin-bottom:10px;">

    <label>Banners gratis</label>
    <div class="checkbox-grid" id="banners${prefijo}">
      ${CATALOGO_BANNERS.map(b => `
        <label class="checkbox-row"><input type="checkbox" value="${b.id}"> ${b.nombre}</label>
      `).join("")}
    </div>

    <label style="margin-top:10px;">Efectos gratis</label>
    <div class="checkbox-grid" id="efectos${prefijo}">
      ${CATALOGO_EFECTOS.map(e => `
        <label class="checkbox-row"><input type="checkbox" value="${e.id}"> ${e.nombre}</label>
      `).join("")}
    </div>

    <label style="margin-top:10px;">Fuentes gratis</label>
    <div class="checkbox-grid" id="fuentes${prefijo}">
      ${CATALOGO_FUENTES.map(f => `
        <label class="checkbox-row"><input type="checkbox" value="${f.id}"> ${f.nombre}</label>
      `).join("")}
    </div>
  `;
}

function leerRecompensaDeFormulario(prefijo) {
  const marcados = (contenedorId) => [...document.querySelectorAll(`#${contenedorId} input:checked`)].map(el => el.value);
  return {
    ox2: Number(document.getElementById(`ox2${prefijo}`).value) || 0,
    banners: marcados(`banners${prefijo}`),
    efectos: marcados(`efectos${prefijo}`),
    fuentes: marcados(`fuentes${prefijo}`)
  };
}

function escribirRecompensaEnFormulario(prefijo, recompensa) {
  document.getElementById(`ox2${prefijo}`).value = recompensa?.ox2 || "";
  const marcar = (contenedorId, lista) => {
    document.querySelectorAll(`#${contenedorId} input`).forEach(el => {
      el.checked = (lista || []).includes(el.value);
    });
  };
  marcar(`banners${prefijo}`, recompensa?.banners);
  marcar(`efectos${prefijo}`, recompensa?.efectos);
  marcar(`fuentes${prefijo}`, recompensa?.fuentes);
}

construirSelectorRecompensa("Nuevo");
construirSelectorRecompensa("Existente");

function limpiarFormLink() {
  linkEditCodigo.value = "";
  linkCodigo.value = "";
  linkCodigo.disabled = false;
  linkNombre.value = "";
  linkLimiteUsos.value = "";
  escribirRecompensaEnFormulario("Nuevo", null);
  escribirRecompensaEnFormulario("Existente", null);
  linkFormTitulo.textContent = "Nuevo link de afiliado";
  btnGuardarLink.textContent = "Crear link";
  btnCancelarEdicionLink.classList.add("hidden");
}

btnCancelarEdicionLink.addEventListener("click", limpiarFormLink);

function mostrarMsgLink(texto, tipo) {
  msgLink.textContent = texto;
  msgLink.className = "msg " + tipo;
  msgLink.style.display = "block";
  setTimeout(() => { msgLink.style.display = "none"; }, 3500);
}

btnGuardarLink.addEventListener("click", async () => {
  const recompensaNuevo = leerRecompensaDeFormulario("Nuevo");
  const recompensaExistente = leerRecompensaDeFormulario("Existente");
  const limite = Number(linkLimiteUsos.value) || null;

  try {
    if (linkEditCodigo.value) {
      await editarLinkAfiliado(linkEditCodigo.value, {
        nombre: linkNombre.value.trim(),
        limiteUsos: limite,
        recompensaNuevo, recompensaExistente
      });
      mostrarMsgLink("Link actualizado.", "ok");
    } else {
      if (!linkCodigo.value.trim()) { mostrarMsgLink("Escribe un código para el link.", "error"); return; }
      const codigo = await crearLinkAfiliado({
        codigo: linkCodigo.value,
        nombre: linkNombre.value.trim(),
        limiteUsos: limite,
        recompensaNuevo, recompensaExistente,
        adminUid: adminActual.uid,
        adminNombre: adminActual.nombre
      });
      mostrarMsgLink(`Link creado: oxygenmedia.online/?ref=${codigo}`, "ok");
    }
    limpiarFormLink();
    cargarLinksAfiliadoAdmin();
  } catch (err) {
    mostrarMsgLink("Error: " + err.message, "error");
  }
});

async function cargarLinksAfiliadoAdmin() {
  const links = await listarLinksAfiliado();
  const tbody = document.getElementById("tablaLinksAfiliado");
  const empty = document.getElementById("emptyLinksAfiliado");

  if (links.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  tbody.innerHTML = links.map(l => `
    <tr>
      <td style="font-family:monospace; font-size:12px;">${l.codigo}</td>
      <td>${l.nombre}</td>
      <td><span class="badge ${l.activo ? "gratis" : "privado"}">${l.activo ? "Activo" : "Desactivado"}</span></td>
      <td>${l.usosActuales || 0}${l.limiteUsos ? " / " + l.limiteUsos : " (ilimitado)"}</td>
      <td class="row-actions">
        <button class="secondary" data-editar-link="${l.codigo}">Editar</button>
        <button class="${l.activo ? "danger" : "success"}" data-toggle-link="${l.codigo}" data-nuevo-estado="${!l.activo}">${l.activo ? "Desactivar" : "Activar"}</button>
        <button class="danger" data-borrar-link="${l.codigo}">Borrar</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-editar-link]").forEach(btn => {
    btn.addEventListener("click", () => {
      const l = links.find(x => x.codigo === btn.dataset.editarLink);
      if (!l) return;
      linkEditCodigo.value = l.codigo;
      linkCodigo.value = l.codigo;
      linkCodigo.disabled = true; // el código es el ID del documento, no se puede cambiar después de creado
      linkNombre.value = l.nombre || "";
      linkLimiteUsos.value = l.limiteUsos || "";
      escribirRecompensaEnFormulario("Nuevo", l.recompensaNuevo);
      escribirRecompensaEnFormulario("Existente", l.recompensaExistente);
      linkFormTitulo.textContent = "Editando: " + l.codigo;
      btnGuardarLink.textContent = "Guardar cambios";
      btnCancelarEdicionLink.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  tbody.querySelectorAll("[data-toggle-link]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await alternarActivoLinkAfiliado(btn.dataset.toggleLink, btn.dataset.nuevoEstado === "true");
      cargarLinksAfiliadoAdmin();
    });
  });

  tbody.querySelectorAll("[data-borrar-link]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Borrar este link de afiliado permanentemente? Los usuarios que ya lo reclamaron conservan su recompensa.")) return;
      await borrarLinkAfiliado(btn.dataset.borrarLink);
      cargarLinksAfiliadoAdmin();
    });
  });
}

