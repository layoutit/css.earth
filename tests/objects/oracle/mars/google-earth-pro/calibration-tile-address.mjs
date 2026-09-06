// Flat tile space is square: both axes span 360 degrees. Polar rows are unused.
export function flatTileBounds(level, row, col) {
  const divisions = 2 ** level;
  if (!Number.isInteger(level) || level < 0 || level > 20 ||
      !Number.isInteger(row) || !Number.isInteger(col) ||
      row < 0 || col < 0 || row >= divisions || col >= divisions) {
    throw new RangeError("Invalid flat tile address.");
  }
  const span = 360 / divisions;
  return { west:-180 + col * span, east:-180 + (col + 1) * span,
    south:-180 + row * span, north:-180 + (row + 1) * span };
}

export function sampleCalibrationTile(source, address, size = 256) {
  const bounds = flatTileBounds(address.level, address.row, address.col);
  const { width, height, channels } = source.info;
  if (channels !== 4 || width !== height * 2) throw new TypeError("Expected equirectangular RGBA source.");
  const topDown = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const latitude = bounds.north - (y + 0.5) / size * (bounds.north - bounds.south);
    const sy = Math.max(0, Math.min(height - 1, Math.floor((90 - latitude) / 180 * height)));
    for (let x = 0; x < size; x++) {
      const longitude = bounds.west + (x + 0.5) / size * (bounds.east - bounds.west);
      const sx = Math.max(0, Math.min(width - 1, Math.floor((longitude + 180) / 360 * width)));
      source.data.copy(topDown, (y * size + x) * 4, (sy * width + sx) * 4, (sy * width + sx + 1) * 4);
    }
  }
  return { topDown, bounds };
}

