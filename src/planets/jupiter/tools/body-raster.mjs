export const JUPITER_BODY_LATITUDE_BOUNDS_DEGREES = Object.freeze([
  -80, -76, -72, -68, -64,
  -56, -48, -40, -32, -24, -16, -8,
  0,
  8, 16, 24, 32, 40, 48, 56,
  64, 68, 72, 76, 80,
]);

export function jupiterBodyRasterBands(height) {
  if (!Number.isInteger(height) || height <= 0) {
    throw new RangeError("Jupiter surface height must be a positive integer.");
  }
  return Object.freeze(Array.from(
    { length: JUPITER_BODY_LATITUDE_BOUNDS_DEGREES.length - 1 },
    (_, bandIndex) => {
      const south = JUPITER_BODY_LATITUDE_BOUNDS_DEGREES[bandIndex];
      const north = JUPITER_BODY_LATITUDE_BOUNDS_DEGREES[bandIndex + 1];
      const y = Math.round((90 - north) / 180 * height);
      const bottom = Math.round((90 - south) / 180 * height);
      return Object.freeze({ y, height: bottom - y });
    },
  ));
}
