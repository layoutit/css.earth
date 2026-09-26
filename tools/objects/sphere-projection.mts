/**
 * The seam handling every generated sphere uses, the same as the hand-made spheres (Europa, Venus, Pluto...): bands tile
 * exactly, read a half-texel raster overscan, and the body publishes a stepped silhouette outset that closes antialiased
 * seams. The generators used to write a 24-unit seam bleed instead: every band grew by about a tenth of the radius, and
 * near a pole on the silhouette that growth reached past the outline (a lemon-shaped planet in Safari on iPad).
 * The raster scale stays the generators' own 2: a one-colour sphere gains nothing from denser leaves.
 */
export const SPHERE_SEAMS = Object.freeze({
  seamBleed: 0,
  overlap: 0.0078125,
  seamOutset: Object.freeze({ targetPixels: 0.5, stepRatio: Math.SQRT2, hysteresis: 0.1, firstDiameter: 16, lastDiameter: 32768 }),
  rasterOverscan: 0.5,
});

/** A generated sphere's projection block: the shared seams plus the fields every generator writes the same way. */
export function sphereProjection(ambientIntensity: number) {
  return { tileSize: 50, layerElevation: 50, interiorSeamBleed: 8, fitToSource: false, rasterScale: 2, rasterGutter: 8, ...SPHERE_SEAMS,
    seamOutset: { ...SPHERE_SEAMS.seamOutset }, projectivePoles: false, lightColor: '#ffffff', ambientIntensity };
}
