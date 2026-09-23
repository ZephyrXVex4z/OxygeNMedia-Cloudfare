'use strict';

import { observarSesion } from "../auth.js";
import {
  obtenerSaldoOx3, obtenerClicksStarEgg, sincronizarClicksStarEgg,
  reclamarRecompensasStarEgg, HITOS_STAR_EGG,
  obtenerEnergiaStarEgg, obtenerBoostersStarEgg, sincronizarEnergiaStarEgg,
  comprarBoosterStarEgg, canjearEnergiaPorOx3, BOOSTERS_STAR_EGG
} from "../ox3.js";

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- Estado ---------------- */
const state = {
  usuario: null,          // { uid, nombre } una vez logueado, si no null
  clicksConocidos: 0,     // mejor número conocido (server si hay sesión; local si no)
  clicksPendientes: 0,    // clicks de este batch aún no sincronizados a Firestore
  ox3Balance: 0,
  energiaConocida: 0,     // ENERGY real (server si hay sesión; local si no) — canjeable por Ox3
  energiaPendiente: 0,    // suma de energía de este batch aún no sincronizada
  boosters: [],           // ids de boosters comprados (server)
  dangerPresses: 0,
  eggZoneClicks: 0,
  soundOn: false,
  chaosActive: false,
  achievements: new Set(),
  secrets: new Set(),
  sincronizando: false,
  sincronizandoEnergia: false
};

/* ---------------- DOM refs ---------------- */
const el = {
  bgCanvas: document.getElementById('bg-canvas'),
  soundToggle: document.getElementById('sound-toggle'),
  sessionNote: document.getElementById('session-note'),
  energyValue: document.getElementById('energy-value'),
  energyBarFill: document.getElementById('energy-bar-fill'),
  clickCount: document.getElementById('click-count'),
  ox3Balance: document.getElementById('ox3-balance'),
  rewardNextLabel: document.getElementById('reward-next-label'),
  rewardBarFill: document.getElementById('reward-bar-fill'),
  rewardNextAmount: document.getElementById('reward-next-amount'),
  eggButton: document.getElementById('egg-button'),
  floatLayer: document.getElementById('float-layer'),
  dangerButton: document.getElementById('danger-button'),
  chaosState: document.getElementById('chaos-state'),
  chaosHint: document.getElementById('chaos-hint'),
  chaosButton: document.getElementById('chaos-button'),
  resetButton: document.getElementById('reset-button'),
  experimentMessage: document.getElementById('experiment-message'),
  hiddenPhrase: document.getElementById('hidden-phrase'),
  statTemp: document.getElementById('stat-temp'),
  statIntegrity: document.getElementById('stat-integrity'),
  statCosmic: document.getElementById('stat-cosmic'),
  statUnknownBar: document.getElementById('stat-unknown-bar'),
  statThreat: document.getElementById('stat-threat'),
  statAnger: document.getElementById('stat-anger'),
  achvList: document.getElementById('achv-list'),
  boosterList: document.getElementById('booster-list'),
  exchangeInput: document.getElementById('exchange-input'),
  exchangeButton: document.getElementById('exchange-button'),
  exchangeNote: document.getElementById('exchange-note'),
  activityCanvas: document.getElementById('activity-canvas'),
  alertOverlay: document.getElementById('alert-overlay'),
  toastContainer: document.getElementById('toast-container')
};

