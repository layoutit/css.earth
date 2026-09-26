import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parsePreparedObjectRuntime } from './index.js';
import { record, array } from './guards.js';

// These are the real preparation outputs, loaded only by this browser-boundary test.
const originals: unknown[] = [];
for (const id of ['mercury', 'venus']) {
  const source = await readFile(new URL(`../../../../src/objects/${id}/prepared/runtime.json`, import.meta.url), "utf8");
  originals.push(JSON.parse(source));
}
const copy = (index = 1): Record<string, unknown> => record(structuredClone(originals[index]), 'test document');
const child = (value: unknown, key: string) => record(record(value, 'test parent')[key], key);
const item = (value: unknown, index = 0) => record(array(value, 'test array')[index], 'test record');

test('external transport cannot silently omit prepared activation ownership', () => {
  const missing = copy();
  delete child(missing, 'tree').activationGroups;
  assert.throws(() => parsePreparedObjectRuntime(missing), /activation groups must be prepared/);
});

test('Tuttle transport preserves selection ranges and rejects incomplete or invalid picking banks', async () => {
  const original = JSON.parse(await readFile(new URL('../../../../src/objects/comet-8p/prepared/runtime.json', import.meta.url), 'utf8'));
  const parsed = parsePreparedObjectRuntime(original);
  assert.deepEqual(parsed.surfaceHit?.lensRanges, [
    {lensId: 'model', start: 0, count: 1000}, {lensId: 'arecibo', start: 1000, count: 1000},
  ]);
  for (const mutate of [
    (ranges: {lensId: string; start: number; count: number}[]) => ranges.pop(),
    (ranges: {lensId: string; start: number; count: number}[]) => { ranges[1]!.lensId = 'model'; },
    (ranges: {lensId: string; start: number; count: number}[]) => { ranges[1]!.count = 1001; },
    (ranges: {lensId: string; start: number; count: number}[]) => { ranges[0]!.start = -1; },
  ]) {
    const input = structuredClone(original); mutate(input.surfaceHit.lensRanges);
    assert.throws(() => parsePreparedObjectRuntime(input), /surface|duplicate/);
  }
});

test('actual prepared Mercury and Venus documents preserve every JSON value and reference', () => {
  for (const original of originals) {
    const parsed = parsePreparedObjectRuntime(original);
    assert.equal(parsed, original);
    assert.equal(parsed.schema, 'cssearth-object-runtime@4');
  }
  assert.equal('heliocentricView' in record(originals[0], 'Mercury runtime'), false, 'the shared universe draws the solar system');
  assert.equal(parsePreparedObjectRuntime(originals[1]).controls.lenses?.defaultLens, 'clouds');
});

test('node parents, scene ancestry, property references and retained targets are validated', () => {
  for (const mutate of [
    (p: Record<string, unknown>) => { item(child(p, 'tree').nodes).parent = 0; },
    (p: Record<string, unknown>) => { child(p, 'tree').camera = 999999; },
    (p: Record<string, unknown>) => { item(child(p, 'tree').nodes, 1).parent = -1; },
    (p: Record<string, unknown>) => { item(child(p, 'tree').nodes).properties = [999999]; },
    (p: Record<string, unknown>) => { item(item(p.variants).writes).target = 999999; },
    (p: Record<string, unknown>) => { item(p.materials).target = child(p, 'tree').camera; },
    (p: Record<string, unknown>) => { item(p.viewBindings).target = 999999; },
  ]) {
    const input = copy(); mutate(input); assert.throws(() => parsePreparedObjectRuntime(input), TypeError);
  }
});

test('undeclared and duplicate resource references fail before acquisition', () => {
  for (const mutate of [
    (p: Record<string, unknown>) => { child(p, 'assets').startup = ['missing']; },
    (p: Record<string, unknown>) => { item(child(p, 'assets').entries).pool = 'missing'; },
    (p: Record<string, unknown>) => { item(p.variants).required = ['missing']; },
    (p: Record<string, unknown>) => { item(item(item(p.materials).banks).frames).resource = 'missing'; },
    (p: Record<string, unknown>) => { const assets = child(p, 'assets'); assets.entries = [...array(assets.entries, 'entries'), item(assets.entries)]; },
    (p: Record<string, unknown>) => { item(child(p, 'assets').pools).concurrency = 999999; },
    (p: Record<string, unknown>) => { item(child(p, 'assets').entries).url = 'javascript:invalid'; },
  ]) {
    const input = copy(); mutate(input); assert.throws(() => parsePreparedObjectRuntime(input), /resource|pool|undeclared|concurrency/);
  }
});

test('camera fields and crossfade bounds cannot carry malformed or missing values', () => {
  for (const [field, value] of [['minimumZoom', 0], ['defaultZoom', 100], ['sceneScale', '1'],
    ['pitchBounded', 1], ['pitchBounded', true], ['defaultControlYawDegrees', null], ['cameraModel', 'unprepared']] as const) {
    const input = copy(); child(input, 'camera')[field] = value;
    assert.throws(() => parsePreparedObjectRuntime(input), /camera|zoom|sceneScale|pitchBounded/);
  }
  const missing = copy(); delete child(missing, 'camera').responsiveFit;
  assert.throws(() => parsePreparedObjectRuntime(missing), /responsive/);
  const invalidDolly = copy(0); child(child(invalidDolly, 'camera'), 'dolly').minimumDistanceRadii = 1;
  assert.throws(() => parsePreparedObjectRuntime(invalidDolly), /outside body/);
});

