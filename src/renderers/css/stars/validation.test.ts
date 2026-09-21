import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { loadPreparedCssPointField, loadPreparedPointAppearance } from './loader.js';
import { decodePreparedCssPointField, parsePreparedCssPointFieldManifest } from './validation.js';
import { readCanonicalPointFieldFiles } from '../preparation/stars/canonical-point-field-fixture.js';
import { POINT_FIELD_MAGNITUDE_BOUND } from './point-field-bank.js';
import { IMPERCEPTIBLE_LUMINANCE } from './point-field-projection.js';
import { magnitudeDisplayAlphaChange } from '../preparation/stars/point-field-bank.js';

const copy = (bytes: Uint8Array) => new Uint8Array(bytes).buffer;
function fixture() {
  const files = readCanonicalPointFieldFiles();
  const data = (JSON.parse(new TextDecoder().decode(files.manifestBytes)) as { data: Record<string, unknown> }).data;
  const transport = (manifestBytes = files.manifestBytes, bankBytes = files.bankBytes) => ({ read: vi.fn(async (path: string) => {
    if (path === files.url) return copy(manifestBytes);
    if (path === files.bankUrl) return copy(bankBytes);
    throw new Error(`Unexpected prepared request ${path}.`);
  }) });
  return { ...files, data, transport };
}

test('decodes the checked prepared point field and verifies its manifest and bank pins once each', async () => {
  const { descriptor, url, bankUrl, bankBytes, data, transport } = fixture();
  const payload = decodePreparedCssPointField(parsePreparedCssPointFieldManifest(data), bankBytes);
  expect(payload.schema).toBe('cssearth-css-point-field@1');
  expect(payload.stars.length).toBe(109389);
  expect(payload.nodes[0]?.first).toBe(0);
  expect(payload.nodes[0]?.count).toBe(payload.stars.length);
  expect(payload.stars.filter(star => star.coverageAnchor)).toHaveLength(96);
  expect(payload.stars.some(star => star.name === 'Sirius')).toBe(true);
  expect(payload.directPoints?.points).toHaveLength(payload.policy.activeSlots);
  expect(payload.directPoints?.points.filter(star => star.coverageAnchor)).toHaveLength(96);
  expect(payload.photometry.floor).toBe(1 / 255);
  expect(payload.labels.activeSlots).toBe(1);
  expect(payload.resources.find(resource => resource.path === payload.atlas.path)).toBeDefined();
  const reader = transport(), loaded = await loadPreparedCssPointField(descriptor, reader);
  expect(reader.read.mock.calls).toEqual([[url], [bankUrl]]);
  expect(loaded.frame).toEqual((descriptor as { properties: { frame: unknown } }).properties.frame);
  expect(loaded.stars[4321]).toEqual(payload.stars[4321]);
  expect(loaded.nodes.at(-1)).toEqual(payload.nodes.at(-1));
});

test('declared magnitude quantization is bounded below what the runtime can display', () => {
  const { manifest } = fixture();
  const recipe = JSON.parse(readFileSync(new URL('../../../objects/stellar-neighbourhood/source/stars.json', import.meta.url), 'utf8')) as {
    atlas: { tileSize: number; haloRadii: number; coreInnerRadii: number; coreOuterRadii: number; haloPeak: number; samplesPerPixelAxis: number } };
  const magnitude = manifest.bank.quantization.find(entry => entry.field === 'star.absoluteMagnitude')!;
  expect(magnitude.bound).toBe(POINT_FIELD_MAGNITUDE_BOUND);
  expect(magnitude.measured).toBeGreaterThan(0);
  expect(magnitude.measured).toBeLessThanOrEqual(magnitude.bound);
  expect(magnitude.displayAlphaChange).toBe(magnitudeDisplayAlphaChange(manifest.photometry, recipe.atlas, magnitude.bound));
  expect(magnitude.displayAlphaChange).toBeLessThan(IMPERCEPTIBLE_LUMINANCE);
  for (const field of manifest.bank.quantization.filter(entry => entry !== magnitude)) expect([field.bound, field.measured, field.displayAlphaChange]).toEqual([0, 0, 0]);
});