function tema(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

/* =========================================================
   FONDO DE PARTÍCULAS (colores tomados del tema activo)
   ========================================================= */
(function backgroundParticles() {
  const canvas = el.bgCanvas;
  const ctx = canvas.getContext('2d');
  let w, h, particles, dpr, running = true;

  function sizeForViewport() {
    const area = window.innerWidth * window.innerHeight;
    return Math.max(24, Math.min(90, Math.floor(area / 16000)));
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function makeParticles() {
    const count = sizeForViewport();
    particles = new Array(count).fill(0).map(() => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.3 + 0.3,
      vy: Math.random() * 0.1 + 0.03,
      vx: (Math.random() - 0.5) * 0.05,
      tw: Math.random() * Math.PI * 2, tws: Math.random() * 0.02 + 0.005
    }));
  }
  resize(); makeParticles();
  window.addEventListener('resize', () => { resize(); makeParticles(); });
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(tick); });

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    const accent = tema('--accent', '#5ff0d6');
    const dim = tema('--text-dim', '#8b96b0');
    for (const p of particles) {
      p.y -= p.vy * (state.chaosActive ? 2.2 : 1);
      p.x += p.vx; p.tw += p.tws;
      if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; }
      if (p.x < -5) p.x = w + 5; if (p.x > w + 5) p.x = -5;
      const alpha = 0.3 + Math.sin(p.tw) * 0.3;
      ctx.beginPath();
      ctx.fillStyle = state.chaosActive ? accent : dim;
      ctx.globalAlpha = Math.max(0.12, alpha);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!prefersReducedMotion) requestAnimationFrame(tick);
  }
  if (prefersReducedMotion) { tick(); setInterval(() => { if (!document.hidden) tick(); }, 4000); }
  else requestAnimationFrame(tick);
})();

/* =========================================================
   AUDIO (Web Audio API)
   ========================================================= */
const AudioEngine = (function () {
  let ctx = null;
  function ensureCtx() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, gainPeak, delay) {
    const c = ensureCtx();
    if (!c || !state.soundOn) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator(); const gain = c.createGain();
    osc.type = type || 'sine'; osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak || 0.07, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  return {
    click() { tone(520 + Math.random() * 80, 0.09, 'sine', 0.05); },
    reward() { tone(660, 0.12, 'triangle', 0.08, 0); tone(880, 0.14, 'triangle', 0.08, 0.1); tone(1180, 0.18, 'triangle', 0.08, 0.2); },
    alarm() { tone(880, 0.18, 'square', 0.05, 0); tone(440, 0.18, 'square', 0.05, 0.2); }
  };
})();

el.soundToggle.addEventListener('click', () => {
  state.soundOn = !state.soundOn;
  el.soundToggle.setAttribute('aria-pressed', String(state.soundOn));
  el.soundToggle.innerHTML = state.soundOn
    ? '<span aria-hidden="true">🔊</span> SOUND: ON'
    : '<span aria-hidden="true">🔇</span> SOUND: OFF';
  if (state.soundOn) AudioEngine.click();
});

/* =========================================================
   TOASTS
   ========================================================= */
function showToast(text) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
  el.toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

/* =========================================================
   SESIÓN
   ========================================================= */
observarSesion(async (user, perfil) => {
  if (user && perfil) {
    state.usuario = { uid: user.uid, nombre: perfil.nombre || "tú" };
    el.sessionNote.textContent = `Conectado como ${perfil.nombre} — tus clicks y energía cuentan para OX3 real.`;
    try {
      const [clicksReales, saldoReal, energiaReal, boostersReales] = await Promise.all([
        obtenerClicksStarEgg(state.usuario.uid),
        obtenerSaldoOx3(state.usuario.uid),
        obtenerEnergiaStarEgg(state.usuario.uid),
        obtenerBoostersStarEgg(state.usuario.uid)
      ]);
      state.clicksConocidos = clicksReales;
      state.ox3Balance = saldoReal;
      state.energiaConocida = energiaReal;
      state.boosters = boostersReales;
      updateAllUI();
      // por si quedaron hitos alcanzados sin reclamar de una sesión anterior
      await intentarReclamarRecompensas();
      setupAutoClicker();
    } catch (e) { /* si falla, seguimos en modo visual local */ }
  } else {
    state.usuario = null;
    el.sessionNote.innerHTML = `Jugando sin sesión — los clicks y la energía son solo visuales. <a href="/">Inicia sesión</a> para ganar OX3 real y comprar boosters.`;
    renderBoosters();
  }
});

