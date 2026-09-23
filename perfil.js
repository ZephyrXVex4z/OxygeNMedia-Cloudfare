// perfil.js
// EdiciÃ³n de perfil: nombre, @username Ãºnico, foto, descripciÃ³n, y roles

import { db } from "./firebase-config.js";
import { observarSesion, cuentaBloqueada } from "./auth.js";
import { iniciarAyudaImagen } from "./ayuda-imagen.js";
import { iniciarConexionSpotify, desconectarSpotify, buscarCanciones } from "./spotify.js";
import { LASTFM_ACTIVO, conectarLastfm, desconectarLastfm, actualizarStatsLastfmEnPerfil } from "./lastfm.js";
import { IA_ACTIVA, pedirRecomendacionIA } from "./ia-recomendaciones.js";
import { subirImagen } from "./subir-imagen.js";
import { CATALOGO_BANNERS, CATALOGO_EFECTOS, comprarBanner, comprarEfecto, equiparBanner, alternarEfectoActivo, equiparBannerPersonalizado, BANNER_PERSONALIZADO_ID } from "./personalizacion.js";
import { aplicarEfectosActivos, iniciarEfectoCanvas } from "./perfil-efectos.js";
import { insigniaVerificado } from "./verificados.js";
import { CATALOGO_ESTADOS, elegirEstadoManual, calcularEstadoVisible } from "./estado-usuario.js";
import {
  doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

let usuarioActual = null;
let perfilActual = null;
let rolesAprobadosDisponibles = [];

const avatarPreview = document.getElementById("avatarPreview");
const avatarInicial = document.getElementById("avatarInicial");
const nombreActual = document.getElementById("nombreActual");
const insigniasActual = document.getElementById("insigniasActual");
const usernameActual = document.getElementById("usernameActual");
const perfilLinkRow = document.getElementById("perfilLinkRow");
const perfilLinkTexto = document.getElementById("perfilLinkTexto");
const btnCopiarPerfilLink = document.getElementById("btnCopiarPerfilLink");
const useridActual = document.getElementById("useridActual");

const inputNombre = document.getElementById("inputNombre");
const inputUsername = document.getElementById("inputUsername");
const usernameMsg = document.getElementById("usernameMsg");
const inputFotoURL = document.getElementById("inputFotoURL");
const inputDescripcion = document.getElementById("inputDescripcion");
const checkSeguidoresPrivados = document.getElementById("checkSeguidoresPrivados");

const rolesActuales = document.getElementById("rolesActuales");
const rolesDisponiblesLista = document.getElementById("rolesDisponiblesLista");
const inputNuevoRol = document.getElementById("inputNuevoRol");
const btnProponerRol = document.getElementById("btnProponerRol");
const proponerRolMsg = document.getElementById("proponerRolMsg");

const btnGuardarPerfil = document.getElementById("btnGuardarPerfil");
const msgGuardado = document.getElementById("msgGuardado");

let misRolesPerfil = [];       // roles ya aprobados que tiene el usuario
let misRolesPendientes = [];   // roles que propuso y esperan aprobaciÃ³n

let yaSeCargoUnaVez = false;

observarSesion((user, perfil) => {
  if (!user || cuentaBloqueada(perfil).bloqueada) {
    document.body.innerHTML = "<div style='padding:60px;text-align:center;color:#8b96b0;'>Debes iniciar sesiÃ³n y estar aprobado para ver tu perfil. <br><br><a href='/' style='color:#5b8def;'>Volver al sitio</a></div>";
    return;
  }
  usuarioActual = { uid: user.uid };
  perfilActual = perfil;

  // observarSesion() puede volver a llamar a este callback mÃ¡s de una vez (por
  // ejemplo, cuando Firebase Auth refresca el token de sesiÃ³n en segundo plano,
  // algo rutinario y sin relaciÃ³n con nada que el usuario haga). Antes, cada vez
  // que eso pasaba, se reconstruÃ­a todo el formulario desde cero â€” incluyendo el
  // botÃ³n de Spotify â€” y si el usuario tocaba el botÃ³n justo en ese instante, el
  // clic se perdÃ­a porque el DOM se acababa de reemplazar debajo de su dedo. Ahora
  // solo se hace la carga completa la PRIMERA vez; las siguientes llamadas solo
  // actualizan la referencia en memoria, sin tocar el DOM ya renderizado.
  if (!yaSeCargoUnaVez) {
    yaSeCargoUnaVez = true;
    cargarDatosEnFormulario();
    iniciarAyudaImagen();
    cargarRolesDisponibles().then(() => sincronizarRolesPendientesAprobados());
  }
});

// Si alguno de mis roles "pendientes" ya fue aprobado por el admin,
// lo movemos automÃ¡ticamente a roles activos
async function sincronizarRolesPendientesAprobados() {
  const pendientesActuales = perfilActual.rolesPendientes || [];
  if (pendientesActuales.length === 0) return;

  const yaAprobados = pendientesActuales.filter(r => rolesAprobadosDisponibles.includes(r));
  if (yaAprobados.length === 0) return;

  const nuevosRolesPerfil = [...new Set([...(perfilActual.rolesPerfil || []), ...yaAprobados])];
  const nuevosPendientes = pendientesActuales.filter(r => !yaAprobados.includes(r));

  await updateDoc(doc(db, "usuarios", usuarioActual.uid), {
    rolesPerfil: nuevosRolesPerfil,
    rolesPendientes: nuevosPendientes
  });

  perfilActual.rolesPerfil = nuevosRolesPerfil;
  perfilActual.rolesPendientes = nuevosPendientes;
  misRolesPerfil = nuevosRolesPerfil;
  misRolesPendientes = nuevosPendientes;
  renderRolesActuales();
  renderRolesDisponibles();
}

function actualizarPerfilLinkRow() {
  if (!perfilActual.username) {
    perfilLinkRow.classList.add("hidden");
    return;
  }
  const url = `${location.origin}/user/@${perfilActual.username}`;
  perfilLinkTexto.textContent = url;
  perfilLinkRow.classList.remove("hidden");
  btnCopiarPerfilLink.onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      btnCopiarPerfilLink.textContent = "Â¡Copiado!";
    } catch (e) {
      btnCopiarPerfilLink.textContent = "No se pudo copiar";
    }
    setTimeout(() => { btnCopiarPerfilLink.textContent = "Copiar enlace"; }, 2000);
  };
}

