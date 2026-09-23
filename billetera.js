// billetera.js
// Página de billetera: saldo, transferencias, historial.

import { db } from "./firebase-config.js";
import { observarSesion, cuentaBloqueada } from "./auth.js";
import { obtenerSaldo, transferirCredito, obtenerHistorial, canjearTarjetaRegalo } from "./wallet.js";
import { obtenerSaldoOx3, transferirOx3, obtenerHistorialOx3 } from "./ox3.js";
import { comprarVerificacionDorada, PRECIO_VERIFICACION_DORADA } from "./verificados.js";
import { CATALOGO_RECOMPENSAS, obtenerEstadoCupoMensual, canjearRecompensa, listarHistorialOxGratis } from "./recompensas.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

let usuarioActual = null;
let destinatarioSeleccionado = null; // { uid, nombre }

const saldoActual = document.getElementById("saldoActual");
const saldoOx3Actual = document.getElementById("saldoOx3Actual");
const textoVerificacionDorada = document.getElementById("textoVerificacionDorada");
const btnComprarVerificacion = document.getElementById("btnComprarVerificacion");
const msgVerificacion = document.getElementById("msgVerificacion");
const buscarDestinatario = document.getElementById("buscarDestinatario");
const resultadosBusqueda = document.getElementById("resultadosBusqueda");
const destinatarioSeleccionadoDiv = document.getElementById("destinatarioSeleccionado");
const inputMonto = document.getElementById("inputMonto");
const inputMotivo = document.getElementById("inputMotivo");
const btnTransferir = document.getElementById("btnTransferir");
const msgTransferir = document.getElementById("msgTransferir");
const listaHistorial = document.getElementById("listaHistorial");
const emptyHistorial = document.getElementById("emptyHistorial");
const inputCodigoTarjeta = document.getElementById("inputCodigoTarjeta");
const btnCanjear = document.getElementById("btnCanjear");
const msgCanjear = document.getElementById("msgCanjear");
const estadoCupoRecompensas = document.getElementById("estadoCupoRecompensas");
const gridRecompensas = document.getElementById("gridRecompensas");
const msgRecompensas = document.getElementById("msgRecompensas");

// ---- OX3 ----
let destinatarioSeleccionadoOx3 = null;
const buscarDestinatarioOx3 = document.getElementById("buscarDestinatarioOx3");
const resultadosBusquedaOx3 = document.getElementById("resultadosBusquedaOx3");
const destinatarioSeleccionadoOx3Div = document.getElementById("destinatarioSeleccionadoOx3");
const inputMontoOx3 = document.getElementById("inputMontoOx3");
const inputMotivoOx3 = document.getElementById("inputMotivoOx3");
const btnTransferirOx3 = document.getElementById("btnTransferirOx3");
const msgTransferirOx3 = document.getElementById("msgTransferirOx3");
const listaHistorialOx3 = document.getElementById("listaHistorialOx3");
const emptyHistorialOx3 = document.getElementById("emptyHistorialOx3");

observarSesion((user, perfil) => {
  if (!user || cuentaBloqueada(perfil).bloqueada) {
    document.body.innerHTML = "<div style='padding:60px;text-align:center;color:#8b96b0;'>Debes iniciar sesión y estar aprobado para ver tu billetera. <br><br><a href='index.html' style='color:#5b8def;'>Volver al sitio</a></div>";
    return;
  }
  usuarioActual = { uid: user.uid, ...perfil };
  refrescarSaldo();
  refrescarSaldoOx3();
  cargarHistorial();
  cargarHistorialOx3();
  actualizarCardVerificacion(perfil);
  cargarTiendaRecompensas();
  cargarHistorialOxGratis();
});

// ============ VERIFICACIÓN DORADA ============

function actualizarCardVerificacion(perfil) {
  if (perfil.verificadoDorado) {
    textoVerificacionDorada.textContent = "Ya tienes la verificación dorada. ¡Gracias por apoyar a la comunidad!";
    btnComprarVerificacion.classList.add("hidden");
  } else {
    textoVerificacionDorada.textContent = `Destaca tu perfil con la insignia dorada por $${PRECIO_VERIFICACION_DORADA} Ox2. También puedes solicitarla directamente a un administrador si prefieres pagar por otro medio.`;
    btnComprarVerificacion.classList.remove("hidden");
  }
}