/* =========================================================
   ENERGÍA / PROGRESO
   ========================================================= */
function proximoHito() {
  return HITOS_STAR_EGG.find(h => state.clicksConocidos < h.clicks) || null;
}
function hitoAnterior(actual) {
  const idx = HITOS_STAR_EGG.indexOf(actual);
  return idx > 0 ? HITOS_STAR_EGG[idx - 1] : { clicks: 0 };
}

function updateAllUI() {
  el.clickCount.textContent = state.clicksConocidos.toLocaleString('es-MX');
  el.ox3Balance.textContent = state.ox3Balance.toLocaleString('es-MX');
  el.energyValue.textContent = Math.floor(state.energiaConocida).toLocaleString('es-MX');
  el.energyBarFill.style.width = (Math.floor(state.energiaConocida) % 100) + '%';

  const next = proximoHito();
  if (next) {
    const prev = hitoAnterior(next);
    const pct = Math.min(100, Math.max(0,
      ((state.clicksConocidos - prev.clicks) / (next.clicks - prev.clicks)) * 100));
    el.rewardNextLabel.textContent = `${next.clicks.toLocaleString('es-MX')} CLICKS`;
    el.rewardBarFill.style.width = pct + '%';
    el.rewardNextAmount.textContent = `+${next.monto} OX3`;
  } else {
    el.rewardNextLabel.textContent = 'ALL CLAIMED';
    el.rewardBarFill.style.width = '100%';
    el.rewardNextAmount.textContent = 'MAX HITO REACHED';
  }

  updateChaosAvailability();
  updateExperimentMessage();
  checkAchievements();
  renderBoosters();
}

function tieneClickX2() { return state.boosters.includes('click_x2'); }
function tieneAutoclicker() { return state.boosters.includes('autoclicker'); }

function renderBoosters() {
  el.boosterList.innerHTML = BOOSTERS_STAR_EGG.map(b => {
    const owned = state.boosters.includes(b.id);
    const puedeComprar = state.usuario && !owned && Math.floor(state.energiaConocida) >= b.precioEnergia;
    return `
      <div class="booster-item${owned ? ' owned' : ''}">
        <span class="booster-icon" aria-hidden="true">${b.icono}</span>
        <span class="booster-info">
          <span class="booster-name">${b.nombre}</span>
          <span class="booster-desc">${b.desc}</span>
        </span>
        <button type="button" class="booster-buy${owned ? ' owned-label' : ''}"
          data-booster="${b.id}" ${owned || !puedeComprar ? 'disabled' : ''}>
          ${owned ? 'OWNED' : `${b.precioEnergia} ⚡`}
        </button>
      </div>`;
  }).join('');

  el.boosterList.querySelectorAll('.booster-buy[data-booster]').forEach(btn => {
    btn.addEventListener('click', () => comprarBooster(btn.dataset.booster));
  });
}

async function comprarBooster(boosterId) {
  if (!state.usuario) { showToast('Inicia sesión para comprar boosters.'); return; }
  await flushSyncEnergia(); // asegura que el server ya vea toda tu energía antes de gastarla
  try {
    await comprarBoosterStarEgg(state.usuario.uid, boosterId);
    const [energiaReal, boostersReales] = await Promise.all([
      obtenerEnergiaStarEgg(state.usuario.uid), obtenerBoostersStarEgg(state.usuario.uid)
    ]);
    state.energiaConocida = energiaReal;
    state.boosters = boostersReales;
    updateAllUI();
    AudioEngine.reward();
    showToast(`Booster comprado: ${BOOSTERS_STAR_EGG.find(b => b.id === boosterId)?.nombre}`);
    setupAutoClicker();
  } catch (e) {
    showToast(e.message || 'No se pudo comprar el booster.');
  }
}