function cargarDatosEnFormulario() {
  nombreActual.textContent = perfilActual.nombre || "";
  insigniasActual.innerHTML = insigniaVerificado(perfilActual);
  renderEstadoChipPropio();
  usernameActual.textContent = perfilActual.username ? "@" + perfilActual.username : "Sin @ configurado";
  useridActual.textContent = "ID: " + usuarioActual.uid;
  actualizarPerfilLinkRow();

  inputNombre.value = perfilActual.nombre || "";
  inputUsername.value = perfilActual.username || "";
  inputFotoURL.value = perfilActual.fotoURL || "";
  inputDescripcion.value = perfilActual.descripcion || "";
  checkSeguidoresPrivados.checked = perfilActual.seguidoresPrivados || false;
  cargarRedesSocialesEnFormulario(perfilActual.redesSociales);
  renderEstadoSpotify();
  renderEstadoLastfm();
  renderSeccionIA();
  renderPersonalizacion();
  renderBannerHeader();
  renderSelectorEstadoManual();

  actualizarAvatar();

  misRolesPerfil = perfilActual.rolesPerfil || [];
  misRolesPendientes = perfilActual.rolesPendientes || [];
  renderRolesActuales();
}

function actualizarAvatar() {
  const url = inputFotoURL.value.trim();
  if (url) {
    avatarPreview.src = url;
    avatarPreview.classList.remove("hidden");
    avatarInicial.classList.add("hidden");
    avatarPreview.onerror = () => {
      avatarPreview.classList.add("hidden");
      avatarInicial.classList.remove("hidden");
    };
  } else {
    avatarPreview.classList.add("hidden");
    avatarInicial.classList.remove("hidden");
    const inicial = (inputNombre.value.trim()[0] || "?").toUpperCase();
    avatarInicial.textContent = inicial;
  }
}
inputFotoURL.addEventListener("input", actualizarAvatar);
inputNombre.addEventListener("input", actualizarAvatar);

// ============ REDES SOCIALES ============
// Se guardan como un solo objeto "redesSociales" en el perfil, en vez de
// campos sueltos, para no ensuciar el documento del usuario con 6 campos
// mÃ¡s al nivel raÃ­z â€” mÃ¡s fÃ¡cil de extender si se agrega otra red despuÃ©s.

const REDES_CAMPOS = ["instagram", "tiktok", "discord", "x", "whatsapp", "linkInBio"];

function cargarRedesSocialesEnFormulario(redes) {
  REDES_CAMPOS.forEach(campo => {
    const input = document.getElementById(`inputRed_${campo}`);
    if (input) input.value = redes?.[campo] || "";
  });
}

function leerRedesSocialesDeFormulario() {
  const resultado = {};
  REDES_CAMPOS.forEach(campo => {
    const input = document.getElementById(`inputRed_${campo}`);
    if (input) resultado[campo] = input.value.trim();
  });
  // El campo de WhatsApp solo debe contener dÃ­gitos (y opcionalmente un "+"
  // inicial) â€” se limpia aquÃ­ antes de guardar para que ver-perfil.js pueda
  // construir el link wa.me directo sin tener que sanear datos viejos ahÃ­.
  if (resultado.whatsapp) {
    resultado.whatsapp = resultado.whatsapp.replace(/[^\d+]/g, "");
  }
  return resultado;
}

// ============ SUBIR FOTO DE PERFIL (archivo real, comprimido a WebP y subido a R2) ============

const btnElegirFotoPerfil = document.getElementById("btnElegirFotoPerfil");
const inputFotoArchivo = document.getElementById("inputFotoArchivo");
const msgSubidaFoto = document.getElementById("msgSubidaFoto");

