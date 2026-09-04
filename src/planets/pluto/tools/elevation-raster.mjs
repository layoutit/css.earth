// USGS's pinned GeoTIFF is uncompressed, signed 16-bit, one strip per row.
// Reading these samples directly avoids image-library conversion of negative
// elevations into unsigned display luminance. No-data is not terrain at zero.
export function decodeElevationGrid(bytes) {
  if (bytes.toString("ascii", 0, 2) !== "II" || bytes.readUInt16LE(2) !== 42) throw new Error("Unsupported Pluto TIFF header.");
  const ifd = bytes.readUInt32LE(4);
  const tags = new Map();
  for (let i = 0; i < bytes.readUInt16LE(ifd); i++) {
    const offset = ifd + 2 + i * 12;
    const tag = bytes.readUInt16LE(offset), type = bytes.readUInt16LE(offset + 2), count = bytes.readUInt32LE(offset + 4);
    const size = type === 3 ? 2 : type === 4 ? 4 : 1;
    const start = count * size <= 4 ? offset + 8 : bytes.readUInt32LE(offset + 8);
    tags.set(tag, { type, count, start, value: () => type === 3 ? bytes.readUInt16LE(start) : bytes.readUInt32LE(start) });
  }
  const get = (tag) => tags.get(tag)?.value();
  if (get(258) !== 16 || get(259) !== 1 || get(277) !== 1 || get(278) !== 1 || get(339) !== 2) throw new Error("Unsupported Pluto elevation encoding.");
  const width = get(256), height = get(257), strips = tags.get(273), counts = tags.get(279), missing = tags.get(42113);
  if (!strips || !counts || strips.type !== 4 || counts.type !== 4 || strips.count !== height || counts.count !== height || !missing || bytes.toString("ascii", missing.start, missing.start + missing.count).replace(/\0/gu, "") !== "-32768") throw new Error("Pluto elevation strip/no-data metadata drifted.");
  const offsets = Array.from({ length: height }, (_, y) => {
    const offset = bytes.readUInt32LE(strips.start + y * 4);
    if (bytes.readUInt32LE(counts.start + y * 4) !== width * 2 || offset + width * 2 > bytes.length) throw new Error("Invalid Pluto elevation strip.");
    return offset;
  });
  return { width, height, sample: (x, y) => bytes.readInt16LE(offsets[y] + x * 2) };
}

export function elevationColor(metres) {
  if (metres === -32768) return [0, 0, 0];
  const low = [57, 94, 151], middle = [214, 208, 178], high = [176, 80, 47];
  const t = Math.max(-1, Math.min(1, metres / 8000));
  const a = t < 0 ? low : middle, b = t < 0 ? middle : high;
  const f = t < 0 ? t + 1 : t;
  return a.map((v, i) => Math.round(v + (b[i] - v) * f));
}

export function elevationRaster(grid, width, height) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sourceX = Math.min(grid.width - 1, Math.floor((x + 0.5) * grid.width / width));
    const sourceY = Math.min(grid.height - 1, Math.floor((y + 0.5) * grid.height / height));
    data.set(elevationColor(grid.sample(sourceX, sourceY)), (y * width + x) * 3);
  }
  return { data, info: { width, height, channels: 3 } };
}
