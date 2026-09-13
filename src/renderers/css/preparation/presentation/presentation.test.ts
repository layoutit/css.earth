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
    for (const key of ['tree', 'variants', 'materials', 'camera', 'sky', 'sun', 'controls', 'viewBindings', 'animations'] as const) {
      expect(prepared[key]).toEqual(accepted[key]);
    }
    expect(prepared.tree.nodes.length).toBe(id === 'mercury' ? 909 : 456);
    expect(createHash('sha256').update(JSON.stringify(canonical(prepared))).digest('hex')).toBe(expectedDigests[id]);
    expect(prepared.textureLevels).toBeUndefined();
  }, 30_000);
  it('rejects surface texture levels in every retained globe presentation', () => {
    for (const mode of ['composite', 'row-bank-cutaway'])
      expect(() => parsePresentationProfile({ schema: 'cssearth-css-presentation-profile@1', namespace: 'venus', mode, textureLevels: { hysteresis: 0.2, texelsPerCssPixel: 2 } })).toThrow();
  });
});
// Full raw output hashes from original JS helpers; see tools/evidence/presentation-typescript-parity.json.
// Both hashes were updated for the stepped seam outset and matched raster overscan,
// and when every prepared raster became a single @2x file.
const expectedDigests: Record<string, string> = {
  mercury: 'ec9416f87949505927aaa70a462a74e8a0633f73c716ef5df5efb17800d90d01',
  venus: '07cd6e0d9e78886ec8e99be8146c58e3408b3ad8efea630f694b0f015291f41c',
};