btnComprarVerificacion.addEventListener("click", async () => {
  if (!confirm(`¿Comprar la verificación dorada por $${PRECIO_VERIFICACION_DORADA} Ox2? Se descontará de tu saldo.`)) return;

  btnComprarVerificacion.disabled = true;
  msgVerificacion.style.display = "none";
  try {
    await comprarVerificacionDorada(usuarioActual.uid, usuarioActual.nombre);
    usuarioActual.verificadoDorado = true;
    actualizarCardVerificacion(usuarioActual);
    msgVerificacion.textContent = "¡Felicidades! Ya tienes tu verificación dorada 🥇";
    msgVerificacion.className = "msg ok";
    msgVerificacion.style.display = "block";
    refrescarSaldo();
    cargarHistorial();
  } catch (err) {
    msgVerificacion.textContent = err.message;
    msgVerificacion.className = "msg error";
    msgVerificacion.style.display = "block";
  }
  btnComprarVerificacion.disabled = false;
});

async function refrescarSaldo() {
  const saldo = await obtenerSaldo(usuarioActual.uid);
  saldoActual.textContent = "$" + saldo;
}

// ============ BUSCAR DESTINATARIO ============

let debounceBusqueda = null;
buscarDestinatario.addEventListener("input", () => {
  clearTimeout(debounceBusqueda);
  const texto = buscarDestinatario.value.trim().replace(/^@/, "").toLowerCase();
  if (texto.length < 2) {
    resultadosBusqueda.innerHTML = "";
    return;
  }
  debounceBusqueda = setTimeout(() => buscarUsuarios(texto), 300);
});

async function buscarUsuarios(texto) {
  const snap = await getDocs(query(collection(db, "usuarios"), where("aprobado", "==", true)));
  const resultados = [];
  snap.forEach(docSnap => {
    if (docSnap.id === usuarioActual.uid) return;
    const u = docSnap.data();
    const coincideNombre = u.nombre && u.nombre.toLowerCase().includes(texto);
    const coincideUsername = u.username && u.username.toLowerCase().includes(texto);
    if (coincideNombre || coincideUsername) resultados.push({ uid: docSnap.id, ...u });
  });

  resultadosBusqueda.innerHTML = "";
  resultados.slice(0, 8).forEach(u => {
    const inicial = (u.nombre || "?")[0].toUpperCase();
    const row = document.createElement("div");
    row.className = "search-result";
    row.innerHTML = `
      ${u.fotoURL
        ? `<img class="search-avatar" src="${u.fotoURL}" onerror="this.outerHTML='<div class=&quot;search-avatar&quot;>${inicial}</div>'">`
        : `<div class="search-avatar">${inicial}</div>`}
      <span>${u.nombre} ${u.username ? "· @" + u.username : ""}</span>
    `;
    row.addEventListener("click", () => seleccionarDestinatario(u.uid, u.nombre));
    resultadosBusqueda.appendChild(row);
  });
}

function seleccionarDestinatario(uid, nombre) {
  destinatarioSeleccionado = { uid, nombre };
  buscarDestinatario.value = "";
  resultadosBusqueda.innerHTML = "";
  destinatarioSeleccionadoDiv.innerHTML = `
    <div class="selected-user">
      <span>Enviando a: <strong>${nombre}</strong></span>
      <span class="quitar" id="quitarDestinatario">✕</span>
    </div>
  `;
  document.getElementById("quitarDestinatario").addEventListener("click", () => {
    destinatarioSeleccionado = null;
    destinatarioSeleccionadoDiv.innerHTML = "";
  });
}

// ============ TRANSFERIR ============

btnTransferir.addEventListener("click", async () => {
  msgTransferir.className = "msg";
  msgTransferir.style.display = "none";

  if (!destinatarioSeleccionado) {
    mostrarMsg("Selecciona a quién le vas a transferir.", "error");
    return;
  }
  const monto = Number(inputMonto.value);
  if (!monto || monto <= 0) {
    mostrarMsg("Escribe un monto válido.", "error");
    return;
  }

  btnTransferir.disabled = true;
  try {
    await transferirCredito(
      usuarioActual.uid, usuarioActual.nombre,
      destinatarioSeleccionado.uid, destinatarioSeleccionado.nombre,
      monto, inputMotivo.value.trim()
    );
    mostrarMsg(`Transferiste $${monto} a ${destinatarioSeleccionado.nombre}.`, "ok");
    inputMonto.value = "";
    inputMotivo.value = "";
    destinatarioSeleccionado = null;
    destinatarioSeleccionadoDiv.innerHTML = "";
    refrescarSaldo();
    cargarHistorial();
  } catch (err) {
    mostrarMsg(err.message, "error");
  }
  btnTransferir.disabled = false;
});

