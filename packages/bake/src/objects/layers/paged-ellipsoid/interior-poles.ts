/** Cut both outer polar tiles in their common prepared longitude frame. */
export function cutInteriorPoles<T extends Uint8Array>(pixels: T, tileSize: number, cutaway: {centerLongitudeDegrees: number; widthDegrees: number}) {
  const width = tileSize * 2;
  for (let tile = 0; tile < 2; tile += 1) {
    for (let y = 0; y < tileSize; y += 1) {
      for (let x = 0; x < tileSize; x += 1) {
        const longitude = Math.atan2(y + 0.5 - tileSize / 2, x + 0.5 - tileSize / 2) * 180 / Math.PI;
        const distance = Math.abs(((longitude - cutaway.centerLongitudeDegrees + 180) % 360 + 360) % 360 - 180);
        if (distance <= cutaway.widthDegrees / 2) pixels[(y * width + tile * tileSize + x) * 4 + 3] = 0;
      }
    }
  }
  return pixels;
}
