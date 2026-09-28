/** A flat disc in the shared neutral gray on a transparent field: the marker of an unresolved, self-luminous surface. A body whose
 * marker takes a colour from its data (an emission map's palette at its dayside mean) passes that colour. */
export async function neutralDiscMarker(size = 512, fill = 0.9, color: readonly [number, number, number] = [128, 128, 128]) {
  const { default: sharp } = await import('sharp');
  const rgba = Buffer.alloc(size * size * 4), c = (size - 1) / 2, radius = size * fill / 2;
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const distance = Math.hypot(col - c, row - c);
    if (distance > radius + 0.5) continue;
    rgba.set([...color, Math.round(255 * Math.max(0, Math.min(1, radius + 0.5 - distance)))], (row * size + col) * 4);
  }
  return sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}