function mostrarMsg(texto, tipo) {
  msgTransferir.textContent = texto;
  msgTransferir.className = "msg " + tipo;
}

// ============ CANJEAR TARJETA DE REGALO ============

inputCodigoTarjeta.addEventListener("input", () => {
  inputCodigoTarjeta.value = inputCodigoTarjeta.value.toUpperCase();
});

btnCanjear.addEventListener("click", async () => {
  const codigo = inputCodigoTarjeta.value.trim();
  msgCanjear.style.display = "none";

  if (!codigo) {
    mostrarMsgCanjear("Escribe el código de la tarjeta.", "error");
    return;
  }

  btnCanjear.disabled = true;
  try {
    const monto = await canjearTarjetaRegalo(codigo, usuarioActual.uid, usuarioActual.nombre);
    mostrarMsgCanjear(`¡Listo! Se agregaron $${monto} a tu saldo.`, "ok");
    inputCodigoTarjeta.value = "";
    refrescarSaldo();
    cargarHistorial();
  } catch (err) {
    mostrarMsgCanjear(err.message, "error");
  }
  btnCanjear.disabled = false;
});

function mostrarMsgCanjear(texto, tipo) {
  msgCanjear.textContent = texto;
  msgCanjear.className = "msg " + tipo;
  msgCanjear.style.display = "block";
}

// ============ HISTORIAL ============

async function cargarHistorial() {
  const historial = await obtenerHistorial(usuarioActual.uid);

  if (historial.length === 0) {
    listaHistorial.innerHTML = "";
    emptyHistorial.classList.remove("hidden");
    return;
  }
  emptyHistorial.classList.add("hidden");

  listaHistorial.innerHTML = historial.map(t => {
    const esRecibido = t.paraUid === usuarioActual.uid;
    const fecha = t.fecha ? t.fecha.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

    let texto = "";
    if (t.tipo === "transferencia") {
      texto = esRecibido ? `Recibido de ${t.deNombre}` : `Enviado a ${t.paraNombre}`;
    } else if (t.tipo === "admin_dar") {
      texto = "Crédito otorgado por un admin";
    } else if (t.tipo === "admin_quitar") {
      texto = "Crédito removido por un admin";
    } else if (t.tipo === "compra_recurso") {
      texto = t.motivo || "Compra de recurso";
    } else if (t.tipo === "canje_tarjeta") {
      texto = "🎁 " + (t.motivo || "Tarjeta de regalo canjeada");
    } else if (t.tipo === "compra_verificacion") {
      texto = "🥇 " + (t.motivo || "Compra de verificación dorada");
    }

    const esPositivo = esRecibido || t.tipo === "admin_dar" || t.tipo === "canje_tarjeta";
    return `
      <div class="historial-item">
        <div class="historial-desc">
          <div class="principal">${texto}${t.motivo && t.tipo === "transferencia" ? " — " + t.motivo : ""}</div>
          <div class="fecha">${fecha}</div>
        </div>
        <div class="historial-monto ${esPositivo ? "positivo" : "negativo"}">${esPositivo ? "+" : "-"}$${t.monto}</div>
      </div>
    `;
  }).join("");
}

// ============ TIENDA DE RECOMPENSAS (Ox2 gratis -> tarjetas de regalo reales) ============

async function cargarTiendaRecompensas() {
  const { restanteMxn, agotado } = await obtenerEstadoCupoMensual();

  estadoCupoRecompensas.textContent = agotado
    ? "😔 El cupo de recompensas de este mes ya se agotó. Vuelve el próximo mes."
    : `Quedan $${restanteMxn} MXN de cupo de recompensas este mes.`;

  gridRecompensas.innerHTML = CATALOGO_RECOMPENSAS.map(r => `
    <div style="border:1px solid var(--border); border-radius:var(--radius); padding:12px; text-align:center;">
      <div style="font-size:13px; font-weight:600; margin-bottom:4px;">${r.nombre}</div>
      <div style="font-size:12px; color:var(--success); margin-bottom:8px;">${r.costoOx2} Ox2</div>
      <button data-canjear-recompensa="${r.id}" ${agotado ? "disabled" : ""} style="width:100%; font-size:12px; padding:7px;">
        ${agotado ? "Sin cupo" : "Canjear"}
      </button>
    </div>
  `).join("");

  gridRecompensas.querySelectorAll("[data-canjear-recompensa]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.canjearRecompensa;
      const recompensa = CATALOGO_RECOMPENSAS.find(r => r.id === id);
      if (!confirm(`¿Canjear ${recompensa.costoOx2} Ox2 por "${recompensa.nombre}"? Un administrador te contactará para entregarte el código.`)) return;

      btn.disabled = true;
      msgRecompensas.style.display = "none";
      try {
        await canjearRecompensa(usuarioActual.uid, usuarioActual.nombre, id);
        msgRecompensas.textContent = "¡Listo! Tu canje quedó pendiente — un administrador te contactará pronto con tu código.";
        msgRecompensas.className = "msg ok";
        msgRecompensas.style.display = "block";
        refrescarSaldo();
        cargarHistorial();
        cargarTiendaRecompensas();
      } catch (err) {
        msgRecompensas.textContent = err.message;
        msgRecompensas.className = "msg error";
        msgRecompensas.style.display = "block";
        btn.disabled = false;
      }
    });
  });
}

