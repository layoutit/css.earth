/** Bake the shared Lambert attenuation frames without importing a raster preparation pipeline. */
export interface LambertAttenuationParameters {
  frameSize: number; columns: number; frameCount: number; terminatorWidth: number;
  directionalAmbient: number; fullPhaseAmbient: number; fullPhaseDiffuse: number; maximumOpacity: number;
}

export function lambertAttenuationAtlas({ frameSize, columns, frameCount, terminatorWidth, directionalAmbient, fullPhaseAmbient, fullPhaseDiffuse, maximumOpacity }: LambertAttenuationParameters) {
  const rows = frameCount / columns, width = frameSize * columns, height = frameSize * rows;
  const pixels = Buffer.alloc(width * height * 4);
  for (let frame = 0; frame < frameCount; frame++) {
    const lz = -1 + 2 * frame / (frameCount - 1), lx = Math.sqrt(1 - lz * lz);
    for (let y = 0; y < frameSize; y++) for (let x = 0; x < frameSize; x++) {
      const nx = (x - (frameSize - 1) / 2) / (frameSize / 2), ny = (y - (frameSize - 1) / 2) / (frameSize / 2), r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const direct = Math.max(0, nx * lx + Math.sqrt(1 - r2) * lz);
      const t = Math.min(1, direct / terminatorWidth), lit = t * t * (3 - 2 * t) * direct;
      const illumination = frame === frameCount - 1 ? fullPhaseAmbient + lit * fullPhaseDiffuse : directionalAmbient + lit;
      const offset = ((Math.floor(frame / columns) * frameSize + y) * width + frame % columns * frameSize + x) * 4;
      pixels[offset + 3] = Math.round(Math.min(maximumOpacity, Math.max(0, 1 - illumination)) * 255);
    }
  }
  return { pixels, width, height, rows };
}
