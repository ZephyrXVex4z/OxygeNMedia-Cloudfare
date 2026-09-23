// pixel-exportar.js
// Genera el PNG final a partir del grid. Cada pixel del dibujo se convierte en
// un bloque sólido de N×N píxeles reales de imagen — nunca se hace un "resize"
// de una imagen ya generada, porque eso interpola y difumina los bordes. Este
// método garantiza que el resultado se vea nítido sin importar la escala.

export const MULTIPLICADORES_DISPONIBLES = [1, 2, 4, 8, 16];

export function exportarComoPng(grid, gridSize, multiplicador, nombreArchivo, fondoColor = null) {
  const lado = gridSize * multiplicador;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = lado;
  exportCanvas.height = lado;
  const ctx = exportCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  if (fondoColor) {
    ctx.fillStyle = fondoColor;
    ctx.fillRect(0, 0, lado, lado);
  }

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const color = grid[y][x];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * multiplicador, y * multiplicador, multiplicador, multiplicador);
      }
    }
  }

  exportCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// Calcula el multiplicador más grande que quepa dentro de una resolución
// objetivo (ej. 1080) sin pasarse — útil como opción rápida "Exportar en HD"
// además de los multiplicadores fijos 1x/2x/4x/8x/16x.
export function multiplicadorParaResolucion(gridSize, resolucionObjetivo) {
  return Math.max(1, Math.floor(resolucionObjetivo / gridSize));
}
