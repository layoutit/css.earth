import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareCssPresentation, parsePresentationProfile } from './index.js';
import type { PresentationInputs } from './types.js';

const root = resolve(import.meta.dirname, '../../../../..');
const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, file), 'utf8'));
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  return value;
}
describe('retained presentation compiler compatibility', () => {
  for (const id of ['mercury', 'venus']) it(`${id} preserves its prepared tree, resources, settings and navigation`, async () => {
    const base = `src/objects/${id}/prepared`;
    const profile = parsePresentationProfile(await read(`src/objects/${id}/source/preparation/presentation.json`));
    const [scene, assets, lenses, sun, markers, controls, expected, solarSource] = await Promise.all([
      ...['scene', 'assets', 'lenses', 'sun', 'markers', 'controls', 'runtime'].map(file => read(`${base}/${file}.json`)),
      read(`src/objects/${id}/source/presentation/solar-system.json`),
    ]);
    const input = { ...profile, scene, assets, lenses, sun, markers, controls, solarSource } as PresentationInputs;
    const prepared = await prepareCssPresentation(input);
    // Runtime finalization adds motion/facing and can update marker/warm-bank
    // metadata. Compare compiler-owned structure, then every raw output byte
    // against the independently executed pre-migration JavaScript helpers.
    const accepted = expected as Record<string, unknown>;
    for (const key of ['tree', 'variants', 'materials', 'camera', 'sky', 'sun', 'controls', 'viewBindings', 'animations', 'textureLevels'] as const) {
      expect(prepared[key]).toEqual(accepted[key]);
    }
    expect(prepared.tree.nodes.length).toBe(id === 'mercury' ? 909 : 456);
    expect(createHash('sha256').update(JSON.stringify(canonical(prepared))).digest('hex')).toBe(expectedDigests[id]);
    if (id === 'mercury') {
      // Two prepared surface levels: mount and startup name only the 1x maps;
      // @2x follows once the disc reaches 2 texels per CSS pixel (2048 / 2pi).
      const levels = prepared.textureLevels!.levels;
      expect(levels.map(level => level.minimumDiameter)).toEqual([0, 2048 / (2 * Math.PI)]);
      expect(levels[0].resources['surface:normal']).toBe('surface:normal:level:2048');
      expect(prepared.assets.startup).toContain('surface:normal:level:2048');
      expect(prepared.assets.startup.filter(key => key.startsWith('surface:'))).toEqual(['surface:normal:level:2048']);
      const surfaceImages = prepared.tree.properties.filter(property => property.name === '--mercury-surface-image');
      expect(surfaceImages.map(property => property.value)).toEqual(['url("/scenes/mercury/mercury-surface-normal.jpg")']);
    }
  }, 30_000);
  it('rejects surface texture levels outside the row-bank cutaway presentation', () => {
    const profile = { schema: 'cssearth-css-presentation-profile@1', namespace: 'venus', mode: 'composite', textureLevels: { hysteresis: 0.2, texelsPerCssPixel: 2 } };
    expect(() => parsePresentationProfile(profile)).toThrow();
    expect(() => parsePresentationProfile({ ...profile, mode: 'row-bank-cutaway', textureLevels: { hysteresis: 1, texelsPerCssPixel: 2 } })).toThrow();
  });
});
// Full raw output hashes from original JS helpers; see tools/evidence/presentation-typescript-parity.json.
// Mercury's hash was updated for its surface texture levels and JPEG surface maps.
// Both hashes were updated for the stepped seam outset and matched raster overscan.
const expectedDigests: Record<string, string> = {
  mercury: '510e8f2c6b5beafe2f5d4f9fb85fa1f5b20cd414cf9a1f7f149b4eb01f250c21',
  venus: 'ef9676f16170a6e218e8aff6cdd16dfb7dec677b4af67f67b10d274580bfd170',
};