test('prepared material ordering, variant coverage and animation ownership remain enforced', () => {
  for (const mutate of [
    (p: Record<string, unknown>) => { child(item(p.materials), 'frame').thresholds = [0, -0.5]; },
    (p: Record<string, unknown>) => { item(item(item(p.materials).banks).frames).frame = 5; },
    (p: Record<string, unknown>) => { item(item(p.variants).materials).bank = 'missing'; },
    (p: Record<string, unknown>) => { p.variants = array(p.variants, 'variants').slice(1); },
    (p: Record<string, unknown>) => { p.variants = [...array(p.variants, 'variants'), item(p.variants)]; },
  ]) {
    const input = copy(); mutate(input); assert.throws(() => parsePreparedObjectRuntime(input), /phase|frame|bank|selection table/);
  }
  const input = copy(0); item(input.animations).target = child(input, 'tree').scene;
  assert.throws(() => parsePreparedObjectRuntime(input), /animation cannot target/);
});

test('celestial direction and sky registration are validated', () => {
  const direction = copy(); child(direction, 'sun').localDirection = [1, 1, 1];
  assert.throws(() => parsePreparedObjectRuntime(direction), /unit direction/);
  const registration = copy(0); delete child(registration, 'sky').sceneRegistration;
  assert.throws(() => parsePreparedObjectRuntime(registration), /scene registration/);
});

test('executable values, symbols, nonfinite numbers and cycles are rejected without evaluating getters', () => {
  let reads = 0;
  assert.throws(() => parsePreparedObjectRuntime({get schema() { reads++; return 'bad'; }}), /executable/);
  assert.equal(reads, 0);
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  const sparse = copy(); child(sparse, 'tree').nodes = new Array(3);
  for (const invalid of [undefined, {value: () => 0}, {value: Infinity}, cyclic, sparse, {[Symbol('hidden')]: 1}]) {
    assert.throws(() => parsePreparedObjectRuntime(invalid), TypeError);
  }
});

test('a body without lenses validates both fixed and toggle-selected presentations', async () => {
  const original = JSON.parse(await readFile(new URL('../../../../src/objects/haumea/prepared/runtime.json', import.meta.url), 'utf8'));
  parsePreparedObjectRuntime(original);
  const input = structuredClone(original);
  // Exercise an absent capability independently of the body's current lenses.
  input.controls.lenses = null;
  input.variants = [{ ...input.variants[0], when: {} }];
  assert.equal(parsePreparedObjectRuntime(input).controls.lenses, null);
  input.variants[0].when.lensId = 'model';
  assert.throws(() => parsePreparedObjectRuntime(input), /declared lens capability/);
  delete input.variants[0].when.lensId;
  input.controls.settings.controls = [{ kind: 'toggle', name: 'shadows', label: 'Shadows', checked: true }];
  input.variants = [false, true].map(shadows => ({ ...structuredClone(original.variants[0]), when: { shadows },
    writes: [...original.variants[0].writes, { kind: 'class', target: -1, name: 'test-shadows', value: shadows }] }));
  parsePreparedObjectRuntime(input);
  input.variants.pop();
  assert.throws(() => parsePreparedObjectRuntime(input), /exactly once/);
});


test('prepared destination roll is optional and rejects non-finite or nonnumeric values', () => {
  const input = copy(), camera = child(input, 'camera');
  const navigation = { maximumZoom: camera.maximumZoom, camera: {
    controlPitch: camera.defaultControlPitchDegrees, controlYaw: camera.defaultControlYawDegrees,
    zoom: camera.defaultZoom, controlRoll: -60 as unknown,
  } };
  item(input.variants).navigation = navigation;
  assert.equal(parsePreparedObjectRuntime(input), input);
  for (const invalid of [NaN, Infinity, -Infinity, 'north-up', null]) {
    navigation.camera.controlRoll = invalid;
    assert.throws(() => parsePreparedObjectRuntime(input), /(?:navigation roll|controlRoll) must be finite/);
  }
  delete (navigation.camera as { controlRoll?: unknown }).controlRoll;
  assert.equal(parsePreparedObjectRuntime(input), input);
});


test('prepared lens transitions require bounded duration and an explicit zoom policy', () => {
  const input = copy(), camera = child(input, 'camera');
  const destination = { controlPitch: camera.defaultControlPitchDegrees,
    controlYaw: camera.defaultControlYawDegrees, zoom: camera.defaultZoom,
    transition: { durationMilliseconds: 650, preserveZoom: true } as unknown };
  item(input.variants).navigation = { maximumZoom: camera.maximumZoom, camera: destination };
  assert.equal(parsePreparedObjectRuntime(input), input);
  destination.transition = { durationMilliseconds: 0, preserveZoom: true };
  assert.equal(parsePreparedObjectRuntime(input), input);
  for (const transition of [null, {}, { durationMilliseconds: -1, preserveZoom: true },
    { durationMilliseconds: 10001, preserveZoom: true }, { durationMilliseconds: 650, preserveZoom: 'true' }]) {
    destination.transition = transition;
    assert.throws(() => parsePreparedObjectRuntime(input), /camera transition/);
  }
});
