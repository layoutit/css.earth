export function orientLatitudeBandsForProjectiveLeaves(
  source,
  { width, height, channels },
  bandCount,
) {
  const bandHeight = height / bandCount;
  if (!Buffer.isBuffer(source) || !Number.isInteger(bandHeight)) {
    throw new Error("Prepared latitude texture does not match its band grid.");
  }
  const output = Buffer.alloc(source.length);
  const rowBytes = width * channels;
  for (let band = 0; band < bandCount; band += 1) {
    const bandStart = band * bandHeight;
    for (let row = 0; row < bandHeight; row += 1) {
      const sourceRow = bandStart + row;
      const outputRow = bandStart + bandHeight - 1 - row;
      source.copy(
        output,
        outputRow * rowBytes,
        sourceRow * rowBytes,
        (sourceRow + 1) * rowBytes,
      );
    }
  }
  return output;
}
