import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasErrorCode, requireArray, requireRecord, requireString } from '@cssearth/core';
import { extractPreview } from './extract.mts';
import { renderPreview } from './render.mts';
import { previewSource, type PreviewChoice } from './source.mts';

const mocks = resolve(import.meta.dirname, '../../../../output/tui-mocks');
const cases: readonly { file: string; origin: 'eso' | 'hst' | 'alma'; product: 'spectrum' | 'image' | 'cube'; pick: string; unit: string }[] = [
  { file: 'ADP.2021-08-29T14:38:00.222.fits', origin: 'eso', product: 'spectrum', pick: '33', unit: 'y adu · x nm' },
  { file: 'ADP.2026-08-19T13:19:07.649.fits', origin: 'eso', product: 'image', pick: '43', unit: 'SPHERE image · ESO data' },
  { file: 'o4de03010_sx1.fits', origin: 'hst', product: 'spectrum', pick: '47', unit: 'y ×10⁻¹¹ erg/s/cm²/Å · x nm' },
  { file: 'alma-cube-cutout.fits', origin: 'alma', product: 'cube', pick: '9', unit: 'y mJy/beam · x GHz' },
  { file: 'alma-continuum-cutout.fits', origin: 'alma', product: 'image', pick: '1', unit: 'continuum image · ALMA data' },
];
for (const entry of cases) test(`optional real ${entry.file} exactly matches its pinned panel`, async t => {
  let bytes: Buffer, expected: Record<string, unknown>;
  try { bytes = await readFile(resolve(mocks, 'real-sources', entry.file)); expected = requireRecord(JSON.parse(await readFile(resolve(mocks, 'real-previews.json'), 'utf8'))); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) { t.skip('Optional ignored real sources are absent.'); return; } throw error; }
  const data = extractPreview(bytes, entry.origin, entry.product, 'SPHERE'), lines = renderPreview(data);
  // SPHERE intentionally replaces the nearest-pixel mock with the corrected area-mean panel.
  const reference = requireArray(entry.pick === '43' ? JSON.parse(await readFile(new URL('./fixtures/sphere-area-panel.json', import.meta.url), 'utf8')) : expected[entry.pick])
    .map(line => requireString(line));
  assert.equal(lines.length, reference.length); assert.ok(lines.every(line => Array.from(line).length === 40));
  assert.equal(lines[11]!.trim(), entry.unit); assert.equal(lines[11]!.trim(), reference[11]!.trim());
  if (data.kind === 'spectrum') {
    assert.equal(data.x.length, 90); assert.ok(data.y.every(Number.isFinite));
    assert.ok(lines.slice(0, 10).filter(line => /[│┤]/u.test(line)).every(line => line.search(/[│┤]/u) === 5));
    assert.match(lines[10]!, /\d/u); assert.doesNotMatch(lines[10]!, /[─│┤]/u);
  } else {
    assert.equal(data.kind, 'image'); assert.ok(lines.slice(0, 11).some(line => /[.:%@*#]/u.test(line)));
  }
  assert.deepEqual(lines, reference);
});

test('optional saved exploration resolves all 72 choices without network IO', async t => {
  let saved: Record<string, unknown>;
  try { saved = requireRecord(JSON.parse(await readFile(resolve(mocks, 'real-sources/betelgeuse-explore.json'), 'utf8'))); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) { t.skip('Optional saved exploration is absent.'); return; } throw error; }
  const choices = requireArray(saved.choices); assert.equal(choices.length, 72);
  const kinds: string[] = [];
  for (const raw of choices) {
    const row = requireRecord(raw), display = requireRecord(row.display), reference = requireRecord(row.reference);
    if (reference.kind !== 'vo-acquisition' || typeof row.pick !== 'number') throw new Error('Unexpected real choice structure.');
    const choice: PreviewChoice = { pick: row.pick, observation: requireString(row.observation), telescope: requireString(row.telescope),
      reference: { kind: 'vo-acquisition', observation: requireString(reference.observation), acquisitionKey: requireString(reference.acquisitionKey), snapshot: requireString(reference.snapshot) },
      display: { instrument: requireString(display.instrument), productKind: requireString(display.productKind), advertisedKilobytes: typeof display.advertisedKilobytes === 'number' ? display.advertisedKilobytes : null,
        metadataBasis: 'advertised', observationTime: { startIso: null, endIso: null }, wavelengthsMicrometres: [null, null] } };
    try { kinds.push((await previewSource(choice, { answer: { request: {} } })).kind); }
    catch (error) { if (hasErrorCode(error, 'ENOENT')) { t.skip('Optional local archive snapshots are absent.'); return; } throw error; }
  }
  // Snapshot XML is optional too; a missing ALMA position is explicitly reported as none.
  assert.equal(kinds.filter(kind => kind === 'hst').length, 27);
  assert.equal(kinds.filter(kind => kind === 'eso').length, 13);
  assert.ok(kinds.slice(0, 32).every(kind => kind === 'alma' || kind === 'none'));
});