btnElegirFotoPerfil.addEventListener("click", () => inputFotoArchivo.click());

inputFotoArchivo.addEventListener("change", async () => {
  const archivo = inputFotoArchivo.files[0];
  if (!archivo) return;

  msgSubidaFoto.style.display = "none";
  btnElegirFotoPerfil.disabled = true;
  btnElegirFotoPerfil.textContent = "Comprimiendo y subiendo...";

  try {
    const url = await subirImagen(archivo, "perfiles");
    inputFotoURL.value = url;
    actualizarAvatar();
    msgSubidaFoto.textContent = "Foto lista â€” no olvides tocar 'Guardar cambios' abajo.";
    msgSubidaFoto.className = "field-msg ok";
    msgSubidaFoto.style.display = "block";
  } catch (err) {
    msgSubidaFoto.textContent = err.message;
    msgSubidaFoto.className = "field-msg error";
    msgSubidaFoto.style.display = "block";
  }

  btnElegirFotoPerfil.disabled = false;
  btnElegirFotoPerfil.textContent = "ðŸ“· Elegir foto desde tu dispositivo";
  inputFotoArchivo.value = ""; // permite volver a elegir el mismo archivo si hace falta
});

// ============ VALIDACIÃ“N DE USERNAME ÃšNICO ============

let debounceUsername = null;
inputUsername.addEventListener("input", () => {
  // Normaliza mientras escribe: minÃºsculas, sin espacios ni sÃ­mbolos raros
  inputUsername.value = inputUsername.value.toLowerCase().replace(/[^a-z0-9_.]/g, "");
  clearTimeout(debounceUsername);
  usernameMsg.style.display = "none";
  debounceUsername = setTimeout(validarUsername, 400);
});

async function validarUsername() {
  const valor = inputUsername.value.trim();
  if (!valor) {
    usernameMsg.textContent = "";
    usernameMsg.style.display = "none";
    return true;
  }
  if (valor.length < 3) {
    usernameMsg.textContent = "Debe tener al menos 3 caracteres.";
    usernameMsg.className = "field-msg error";
    return false;
  }
  // Si no cambiÃ³ respecto al actual, estÃ¡ bien sin checar duplicados
  if (valor === perfilActual.username) {
    usernameMsg.textContent = "";
    usernameMsg.style.display = "none";
    return true;
  }

  const q = query(collection(db, "usuarios"), where("username", "==", valor));
  const snap = await getDocs(q);
  if (!snap.empty) {
    usernameMsg.textContent = "Ese @ ya estÃ¡ en uso.";
    usernameMsg.className = "field-msg error";
    return false;
  }

  usernameMsg.textContent = "Disponible âœ“";
  usernameMsg.className = "field-msg ok";
  return true;
}

// ============ ROLES ============

async function cargarRolesDisponibles() {
  const snap = await getDocs(query(collection(db, "rolesDisponibles"), where("aprobado", "==", true)));
  rolesAprobadosDisponibles = snap.docs.map(d => d.data().nombre);
  renderRolesDisponibles();
}

function renderRolesActuales() {
  rolesActuales.innerHTML = "";
  misRolesPerfil.forEach(rol => {
    const chip = document.createElement("span");
    chip.className = "role-chip";
    chip.innerHTML = `${rol} <span data-quitar-rol="${rol}">âœ•</span>`;
    rolesActuales.appendChild(chip);
  });
  misRolesPendientes.forEach(rol => {
    const chip = document.createElement("span");
    chip.className = "role-chip pendiente";
    chip.innerHTML = `${rol} (esperando aprobaciÃ³n) <span data-quitar-pendiente="${rol}">âœ•</span>`;
    rolesActuales.appendChild(chip);
  });
  if (misRolesPerfil.length === 0 && misRolesPendientes.length === 0) {
    rolesActuales.innerHTML = "<span style='color:var(--text-dim); font-size:13px;'>AÃºn no tienes roles.</span>";
  }

  rolesActuales.querySelectorAll("[data-quitar-rol]").forEach(el => {
    el.addEventListener("click", () => {
      misRolesPerfil = misRolesPerfil.filter(r => r !== el.dataset.quitarRol);
      renderRolesActuales();
    });
  });
  rolesActuales.querySelectorAll("[data-quitar-pendiente]").forEach(el => {
    el.addEventListener("click", () => {
      misRolesPendientes = misRolesPendientes.filter(r => r !== el.dataset.quitarPendiente);
      renderRolesActuales();
    });
  });
}

function renderRolesDisponibles() {
  const noAgregados = rolesAprobadosDisponibles.filter(r => !misRolesPerfil.includes(r));
  rolesDisponiblesLista.innerHTML = "";
  if (noAgregados.length === 0) {
    rolesDisponiblesLista.innerHTML = "<span style='color:var(--text-dim); font-size:12px;'>No hay roles disponibles para agregar todavÃ­a.</span>";
    return;
  }
  noAgregados.forEach(rol => {
    const opt = document.createElement("span");
    opt.className = "role-option";
    opt.textContent = "+ " + rol;
    opt.addEventListener("click", () => {
      misRolesPerfil.push(rol);
      renderRolesActuales();
      renderRolesDisponibles();
    });
    rolesDisponiblesLista.appendChild(opt);
  });
}

