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
    const base = `src/planets/${id}/prepared`;
    const profile = parsePresentationProfile(await read(`src/planets/${id}/source/preparation/presentation.json`));
    const [scene, assets, lenses, sun, markers, controls, expected, solarSource] = await Promise.all([
      ...['scene', 'assets', 'lenses', 'sun', 'markers', 'controls', 'runtime'].map(file => read(`${base}/${file}.json`)),
      read(`src/planets/${id}/source/presentation/solar-system.json`),
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
    if (id === 'venus') {
      // The composite mesh paints its whole-body layers through one property per
      // layer, so the runtime owns the density and levels it by silhouette.
      const levels = prepared.textureLevels!.levels;
      expect(levels.map(level => level.minimumDiameter)).toEqual([0, 1024 / (2 * Math.PI)]);
      expect(levels[0].resources['surface:clouds']).toBe('surface:clouds:level:1024');
      expect(levels[0].resources['poles:clouds']).toBe('poles:clouds:level:1024');
      expect(prepared.assets.startup.filter(key => key.startsWith('surface:'))).toEqual(['surface:clouds:level:1024']);
      // The mount stands alone: each layer property carries its level-0 address
      // before the first selection commits, and no leaf is written per mount.
      const mounted = prepared.tree.properties.filter(property => /^--venus-(surface|poles)-image$/.test(property.name));
      expect(mounted.map(property => property.value).sort()).toEqual([
        'url("/scenes/venus/venus-clouds.webp")', 'url("/scenes/venus/venus-poles-clouds.webp")',
      ]);
      expect(prepared.tree.properties.some(property => property.name === 'backgroundImage')).toBe(false);
      for (const layer of ['surface', 'poles']) {
        expect(prepared.variants.every(variant => variant.writes.some(write => write.kind === 'texture' &&
          write.name === `--venus-${layer}-image` && variant.required.includes(write.resource!)))).toBe(true);
      }
    }
  }, 30_000);
  it('accepts layer levels in any presentation, and still rejects an unusable rule', () => {
    // Levels belong to the prepared layers, not to a material mode: the shared
    // selection reads only the projected silhouette. `null` declines them.
    const profile = { schema: 'cssearth-css-presentation-profile@1', namespace: 'venus', mode: 'composite', textureLevels: { hysteresis: 0.2, texelsPerCssPixel: 2 } };
    expect(parsePresentationProfile(profile).textureLevels).toEqual({ hysteresis: 0.2, texelsPerCssPixel: 2 });
    expect(parsePresentationProfile({ ...profile, textureLevels: null }).textureLevels).toBeNull();
    expect(parsePresentationProfile({ ...profile, mode: 'emissive' }).textureLevels).toEqual({ hysteresis: 0.2, texelsPerCssPixel: 2 });
    for (const textureLevels of [{ hysteresis: 1, texelsPerCssPixel: 2 }, { hysteresis: 0.2, texelsPerCssPixel: 0 }, { hysteresis: 0.2 }]) {
      expect(() => parsePresentationProfile({ ...profile, mode: 'row-bank-cutaway', textureLevels })).toThrow();
    }
  });
});
// Full raw output hashes from original JS helpers; see tools/evidence/presentation-typescript-parity.json.
// Mercury's hash was updated for its surface texture levels and JPEG surface maps.
// Venus's hash was updated when the composite layers became prepared levels: the
// published rule reads a layer property the variant writes, so the plan gained
// two texture writes, the level pair of each layer and their mount addresses.
// Mercury's hash is unchanged by that move, which is the parity evidence that the
// shared level builder reproduces the row-bank output it replaced.
const expectedDigests: Record<string, string> = {
  mercury: '4070cf874d98f9ead4aed6abdaeb4be984759350cff9b637bf1c3c1131cd3dd1',
  venus: 'e3b9523c1d8c3b712fdd5bb04fe0dd259386df4f8652167f83fdfcdf9348d886',
};
