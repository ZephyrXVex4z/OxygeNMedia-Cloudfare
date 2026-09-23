// perfil-efectos.js
// Implementación visual de cada efecto de perfil. La mayoría se hacen con divs +
// animaciones CSS puras (mismo enfoque que "lluvia", "humo" y "partículas" que ya
// veníamos usando) — es más ligero que canvas con requestAnimationFrame porque el
// navegador anima con su propio compositor, sin JS corriendo en cada frame. Solo
// "fuego" y "galaxia" usan canvas, porque ese estilo de partícula aleatoria y
// colores mezclándose se ve mejor así.
//
// Los efectos se pueden COMBINAR: iniciarEfectoDom() no reemplaza lo que ya hay,
// solo agrega o quita el efecto pedido, así que varios pueden convivir en el mismo
// contenedor a la vez (ej. lluvia + estrellas).

// ============ EFECTOS CSS PUROS (una sola clase, sin JS de por medio) ============

export function aplicarEfectoCSS(contenedor, tipo, activar) {
  contenedor.classList.toggle(tipo, activar);
}

// ============ EFECTOS DOM (divs generados + animación CSS) ============

const GENERADORES_DOM = {
  "dom-lluvia": (capa) => {
    const cantidad = 60;
    for (let i = 0; i < cantidad; i++) {
      const gota = document.createElement("div");
      gota.className = "fx-gota";
      gota.style.left = Math.random() * 100 + "%";
      gota.style.animationDuration = (0.5 + Math.random() * 0.8) + "s";
      gota.style.animationDelay = Math.random() * 2 + "s";
      gota.style.opacity = 0.2 + Math.random() * 0.6;
      capa.appendChild(gota);
    }
  },
  "dom-nieve": (capa) => {
    const cantidad = 40;
    for (let i = 0; i < cantidad; i++) {
      const copo = document.createElement("div");
      copo.className = "fx-copo";
      const tam = 2 + Math.random() * 4;
      copo.style.width = tam + "px";
      copo.style.height = tam + "px";
      copo.style.left = Math.random() * 100 + "%";
      copo.style.animationDuration = (4 + Math.random() * 5) + "s";
      copo.style.animationDelay = Math.random() * 6 + "s";
      copo.style.opacity = 0.4 + Math.random() * 0.5;
      capa.appendChild(copo);
    }
  },
  "dom-estrellas": (capa) => {
    const cantidad = 45;
    for (let i = 0; i < cantidad; i++) {
      const e = document.createElement("div");
      e.className = "fx-estrella";
      e.style.left = Math.random() * 100 + "%";
      e.style.top = Math.random() * 100 + "%";
      e.style.animationDuration = (1.5 + Math.random() * 2.5) + "s";
      e.style.animationDelay = Math.random() * 3 + "s";
      capa.appendChild(e);
    }
  },
  "dom-humo": (capa) => {
    const cantidad = 7;
    for (let i = 0; i < cantidad; i++) {
      const s = document.createElement("div");
      s.className = "fx-humo";
      s.style.left = (Math.random() * 100 - 10) + "%";
      s.style.bottom = (-60 + Math.random() * 40) + "px";
      s.style.animationDuration = (7 + Math.random() * 6) + "s";
      s.style.animationDelay = Math.random() * 6 + "s";
      capa.appendChild(s);
    }
  },
  "dom-particulas": (capa) => {
    const cantidad = 50;
    for (let i = 0; i < cantidad; i++) {
      const p = document.createElement("div");
      p.className = "fx-particula";
      const tam = 2 + Math.random() * 3;
      p.style.width = tam + "px";
      p.style.height = tam + "px";
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDuration = (4 + Math.random() * 6) + "s";
      p.style.animationDelay = Math.random() * 6 + "s";
      capa.appendChild(p);
    }
  },
  "dom-burbujas": (capa) => {
    const cantidad = 25;
    for (let i = 0; i < cantidad; i++) {
      const b = document.createElement("div");
      b.className = "fx-burbuja";
      const tam = 6 + Math.random() * 14;
      b.style.width = tam + "px";
      b.style.height = tam + "px";
      b.style.left = Math.random() * 100 + "%";
      b.style.animationDuration = (4 + Math.random() * 5) + "s";
      b.style.animationDelay = Math.random() * 5 + "s";
      capa.appendChild(b);
    }
  },
  "dom-hojas": (capa) => {
    const emojis = ["🍁", "🍂"];
    const cantidad = 18;
    for (let i = 0; i < cantidad; i++) {
      const h = document.createElement("div");
      h.className = "fx-hoja";
      h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      h.style.left = Math.random() * 100 + "%";
      h.style.fontSize = (12 + Math.random() * 8) + "px";
      h.style.animationDuration = (5 + Math.random() * 5) + "s";
      h.style.animationDelay = Math.random() * 6 + "s";
      capa.appendChild(h);
    }
  },
  "dom-petalos": (capa) => {
    const cantidad = 22;
    for (let i = 0; i < cantidad; i++) {
      const p = document.createElement("div");
      p.className = "fx-petalo";
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDuration = (5 + Math.random() * 4) + "s";
      p.style.animationDelay = Math.random() * 5 + "s";
      capa.appendChild(p);
    }
  },
  "dom-confeti": (capa) => {
    const colores = ["#ff5e7e", "#5b8def", "#e0a941", "#4caf7d", "#8b5cf6"];
    const cantidad = 40;
    for (let i = 0; i < cantidad; i++) {
      const c = document.createElement("div");
      c.className = "fx-confeti";
      c.style.left = Math.random() * 100 + "%";
      c.style.background = colores[Math.floor(Math.random() * colores.length)];
      c.style.animationDuration = (2.5 + Math.random() * 2) + "s";
      c.style.animationDelay = Math.random() * 3 + "s";
      capa.appendChild(c);
    }
  },
  "dom-rayos": (capa) => {
    const cantidad = 4;
    for (let i = 0; i < cantidad; i++) {
      const r = document.createElement("div");
      r.className = "fx-rayo";
      r.style.left = (10 + Math.random() * 80) + "%";
      r.style.animationDelay = Math.random() * 4 + "s";
      capa.appendChild(r);
    }
  },
  "dom-matrix": (capa) => {
    const caracteres = "01アイウエオカキクケコ";
    const columnas = 16;
    for (let i = 0; i < columnas; i++) {
      const col = document.createElement("div");
      col.className = "fx-matrix-col";
      col.style.left = (i / columnas * 100) + "%";
      col.style.animationDuration = (3 + Math.random() * 3) + "s";
      col.style.animationDelay = Math.random() * 4 + "s";
      let texto = "";
      for (let j = 0; j < 12; j++) texto += caracteres[Math.floor(Math.random() * caracteres.length)] + "<br>";
      col.innerHTML = texto;
      capa.appendChild(col);
    }
  },
  "dom-nyancat": (capa) => {
    // Personaje propio inspirado en el concepto (gato + estela arcoíris), no una
    // copia del sprite original de Nyan Cat.
    const estela = document.createElement("div");
    estela.className = "fx-nyan-estela";
    capa.appendChild(estela);

    const gato = document.createElement("div");
    gato.className = "fx-nyan-gato";
    gato.innerHTML = `
      <div class="fx-nyan-cuerpo"></div>
      <div class="fx-nyan-cara">
        <div class="fx-nyan-ojo"></div><div class="fx-nyan-ojo"></div>
        <div class="fx-nyan-mejilla"></div><div class="fx-nyan-mejilla"></div>
      </div>
    `;
    capa.appendChild(gato);
  }
};

