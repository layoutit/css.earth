import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareCssPresentation, parsePresentationProfile } from './css-presentation.ts';
import { presentationHostAdapters } from '../objects/host-adapters/index.ts';
import * as solarGeometry from '../../../../src/platform/solar-geometry.mts';
import type { PresentationInputs } from './types.ts';

const root = resolve(import.meta.dirname, '../../../..');
const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, file), 'utf8'));
describe('retained presentation compiler compatibility', () => {
  for (const id of ['mercury', 'venus']) it(`${id} preserves its prepared tree, resources, settings and navigation`, async () => {
    const base = `src/objects/${id}/prepared`;
    const profile = parsePresentationProfile(await read(`src/objects/${id}/source/preparation/presentation.json`));
    const [scene, assets, datasets, sun, markers, controls, expected, solarSource] = await Promise.all([
      ...['scene', 'assets', 'datasets', 'sun', 'markers', 'controls', 'runtime'].map(file => read(`${base}/${file}.json`)),
      read(`src/objects/${id}/source/presentation/solar-system.json`),
    ]);
    const input = { ...profile, scene, assets, datasets, sun, markers, controls, solarSource } as PresentationInputs;
    const prepared = await prepareCssPresentation(input, presentationHostAdapters(solarGeometry));
    // Runtime finalization adds motion/facing and can update marker/warm-bank
    // metadata. Compare the compiler-owned structure with the accepted runtime.
    const accepted = expected as Record<string, unknown>;
    for (const key of ['tree', 'variants', 'materials', 'camera', 'sky', 'sun', 'controls', 'viewBindings', 'animations', 'textureLevels'] as const) {
      expect(prepared[key]).toEqual(accepted[key]);
    }
    expect(prepared.tree.nodes.length).toBe(id === 'mercury' ? 909 : 456);
    if (id === 'mercury') {
      // One prepared density: mount and startup name the canonical map; there are no silhouette levels.
      expect(prepared.textureLevels).toBeUndefined();
      const surfaceImages = prepared.tree.properties.filter(property => property.name === '--mercury-surface-image');
      expect(surfaceImages.map(property => property.value)).toEqual(['url("/scenes/mercury/mercury-surface-normal@2x.jpg")']);
    }
  }, 30_000);
  it('rejects surface texture levels: raster surfaces have one prepared density', () => {
    const profile = { schema: 'cssearth-css-presentation-profile@2', namespace: 'mercury', mode: 'row-bank-cutaway', textureLevels: { hysteresis: 0.2, texelsPerCssPixel: 2 } };
    expect(() => parsePresentationProfile(profile)).toThrow(/one prepared density/);
  });
});
