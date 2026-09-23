import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { prepareCssPresentation, parsePresentationProfile } from './index.js';
import type { PresentationInputs } from './types.js';

const root = resolve(import.meta.dirname, '../../../../..');
const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, file), 'utf8'));

for (const id of ['neptune', 'uranus']) it(`${id} Rings controls the prepared ring mesh`, async () => {
  const base = `src/objects/${id}/prepared`;
  const profile = parsePresentationProfile(await read(`src/objects/${id}/source/preparation/presentation.json`));
  const [scene, assets, lenses, sun, controls, solarSource] = await Promise.all([
    ...['scene', 'assets', 'lenses', 'sun', 'controls'].map(file => read(`${base}/${file}.json`)),
    read(`src/objects/${id}/source/presentation/solar-system.json`),
  ]);
  const prepared = await prepareCssPresentation({ ...profile, scene, assets, lenses, sun, controls, solarSource } as PresentationInputs);
  const variants = [false, true].map(rings => prepared.variants.find(variant =>
    variant.when.lensId === prepared.controls.lenses?.defaultLens && variant.when.shadows === false && variant.when.rings === rings));
  for (const [index, variant] of variants.entries()) {
    expect(variant).toBeDefined();
    const display = variant!.writes.find(write => write.kind === 'style' && write.name === 'display' &&
      prepared.tree.nodes[write.target]?.className?.includes('rings'));
    expect(display).toMatchObject({ value: index ? 'block' : 'none' });
  }
}, 30_000);