/* ---- Canjear energía por Ox3 ---- */
el.exchangeButton.addEventListener('click', async () => {
  el.exchangeNote.className = 'exchange-note';
  if (!state.usuario) { el.exchangeNote.textContent = 'Inicia sesión para canjear.'; el.exchangeNote.classList.add('error'); return; }

  const monto = Math.floor(Number(el.exchangeInput.value));
  if (!monto || monto < 100) { el.exchangeNote.textContent = 'Mínimo 100 ENERGY.'; el.exchangeNote.classList.add('error'); return; }
  const bloques = Math.floor(monto / 100);

  el.exchangeButton.disabled = true;
  await flushSyncEnergia();
  try {
    const ox3Ganado = await canjearEnergiaPorOx3(state.usuario.uid, state.usuario.nombre, bloques);
    state.energiaConocida = await obtenerEnergiaStarEgg(state.usuario.uid);
    state.ox3Balance = await obtenerSaldoOx3(state.usuario.uid);
    updateAllUI();
    el.exchangeInput.value = '';
    el.exchangeNote.textContent = `¡Canjeado! +${ox3Ganado} OX3.`;
    el.exchangeNote.classList.add('ok');
    AudioEngine.reward();
  } catch (e) {
    el.exchangeNote.textContent = e.message || 'No se pudo canjear.';
    el.exchangeNote.classList.add('error');
  }
  el.exchangeButton.disabled = false;
});

/* =========================================================
   INTERACCIÓN CON EL HUEVO
   ========================================================= */
function spawnFloatingNumber(text, x, y, cls) {
  const span = document.createElement('span');
  span.className = 'float-num' + (cls ? ' ' + cls : '');
  span.style.left = x + 'px'; span.style.top = y + 'px';
  span.textContent = text;
  el.floatLayer.appendChild(span);
  setTimeout(() => span.remove(), 1050);
}
function spawnSparks(x, y) {
  const count = state.chaosActive ? 10 : 6;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    const angle = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * 30;
    s.style.setProperty('--spark-end', `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`);
    s.style.left = x + 'px'; s.style.top = y + 'px';
    el.floatLayer.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }
}

el.eggButton.addEventListener('click', (evt) => {
  const rect = el.eggButton.getBoundingClientRect();
  const x = (evt.clientX || rect.left + rect.width / 2) - rect.left;
  const y = (evt.clientY || rect.top + rect.height / 2) - rect.top;
  registrarClick(x, y, rect, true);
});

function registrarClick(x, y, rect, esManual) {
  if (esManual) {
    el.eggButton.classList.remove('impact');
    void el.eggButton.offsetWidth;
    el.eggButton.classList.add('impact');
  }

  const base = [1, 1, 2, 2, 5][Math.floor(Math.random() * 5)];
  let ganancia = base * (tieneClickX2() ? 2 : 1);
  if (state.chaosActive) ganancia *= 2;

  state.energiaConocida += ganancia;
  state.energiaPendiente += ganancia;
  spawnFloatingNumber(`+${ganancia} ENERGY`, x, y);
  if (esManual) spawnSparks(x, y);
  AudioEngine.click();

  state.clicksConocidos += 1;
  state.clicksPendientes += 1;
  updateAllUI();

  if (esManual) {
    const relY = y / rect.height, relX = x / rect.width;
    if (relY < 0.28 && relX > 0.15 && relX < 0.55) {
      state.eggZoneClicks += 1;
      if (state.eggZoneClicks === 5) unlockSecret('Secret detected.');
    }
  }

  scheduleSync();
  scheduleSyncEnergia();
}

/* Auto-Clicker: 1 click automático por segundo mientras el booster esté activo. */
let autoClickerInterval = null;
function setupAutoClicker() {
  if (autoClickerInterval) { clearInterval(autoClickerInterval); autoClickerInterval = null; }
  if (!tieneAutoclicker()) return;
  autoClickerInterval = setInterval(() => {
    const rect = el.eggButton.getBoundingClientRect();
    registrarClick(rect.width / 2, rect.height / 2, rect, false);
  }, 1000);
}

