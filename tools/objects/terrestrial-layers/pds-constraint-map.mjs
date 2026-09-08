import sharp from 'sharp';

/** Map the archive's categorical vertex flags, with nearest-grid sampling.
 * Colours are an authored legend, never a surface photograph or albedo map. */
export async function preparePdsConstraintMap(mesh, { width, height, stepDegrees, colors }) {
  if (!Number.isInteger(width) || width !== height * 2 || width < 16 || width > 4096 ||
      !(stepDegrees > 0) || 180 % stepDegrees || !mesh.coordinates || !mesh.constraintFlags ||
      ![1, 2, 3].every(flag => /^#[0-9a-f]{6}$/i.test(colors?.[flag]))) throw new TypeError('Invalid PDS constraint map recipe.');
  const cells = new Map();
  for (const [i, [latitude, longitude]] of mesh.coordinates.entries()) {
    const key = `${latitude},${longitude}`;
    if (latitude % stepDegrees || longitude % stepDegrees || cells.has(key)) throw new Error('PDS constraint grid is not unique and regular.');
    cells.set(key, mesh.constraintFlags[i]);
  }
  const palette = Object.fromEntries([1, 2, 3].map(flag => [flag, Buffer.from(colors[flag].slice(1), 'hex')]));
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const latitude = Math.round((90 - (y + .5) * 180 / height) / stepDegrees) * stepDegrees;
    const longitude = Math.abs(latitude) === 90 ? 0 : (Math.round((x + .5) * 360 / width / stepDegrees) * stepDegrees) % 360;
    const flag = cells.get(`${latitude},${longitude}`);
    if (!palette[flag]) throw new Error(`Missing PDS constraint cell ${latitude},${longitude}.`);
    palette[flag].copy(data, (y * width + x) * 3);
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
}
