/**
 * The seam handling every generated sphere uses, the same as the hand-made spheres (Europa, Venus, Pluto...): bands tile
 * exactly, read a half-texel raster overscan, and the body publishes a stepped silhouette outset that closes antialiased
 * seams. The generators used to write a 24-unit seam bleed instead: every band grew by about a tenth of the radius, and
 * near a pole on the silhouette that growth reached past the outline (a lemon-shaped planet in Safari on iPad).
 * The raster scale stays the generators' own 2: a one-colour sphere gains nothing from denser leaves.
 */
export const SPHERE_SEAMS = Object.freeze({
  seamBleed: 0,
  seamOutset: Object.freeze({ targetPixels: 0.5, stepRatio: Math.SQRT2, hysteresis: 0.1, firstDiameter: 16, lastDiameter: 32768 }),
  rasterOverscan: 0.5,
});

/**
 * A generated sphere's projection block: the shared seams plus the fields every generator writes the same way. Leaves
 * overlap by exactly their raster overscan, so the overlap is the overscan over the texels in one map cell (a 1,024-texel
 * map in 32 longitude cells: 0.5 / 32). The cells must be square in texels, or no single overlap matches both axes.
 */
export function sphereProjection(ambientIntensity: number, cellTexels: number) {
  if (!(cellTexels > 0)) throw new RangeError(`sphereProjection: texels per map cell must be positive, not ${cellTexels}.`);
  return { tileSize: 50, layerElevation: 50, seamBleed: SPHERE_SEAMS.seamBleed, interiorSeamBleed: 8, overlap: SPHERE_SEAMS.rasterOverscan / cellTexels,
    seamOutset: { ...SPHERE_SEAMS.seamOutset }, fitToSource: false, rasterScale: 2, rasterGutter: 8, rasterOverscan: SPHERE_SEAMS.rasterOverscan,
    projectivePoles: false, lightColor: '#ffffff', ambientIntensity };
}
