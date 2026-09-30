/** Deterministic topology-preserving binary thinning. It only removes observed pixels. */
export function ridgeSkeleton(supported: Uint8Array, width: number, height: number) {
  const mask = Uint8Array.from(supported), remove: number[] = [];
  let passes = 0, changed = true;
  const at = (x: number, y: number): number => x >= 0 && y >= 0 && x < width && y < height ? mask[y * width + x] : 0;
  while (changed) {
    changed = false;
    for (let phase = 0; phase < 2; phase++) {
      remove.length = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const p = y * width + x; if (!mask[p]) continue;
        const n = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
        const neighbors = n.reduce((sum, value) => sum + value, 0);
        if (neighbors < 2 || neighbors > 6) continue;
        let entries = 0; for (let i = 0; i < 8; i++) if (!n[i] && n[(i + 1) % 8]) entries++;
        if (entries !== 1) continue;
        if (phase === 0 ? n[0] * n[2] * n[4] || n[2] * n[4] * n[6] : n[0] * n[2] * n[6] || n[0] * n[4] * n[6]) continue;
        remove.push(p);
      }
      for (const p of remove) mask[p] = 0;
      if (remove.length) changed = true;
      passes++;
    }
    // Each progressing iteration removes pixels; this bound exposes a defect instead of hanging.
    if (passes > supported.length * 2 + 2) throw new Error('Ridge thinning did not converge.');
  }
  return { mask, passes };
}

/** Avoid diagonal shortcut triangles when an orthogonal skeleton path already connects two pixels. */
export function ridgeNeighbors(p: number, mask: Uint8Array, width: number, height: number): number[] {
  const x = p % width, y = Math.floor(p / width), result: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!(dx || dy) || x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
    const next = (y + dy) * width + x + dx; if (!mask[next]) continue;
    if (dx && dy && (mask[y * width + x + dx] || mask[(y + dy) * width + x])) continue;
    result.push(next);
  }
  return result;
}
