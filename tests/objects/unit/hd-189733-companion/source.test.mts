import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { starStateKm } from '@cssearth/astronomy';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { loadStellarPhotometricColor } from '../../../../tools/objects/observation/stellar-photometric-color.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../../../tools/sources/source-values.mts';

const body = resolve(import.meta.dirname, '../../../../src/objects/hd-189733-companion'), root = resolve(body, 'source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;

test('HD 189733 B retains its pins; its acquisitions are the font, the Gaia row and spectrum, and the TIC row', async () => {
  const source = await createSourceManifest({ planetId: 'hd-189733-companion', planetName: 'HD 189733 B', sourceRoot: root });
  await source.verify();
  const operations = requireArray(requireRecord(await read('preparation/acquisition.json')).operations).map(value => requireString(requireRecord(value).path));
  assert.deepEqual(operations, ['presentation/InterVariable.ttf', 'photometry/gaia-dr3-source.csv', 'photometry/gaia-dr3-xp-sampled.csv', 'photometry/tic-8.2.tsv']);
  const science = requireRecord(requireRecord(requireArray(requireRecord(await read('preparation/raster.json')).surfaces)[0]).science);
  const { color, limbDarkening, range } = await loadStellarPhotometricColor(path => readFile(resolve(root, path)), science, 'photometry/stellar-color.json');
  assert.deepEqual(color.srgb, [255, 201, 123]);
  assert.equal(limbDarkening, null);
  // The record is a Gaia XP sampled spectrum, so the loader always reports the one-sigma fainter and brighter colours.
  assert.ok(range, 'the XP spectrum reports a colour range');
  for (const bound of range) for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(bound.srgb[channel]! - color.srgb[channel]!) <= 3);
});

test('radius and mass are the catalogue\'s; B is placed at A\'s distance, 11.44 arcsec from it as seen from the Sun', async () => {
  const tic = (await readFile(resolve(root, 'photometry/tic-8.2.tsv'), 'utf8')).trim().split('\n').map(line => line.split('\t').map(cell => cell.trim()));
  const row = tic.find(cells => cells[0] === '256364937')!, column = (name: string) => Number(row[tic[0]!.indexOf(name)]);
  const record = requireRecord(JSON.parse(await readFile(resolve(body, '../../../packages/astronomy/data/bodies/hd-189733-companion.json'), 'utf8')) as unknown);
  const host = requireRecord(JSON.parse(await readFile(resolve(body, '../../../packages/astronomy/data/bodies/hd-189733.json'), 'utf8')) as unknown);
  assert.ok(Math.abs(requireFiniteNumber(requireRecord(record.physical).meanRadiusKm) - column('Rad') * 695700) < 1e-6);
  assert.ok(Math.abs(requireFiniteNumber(requireRecord(record.physical).gravitationalParameterKm3PerS2) / 132712440041.93938 - column('Mass')) < 1e-12);
  assert.equal(requireRecord(record.star).distanceParsecs, requireRecord(host.star).distanceParsecs);
  const epoch = 2457389.0; // J2016.0 (TT), the Gaia epoch
  const a = starStateKm('hd-189733', epoch).positionKm, b = starStateKm('hd-189733-companion', epoch).positionKm;
  const angle = Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b)) * 180 / Math.PI * 3600;
  assert.ok(Math.abs(angle - 11.44) < 0.01, `separation ${angle} arcsec`);
});