test('rejects malformed hierarchy, rows, manifest fields and either pinned transport', async () => {
  const { descriptor, manifestBytes, bankBytes, manifest, data, transport } = fixture();
  const column = (name: string) => manifest.bank.columns.find(entry => entry.name === name)!;
  const tampered = (mutate: (view: DataView) => void) => { const bytes = new Uint8Array(bankBytes); mutate(new DataView(bytes.buffer)); return bytes; };
  const firstChild = (() => { const children = column('node.children'); return new DataView(bankBytes.buffer, bankBytes.byteOffset).getUint32(children.offset, true); })();
  const partition = tampered(view => view.setUint32(column('node.first').offset + firstChild * 4, view.getUint32(column('node.first').offset + firstChild * 4, true) + 1, true));
  expect(() => decodePreparedCssPointField(manifest, partition)).toThrow('partition');
  expect(() => decodePreparedCssPointField(manifest, tampered(view => view.setFloat32(column('star.positionUnits').offset, Number.NaN, true)))).toThrow('star');
  const resources = data.resources as Record<string, unknown>[];
  expect(() => parsePreparedCssPointFieldManifest({ ...data, resources: resources.map((resource, index) => index === 0 ? { ...resource, width: 1 } : resource) })).toThrow('atlas metadata');
  const policy = data.policy as Record<string, unknown>;
  expect(() => parsePreparedCssPointFieldManifest({ ...data, policy: { ...policy, transitionSlots: (policy.activeSlots as number) - 1 } })).toThrow('policy');
  const photometry = data.photometry as Record<string, unknown>;
  expect(() => parsePreparedCssPointFieldManifest({ ...data, photometry: { ...photometry, floor: 2 } })).toThrow('photometry');
  const labels = data.labels as Record<string, unknown>;
  expect(() => parsePreparedCssPointFieldManifest({ ...data, labels: { ...labels, transitionSlots: 0 } })).toThrow('labels');
  const directPoints = data.directPoints as { points: Record<string, unknown>[] };
  expect(() => parsePreparedCssPointFieldManifest({ ...data, directPoints: { ...(data.directPoints as object),
    points: directPoints.points.map((point, index) => index === 1 ? { ...point, sourceRow: directPoints.points[0]!.sourceRow } : point) } })).toThrow('direct star point');
  const bank = data.bank as Record<string, unknown>, quantization = bank.quantization as Record<string, unknown>[];
  expect(() => parsePreparedCssPointFieldManifest({ ...data, bank: { ...bank, encoding: 'other@1' } })).toThrow('bank');
  expect(() => parsePreparedCssPointFieldManifest({ ...data, bank: { ...bank, starCount: (bank.starCount as number) + 1 } })).toThrow('layout');
  expect(() => parsePreparedCssPointFieldManifest({ ...data, bank: { ...bank, quantization: quantization.map((entry, index) => index === 1 ? { ...entry, bound: 0.01 } : entry) } })).toThrow('quantization');
  expect(() => parsePreparedCssPointFieldManifest({ ...data, stars: [] })).toThrow('unsupported');
  await expect(loadPreparedCssPointField(descriptor, transport(new TextEncoder().encode(new TextDecoder().decode(manifestBytes) + '\n')))).rejects.toThrow('SHA-256');
  const flipped = new Uint8Array(bankBytes); flipped[flipped.length - 9]! ^= 1;
  await expect(loadPreparedCssPointField(descriptor, transport(undefined, flipped))).rejects.toThrow('bank length or SHA-256');
  await expect(loadPreparedCssPointField(descriptor, transport(undefined, bankBytes.subarray(0, bankBytes.length - 8)))).rejects.toThrow('bank length or SHA-256');
  const drifted = structuredClone(descriptor) as { properties: { frame: { originM: number[] } } };
  drifted.properties.frame.originM[0]! += 1;
  await expect(loadPreparedCssPointField(drifted, transport())).rejects.toThrow('frame');
});

test('Sun appearance verifies the manifest without fetching or decoding the star bank', async () => {
  const { descriptor, url, manifest, transport, manifestBytes } = fixture();
  const reader = transport();
  const appearance = await loadPreparedPointAppearance(descriptor, reader);
  expect(reader.read.mock.calls).toEqual([[url]]);
  expect(Object.keys(appearance).sort()).toEqual(['atlas', 'directPoints', 'frame', 'id', 'photometry', 'resources']);
  expect(appearance.atlas).toEqual(manifest.atlas);
  expect(appearance.photometry).toEqual(manifest.photometry);
  expect(appearance.directPoints).toEqual(manifest.directPoints);
  await expect(loadPreparedPointAppearance(descriptor, transport(new TextEncoder().encode(new TextDecoder().decode(manifestBytes) + '\n')))).rejects.toThrow('SHA-256');
});
