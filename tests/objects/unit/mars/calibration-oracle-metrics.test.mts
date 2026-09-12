import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ClassicLevel } from 'classic-level';
import { array, object, text, parseJson } from '../../../../tools/oracles/mars/google-earth-pro/oracle-values.mts';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { createPixelmatchTriptych } from '../../../../tools/oracles/mars/google-earth-pro/triptych.mts';
import { intersectionDiscMask, localLandmarkFlow, maskedColorDelta } from '../../../../tools/oracles/mars/google-earth-pro/qualify-calibration-metric.mts';
import { loadHeldInitialFrame, parseRenderedNativeReport } from '../../../../tools/oracles/mars/google-earth-pro/rendered-motion-records.mts';
import { parseNativeSnapshot } from '../../../../tools/oracles/mars/google-earth-pro/render-contract-values.mts';
import { parseGranularSample } from '../../../../tools/oracles/mars/google-earth-pro/granular-contract-values.mts';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('pixel pairing preserves exact deltas and rejects unequal image dimensions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mars-triptych-'));
  try {
    const source = new PNG({ width: 2, height: 1 }); source.data.fill(0); source.data[3] = source.data[7] = 255;
    const candidate = new PNG({ width: 2, height: 1 }); source.data.copy(candidate.data); candidate.data[0] = 255;
    const referencePath = join(root, 'reference.png'), candidatePath = join(root, 'candidate.png');
    await writeFile(referencePath, PNG.sync.write(source)); await writeFile(candidatePath, PNG.sync.write(candidate));
    const identical = await createPixelmatchTriptych({ referencePath, candidatePath: referencePath, outputPath: join(root, 'identical.png') });
    assert.equal(identical.changedPixels, 0); assert.equal(identical.meanAbsoluteRgbDelta, 0);
    const different = await createPixelmatchTriptych({ referencePath, candidatePath, outputPath: join(root, 'different.png') });
    assert.equal(different.changedPixels, 1); assert.equal(different.changedPixelRatio, 0.5);
    assert.equal(different.meanAbsoluteRgbDelta, 42.5);
    assert.equal(hash(await readFile(different.paths.triptych)), different.sha256.triptych);
    assert.equal(PNG.sync.read(await readFile(different.paths.triptych)).width, 14);
    const wrong = join(root, 'wrong.png'); await writeFile(wrong, PNG.sync.write(new PNG({ width: 3, height: 1 })));
    await assert.rejects(createPixelmatchTriptych({ referencePath, candidatePath: wrong, outputPath: join(root, 'invalid.png') }), /unpaired dimensions/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('calibration metrics detect translated landmarks and preserve masks', () => {
  const width = 72, height = 72, data = new Uint8Array(width * height * 4), shifted = new Uint8Array(data.length);
  let random = 12345;
  for (let i = 0; i < data.length; i += 4) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    data[i] = random & 255; data[i + 1] = (random >>> 8) & 255; data[i + 2] = (random >>> 16) & 255; data[i + 3] = 255;
  }
  for (let y = 0; y < height; y++) for (let x = 3; x < width; x++) {
    shifted.set(data.subarray((y * width + x - 3) * 4, (y * width + x - 3) * 4 + 4), (y * width + x) * 4);
  }
  const native = { width, height, data }, candidate = { width, height, data: shifted }, mask = new Uint8Array(width * height).fill(1);
  const identical = localLandmarkFlow(native, native, mask), displaced = localLandmarkFlow(native, candidate, mask);
  assert.ok(identical.sampleCount > 0); assert.equal(identical.meanPixels, 0); assert.equal(identical.p95Pixels, 0);
  assert.equal(displaced.meanPixels, 3); assert.equal(displaced.p95Pixels, 3); assert.equal(displaced.maximumPixels, 3);
  assert.equal(maskedColorDelta(native, native, mask).meanAbsoluteRgbDelta, 0);
  assert.ok(maskedColorDelta(native, candidate, mask).meanAbsoluteRgbDelta > 0);
  const disc = { minX: 1, maxX: 7, centerX: 4, centerY: 4, width: 6, height: 6 };
  const discMask = intersectionDiscMask(9, 9, disc, { ...disc, centerX: 5 }, 1);
  assert.equal(discMask[4 * 9 + 4], 1); assert.equal(discMask[4 * 9 + 2], 0); assert.equal(discMask[0], 0);
});

test('held initial frame uses the report directory and preserves its exact bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mars-held-frame-'));
  try {
    const bytes = Buffer.from('exact initial-frame bytes'); await writeFile(join(root, 'initial.png'), bytes);
    const frame = await loadHeldInitialFrame(join(root, 'capture.json'), 12345);
    assert.equal(frame.path, join(root, 'initial.png')); assert.equal(frame.timestamp, 12.345);
    assert.equal(frame.sha256, hash(bytes)); assert.equal(frame.heldInitialFrame, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const snapshot = () => ({ revision: 1, context: '0x1', program: 6, primitive: 4, count: 4,
  viewport: [0, 0, 100, 100], blend: [770, 1, 770, 1], blendEnabled: true, depthTestEnabled: false, depthWrite: false,
  classification: { skyMap: false, catalogueStars: false }, uniforms: { ig_ModelViewMatrix: identity,
    ig_ModelViewProjectionMatrix: identity, starsToCameraMatrix: identity, view_dir: [0, 0, 1], view_right: [1, 0, 0], view_up: [0, 1, 0] },
  samplers: { t_tex0: { texture: 1, width: 128, height: 128, internalFormat: 6408, minFilter: 9729, magFilter: 9729, wrapS: 33071, wrapT: 33071, dumpPath: 'texture.rgba' } },
  attributes: { ig_Vertex: { buffer: 0, bufferBytes: 0, components: 3, stride: 12, clientDumpPath: 'vertices.bin', clientBytes: 48 } },
  retainedEvidence: { nativeField: 'preserved' } });

test('native renderer records validate consumed fields and preserve evidence metadata', () => {
  const value = snapshot(); assert.deepEqual(parseNativeSnapshot(value), value);
  assert.throws(() => parseNativeSnapshot({ ...value, viewport: [0, 1] }), /four components/);
  assert.throws(() => parseNativeSnapshot({ ...value, uniforms: { view_dir: ['wrong'] } }), /finite/);
  assert.throws(() => parseNativeSnapshot({ ...value, attributes: { ig_Vertex: { ...value.attributes.ig_Vertex, clientBytes: '48' } } }), /finite/);
  assert.throws(() => parseRenderedNativeReport({ frames: [] }), TypeError);
});

test('granular parser accepts the writer’s three-component NDC center', () => {
  const value = { index: 1, familyIndex: 0, completedAt: '2026-09-02T12:00:00Z', framePath: 'frame.png',
    requested: { family: 'log-zoom', distance: 100, latitude: 0, longitude: 0, heading: 0, tilt: 0 },
    skyMap: snapshot(), catalogue: snapshot(), sun: snapshot(), sunPresentation: { visibility: 'fully-visible', cameraDistance: 100,
      localHalfExtent: 1, halfExtentPerCameraDistance: 0.01, centerNdc: [0, 0, 0.5] } };
  const parsed = parseGranularSample(value); assert.notEqual(parsed.sun, null);
  if (parsed.sun === null) throw new Error('Expected drawn Sun sample.');
  assert.deepEqual(parsed.sunPresentation.centerNdc, [0, 0, 0.5]);
  assert.throws(() => parseGranularSample({ ...value, sunPresentation: { ...value.sunPresentation, centerNdc: [0, 0] } }), /3 finite/);
  assert.throws(() => parseGranularSample({ ...value, completedAt: 'invalid' }), /completion time/);
});

test('cache export binds a real LevelDB payload to its quadtree address beside the output index', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mars-cache-export-'));
  try {
    const cacheRoot = join(root, 'cache'), databasePath = join(cacheRoot, 'unified_cache_leveldb_leveldb2-test');
    const database = new ClassicLevel<Buffer, Buffer>(databasePath, { keyEncoding: 'buffer', valueEncoding: 'buffer' });
    await database.open();
    const request = Buffer.alloc(32); request[18] = 0x82; request[20] = 1; request[27] = 0x80;
    const payload = Buffer.alloc(32768, 75), key = Buffer.from('EVLL Mars' + request.toString('base64'));
    await database.put(key, Buffer.concat([Buffer.alloc(20), payload])); await database.close();
    const outputPath = join(root, 'results', 'index.json');
    const command = fileURLToPath(new URL('../../../../tools/oracles/mars/google-earth-pro/export-google-imagery-cache.mts', import.meta.url));
    const result = await promisify(execFile)(process.execPath, ['--experimental-strip-types', command, '--cache-root', cacheRoot, '--output', outputPath]);
    assert.equal(object(parseJson(result.stdout)).ok, true);
    const report = object(parseJson(await readFile(outputPath, 'utf8'))), entries = array(report.entries);
    assert.equal(report.qualification, 'EXACT_GOOGLE_CACHE_PAYLOAD_ADDRESSES_INDEXED'); assert.equal(entries.length, 1);
    const entry = object(entries[0]); assert.equal(entry.path, '2'); assert.equal(entry.level, 1);
    assert.equal(entry.row, 1); assert.equal(entry.col, 1);
    assert.deepEqual(entry.longitudeRangeDegrees, [0, 180]); assert.deepEqual(entry.latitudeRangeDegrees, [0, 90]);
    assert.equal(report.payloadRoot, join(root, 'results', 'google-cache-payloads'));
    assert.equal(entry.cachePayloadPath, join(root, 'results', 'google-cache-payloads', hash(payload) + '.bin'));
    assert.deepEqual(await readFile(text(entry.cachePayloadPath)), payload);
    assert.equal(entry.cachePayloadSha256, hash(payload));
  } finally { await rm(root, { recursive: true, force: true }); }
});
