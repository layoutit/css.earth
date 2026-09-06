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
    expect(prepared).toEqual(expected);
    expect(prepared.tree.nodes.length).toBe(id === 'mercury' ? 1805 : 904);
    expect(createHash('sha256').update(JSON.stringify(canonical(prepared))).digest('hex')).toBe(expectedDigests[id]);
  }, 30_000);
});
// Updated for PR11's 16-entry navigation atlas: marker counts and shifted indices only.
// All other presentation fields remain equal to the pinned 13-entry baseline.
const expectedDigests: Record<string, string> = {
  mercury: '045bf3e245b1dae08ad4f92da7bb74a5af322f22fc757535acdceff709e47e4b',
  venus: 'a8efabd16486a7d821a84137e5c741a1c7f55bf0e85862ff0ebeb34af1b23bea',
};