/* =========================================================
   SINCRONIZACIÓN A FIRESTORE (lotes, no cada click)
   ========================================================= */
let syncTimer = null;
function scheduleSync() {
  if (!state.usuario) return; // sin sesión: nada que sincronizar
  if (state.clicksPendientes >= 20) { flushSync(); return; }
  if (syncTimer) return;
  syncTimer = setTimeout(flushSync, 6000);
}

async function flushSync() {
  clearTimeout(syncTimer); syncTimer = null;
  if (!state.usuario || state.clicksPendientes <= 0 || state.sincronizando) return;
  state.sincronizando = true;
  const lote = state.clicksPendientes;
  try {
    await sincronizarClicksStarEgg(state.usuario.uid, lote);
    state.clicksPendientes -= lote;
    await intentarReclamarRecompensas();
  } catch (e) {
    // se reintenta en el próximo lote / al recargar; no perdemos el conteo local
  }
  state.sincronizando = false;
}
window.addEventListener('beforeunload', () => {
  if (state.clicksPendientes > 0) flushSync();
  if (state.energiaPendiente > 0) flushSyncEnergia();
});

let syncEnergiaTimer = null;
function scheduleSyncEnergia() {
  if (!state.usuario) return;
  if (state.energiaPendiente >= 60) { flushSyncEnergia(); return; }
  if (syncEnergiaTimer) return;
  syncEnergiaTimer = setTimeout(flushSyncEnergia, 6000);
}
async function flushSyncEnergia() {
  clearTimeout(syncEnergiaTimer); syncEnergiaTimer = null;
  if (!state.usuario || state.energiaPendiente <= 0 || state.sincronizandoEnergia) return;
  state.sincronizandoEnergia = true;
  const lote = state.energiaPendiente;
  try {
    await sincronizarEnergiaStarEgg(state.usuario.uid, lote);
    state.energiaPendiente -= lote;
  } catch (e) {
    // se reintenta en el próximo lote
  }
  state.sincronizandoEnergia = false;
}

async function intentarReclamarRecompensas() {
  if (!state.usuario) return;
  const reclamados = await reclamarRecompensasStarEgg(state.usuario.uid, state.usuario.nombre);
  if (reclamados.length === 0) return;

  const saldoReal = await obtenerSaldoOx3(state.usuario.uid);
  state.ox3Balance = saldoReal;
  updateAllUI();

  for (const hito of reclamados) {
    AudioEngine.reward();
    showToast(`REWARD CLAIMED — +${hito.monto} OX3`);
    const rect = el.eggButton.getBoundingClientRect();
    spawnFloatingNumber(`+${hito.monto} OX3`, rect.width / 2, rect.height * 0.3, 'reward');
  }
}

/* =========================================================
   STATS DECORATIVOS
   ========================================================= */
function jitterStats() {
  el.statTemp.textContent = `${(37 + Math.random() * 0.6 - 0.3).toFixed(1)}°C`;
  const integrityBase = state.chaosActive ? 90 : 99.8;
  el.statIntegrity.textContent = `${(integrityBase - Math.random() * (state.chaosActive ? 6 : 0.6)).toFixed(1)}%`;
  el.statCosmic.textContent = `${(10 + Math.random() * (state.chaosActive ? 40 : 6)).toFixed(1)}%`;
  el.statUnknownBar.style.width = Math.min(100, 30 + state.clicksConocidos / 20 + Math.random() * 8) + '%';
  const threats = ['????', 'LOW', 'UNCERTAIN', 'PROBABLY FINE', 'DO NOT WORRY'];
  el.statThreat.textContent = threats[Math.floor(Math.random() * threats.length)];
  const angers = ['low', 'mildly disappointed', 'stable', 'fine, probably'];
  el.statAnger.textContent = angers[Math.floor(Math.random() * angers.length)];
  if (Math.random() < 0.12) el.statIntegrity.textContent = `${(100 + Math.random() * 6).toFixed(0)}%`;
}
setInterval(() => { if (!document.hidden) jitterStats(); }, 3200);