export function iniciarEfectoDom(contenedor, tipo, activar) {
  let capa = contenedor.querySelector(`[data-fx="${tipo}"]`);

  if (!activar) {
    if (capa) capa.remove();
    return;
  }

  if (capa) return; // ya está activo, no duplicar
  if (!GENERADORES_DOM[tipo]) return;

  capa = document.createElement("div");
  capa.className = "fx-capa";
  capa.dataset.fx = tipo;
  contenedor.appendChild(capa);
  GENERADORES_DOM[tipo](capa);
}

// Quita TODAS las capas de efectos dom-* de un contenedor (usado al cambiar de
// perfil, por ejemplo, para no ir acumulando efectos de perfiles anteriores).
export function limpiarEfectosDom(contenedor) {
  contenedor.querySelectorAll(".fx-capa").forEach(el => el.remove());
  contenedor.classList.remove("css-brillo", "css-arcoiris");
}

// ============ EFECTOS CANVAS (fuego y galaxia — se ven mejor con partículas random) ============

const animacionesActivas = {}; // { tipo: requestAnimationFrame id }

export function detenerEfectoCanvas(tipo) {
  if (animacionesActivas[tipo]) {
    cancelAnimationFrame(animacionesActivas[tipo]);
    delete animacionesActivas[tipo];
  }
}