btnProponerRol.addEventListener("click", async () => {
  const nombreRol = inputNuevoRol.value.trim();
  if (!nombreRol) return;

  if (rolesAprobadosDisponibles.some(r => r.toLowerCase() === nombreRol.toLowerCase()) ||
      misRolesPendientes.some(r => r.toLowerCase() === nombreRol.toLowerCase())) {
    proponerRolMsg.textContent = "Ese rol ya existe o ya lo propusiste.";
    proponerRolMsg.className = "field-msg error";
    return;
  }

  try {
    await addDoc(collection(db, "rolesDisponibles"), {
      nombre: nombreRol,
      creadoPor: usuarioActual.uid,
      aprobado: false
    });
    misRolesPendientes.push(nombreRol);
    renderRolesActuales();
    inputNuevoRol.value = "";
    proponerRolMsg.textContent = "Rol propuesto. Un admin debe aprobarlo.";
    proponerRolMsg.className = "field-msg ok";
  } catch (err) {
    proponerRolMsg.textContent = "Error: " + err.message;
    proponerRolMsg.className = "field-msg error";
  }
});

// ============ GUARDAR PERFIL ============

btnGuardarPerfil.addEventListener("click", async () => {
  const nombre = inputNombre.value.trim();
  if (!nombre) {
    msgGuardado.textContent = "El nombre no puede estar vacÃ­o.";
    msgGuardado.className = "msg-guardado error";
    return;
  }

  const usernameValido = await validarUsername();
  if (!usernameValido) {
    msgGuardado.textContent = "Corrige el @ antes de guardar.";
    msgGuardado.className = "msg-guardado error";
    return;
  }

  btnGuardarPerfil.disabled = true;
  try {
    const privacidadSpotify = document.getElementById("selectPrivacidadSpotify").value;
    const privacidadLastfm = selectPrivacidadLastfm ? selectPrivacidadLastfm.value : (perfilActual.privacidadLastfm || "amigos");
    const redesSociales = leerRedesSocialesDeFormulario();
    await updateDoc(doc(db, "usuarios", usuarioActual.uid), {
      nombre: nombre,
      username: inputUsername.value.trim(),
      fotoURL: inputFotoURL.value.trim(),
      descripcion: inputDescripcion.value.trim(),
      seguidoresPrivados: checkSeguidoresPrivados.checked,
      privacidadSpotify,
      privacidadLastfm,
      redesSociales,
      rolesPerfil: misRolesPerfil,
      rolesPendientes: misRolesPendientes
    });

    perfilActual = { ...perfilActual, nombre, username: inputUsername.value.trim(), fotoURL: inputFotoURL.value.trim(), descripcion: inputDescripcion.value.trim(), seguidoresPrivados: checkSeguidoresPrivados.checked, privacidadSpotify, privacidadLastfm, redesSociales, rolesPerfil: misRolesPerfil, rolesPendientes: misRolesPendientes };
    cargarDatosEnFormulario();

    msgGuardado.textContent = "Perfil actualizado âœ“";
    msgGuardado.className = "msg-guardado ok";
  } catch (err) {
    msgGuardado.textContent = "Error al guardar: " + err.message;
    msgGuardado.className = "msg-guardado error";
  }
  btnGuardarPerfil.disabled = false;
});

// ============ SPOTIFY ============

const textoEstadoSpotify = document.getElementById("textoEstadoSpotify");
const btnConectarSpotify = document.getElementById("btnConectarSpotify");
const btnDesconectarSpotify = document.getElementById("btnDesconectarSpotify");
const camposMusicaConectada = document.getElementById("camposMusicaConectada");
const inputCancionFavorita = document.getElementById("inputCancionFavorita");
const resultadosCancionFavorita = document.getElementById("resultadosCancionFavorita");
const cancionFavoritaElegida = document.getElementById("cancionFavoritaElegida");