const experimentTiers = [
  { min: 0, text: 'Monitoring specimen...' },
  { min: 1, text: 'Specimen appears normal.' },
  { min: 5, text: 'Specimen has noticed you.' },
  { min: 15, text: 'Please stop clicking the egg.' },
  { min: 30, text: 'Why are you still clicking?' },
  { min: 50, text: 'Scientists are concerned.' },
  { min: 80, text: 'Egg is becoming powerful.' },
  { min: 120, text: 'THIS WAS NOT EXPECTED.' },
  { min: 180, text: 'Containment protocol recommended.' },
  { min: 250, text: 'Everything is completely normal.' }
];
let lastTierText = null;
function updateExperimentMessage() {
  let tier = experimentTiers[0];
  for (const t of experimentTiers) if (state.clicksConocidos >= t.min) tier = t;
  if (tier.text !== lastTierText) {
    lastTierText = tier.text;
    el.experimentMessage.style.opacity = '0';
    setTimeout(() => { el.experimentMessage.textContent = tier.text; el.experimentMessage.style.opacity = '1'; }, 180);
  }
}

const hiddenPhrases = [
  'Scientific accuracy: questionable.', 'Do not feed the egg.',
  'Egg containment is mostly theoretical.', 'Nobody knows why this exists.',
  'Internal note: it\u2019s still just an egg.', 'Budget allocation: questionable.',
  'Specimen requested Wi-Fi.', 'Egg has declined to comment.'
];
let phraseIndex = 0;
setInterval(() => {
  if (document.hidden) return;
  phraseIndex = (phraseIndex + 1) % hiddenPhrases.length;
  el.hiddenPhrase.style.opacity = '0';
  setTimeout(() => { el.hiddenPhrase.textContent = hiddenPhrases[phraseIndex]; el.hiddenPhrase.style.opacity = '1'; }, 250);
}, 6500);

/* =========================================================
   DO NOT PRESS
   ========================================================= */
const dangerEvents = [
  () => { document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 420); },
  () => { el.statThreat.textContent = 'MAXIMUM'; el.statIntegrity.textContent = '412%'; el.statCosmic.textContent = 'yes'; setTimeout(jitterStats, 2200); },
  () => { el.eggButton.style.transition = 'transform .5s ease'; el.eggButton.style.transform = 'scale(1.18)'; setTimeout(() => { el.eggButton.style.transform = ''; }, 900); },
  () => { showToast('egg.exe has stopped pretending'); },
  () => { flashBigEmoji('🗿'); }
];
function flashBigEmoji(emoji) {
  const div = document.createElement('div');
  div.textContent = emoji;
  Object.assign(div.style, {
    position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 'min(38vw, 300px)', zIndex: '55', pointerEvents: 'none', opacity: '0',
    transition: 'opacity .2s ease, transform .4s ease', transform: 'scale(0.8)'
  });
  document.body.appendChild(div);
  requestAnimationFrame(() => { div.style.opacity = '1'; div.style.transform = 'scale(1)'; });
  setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 900);
}
function showOverlayMessage(text, duration) {
  el.alertOverlay.innerHTML = `<div class="alert-msg">${text}</div>`;
  el.alertOverlay.classList.add('show');
  return new Promise(resolve => setTimeout(() => { el.alertOverlay.classList.remove('show'); setTimeout(resolve, 250); }, duration));
}
let dangerBusy = false;
el.dangerButton.addEventListener('click', async () => {
  if (dangerBusy) return;
  dangerBusy = true;
  state.dangerPresses += 1;
  AudioEngine.alarm();
  await showOverlayMessage('YOU PRESSED IT.', 900);
  await showOverlayMessage('WHY.', 800);
  await showOverlayMessage('STAR EGG HAS BEEN NOTIFIED.', 1000);
  dangerEvents[Math.floor(Math.random() * dangerEvents.length)]();
  checkAchievements();
  dangerBusy = false;
});

