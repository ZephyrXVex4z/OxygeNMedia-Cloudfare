// espectro.js — Visualizador decorativo de barras/ondas tipo ecualizador.
//
// IMPORTANTE: no está sincronizado al audio real (Spotify no expone eso vía su
// API pública ni hay forma de leer el audio del dispositivo del usuario desde
// aquí). Es una animación ambiental que simplemente "se mueve" mientras
// datos.reproduciendo === true, y se congela/atenúa en pausa — exactamente como
// se especificó.
//
// Un solo requestAnimationFrame vivo por instancia; se detiene por completo
// (cancelAnimationFrame) cuando la pestaña está oculta, cuando está pausado el
// nivel de animación es "ninguna", o cuando prefers-reduced-motion está activo.

const ESTILOS = ["barras", "ondas", "circular"];

export function crearEspectro(canvas, opciones = {}) {
  const ctx = canvas.getContext("2d");
  let dpr = window.devicePixelRatio || 1;
  let ancho = 0, alto = 0;
  let rafId = null;
  let activo = false;
  let reproduciendo = false;
  let tiempoBase = performance.now();

  const estado = {
    estilo: opciones.estilo || "barras",
    color: opciones.color || "#5b8def",
    intensidad: opciones.intensidad ?? 1 // 0.4 (sutil) a 1.4 (intenso), ajustable desde ajustes
  };

  const NUM_BARRAS = 28;
  // Fases/semillas fijas por barra para que el movimiento se vea orgánico sin
  // ser aleatorio en cada frame (aleatorio por frame = parpadeo feo).
  const semillas = Array.from({ length: NUM_BARRAS }, () => Math.random() * Math.PI * 2);

  function redimensionar() {
    const rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    ancho = rect.width;
    alto = rect.height;
    canvas.width = Math.max(1, Math.round(ancho * dpr));
    canvas.height = Math.max(1, Math.round(alto * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const resizeObserver = new ResizeObserver(redimensionar);
  resizeObserver.observe(canvas);
  redimensionar();

  function dibujarBarras(t) {
    ctx.clearRect(0, 0, ancho, alto);
    const anchoBarra = ancho / NUM_BARRAS;
    const nivelActividad = reproduciendo ? 1 : 0.18; // en pausa: casi plano, no "muerto"

    for (let i = 0; i < NUM_BARRAS; i++) {
      const fase = semillas[i] + t * 0.0016 * (reproduciendo ? 1 : 0.3);
      const base = (Math.sin(fase) * 0.5 + 0.5);
      const h = Math.max(2, base * alto * 0.85 * estado.intensidad * nivelActividad);
      const x = i * anchoBarra + anchoBarra * 0.18;
      const w = anchoBarra * 0.64;
      ctx.fillStyle = estado.color;
      ctx.globalAlpha = 0.55 + base * 0.35;
      const radio = Math.min(w / 2, 3);
      dibujarRectRedondeado(ctx, x, alto - h, w, h, radio);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function dibujarOndas(t) {
    ctx.clearRect(0, 0, ancho, alto);
    const nivelActividad = reproduciendo ? 1 : 0.15;
    const capas = 3;
    for (let c = 0; c < capas; c++) {
      ctx.beginPath();
      const amplitud = (alto * 0.18) * estado.intensidad * nivelActividad * (1 - c * 0.22);
      const velocidad = 0.0012 + c * 0.0004;
      const frecuencia = 0.018 + c * 0.006;
      for (let x = 0; x <= ancho; x += 4) {
        const y = alto / 2 +
          Math.sin(x * frecuencia + t * velocidad * (reproduciendo ? 1 : 0.25) + c * 2) * amplitud;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = estado.color;
      ctx.globalAlpha = 0.5 - c * 0.12;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function dibujarCircular(t) {
    ctx.clearRect(0, 0, ancho, alto);
    const cx = ancho / 2, cy = alto / 2;
    const radioBase = Math.min(ancho, alto) / 2 * 0.7;
    const nivelActividad = reproduciendo ? 1 : 0.15;
    const puntos = 40;

    ctx.beginPath();
    for (let i = 0; i <= puntos; i++) {
      const ang = (i / puntos) * Math.PI * 2;
      const ruido = Math.sin(ang * 5 + t * 0.0018 * (reproduciendo ? 1 : 0.25)) * 0.5 + 0.5;
      const r = radioBase + ruido * radioBase * 0.22 * estado.intensidad * nivelActividad;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = estado.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function dibujarRectRedondeado(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function frame(t) {
    if (!activo) return;
    const dibujantes = { barras: dibujarBarras, ondas: dibujarOndas, circular: dibujarCircular };
    (dibujantes[estado.estilo] || dibujarBarras)(t - tiempoBase);
    rafId = requestAnimationFrame(frame);
  }

  return {
    iniciar() {
      if (activo) return;
      activo = true;
      tiempoBase = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    detener() {
      activo = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    },
    destruir() {
      this.detener();
      resizeObserver.disconnect();
    },
    setReproduciendo(valor) { reproduciendo = !!valor; },
    setEstilo(estilo) { if (ESTILOS.includes(estilo)) estado.estilo = estilo; },
    setColor(color) { estado.color = color; },
    setIntensidad(valor) { estado.intensidad = Math.max(0.3, Math.min(1.6, valor)); }
  };
}

export const ESTILOS_ESPECTRO = ESTILOS;
