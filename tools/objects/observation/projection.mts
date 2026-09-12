import type { RasterInfo } from "./raster.mts";
/** Reverse the row order inside each latitude band without crossing bands (the retained band packing orientation). */
export function orientLatitudeBands(data: Buffer, { width, height, channels, bandCount }: RasterInfo & {bandCount: number}) {
  const bandHeight = height / bandCount;
  if (!Buffer.isBuffer(data) || !Number.isInteger(bandHeight)) {
    throw new Error("Surface texture does not match its prepared latitude grid.");
  }
  const output = Buffer.alloc(data.length);
  const rowBytes = width * channels;
  for (let band = 0; band < bandCount; band += 1) {
    const bandStart = band * bandHeight;
    for (let row = 0; row < bandHeight; row += 1) {
      const sourceRow = bandStart + row;
      const outputRow = bandStart + bandHeight - 1 - row;
      data.copy(
        output,
        outputRow * rowBytes,
        sourceRow * rowBytes,
        (sourceRow + 1) * rowBytes,
      );
    }
  }
  return output;
}