/* =========================================================
   CHAOS MODE (visual/local — no otorga OX3 por sí solo)
   ========================================================= */
function updateChaosAvailability() {
  const unlocked = state.clicksConocidos >= 100;
  el.chaosButton.disabled = !unlocked;
  el.chaosHint.textContent = unlocked
    ? (state.chaosActive ? 'Chaos is currently destabilizing the egg.' : 'Specimen behavior may become unpredictable.')
    : 'Reach 100 clicks.';
  el.chaosState.textContent = unlocked ? (state.chaosActive ? '\u26A0 ACTIVE' : '\u26A0 AVAILABLE') : '\uD83D\uDD12 LOCKED';
  el.chaosState.className = 'chaos-state ' + (unlocked ? (state.chaosActive ? 'active' : 'available') : 'locked');
  el.chaosButton.classList.toggle('active', state.chaosActive);
  el.chaosButton.textContent = state.chaosActive ? 'DEACTIVATE' : 'ACTIVATE';
}
el.chaosButton.addEventListener('click', () => {
  if (el.chaosButton.disabled) return;
  state.chaosActive = !state.chaosActive;
  document.body.dataset.chaos = state.chaosActive ? 'on' : 'off';
  updateChaosAvailability();
  showToast(state.chaosActive ? 'CHAOS MODE ENGAGED' : 'Chaos mode disengaged.');
});

/* =========================================================
   ACHIEVEMENTS (cosméticos/locales — el dinero real ya lo dan los hitos de Star Egg)
   ========================================================= */
const achievementDefs = [
  { id: 'first_contact', name: 'FIRST CONTACT', desc: 'Click the egg for the first time.', icon: '\u2728', check: s => s.clicksConocidos >= 1 },
  { id: 'egg_enthusiast', name: 'EGG ENTHUSIAST', desc: '50 clicks.', icon: '\uD83D\uDD0B', check: s => s.clicksConocidos >= 50 },
  { id: 'questionable', name: 'QUESTIONABLE DECISIONS', desc: 'Press DO NOT PRESS.', icon: '\u26A0\uFE0F', check: s => s.dangerPresses >= 1 },
  { id: 'sci_unnecessary', name: 'SCIENTIFICALLY UNNECESSARY', desc: '100 clicks.', icon: '\uD83E\uDDEA', check: s => s.clicksConocidos >= 100 },
  { id: 'egg_knows', name: 'THE EGG KNOWS', desc: '500 clicks.', icon: '\uD83D\uDC41\uFE0F', check: s => s.clicksConocidos >= 500 },
  { id: 'absolute_egg', name: 'ABSOLUTE EGG', desc: '1,000 clicks.', icon: '\uD83C\uDFC6', check: s => s.clicksConocidos >= 1000 },
  { id: 'still_here', name: 'WHY ARE YOU STILL HERE', desc: '5,000 clicks.', icon: '\u23F3', check: s => s.clicksConocidos >= 5000 },
  { id: 'economic_power', name: 'THE EGG HAS ECONOMIC POWER', desc: '10,000 clicks.', icon: '\uD83D\uDCB8', check: s => s.clicksConocidos >= 10000 }
];
function renderAchievements() {
  el.achvList.innerHTML = achievementDefs.map(a => {
    const unlocked = state.achievements.has(a.id);
    return `<li class="achv-item${unlocked ? ' unlocked' : ''}">
      <span class="achv-icon" aria-hidden="true">${unlocked ? a.icon : '\uD83D\uDD12'}</span>
      <span><span class="achv-name">${a.name}</span><br><span class="achv-desc">${a.desc}</span></span>
    </li>`;
  }).join('');
}
function checkAchievements() {
  let nuevo = false;
  for (const a of achievementDefs) {
    if (!state.achievements.has(a.id) && a.check(state)) {
      state.achievements.add(a.id); nuevo = true;
      AudioEngine.reward();
      showToast(`ACHIEVEMENT UNLOCKED: ${a.name}`);
    }
  }
  if (nuevo) renderAchievements();
}
renderAchievements();

