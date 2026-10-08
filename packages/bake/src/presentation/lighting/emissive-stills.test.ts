import { parsePresentationProfile } from '@cssearth/objects';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { prepareCssPresentation } from '../css-presentation.ts';
import { presentationHostAdapters } from '../../objects/host-adapters/index.ts';
import * as solarGeometry from '../../../../../src/platform/solar-geometry.mts';
import type { PresentationInputs } from '../types.ts';

const test = sourceTest(), root = resolve(import.meta.dirname, '../../../../..');
const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, file), 'utf8'));

// RY CMa plays its Gaia light curve as a veil over its disc, and its Pulsation datasets each draw the star at one phase of
// that light curve.
test('a dataset that is a still of the light curve takes the veil off; a body with no still writes nothing on its veil', { timeout: 60_000 }, async () => {
  const id = 'ry-cma', base = `src/objects/${id}/prepared`;
  const profile = parsePresentationProfile(await read(`src/objects/${id}/source/preparation/presentation.json`));
  const [scene, assets, datasets, sun, controls, solarSource] = await Promise.all([
    ...['scene', 'assets', 'datasets', 'sun', 'controls'].map(file => read(`${base}/${file}.json`)), read(`src/objects/${id}/source/presentation/solar-system.json`)]);
  const stills = (datasets as { controls: { id: string; step?: { group: string } }[] }).controls.filter(control => control.step?.group === profile.lightCurve?.stills).map(control => control.id);
  assert.equal(stills.length, 10);
  const track = { durationMs: 1559, keyframes: [{ offset: 0, opacity: '0.2010' }, { offset: 0.5, opacity: '0.0000' }, { offset: 1, opacity: '0.2010' }] };
  const compile = (lightCurve: PresentationInputs['lightCurve']) => prepareCssPresentation({ namespace: profile.namespace, mode: profile.mode, lightCurve, scene, assets, datasets, sun, controls, solarSource } as PresentationInputs, presentationHostAdapters(solarGeometry));
  const prepared = await compile({ ...track, stills }), veil = prepared.tree.nodes.findIndex(node => node.className === `${id}-light-veil`);
  assert.ok(veil >= 0); assert.equal(prepared.motion?.[0]?.target, veil);
  for (const variant of prepared.variants) assert.deepEqual(variant.writes.filter(write => write.target === veil),
    [{ kind: 'style', target: veil, name: 'display', value: stills.includes(String(variant.when.datasetId)) ? 'none' : 'block' }], String(variant.when.datasetId));
  // Without stills the veil is written by no selection, as every star that only plays its light curve was prepared.
  const played = await compile(track);
  assert.ok(played.variants.every(variant => variant.writes.every(write => write.target !== veil)));
  await assert.rejects(compile({ ...track, stills: ['no-such-dataset'] }), /names the still no-such-dataset, which is not a dataset of the body/u);
});
