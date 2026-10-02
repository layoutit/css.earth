import { readFileSync } from 'node:fs';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { loadPreparedCssPointField, loadPreparedPointAppearance } from '@cssearth/renderer/stars/loader.ts';
import { decodePreparedCssPointField, parsePreparedCssPointFieldManifest } from '@cssearth/objects';
import { readCanonicalPointFieldFiles } from '@cssearth/renderer/test/canonical-point-field-fixture.ts';
import { POINT_FIELD_MAGNITUDE_BOUND } from '@cssearth/objects';
import { IMPERCEPTIBLE_LUMINANCE } from '@cssearth/renderer/stars/point-field-projection.ts';
import { magnitudeDisplayAlphaChange } from '@cssearth/bake/stars';

const copy = (bytes: Uint8Array) => new Uint8Array(bytes).buffer;
function fixture() {
  const files = readCanonicalPointFieldFiles();
  const data = (JSON.parse(new TextDecoder().decode(files.manifestBytes)) as { data: Record<string, unknown> }).data;
  const transport = (manifestBytes = files.manifestBytes, bankFile = files.bankFile) => ({ read: mock.fn(async (path: string) => {
    if (path === files.url) return copy(manifestBytes);
    if (path === files.bankUrl) return copy(bankFile);
    throw new Error(`Unexpected prepared request ${path}.`);
  }) });
  return { ...files, data, transport };
}

test('decodes the local prepared point field and reads its manifest and bank once each', async () => {
  const { descriptor, url, bankUrl, bankBytes, data, transport } = fixture();
  const payload = decodePreparedCssPointField(parsePreparedCssPointFieldManifest(data), bankBytes);
  assert.equal(payload.schema, 'cssearth-css-point-field@1');
  assert.equal(payload.stars.length, 255);
  assert.equal(payload.nodes[0]?.first, 0);
  assert.equal(payload.nodes[0]?.count, payload.stars.length);
  assert.equal(payload.stars.filter(star => star.coverageAnchor).length, 96);
  assert.equal(payload.stars.some(star => star.name === 'Sirius'), true);
  assert.equal(payload.photometry.floor, 1 / 255);
  assert.equal(payload.labels.activeSlots, 1);
  assert.notEqual(payload.resources.find(resource => resource.path === payload.atlas.path), undefined);
  const reader = transport(), loaded = await loadPreparedCssPointField(descriptor, reader);
  assert.deepEqual(reader.read.mock.calls.map(call => call.arguments), [[url], [bankUrl]]);
  assert.deepEqual(loaded.frame, (descriptor as { properties: { frame: unknown } }).properties.frame);
  assert.deepEqual(loaded.stars[123], payload.stars[123]);
  assert.deepEqual(loaded.nodes.at(-1), payload.nodes.at(-1));
});

test('declared magnitude quantization is bounded below what the runtime can display', () => {
  const { manifest } = fixture();
  const atlas = JSON.parse(readFileSync(new URL('../../../../packages/renderer/test/fixtures/point-field/atlas-recipe.json', import.meta.url), 'utf8')) as {
    tileSize: number; haloRadii: number; coreInnerRadii: number; coreOuterRadii: number; haloPeak: number; samplesPerPixelAxis: number };
  const magnitude = manifest.bank.quantization.find(entry => entry.field === 'star.absoluteMagnitude')!;
  assert.equal(magnitude.bound, POINT_FIELD_MAGNITUDE_BOUND);
  assert.ok(magnitude.measured >= 0);
  assert.ok(magnitude.measured <= magnitude.bound);
  assert.equal(magnitude.displayAlphaChange, magnitudeDisplayAlphaChange(manifest.photometry, atlas, magnitude.bound));
  assert.ok(magnitude.displayAlphaChange < IMPERCEPTIBLE_LUMINANCE);
  for (const field of manifest.bank.quantization.filter(entry => entry !== magnitude)) assert.deepEqual(([field.bound, field.measured, field.displayAlphaChange]), [0, 0, 0]);
});

test('rejects malformed hierarchy, rows and manifest fields', async () => {
  const { descriptor, manifestBytes, bankBytes, manifest, data, transport } = fixture();
  const column = (name: string) => manifest.bank.columns.find(entry => entry.name === name)!;
  const tampered = (mutate: (view: DataView) => void) => { const bytes = new Uint8Array(bankBytes); mutate(new DataView(bytes.buffer)); return bytes; };
  const firstChild = (() => { const children = column('node.children'); return new DataView(bankBytes.buffer, bankBytes.byteOffset).getUint32(children.offset, true); })();
  const partition = tampered(view => view.setUint32(column('node.first').offset + firstChild * 4, view.getUint32(column('node.first').offset + firstChild * 4, true) + 1, true));
  assert.throws(() => decodePreparedCssPointField(manifest, partition), /partition/);
  assert.throws(() => decodePreparedCssPointField(manifest, tampered(view => view.setFloat32(column('star.positionUnits').offset, Number.NaN, true))), /star/);
  const resources = data.resources as Record<string, unknown>[];
  assert.throws(() => parsePreparedCssPointFieldManifest({ ...data, resources: resources.map((resource, index) => index === 0 ? { ...resource, width: 1 } : resource) }), /atlas metadata/);
  const policy = data.policy as Record<string, unknown>;
  assert.throws(() => parsePreparedCssPointFieldManifest({ ...data, policy: { ...policy, transitionSlots: (policy.activeSlots as number) - 1 } }), /policy/);
  const photometry = data.photometry as Record<string, unknown>;
  assert.throws(() => parsePreparedCssPointFieldManifest({ ...data, photometry: { ...photometry, floor: 2 } }), /photometry/);
  const labels = data.labels as Record<string, unknown>;
  assert.throws(() => parsePreparedCssPointFieldManifest({ ...data, labels: { ...labels, transitionSlots: 0 } }), /labels/);
  assert.throws(() => parsePreparedCssPointFieldManifest({ ...data, directPoints: {} }), /unsupported/, 'the direct star sample is gone');
  const bank = data.bank as Record<string, unknown>, quantization = bank.quantization as Record<string, unknown>[];
  assert.throws(() => parsePreparedCssPointFieldManifest({ ...data, bank: { ...bank, encoding: 'other@1' } }), /bank/);
  assert.throws(() => parsePreparedCssPointFieldManifest({ ...data, bank: { ...bank, starCount: (bank.starCount as number) + 1 } }), /layout/);
  assert.throws(() => parsePreparedCssPointFieldManifest({ ...data, bank: { ...bank, quantization: quantization.map((entry, index) => index === 1 ? { ...entry, bound: 0.01 } : entry) } }), /quantization/);
  assert.throws(() => parsePreparedCssPointFieldManifest({ ...data, stars: [] }), /unsupported/);
  const drifted = structuredClone(descriptor) as { properties: { frame: { originM: number[] } } };
  drifted.properties.frame.originM[0]! += 1;
  await assert.rejects(loadPreparedCssPointField(drifted, transport()), /frame/);
});

test('Sun appearance verifies the manifest without fetching or decoding the star bank', async () => {
  const { descriptor, url, manifest, transport, manifestBytes } = fixture();
  const reader = transport();
  const appearance = await loadPreparedPointAppearance(descriptor, reader);
  assert.deepEqual(reader.read.mock.calls.map(call => call.arguments), [[url]]);
  assert.deepEqual(Object.keys(appearance).sort(), ['atlas', 'frame', 'id', 'photometry', 'resources']);
  assert.deepEqual(appearance.atlas, manifest.atlas);
  assert.deepEqual(appearance.photometry, manifest.photometry);
});