// ============ GUÍA "CÓMO CONSEGUIR OX2 GRATIS" (plegable) ============

const btnToggleGuiaOx2 = document.getElementById("btnToggleGuiaOx2");
const contenidoGuiaOx2 = document.getElementById("contenidoGuiaOx2");
const chevronGuiaOx2 = document.getElementById("chevronGuiaOx2");

btnToggleGuiaOx2.addEventListener("click", () => {
  const abierta = !contenidoGuiaOx2.classList.contains("hidden");
  contenidoGuiaOx2.classList.toggle("hidden", abierta);
  chevronGuiaOx2.style.transform = abierta ? "rotate(0deg)" : "rotate(90deg)";
});

// ============ HISTORIAL DE OX2 GANADO GRATIS ============

const listaHistorialOxGratis = document.getElementById("listaHistorialOxGratis");
const emptyHistorialOxGratis = document.getElementById("emptyHistorialOxGratis");

const DESCRIPCION_TIPO = {
  like_recibido: "❤️ Like recibido",
  publicacion: "📝 Publicaste algo",
};

async function cargarHistorialOxGratis() {
  const entradas = await listarHistorialOxGratis(usuarioActual.uid);
  emptyHistorialOxGratis.classList.toggle("hidden", entradas.length > 0);

  listaHistorialOxGratis.innerHTML = entradas.map(e => {
    const fecha = e.fecha ? e.fecha.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    const etiqueta = DESCRIPCION_TIPO[e.tipo] || e.descripcion || "Ox2 ganado";
    return `
      <div class="historial-item">
        <div class="historial-desc">
          <div class="principal">${etiqueta}</div>
          <div class="fecha">${fecha}</div>
        </div>
        <div class="historial-monto positivo">+${e.cantidad}</div>
      </div>
    `;
  }).join("");
}

// ============ OX3 — SALDO ============

async function refrescarSaldoOx3() {
  const saldo = await obtenerSaldoOx3(usuarioActual.uid);
  saldoOx3Actual.textContent = saldo;
}

// ============ OX3 — BUSCAR DESTINATARIO ============

let debounceBusquedaOx3 = null;
buscarDestinatarioOx3.addEventListener("input", () => {
  clearTimeout(debounceBusquedaOx3);
  const texto = buscarDestinatarioOx3.value.trim().replace(/^@/, "").toLowerCase();
  if (texto.length < 2) {
    resultadosBusquedaOx3.innerHTML = "";
    return;
  }
  debounceBusquedaOx3 = setTimeout(() => buscarUsuariosOx3(texto), 300);
});

async function buscarUsuariosOx3(texto) {
  const snap = await getDocs(query(collection(db, "usuarios"), where("aprobado", "==", true)));
  const resultados = [];
  snap.forEach(docSnap => {
    if (docSnap.id === usuarioActual.uid) return;
    const u = docSnap.data();
    const coincideNombre = u.nombre && u.nombre.toLowerCase().includes(texto);
    const coincideUsername = u.username && u.username.toLowerCase().includes(texto);
    if (coincideNombre || coincideUsername) resultados.push({ uid: docSnap.id, ...u });
  });

  resultadosBusquedaOx3.innerHTML = "";
  resultados.slice(0, 8).forEach(u => {
    const inicial = (u.nombre || "?")[0].toUpperCase();
    const row = document.createElement("div");
    row.className = "search-result";
    row.innerHTML = `
      ${u.fotoURL
        ? `<img class="search-avatar" src="${u.fotoURL}" onerror="this.outerHTML='<div class=&quot;search-avatar&quot;>${inicial}</div>'">`
        : `<div class="search-avatar">${inicial}</div>`}
      <span>${u.nombre} ${u.username ? "· @" + u.username : ""}</span>
    `;
    row.addEventListener("click", () => seleccionarDestinatarioOx3(u.uid, u.nombre));
    resultadosBusquedaOx3.appendChild(row);
  });
}

