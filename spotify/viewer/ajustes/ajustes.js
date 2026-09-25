// ajustes.js — Página de configuración del Spotify Viewer.
// Todo se guarda en localStorage vía ajustes-shared.js (ver ese archivo para
// justificación de por qué no usa Firestore).

import { leerAjustesViewer, guardarAjustesViewer, AJUSTES_DEFAULT } from "../ajustes-shared.js";

let ajustes = leerAjustesViewer();

const msgGuardado = document.getElementById("msgGuardado");

function mostrarGuardado() {
  msgGuardado.classList.add("visible");
  setTimeout(() => msgGuardado.classList.remove("visible"), 1400);
}

function persistir() {
  guardarAjustesViewer(ajustes);
  mostrarGuardado();
}

// ============ HELPERS DE RENDER ============

function crearFilaCheck(clave, etiqueta) {
  const fila = document.createElement("div");
  fila.className = "fila-check";
  const idInput = "chk_" + clave;
  fila.innerHTML = `
    <label for="${idInput}" style="cursor:pointer;">${etiqueta}</label>
    <label class="switch">
      <input type="checkbox" id="${idInput}" ${ajustes[clave] ? "checked" : ""}>
      <span class="slider"></span>
    </label>
  `;
  fila.querySelector("input").addEventListener("change", (e) => {
    ajustes[clave] = e.target.checked;
    persistir();
  });
  return fila;
}

function crearFilaSelect(clave, etiqueta, opciones) {
  const fila = document.createElement("div");
  fila.className = "fila-select";
  const idSelect = "sel_" + clave;
  const optionsHtml = opciones.map(o =>
    `<option value="${o.valor}" ${ajustes[clave] === o.valor ? "selected" : ""}>${o.texto}</option>`
  ).join("");
  fila.innerHTML = `
    <label for="${idSelect}">${etiqueta}</label>
    <select id="${idSelect}">${optionsHtml}</select>
  `;
  fila.querySelector("select").addEventListener("change", (e) => {
    ajustes[clave] = e.target.value;
    persistir();
  });
  return fila;
}

// ============ GRUPO: INFORMACIÓN ============

function renderInfo() {
  const cont = document.getElementById("grupoInfo");
  cont.innerHTML = "";
  cont.appendChild(crearFilaCheck("mostrarPortada", "Mostrar portada"));
  cont.appendChild(crearFilaCheck("mostrarCancion", "Mostrar nombre de canción"));
  cont.appendChild(crearFilaCheck("mostrarArtista", "Mostrar artista"));
  cont.appendChild(crearFilaCheck("mostrarAlbum", "Mostrar álbum"));
  cont.appendChild(crearFilaCheck("mostrarDuracion", "Mostrar duración"));
  cont.appendChild(crearFilaCheck("mostrarBoton", 'Mostrar botón "Escuchar en Spotify"'));
}

// ============ GRUPO: VISUALES ============

function renderVisuales() {
  const cont = document.getElementById("grupoVisuales");
  cont.innerHTML = "";
  cont.appendChild(crearFilaCheck("fondoDinamico", "Fondo dinámico"));
  cont.appendChild(crearFilaCheck("blur", "Blur"));
  cont.appendChild(crearFilaCheck("glow", "Glow"));
  cont.appendChild(crearFilaCheck("particulas", "Partículas"));
  cont.appendChild(crearFilaCheck("animCambioCancion", "Animación al cambiar de canción"));
}

// ============ GRUPO: ANIMACIONES ============

function renderAnimaciones() {
  const cont = document.getElementById("grupoAnimaciones");
  cont.innerHTML = "";
  cont.appendChild(crearFilaSelect("animaciones", "Nivel", [
    { valor: "auto", texto: "Automático" },
    { valor: "ligero", texto: "Ligero" },
    { valor: "medio", texto: "Medio" },
    { valor: "potente", texto: "Potente" },
    { valor: "ninguna", texto: "Sin animaciones" }
  ]));
}

// ============ GRUPO: PORTADA ============

function renderPortada() {
  const cont = document.getElementById("grupoPortada");
  cont.innerHTML = "";
  cont.appendChild(crearFilaSelect("tamanoPortada", "Tamaño", [
    { valor: "grande", texto: "Grande" },
    { valor: "mediana", texto: "Mediana" },
    { valor: "pequena", texto: "Pequeña" },
    { valor: "oculta", texto: "Ocultar" }
  ]));
}

// ============ GRUPO: DISEÑO ============

function renderDiseno() {
  const cont = document.getElementById("grupoDiseno");
  cont.innerHTML = "";
  cont.appendChild(crearFilaSelect("diseno", "Distribución", [
    { valor: "centrado", texto: "Centrado" },
    { valor: "compacto", texto: "Compacto" },
    { valor: "tarjeta", texto: "Tarjeta" },
    { valor: "fullscreen", texto: "Fullscreen" }
  ]));
}

function renderTodo() {
  renderInfo();
  renderVisuales();
  renderAnimaciones();
  renderPortada();
  renderDiseno();
}

renderTodo();

// ============ RESTABLECER ============

document.getElementById("btnRestablecer").addEventListener("click", () => {
  if (!confirm("¿Restablecer todos los ajustes del Viewer a sus valores predeterminados?")) return;
  ajustes = { ...AJUSTES_DEFAULT };
  guardarAjustesViewer(ajustes);
  renderTodo();
  mostrarGuardado();
});
