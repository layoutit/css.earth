import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createSurfacePatches } from './surface.js';
import type { SurfaceGeometryProfile } from './surface.js';

const profile = {
  radius: 230, polarRadius: 230, latitudeSegments: 16, longitudeSegments: 32,
  surface: { url: 'surface.webp', width: 2048, height: 1536 }, surfaceLatitudeHeight: 1024, packedBandGutter: 16,
  poles: { url: 'poles.webp', width: 512, height: 256 }, polarTileSize: 256, uv: 'cell', color: '#aaaaaa',
} as SurfaceGeometryProfile;
const cell = (overlap: number, texelsPerUnit: number, overscan = 0) =>
  createSurfacePatches(profile, overlap, texelsPerUnit, overscan).find(patch => patch.longitudeIndex === 3 && patch.latitudeIndex === 5)!;

describe('surface patch overlap', () => {
  it('grows the texture cell with the patch, in whole texels, so neighbours sample the same map', () => {
    const exact = cell(0, 4), grown = cell(0.005, 4);
    // 0.005 of a 64-unit cell at 4 texels per unit is 1.28 texels: one whole texel, a quarter unit, on each side.
    assert.deepEqual(grown.surfaceSourceRect, { x: 191.75, y: 639.75, width: 64.5, height: 64.5 });
    assert.equal(grown.textureImageSource.sourceRect.y, exact.textureImageSource.sourceRect.y - 0.25);
    // The patch reaches exactly as far past its cell as its texture does: a quarter unit is 1/256 of the cell's angle.
    const longitude = (vertex: readonly number[]) => Math.atan2(vertex[1]!, vertex[0]!);
    const exactSpan = longitude(exact.vertices[1]!) - longitude(exact.vertices[0]!);
    const grownSpan = longitude(grown.vertices[1]!) - longitude(grown.vertices[0]!);
    assert.ok(Math.abs((grownSpan / exactSpan) - (64.5 / 64)) < 10 ** -12 / 2, `${(grownSpan / exactSpan)} is not close to ${64.5 / 64}`);
  });
  it('leaves the growth to a raster overscan that already carries the overlap', () => {
    // 0.0078125 of a 64-unit cell is half a unit, which a half-unit overscan already draws around the exact cell.
    assert.deepEqual(cell(0.0078125, 4, 0.5).surfaceSourceRect, { x: 192, y: 640, width: 64, height: 64 });
    assert.deepEqual(cell(0.0078125, 4, 0.25).surfaceSourceRect, { x: 191.75, y: 639.75, width: 64.5, height: 64.5 });
  });
  it('keeps the exact cell without an overlap', () => {
    assert.deepEqual(cell(0, 4).surfaceSourceRect, { x: 192, y: 640, width: 64, height: 64 });
  });
});
