import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PreparedCssVolume } from '../volume/delivery/css-volume-types.js';
import type { PreparedCataloguePoints } from '../volume/catalogue/prepared-catalogue-points.js';
import { validatePreparedVolumeDatasets, type PreparedVolumeDatasets } from '../volume/delivery/prepared-volume-datasets.js';
import { validatePreparedVolumeDatasetIndex } from '../volume/delivery/volume-dataset-bank-files.js';
import { readVolumeDatasetBank, volumeDatasetBankFiles, writeVolumeDatasetBank } from './volume-dataset-bank.js';
import { unpackPreparedBank } from './prepared-binary-file.js';

const frame = { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const, metersPerUnit: 1,
  boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
const points = (opacity = .7): PreparedCataloguePoints => ({ frame, points: [
  { id: 'catalogue:a', positionUnits: [-1.0000000000000002, 1, 0], sizePx: 3.141724106182826, colorCss: '#ffeecc', opacity },
  { id: 'catalogue:b', positionUnits: [0, 0, 20], sizePx: 2, diameterUnits: 0.25, colorCss: '#ffffff', opacity: 1 },
] });
const volume = (id: string, atlasOffset = 0, geometryOffset = 0): PreparedCssVolume => ({ schema: 'cssearth-css-volume@1', id, frame, anchors: [],
  stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0], texturePath: `${id}/${axis}.webp`, widthPx: 1, heightPx: 1,
    style: { width: '1px', height: '1px', transform: `matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,${axis === 'x' ? geometryOffset : 0},0,0,1)`, backgroundSize: '3px 1px', backgroundPosition: `${atlasOffset}px 0px` } }] })),
  resources: ['x', 'y', 'z'].map(axis => ({ path: `${id}/${axis}.webp`, bytes: 1, width: 1, height: 1 })),
  provenance: { method: `${id} method` }, approximation: { note: 'fixture' } });
const bank = (): PreparedVolumeDatasets => validatePreparedVolumeDatasets({ schema: 'cssearth-volume-datasets@1', id: 'fixture', defaultDataset: 'first', framingRadiusUnits: 1,
  provenance: { made: 'here' }, datasets: [['first', 0, 0, .7], ['second', -1, 0, .7], ['third', 0, 5, .4]].map(([id, atlas, geometry, opacity]) => ({ id: id as string, label: id as string, title: `${id} dataset`,
    description: 'Prepared observation', sourceUrl: 'https://example.org/source', volume: volume(id as string, atlas as number, geometry as number), brightness: { overall: .8, x: .2, y: .5, z: .9 }, stars: points(opacity as number) })) });

test('a bank is stored as an index, one volume a dataset and each set of stars once, and reads back as the bank it was', async () => {
  const files = volumeDatasetBankFiles(bank()), names = [...files.keys()].sort();
  assert.deepEqual(names, ['datasets.json', 'first/volume.json', 'record.json', 'second/volume.json', 'stars.bin', 'third/stars.bin', 'third/volume.json']);
  const envelope = JSON.parse(new TextDecoder().decode(files.get('datasets.json'))) as { format: string; data: unknown };
  assert.equal(envelope.format, 'cssearth-volume-dataset-index@1');
  const index = validatePreparedVolumeDatasetIndex(envelope.data);
  assert.deepEqual(index.datasets.map(dataset => [dataset.id, dataset.topology, dataset.volume, dataset.stars]),
    [['first', 0, 'first/volume.json', 'stars.bin'], ['second', 0, 'second/volume.json', 'stars.bin'], ['third', 1, 'third/volume.json', 'third/stars.bin']],
    'datasets of one geometry share a family; datasets that draw the same stars share their file');
  assert.equal('provenance' in (envelope.data as object), false);
  for (const name of names.filter(name => name.endsWith('/volume.json'))) {
    const stored = JSON.parse(new TextDecoder().decode(files.get(name))) as Record<string, unknown>;
    assert.equal('provenance' in stored || 'approximation' in stored, false, `${name} carries nothing the page does not read`);
  }
  assert.deepEqual([...unpackPreparedBank(files.get('stars.bin')!).columns.position!].slice(0, 3), [-1.0000000000000002, 1, 0], 'a position keeps every digit');
  const directory = await mkdtemp(join(tmpdir(), 'bank-'));
  try {
    assert.deepEqual([...await writeVolumeDatasetBank(directory, bank())].sort(), names);
    assert.deepEqual(JSON.parse(JSON.stringify(await readVolumeDatasetBank(directory))), JSON.parse(JSON.stringify(bank())));
    await rm(join(directory, 'second/volume.json'));
    await assert.rejects(readVolumeDatasetBank(directory), /second\/volume\.json/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an index that names no default, a file outside the bank or one texture two ways is refused', () => {
  const index = (JSON.parse(new TextDecoder().decode(volumeDatasetBankFiles(bank()).get('datasets.json'))) as { data: { defaultDataset: string; datasets: { volume: string; resources: { bytes: number }[] }[] } }).data;
  assert.throws(() => validatePreparedVolumeDatasetIndex({ ...index, defaultDataset: 'absent' }), /Volume dataset index fixture: its default dataset absent/u);
  assert.throws(() => validatePreparedVolumeDatasetIndex({ ...index, datasets: [{ ...index.datasets[0], volume: '../outside.json' }] }), /dataset first: its card, family or files are invalid/u);
  const twice = [index.datasets[0], { ...index.datasets[1], resources: index.datasets[0]!.resources.map(resource => ({ ...resource, bytes: resource.bytes + 1 })) }];
  assert.throws(() => validatePreparedVolumeDatasetIndex({ ...index, datasets: twice }), /first\/x\.webp is described differently/u);
});
