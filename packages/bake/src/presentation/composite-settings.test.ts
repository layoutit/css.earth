import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { prepareCssPresentation, parsePresentationProfile } from './css-presentation.ts';
import { presentationHostAdapters } from '../objects/host-adapters/index.ts';
import * as solarGeometry from '../../../../src/platform/solar-geometry.mts';
import type { PresentationInputs } from './types.ts';

const root = resolve(import.meta.dirname, '../../../..');
const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, file), 'utf8'));

for (const id of ['neptune']) it(`${id} Rings controls the prepared ring mesh`, async () => {
  const base = `src/objects/${id}/prepared`;
  const profile = parsePresentationProfile(await read(`src/objects/${id}/source/preparation/presentation.json`));
  const [scene, assets, datasets, sun, controls, solarSource] = await Promise.all([
    ...['scene', 'assets', 'datasets', 'sun', 'controls'].map(file => read(`${base}/${file}.json`)),
    read(`src/objects/${id}/source/presentation/solar-system.json`),
  ]);
  const prepared = await prepareCssPresentation({ ...profile, scene, assets, datasets, sun, controls, solarSource } as PresentationInputs, presentationHostAdapters(solarGeometry));
  const variants = [false, true].map(rings => prepared.variants.find(variant =>
    variant.when.datasetId === prepared.controls.datasets?.defaultDataset && variant.when.shadows === false && variant.when.rings === rings));
  for (const [index, variant] of variants.entries()) {
    assert.notEqual(variant, undefined);
    const display = variant!.writes.find(write => write.kind === 'style' && write.name === 'display' &&
      prepared.tree.nodes[write.target]?.className?.includes('rings'));
    assert.partialDeepStrictEqual(display, { value: index ? 'block' : 'none' });
  }
}, 30_000);