/* =========================================================
   SECRETOS (visuales)
   ========================================================= */
function unlockSecret(message) {
  if (state.secrets.has(message)) return;
  state.secrets.add(message);
  showToast(message);
  AudioEngine.reward();
}
(function keyboardSecret() {
  const target = 'staregg'; let buffer = '';
  window.addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-target.length);
    if (buffer === target) unlockSecret('YOU FOUND THE THING.');
  });
})();
setTimeout(() => unlockSecret('Bro is still here.'), 3 * 60 * 1000);

/* =========================================================
   GRÁFICO DE ACTIVIDAD (decorativo)
   ========================================================= */
(function activityChart() {
  const canvas = el.activityCanvas;
  const ctx = canvas.getContext('2d');
  let w, h, dpr;
  const points = new Array(48).fill(0).map(() => 40 + Math.random() * 10);
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = rect.width || 260; h = rect.height || 70;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize(); window.addEventListener('resize', resize);
  function step() {
    points.shift();
    const drift = state.chaosActive ? 18 : 6;
    points.push(Math.min(h - 6, Math.max(6, points[points.length - 1] + (Math.random() - 0.5) * drift)));
  }
  function draw() {
    if (document.hidden) return;
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    const stepX = w / (points.length - 1);
    points.forEach((p, i) => { const x = i * stepX, y = h - p; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.strokeStyle = tema('--accent', '#5ff0d6'); ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = tema('--accent', '#5ff0d6') + '18';
    try { ctx.fill(); } catch (e) { /* algunos navegadores no aceptan alpha pegado al hex */ }
  }
  setInterval(() => { step(); draw(); }, 700);
  draw();
})();

/* =========================================================
   RESET VISUAL (solo lo local — el OX3 real vive en Firestore y no se toca)
   ========================================================= */
function buildConfirmModal() {
  const wrap = document.createElement('div'); wrap.className = 'confirm-modal';
  wrap.innerHTML = `<div class="confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <h3 id="confirm-title">¿Reiniciar el progreso visual?</h3>
    <p>Solo reinicia logros y efectos locales de esta pantalla. Tu OX3, tu ENERGY, tus boosters y tus clicks guardados en tu cuenta NO se borran.</p>
    <div class="confirm-actions">
      <button type="button" class="confirm-cancel">CANCELAR</button>
      <button type="button" class="confirm-yes">REINICIAR</button>
    </div></div>`;
  document.body.appendChild(wrap);
  return wrap;
}
const confirmModal = buildConfirmModal();
const confirmCancelBtn = confirmModal.querySelector('.confirm-cancel');
const confirmYesBtn = confirmModal.querySelector('.confirm-yes');
el.resetButton.addEventListener('click', () => { confirmModal.classList.add('show'); confirmCancelBtn.focus(); });
confirmCancelBtn.addEventListener('click', () => confirmModal.classList.remove('show'));
confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) confirmModal.classList.remove('show'); });
confirmYesBtn.addEventListener('click', () => {
  state.achievements.clear();
  state.dangerPresses = 0;
  document.body.dataset.chaos = 'off';
  state.chaosActive = false;
  renderAchievements();
  updateAllUI();
  confirmModal.classList.remove('show');
  showToast('Progreso visual reiniciado.');
});

/* ---------------- Init ---------------- */
updateAllUI();