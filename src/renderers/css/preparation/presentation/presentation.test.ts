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
    expect(prepared.tree.nodes.length).toBe(id === 'mercury' ? 909 : 456);
    expect(createHash('sha256').update(JSON.stringify(canonical(prepared))).digest('hex')).toBe(expectedDigests[id]);
  }, 30_000);
});
// Source-compiled direct leaves compose the prepared frame and texture transform.
const expectedDigests: Record<string, string> = {
  mercury: '56519a7b96af7ebdbe81ab5a1d69b0e00bc1d9f064d13a6705c43aa7c44498da',
  venus: '7c5846a3e69c5b8e8bbdb22408034d0e17eda4e93cf741bdf3c1ae879d7a5e43',
};
