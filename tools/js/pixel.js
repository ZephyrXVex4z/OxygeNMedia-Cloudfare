(() => {
  const O = window.OxygeNTools;
  O.register('pixel', host => {
    host.innerHTML = `<section class="ot-panel">
      <div class="ot-fields">
        <div class="ot-field"><label for="pixel-size">Tamaño del lienzo</label><select class="ot-select" id="pixel-size"><option value="16">16 × 16</option><option value="24">24 × 24</option><option value="32" selected>32 × 32</option></select></div>
        <div class="ot-field"><label for="pixel-color">Color de pintura</label><input class="ot-input" id="pixel-color" type="color" value="#43D7BF"></div>
        <div class="ot-field"><label class="ot-check"><input type="checkbox" id="pixel-erase"> Borrador</label></div>
      </div>
      <div class="ot-actions"><button class="ot-btn" id="pixel-undo" disabled>↶ Deshacer</button><button class="ot-btn" id="pixel-redo" disabled>↷ Rehacer</button><button class="ot-btn ghost" id="pixel-clear">Limpiar lienzo</button><button class="ot-btn primary" id="pixel-export">Exportar PNG</button></div>
      <div class="ot-pixel-wrap" style="margin-top:16px"><canvas id="pixel-canvas" tabindex="0" role="application" aria-label="Lienzo de pixel art interactivo"></canvas></div>
      <p class="ot-hint" id="pixel-help">Pinta con el puntero o toca una celda. Para usar el teclado, enfoca el lienzo; muévete con las flechas y pinta o borra con Espacio o Enter. El PNG se exporta a 512 × 512 px.</p>
      <p class="ot-status" id="pixel-cell-status" aria-live="polite">Cursor: fila 1, columna 1.</p>
      <div class="ot-message" aria-live="polite"></div>
    </section>`;
    const $ = s => O.$(s, host), canvas = $('#pixel-canvas'), ctx = canvas.getContext('2d');
    let n = 32, scale = 16, grid = Array(n * n).fill(null), undo = [], redo = [], drawing = false, strokeSaved = false, cursorX = 0, cursorY = 0;
    const syncButtons = () => { $('#pixel-undo').disabled = !undo.length; $('#pixel-redo').disabled = !redo.length; };
    function draw() {
      canvas.width = n * scale; canvas.height = n * scale;
      canvas.style.width = `${n * scale}px`; canvas.style.height = `${n * scale}px`;
      canvas.setAttribute('aria-label', `Lienzo de pixel art interactivo, ${n} por ${n}. Usa las flechas para mover el cursor, Espacio o Enter para pintar. Fila ${cursorY + 1}, columna ${cursorX + 1}.`);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const color = grid[y * n + x];
        if (color) { ctx.fillStyle = color; ctx.fillRect(x * scale, y * scale, scale, scale); }
      }
      ctx.strokeStyle = 'rgba(120,140,150,.35)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const p = i * scale + .5; ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height); ctx.moveTo(0, p); ctx.lineTo(canvas.width, p); }
      ctx.stroke();
      if (document.activeElement === canvas) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(cursorX * scale + 1, cursorY * scale + 1, scale - 2, scale - 2);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.strokeRect(cursorX * scale + 2, cursorY * scale + 2, scale - 4, scale - 4);
      }
    }
    function snapshot() { undo.push([...grid]); if (undo.length > 100) undo.shift(); redo = []; syncButtons(); }
    function paint(x, y, fromPointer = false) {
      if (x < 0 || y < 0 || x >= n || y >= n) return;
      const idx = y * n + x, value = $('#pixel-erase').checked ? null : $('#pixel-color').value;
      if (grid[idx] === value) return;
      if (fromPointer) { if (!strokeSaved) { snapshot(); strokeSaved = true; } }
      else snapshot();
      grid[idx] = value; draw(); syncButtons();
    }
    function pointerCell(e) {
      const r = canvas.getBoundingClientRect();
      return [Math.floor((e.clientX - r.left) / r.width * n), Math.floor((e.clientY - r.top) / r.height * n)];
    }
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault(); drawing = true; strokeSaved = false; canvas.setPointerCapture(e.pointerId);
      const [x, y] = pointerCell(e); cursorX = Math.max(0, Math.min(n - 1, x)); cursorY = Math.max(0, Math.min(n - 1, y));
      paint(x, y, true); $('#pixel-cell-status').textContent = `Fila ${cursorY + 1}, columna ${cursorX + 1}.`;
    });
    canvas.addEventListener('pointermove', e => { if (drawing) { const [x, y] = pointerCell(e); if (x >= 0 && y >= 0 && x < n && y < n) { cursorX = x; cursorY = y; paint(x, y, true); } } });
    canvas.addEventListener('pointerup', () => { drawing = false; });
    canvas.addEventListener('pointercancel', () => { drawing = false; });
    canvas.addEventListener('focus', draw);
    canvas.addEventListener('blur', draw);
    canvas.addEventListener('keydown', e => {
      const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (moves[e.key]) {
        e.preventDefault(); cursorX = Math.max(0, Math.min(n - 1, cursorX + moves[e.key][0])); cursorY = Math.max(0, Math.min(n - 1, cursorY + moves[e.key][1]));
        $('#pixel-cell-status').textContent = `Fila ${cursorY + 1}, columna ${cursorX + 1}.`; draw();
      } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); paint(cursorX, cursorY); $('#pixel-cell-status').textContent = `Fila ${cursorY + 1}, columna ${cursorX + 1}${$('#pixel-erase').checked ? ', borrada.' : ', pintada.'}`; }
    });
    $('#pixel-size').addEventListener('change', e => { n = Number(e.target.value); grid = Array(n * n).fill(null); undo = []; redo = []; cursorX = cursorY = 0; draw(); syncButtons(); $('#pixel-cell-status').textContent = `Lienzo ${n} por ${n}. Fila 1, columna 1.`; });
    $('#pixel-undo').addEventListener('click', () => { if (!undo.length) return; redo.push([...grid]); grid = undo.pop(); draw(); syncButtons(); });
    $('#pixel-redo').addEventListener('click', () => { if (!redo.length) return; undo.push([...grid]); grid = redo.pop(); draw(); syncButtons(); });
    $('#pixel-clear').addEventListener('click', () => { if (!grid.some(Boolean)) return; snapshot(); grid = Array(n * n).fill(null); draw(); syncButtons(); });
    $('#pixel-export').addEventListener('click', () => {
      const out = document.createElement('canvas'); out.width = out.height = 512; const c = out.getContext('2d'); c.imageSmoothingEnabled = false;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (grid[y * n + x]) { c.fillStyle = grid[y * n + x]; c.fillRect(x * 512 / n, y * 512 / n, 512 / n, 512 / n); }
      out.toBlob(blob => blob && O.download(blob, 'oxygetools-pixel-art.png'), 'image/png');
    });
    draw();
  });
})();