function renderEstadoSpotify() {
  const conectado = perfilActual.spotifyConectado;
  textoEstadoSpotify.textContent = conectado
    ? "Tu cuenta de Spotify estÃ¡ conectada."
    : "Conecta tu cuenta para mostrar tu canciÃ³n favorita, quÃ© estÃ¡s escuchando, y tus artistas mÃ¡s escuchados.";

  btnConectarSpotify.classList.toggle("hidden", conectado);
  btnDesconectarSpotify.classList.toggle("hidden", !conectado);
  camposMusicaConectada.classList.toggle("hidden", !conectado);

  document.getElementById("selectPrivacidadSpotify").value = perfilActual.privacidadSpotify || "amigos";

  if (perfilActual.cancionFavorita) {
    const c = perfilActual.cancionFavorita;
    cancionFavoritaElegida.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; border:1px solid var(--border); border-radius:var(--radius); padding:8px 10px;">
        ${c.imagenURL ? `<img src="${c.imagenURL}" style="width:40px;height:40px;border-radius:6px;">` : ""}
        <div style="flex:1; min-width:0;">
          <div style="font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.cancion}</div>
          <div style="font-size:12px; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.artista}</div>
        </div>
        <button type="button" id="btnQuitarCancionFavorita" class="secondary" style="font-size:12px; padding:6px 10px;">Quitar</button>
      </div>
    `;
    document.getElementById("btnQuitarCancionFavorita").addEventListener("click", async () => {
      await updateDoc(doc(db, "usuarios", usuarioActual.uid), { cancionFavorita: null });
      perfilActual.cancionFavorita = null;
      renderEstadoSpotify();
    });
  } else {
    cancionFavoritaElegida.innerHTML = "";
  }
}

btnConectarSpotify.addEventListener("click", () => {
  iniciarConexionSpotify();
});

btnDesconectarSpotify.addEventListener("click", async () => {
  if (!confirm("Â¿Desconectar tu cuenta de Spotify? Se dejarÃ¡ de mostrar tu mÃºsica en tu perfil.")) return;
  await desconectarSpotify(usuarioActual.uid);
  perfilActual.spotifyConectado = false;
  perfilActual.cancionActual = null;
  perfilActual.topArtistas = null;
  perfilActual.topCanciones = null;
  renderEstadoSpotify();
});

let debounceBusquedaCancion = null;
let resultadosCancionActuales = [];

inputCancionFavorita.addEventListener("input", () => {
  clearTimeout(debounceBusquedaCancion);
  const texto = inputCancionFavorita.value.trim();
  if (texto.length < 2) { resultadosCancionFavorita.innerHTML = ""; resultadosCancionActuales = []; return; }
  debounceBusquedaCancion = setTimeout(async () => {
    resultadosCancionActuales = await buscarCanciones(usuarioActual.uid, texto);
    resultadosCancionFavorita.innerHTML = resultadosCancionActuales.map((r, i) => `
      <button type="button" class="resultado-cancion" data-idx="${i}" style="display:flex; align-items:center; gap:10px; padding:6px; width:100%; text-align:left; background:none; border:none; border-radius:8px; font-family:inherit; cursor:pointer;">
        ${r.imagenURL ? `<img src="${r.imagenURL}" style="width:34px;height:34px;border-radius:5px;">` : ""}
        <div style="font-size:13px; color:var(--text);">
          <div>${r.cancion}</div>
          <div style="color:var(--text-dim); font-size:11.5px;">${r.artista}</div>
        </div>
      </button>
    `).join("");

    // Usamos "pointerdown" (se dispara ANTES que "click" y antes que el "blur" del
    // input) en vez de "click" â€” en mÃ³vil, si el usuario toca un resultado mientras
    // el teclado virtual sigue abierto, el input pierde el foco (blur) y a veces
    // eso alcanza a disparar antes que el "click", perdiendo el toque por completo.
    // Con "pointerdown" capturamos la elecciÃ³n de inmediato, antes de que nada mÃ¡s
    // pueda interferir, y evitamos que el blur del input borre la lista a tiempo.
    resultadosCancionFavorita.querySelectorAll("[data-idx]").forEach(el => {
      el.addEventListener("pointerdown", async (e) => {
        e.preventDefault();
        const elegida = resultadosCancionActuales[parseInt(el.dataset.idx, 10)];
        if (!elegida) return;
        await updateDoc(doc(db, "usuarios", usuarioActual.uid), { cancionFavorita: elegida });
        perfilActual.cancionFavorita = elegida;
        inputCancionFavorita.value = "";
        resultadosCancionFavorita.innerHTML = "";
        resultadosCancionActuales = [];
        renderEstadoSpotify();
      });
    });
  }, 400);
});

// ============ LAST.FM (complemento a Spotify: estadÃ­sticas histÃ³ricas) ============
// Oculto por completo mientras LASTFM_ACTIVO sea false â€” ver lastfm.js.

const seccionLastfm = document.getElementById("seccionLastfm");
const textoEstadoLastfm = document.getElementById("textoEstadoLastfm");
const inputUsernameLastfm = document.getElementById("inputUsernameLastfm");
const btnConectarLastfm = document.getElementById("btnConectarLastfm");
const btnDesconectarLastfm = document.getElementById("btnDesconectarLastfm");
const msgLastfm = document.getElementById("msgLastfm");
const selectPrivacidadLastfm = document.getElementById("selectPrivacidadLastfm");

function renderEstadoLastfm() {
  if (!seccionLastfm) return;
  if (!LASTFM_ACTIVO) { seccionLastfm.classList.add("hidden"); return; }
  seccionLastfm.classList.remove("hidden");

  const conectado = perfilActual.lastfmConectado;
  textoEstadoLastfm.textContent = conectado
    ? `Conectado como ${perfilActual.lastfmUsername} en Last.fm.`
    : "Conecta tu cuenta de Last.fm para mostrar tus estadÃ­sticas de escucha (top artistas, Ã¡lbumes y canciones).";

  inputUsernameLastfm.classList.toggle("hidden", conectado);
  btnConectarLastfm.classList.toggle("hidden", conectado);
  btnDesconectarLastfm.classList.toggle("hidden", !conectado);
  if (selectPrivacidadLastfm) selectPrivacidadLastfm.classList.toggle("hidden", !conectado);
  if (selectPrivacidadLastfm) selectPrivacidadLastfm.value = perfilActual.privacidadLastfm || "amigos";
}

if (btnConectarLastfm) {
  btnConectarLastfm.addEventListener("click", async () => {
    msgLastfm.style.display = "none";
    btnConectarLastfm.disabled = true;
    try {
      const username = await conectarLastfm(usuarioActual.uid, inputUsernameLastfm.value);
      perfilActual.lastfmConectado = true;
      perfilActual.lastfmUsername = username;
      inputUsernameLastfm.value = "";
      renderEstadoLastfm();
      actualizarStatsLastfmEnPerfil(usuarioActual.uid); // primera carga de stats, en segundo plano
      msgLastfm.textContent = "Â¡Cuenta de Last.fm conectada!";
      msgLastfm.className = "field-msg ok";
      msgLastfm.style.display = "block";
    } catch (err) {
      msgLastfm.textContent = err.message;
      msgLastfm.className = "field-msg error";
      msgLastfm.style.display = "block";
    }
    btnConectarLastfm.disabled = false;
  });
}

if (btnDesconectarLastfm) {
  btnDesconectarLastfm.addEventListener("click", async () => {
    if (!confirm("Â¿Desconectar tu cuenta de Last.fm? Se dejarÃ¡n de mostrar tus estadÃ­sticas de escucha.")) return;
    await desconectarLastfm(usuarioActual.uid);
    perfilActual.lastfmConectado = false;
    perfilActual.lastfmUsername = null;
    renderEstadoLastfm();
  });
}

// ============ RECOMENDACIONES CON IA (Gemini vÃ­a Cloudflare Worker) ============
// Oculto mientras IA_ACTIVA sea false en ia-recomendaciones.js. Requiere
// Last.fm conectado, porque las stats de ahÃ­ son el insumo del prompt.

const seccionIA = document.getElementById("seccionRecomendacionIA");
const btnPedirRecomendacionIA = document.getElementById("btnPedirRecomendacionIA");
const listaRecomendacionIA = document.getElementById("listaRecomendacionIA");
const msgRecomendacionIA = document.getElementById("msgRecomendacionIA");

function renderSeccionIA() {
  if (!seccionIA) return;
  const debeMostrarse = IA_ACTIVA && LASTFM_ACTIVO && perfilActual.lastfmConectado;
  seccionIA.classList.toggle("hidden", !debeMostrarse);
  if (!debeMostrarse) return;

  if (perfilActual.iaRecomendacion) {
    listaRecomendacionIA.textContent = perfilActual.iaRecomendacion;
    listaRecomendacionIA.classList.remove("hidden");
  } else {
    listaRecomendacionIA.classList.add("hidden");
  }
}

if (btnPedirRecomendacionIA) {
  btnPedirRecomendacionIA.addEventListener("click", async () => {
    if (!perfilActual.lastfmStats) {
      msgRecomendacionIA.textContent = "Espera a que se carguen tus estadÃ­sticas de Last.fm primero (unos segundos tras conectar).";
      msgRecomendacionIA.className = "field-msg error";
      msgRecomendacionIA.style.display = "block";
      return;
    }
    btnPedirRecomendacionIA.disabled = true;
    msgRecomendacionIA.style.display = "none";
    try {
      const recomendacion = await pedirRecomendacionIA(usuarioActual.uid, perfilActual.lastfmStats, true);
      perfilActual.iaRecomendacion = recomendacion;
      renderSeccionIA();
    } catch (err) {
      msgRecomendacionIA.textContent = err.message;
      msgRecomendacionIA.className = "field-msg error";
      msgRecomendacionIA.style.display = "block";
    }
    btnPedirRecomendacionIA.disabled = false;
  });
}



const gridBanners = document.getElementById("gridBanners");
const gridEfectos = document.getElementById("gridEfectos");
const msgPersonalizacion = document.getElementById("msgPersonalizacion");
const previewPerfilPersonalizado = document.getElementById("previewPerfilPersonalizado");
const canvasPreviewEfecto = document.getElementById("canvasPreviewEfecto");
const inputBannerArchivo = document.getElementById("inputBannerArchivo");

function mostrarMsgPersonalizacion(texto, esError) {
  msgPersonalizacion.textContent = texto;
  msgPersonalizacion.className = "msg " + (esError ? "error" : "ok");
}

inputBannerArchivo.addEventListener("change", async () => {
  const archivo = inputBannerArchivo.files[0];
  if (!archivo) return;

  mostrarMsgPersonalizacion("Comprimiendo y subiendo tu banner...", false);
  try {
    const url = await subirImagen(archivo, "banners");
    await equiparBannerPersonalizado(usuarioActual.uid, url);
    perfilActual.bannerActivo = BANNER_PERSONALIZADO_ID;
    perfilActual.bannerPersonalizadoURL = url;
    mostrarMsgPersonalizacion("Banner actualizado.", false);
    renderPersonalizacion();
    renderPreviewBanner();
  } catch (err) {
    mostrarMsgPersonalizacion(err.message, true);
  }
  inputBannerArchivo.value = "";
});

// Pinta el banner activo (catÃ¡logo o imagen personalizada) + efectos sobre
// CUALQUIER contenedor/canvas dado â€” se usa tanto para el header superior
// (bannerHeaderPerfil, de solo vista previa) como para el editor de
// personalizaciÃ³n mÃ¡s abajo (previewPerfilPersonalizado, donde se elige).
function pintarBannerEnContenedor(contenedor, canvas) {
  const bannerId = perfilActual.bannerActivo || "banner-basico-azul";

  if (bannerId === BANNER_PERSONALIZADO_ID && perfilActual.bannerPersonalizadoURL) {
    contenedor.style.background = `url("${perfilActual.bannerPersonalizadoURL}") center/cover no-repeat`;
    canvas.style.display = "none";
    const efectosActivos = perfilActual.efectosActivos || [];
    aplicarEfectosActivos(contenedor, canvas, efectosActivos, CATALOGO_EFECTOS);
    return;
  }

  const banner = CATALOGO_BANNERS.find(b => b.id === bannerId) || CATALOGO_BANNERS[0];
  contenedor.style.background = banner.tipo === "gradiente" ? banner.valor : "#10182a";

  const efectosActivos = perfilActual.efectosActivos || [];
  aplicarEfectosActivos(contenedor, canvas, efectosActivos, CATALOGO_EFECTOS);

  if (banner.tipo === "canvas") {
    canvas.style.display = "block";
    iniciarEfectoCanvas(canvas, banner.valor);
  }
}

const bannerHeaderPerfil = document.getElementById("bannerHeaderPerfil");
const canvasHeaderPerfil = document.getElementById("canvasHeaderPerfil");

function renderBannerHeader() {
  if (!bannerHeaderPerfil || !canvasHeaderPerfil) return;
  pintarBannerEnContenedor(bannerHeaderPerfil, canvasHeaderPerfil);
}

function renderPreviewBanner() {
  pintarBannerEnContenedor(previewPerfilPersonalizado, canvasPreviewEfecto);
  renderBannerHeader();
}

function renderPersonalizacion() {
  const bannersDesbloqueados = perfilActual.bannersDesbloqueados || [];
  const efectosDesbloqueados = perfilActual.efectosDesbloqueados || [];
  const efectosActivos = perfilActual.efectosActivos || [];
  const bannerActivo = perfilActual.bannerActivo || "banner-basico-azul";

  // Tarjeta especial de "imagen personalizada", siempre primera en el grid.
  // Se ve activa si el usuario ya la equipÃ³, sin importar si tiene o no una
  // imagen subida todavÃ­a (el botÃ³n sirve tanto para subir la primera vez
  // como para reemplazarla despuÃ©s).
  const bannerPersonalizadoActivo = bannerActivo === BANNER_PERSONALIZADO_ID;
  const swatchPersonalizado = perfilActual.bannerPersonalizadoURL
    ? `background:url("${perfilActual.bannerPersonalizadoURL}") center/cover no-repeat;`
    : "background:linear-gradient(135deg,#333,#555);";

  gridBanners.innerHTML = `
    <button type="button" class="banner-item ${bannerPersonalizadoActivo ? "activo" : ""}" id="btnBannerPersonalizado">
      <div class="swatch" style="${swatchPersonalizado}"></div>
      <div>ðŸ“· Mi imagen</div>
      <div class="costo">${perfilActual.bannerPersonalizadoURL ? "Toca para cambiar" : "Subir desde tu dispositivo"}</div>
    </button>
  ` + CATALOGO_BANNERS.filter(b => !b.exclusivo || bannersDesbloqueados.includes(b.id)).map(b => {
    const desbloqueado = b.costoOx2 === 0 || bannersDesbloqueados.includes(b.id);
    return `
      <button type="button" class="banner-item ${b.id === bannerActivo ? "activo" : ""} ${desbloqueado ? "" : "bloqueado"}" data-banner="${b.id}" data-desbloqueado="${desbloqueado}">
        <div class="swatch" style="background:${b.tipo === "gradiente" ? b.valor : "linear-gradient(135deg,#333,#555)"};"></div>
        <div>${b.nombre}</div>
        <div class="costo">${b.exclusivo ? "ðŸ”’ Exclusivo" : desbloqueado ? "Desbloqueado" : `${b.costoOx2} Ox2`}</div>
      </button>
    `;
  }).join("");

  document.getElementById("btnBannerPersonalizado").addEventListener("click", () => inputBannerArchivo.click());

  // Los efectos se muestran con checkbox visual (pueden estar VARIOS "activos" a
  // la vez), a diferencia de los banners donde solo uno puede estarlo.
  gridEfectos.innerHTML = CATALOGO_EFECTOS.map(e => {
    const desbloqueado = e.costoOx2 === 0 || efectosDesbloqueados.includes(e.id);
    const activo = efectosActivos.includes(e.id);
    return `
      <button type="button" class="efecto-item ${activo ? "activo" : ""} ${desbloqueado ? "" : "bloqueado"}" data-efecto="${e.id}" data-desbloqueado="${desbloqueado}">
        <div>${activo ? "âœ“ " : ""}${e.nombre}</div>
        <div class="costo">${desbloqueado ? (activo ? "Activo â€” toca para quitar" : "Toca para activar") : `${e.costoOx2} Ox2`}</div>
      </button>
    `;
  }).join("");

  gridBanners.querySelectorAll("[data-banner]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const bannerId = btn.dataset.banner;
      const desbloqueado = btn.dataset.desbloqueado === "true";
      try {
        if (!desbloqueado) {
          if (!confirm(`Â¿Desbloquear este banner? Se descontarÃ¡ su costo en Ox2.`)) return;
          await comprarBanner(usuarioActual.uid, bannerId);
          perfilActual.bannersDesbloqueados = [...(perfilActual.bannersDesbloqueados || []), bannerId];
        }
        await equiparBanner(usuarioActual.uid, bannerId);
        perfilActual.bannerActivo = bannerId;
        mostrarMsgPersonalizacion("Banner actualizado.", false);
        renderPersonalizacion();
        renderPreviewBanner();
      } catch (err) {
        mostrarMsgPersonalizacion(err.message, true);
      }
    });
  });

  gridEfectos.querySelectorAll("[data-efecto]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const efectoId = btn.dataset.efecto;
      const desbloqueado = btn.dataset.desbloqueado === "true";
      try {
        if (!desbloqueado) {
          if (!confirm(`Â¿Desbloquear este efecto? Se descontarÃ¡ su costo en Ox2. PodrÃ¡s combinarlo con otros efectos que ya tengas.`)) return;
          await comprarEfecto(usuarioActual.uid, efectoId);
          perfilActual.efectosDesbloqueados = [...(perfilActual.efectosDesbloqueados || []), efectoId];
        }
        const nuevosActivos = await alternarEfectoActivo(usuarioActual.uid, efectoId);
        perfilActual.efectosActivos = nuevosActivos;
        mostrarMsgPersonalizacion("Efectos actualizados.", false);
        renderPersonalizacion();
        renderPreviewBanner();
      } catch (err) {
        mostrarMsgPersonalizacion(err.message, true);
      }
    });
  });

  renderPreviewBanner();
}

// ============ ESTADO DE PRESENCIA (En lÃ­nea / Jugando / No molestar / etc.) ============

function renderEstadoChipPropio() {
  const chip = document.getElementById("estadoChipPropio");
  if (!chip) return;
  const estado = calcularEstadoVisible(perfilActual);
  chip.textContent = `${estado.emoji} ${estado.etiqueta}`;
  chip.style.color = estado.color;
}

function renderSelectorEstadoManual() {
  const lista = document.getElementById("listaEstadosManual");
  if (!lista) return;
  const actual = perfilActual.estadoManual || null;

  lista.innerHTML = `
    <button type="button" class="estado-opcion ${!actual ? "activo" : ""}" data-estado="">
      ðŸŸ¢ AutomÃ¡tico (En lÃ­nea / Desconectado)
    </button>
  ` + CATALOGO_ESTADOS.map(e => `
    <button type="button" class="estado-opcion ${actual === e.id ? "activo" : ""}" data-estado="${e.id}">
      ${e.emoji} ${e.etiqueta}
    </button>
  `).join("");

  const campoPersonalizado = document.getElementById("campoEstadoPersonalizado");
  campoPersonalizado.classList.toggle("hidden", actual !== "personalizado");
  document.getElementById("inputEstadoPersonalizado").value = perfilActual.estadoPersonalizadoTexto || "";

  lista.querySelectorAll("[data-estado]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.estado || null;
      if (id === "personalizado") {
        campoPersonalizado.classList.remove("hidden");
        document.getElementById("inputEstadoPersonalizado").focus();
        return; // espera a que el usuario escriba y confirme con btnGuardarEstadoPersonalizado
      }
      try {
        await elegirEstadoManual(usuarioActual.uid, id);
        perfilActual.estadoManual = id;
        perfilActual.estadoPersonalizadoTexto = null;
        renderEstadoChipPropio();
        renderSelectorEstadoManual();
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  });
}

const btnGuardarEstadoPersonalizado = document.getElementById("btnGuardarEstadoPersonalizado");
if (btnGuardarEstadoPersonalizado) {
  btnGuardarEstadoPersonalizado.addEventListener("click", async () => {
    const texto = document.getElementById("inputEstadoPersonalizado").value;
    try {
      await elegirEstadoManual(usuarioActual.uid, "personalizado", texto);
      perfilActual.estadoManual = "personalizado";
      perfilActual.estadoPersonalizadoTexto = texto.trim().slice(0, 40);
      renderEstadoChipPropio();
      renderSelectorEstadoManual();
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
}