function seleccionarDestinatarioOx3(uid, nombre) {
  destinatarioSeleccionadoOx3 = { uid, nombre };
  buscarDestinatarioOx3.value = "";
  resultadosBusquedaOx3.innerHTML = "";
  destinatarioSeleccionadoOx3Div.innerHTML = `
    <div class="selected-user">
      <span>Enviando a: <strong>${nombre}</strong></span>
      <span class="quitar" id="quitarDestinatarioOx3">✕</span>
    </div>
  `;
  document.getElementById("quitarDestinatarioOx3").addEventListener("click", () => {
    destinatarioSeleccionadoOx3 = null;
    destinatarioSeleccionadoOx3Div.innerHTML = "";
  });
}

// ============ OX3 — TRANSFERIR ============

btnTransferirOx3.addEventListener("click", async () => {
  msgTransferirOx3.className = "msg";
  msgTransferirOx3.style.display = "none";

  if (!destinatarioSeleccionadoOx3) {
    mostrarMsgOx3("Selecciona a quién le vas a transferir.", "error");
    return;
  }
  const monto = Number(inputMontoOx3.value);
  if (!monto || monto <= 0) {
    mostrarMsgOx3("Escribe un monto válido.", "error");
    return;
  }

  btnTransferirOx3.disabled = true;
  try {
    await transferirOx3(
      usuarioActual.uid, usuarioActual.nombre,
      destinatarioSeleccionadoOx3.uid, destinatarioSeleccionadoOx3.nombre,
      monto, inputMotivoOx3.value.trim()
    );
    mostrarMsgOx3(`Transferiste ${monto} Ox3 a ${destinatarioSeleccionadoOx3.nombre}.`, "ok");
    inputMontoOx3.value = "";
    inputMotivoOx3.value = "";
    destinatarioSeleccionadoOx3 = null;
    destinatarioSeleccionadoOx3Div.innerHTML = "";
    refrescarSaldoOx3();
    cargarHistorialOx3();
  } catch (err) {
    mostrarMsgOx3(err.message, "error");
  }
  btnTransferirOx3.disabled = false;
});

function mostrarMsgOx3(texto, tipo) {
  msgTransferirOx3.textContent = texto;
  msgTransferirOx3.className = "msg " + tipo;
  msgTransferirOx3.style.display = "block";
}

// ============ OX3 — HISTORIAL ============

const TEXTO_TIPO_OX3 = {
  recompensa_staregg: (t) => `🥚 ${t.motivo || "Recompensa de Star Egg"}`,
  compra_personalizacion: (t) => t.motivo || "Compra de personalización",
  admin_dar: () => "Ox3 otorgado por un admin",
  admin_quitar: () => "Ox3 removido por un admin"
};

async function cargarHistorialOx3() {
  const historial = await obtenerHistorialOx3(usuarioActual.uid);

  if (historial.length === 0) {
    listaHistorialOx3.innerHTML = "";
    emptyHistorialOx3.classList.remove("hidden");
    return;
  }
  emptyHistorialOx3.classList.add("hidden");

  listaHistorialOx3.innerHTML = historial.map(t => {
    const esRecibido = t.paraUid === usuarioActual.uid;
    const fecha = t.fecha ? t.fecha.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

    let texto = "";
    if (t.tipo === "transferencia") {
      texto = esRecibido ? `Recibido de ${t.deNombre}` : `Enviado a ${t.paraNombre}`;
    } else if (TEXTO_TIPO_OX3[t.tipo]) {
      texto = TEXTO_TIPO_OX3[t.tipo](t);
    } else {
      texto = t.motivo || t.tipo;
    }

    const esPositivo = t.tipo === "recompensa_staregg" || t.tipo === "admin_dar" ||
                        (t.tipo === "transferencia" && esRecibido);
    return `
      <div class="historial-item">
        <div class="historial-desc">
          <div class="principal">${texto}${t.motivo && t.tipo === "transferencia" ? " — " + t.motivo : ""}</div>
          <div class="fecha">${fecha}</div>
        </div>
        <div class="historial-monto ${esPositivo ? "positivo" : "negativo"}">${esPositivo ? "+" : "-"}${t.monto}</div>
      </div>
    `;
  }).join("");
}