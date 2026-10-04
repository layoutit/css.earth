/** One scalar on a complete periodic longitude/latitude grid, read between its released nodes. Longitudes are east-positive
 * degrees, evenly spaced around the whole body; latitudes increase and are bounded by the actual samples, so missing polar
 * rows are not extrapolated. A node without a value (NaN) leaves every sample that would use it without one. */
export function periodicLonLatGrid(longitudes: readonly number[], latitudes: readonly number[], grid: Float64Array, toleranceDegrees: number) {
  if (longitudes.at(-1)! - longitudes[0]! >= 360 || latitudes[0]! < -90 || latitudes.at(-1)! > 90)
    throw new RangeError('Grid coordinates must span less than 360 degrees and lie within the poles.');
  const step = 360 / longitudes.length;
  for (let i = 0; i < longitudes.length; i++) if (Math.abs(longitudes[i]! - longitudes[0]! - i * step) > 2 * toleranceDegrees)
    throw new TypeError('Longitude samples must form a complete periodic grid.');
  // Use the released rounded coordinates themselves for interpolation, so every
  // native node is reproduced exactly, including the two sides of the seam.
  const bracket = (axis: readonly number[], n: number) => {
    let i = 0;
    while (i + 1 < axis.length && axis[i + 1]! <= n) i++;
    return i;
  };
  return {
    sample(longitude: number, latitude: number): number | null {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < latitudes[0]! || latitude > latitudes.at(-1)!) return null;
      const lon = ((longitude - longitudes[0]!) % 360 + 360) % 360 + longitudes[0]!;
      const x0 = bracket(longitudes, lon), x1 = (x0 + 1) % longitudes.length;
      const y0 = Math.min(latitudes.length - 2, bracket(latitudes, latitude)), y1 = y0 + 1;
      const dx = (lon - longitudes[x0]!) / ((x1 === 0 ? longitudes[0]! + 360 : longitudes[x1]!) - longitudes[x0]!);
      const dy = (latitude - latitudes[y0]!) / (latitudes[y1]! - latitudes[y0]!);
      const node = (x: number, y: number) => grid[y * longitudes.length + x]!;
      const value = (node(x0, y0) * (1 - dx) + node(x1, y0) * dx) * (1 - dy) + (node(x0, y1) * (1 - dx) + node(x1, y1) * dx) * dy;
      return Number.isFinite(value) ? value : null;
    },
  };
}