export function detenerTodosLosCanvas() {
  Object.keys(animacionesActivas).forEach(detenerEfectoCanvas);
}

function prepararCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return { ctx, ancho: rect.width, alto: rect.height };
}

export function iniciarEfectoCanvas(canvas, tipo) {
  const { ctx, ancho, alto } = prepararCanvas(canvas);
  if (tipo === "canvas-fuego") iniciarFuego(ctx, ancho, alto, tipo);
  else if (tipo === "canvas-galaxia") iniciarGalaxia(ctx, ancho, alto, tipo);
}

function iniciarFuego(ctx, ancho, alto, tipo) {
  // Más denso, con más variación de tamaño/color, y ocupando todo el ancho del
  // banner (no solo el centro) para que se note en una tarjeta ancha en vez de
  // verse como una fogata diminuta como en la versión anterior.
  const crearParticula = () => ({
    x: Math.random() * ancho,
    y: alto + Math.random() * 20,
    radio: 3 + Math.random() * 7,
    velocidadY: 1.2 + Math.random() * 2.2,
    deriva: (Math.random() - 0.5) * 1.5,
    vida: 1,
    decaimiento: 0.008 + Math.random() * 0.012
  });
  const particulas = Array.from({ length: 70 }, crearParticula);

  function dibujar() {
    ctx.clearRect(0, 0, ancho, alto);
    ctx.globalCompositeOperation = "lighter";
    for (const p of particulas) {
      const t = p.vida;
      const g = Math.round(90 + 140 * t);
      const b = Math.round(20 * t);
      ctx.fillStyle = `rgba(255,${g},${b},${t * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radio * t, 0, Math.PI * 2);
      ctx.fill();

      p.y -= p.velocidadY;
      p.x += p.deriva;
      p.vida -= p.decaimiento;
      if (p.vida <= 0) Object.assign(p, crearParticula());
    }
    ctx.globalCompositeOperation = "source-over";
    animacionesActivas[tipo] = requestAnimationFrame(dibujar);
  }
  dibujar();
}

function iniciarGalaxia(ctx, ancho, alto, tipo) {
  const puntos = Array.from({ length: 70 }, (_, i) => ({
    angulo: (i / 70) * Math.PI * 8,
    radio: (i / 70) * Math.min(ancho, alto) * 0.48,
    velocidad: 0.002 + Math.random() * 0.003,
    tamano: 1 + Math.random() * 2
  }));
  const cx = ancho / 2, cy = alto / 2;

  function dibujar() {
    ctx.clearRect(0, 0, ancho, alto);
    for (const p of puntos) {
      p.angulo += p.velocidad;
      const x = cx + Math.cos(p.angulo) * p.radio;
      const y = cy + Math.sin(p.angulo) * p.radio * 0.5;
      ctx.fillStyle = "rgba(200, 180, 255, 0.7)";
      ctx.beginPath();
      ctx.arc(x, y, p.tamano, 0, Math.PI * 2);
      ctx.fill();
    }
    animacionesActivas[tipo] = requestAnimationFrame(dibujar);
  }
  dibujar();
}

// ============ APLICAR UN CONJUNTO DE EFECTOS ACTIVOS A UN CONTENEDOR ============
// Punto de entrada único: recibe el contenedor, el <canvas> a usar para los efectos
// canvas-*, y el array de IDs de efecto activos — prende/apaga cada capa según
// corresponda, sin duplicar ni dejar basura de efectos que ya no aplican.

export function aplicarEfectosActivos(contenedor, canvas, efectosActivos, catalogoEfectos) {
  limpiarEfectosDom(contenedor);
  detenerTodosLosCanvas();
  canvas.style.display = "none";

  for (const efectoId of efectosActivos) {
    const efecto = catalogoEfectos.find(e => e.id === efectoId);
    if (!efecto) continue;

    if (efecto.tipo.startsWith("css-")) {
      aplicarEfectoCSS(contenedor, efecto.tipo, true);
    } else if (efecto.tipo.startsWith("dom-")) {
      iniciarEfectoDom(contenedor, efecto.tipo, true);
    } else if (efecto.tipo.startsWith("canvas-")) {
      canvas.style.display = "block";
      iniciarEfectoCanvas(canvas, efecto.tipo);
    }
  }
}
