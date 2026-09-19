import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AGREEMENT_TOLERANCE, DELIVERY_FACTOR, DIFFERENCE_RANGE, differenceColour, differenceField, lensDifference,
  lensDifferenceHandler } from './lens-difference.ts';
import type { LensLevelGrid } from './lens-levels.ts';
import type { PreparedReconstruction } from '../../features/reconstruction/reconstruction-types.ts';

const WIDTH = 20, HEIGHT = 10, PIXELS = WIDTH * HEIGHT;
/**
 * A neutral grey image whose first footprint row is black, so the 5th-percentile sky pedestal is exactly zero.
 * The projection is the source × `projectionOver` plus `offset` levels, so the analytic render (for grey, the
 * projection byte itself) sits a known number of levels from the source.
 */
function grid(projectionOver: number, offset = 0, outside = 0): LensLevelGrid {
  const projection = new Uint8Array(PIXELS), source = new Float64Array(PIXELS * 3), mask = new Uint8Array(PIXELS);
  for (let p = 0; p < PIXELS; p++) {
    const value = p < WIDTH ? 0 : 40 + (p % 150);
    mask[p] = p >= outside ? 1 : 0;
    source.fill(value, p * 3, p * 3 + 3);
    projection[p] = value ? Math.min(255, Math.round(value * projectionOver + offset)) : 0;
  }
  return { width: WIDTH, height: HEIGHT, projection, source, mask };
}
const material = { channelGain: null, toneCurve: null };
const inside = (field: Float64Array) => [...field].filter(Number.isFinite);

test('the delivery factor is divided out: an analytic render exactly that much brighter reads as agreement', () => {
  assert.ok(Math.abs(DELIVERY_FACTOR - 61.0 / 53.5) < 1e-12, 'the measured horalek delivery ratio');
  const corrected = inside(differenceField(grid(DELIVERY_FACTOR), material));
  assert.ok(corrected.every(delta => Math.abs(delta) <= .5 / DELIVERY_FACTOR + 1e-9), `max |Δ| ${Math.max(...corrected.map(Math.abs))}`);
  assert.ok(corrected.every(delta => differenceColour(delta)[3] === 0), 'agreement paints nothing');
  // Mutation: drop the correction and the same lens reads uniformly too bright.
  const raw = inside(differenceField(grid(DELIVERY_FACTOR), material, 1));
  const red = raw.filter(delta => delta > AGREEMENT_TOLERANCE).length, blue = raw.filter(delta => delta < -AGREEMENT_TOLERANCE).length;
  assert.ok(red / raw.length > .8 && blue === 0, `uncorrected: ${red} red, ${blue} blue of ${raw.length}`);
});

test('the tolerance is the stated one: 5 levels off stays clear, 8 levels off is coloured with its sign', () => {
  assert.equal(AGREEMENT_TOLERANCE, 6);
  assert.equal(DIFFERENCE_RANGE, 64);
  const colour = (offset: number) => inside(differenceField(grid(DELIVERY_FACTOR, offset * DELIVERY_FACTOR), material))
    .filter(delta => delta !== 0).map(delta => differenceColour(delta));
  for (const [r, , b, a] of colour(5)) assert.equal(a, 0, `5 levels bright painted ${r},${b},${a}`);
  for (const [r, , b, a] of colour(-5)) assert.equal(a, 0, `5 levels dark painted ${r},${b},${a}`);
  for (const [r, , b, a] of colour(8)) assert.ok(a > 0 && r > b, `8 levels bright must be red, got ${r},${b},${a}`);
  for (const [r, , b, a] of colour(-8)) assert.ok(a > 0 && b > r, `8 levels dark must be blue, got ${r},${b},${a}`);
  assert.deepEqual(differenceColour(AGREEMENT_TOLERANCE), [0, 0, 0, 0]);
  assert.ok(differenceColour(AGREEMENT_TOLERANCE + .01)[3] > 0);
  // The scale saturates at the stated range, never beyond it.
  assert.deepEqual(differenceColour(DIFFERENCE_RANGE), differenceColour(DIFFERENCE_RANGE * 3));
  assert.notDeepEqual(differenceColour(DIFFERENCE_RANGE / 2), differenceColour(DIFFERENCE_RANGE));
});

test('pixels outside the footprint stay transparent however far off they are', () => {
  const field = differenceField(grid(3, 0, 3 * WIDTH), material);
  for (let p = 0; p < 3 * WIDTH; p++) assert.ok(Number.isNaN(field[p]!), `pixel ${p} is outside`);
  assert.deepEqual(differenceColour(Number.NaN), [0, 0, 0, 0]);
  assert.ok(inside(field).some(delta => differenceColour(delta)[3] > 0));
});

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
/** A saved lens in the file shape `bakeFiniteLens` publishes: a grey ramp whose projection is `over` × the image. */
async function fixture(options: { over: number; lensBounds?: { min: number[]; max: number[] } }) {
  const root = await mkdtemp(join(tmpdir(), 'nebula-lens-difference-'));
  const resultId = 'd'.repeat(64), directory = `.local/nebula-lab/reconstructions/${resultId}`;
  const width = 32, height = 24, projectionBounds = { min: [-4, -3], max: [4, 3] };
  const lens = options.lensBounds ?? projectionBounds, artifacts: Record<string, { sha256: string; bytes: number }> = {};
  const save = async (path: string, bytes: Buffer) => {
    await mkdir(dirname(join(root, directory, path)), { recursive: true }); await writeFile(join(root, directory, path), bytes);
    artifacts[path] = { sha256: digest(bytes), bytes: bytes.length };
  };
  // The lens raster covers its own bounds at the projection's pitch, so each lens pixel lands on one grid pixel.
  const lensWidth = Math.round(width * (lens.max[0]! - lens.min[0]!) / 8), lensHeight = Math.round(height * (lens.max[1]! - lens.min[1]!) / 6);
  const grey = (i: number, j: number) => (j < 2 ? 0 : 40 + ((i * 7 + j * 3) % 150));
  const projection = Buffer.alloc(width * height), rgb = Buffer.alloc(lensWidth * lensHeight * 3);
  for (let j = 0; j < lensHeight; j++) for (let i = 0; i < lensWidth; i++) rgb.fill(grey(i, j), (j * lensWidth + i) * 3, (j * lensWidth + i) * 3 + 3);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) projection[j * width + i] = Math.min(255, Math.round(grey(i, j) * options.over));
  await save('source/fit-projection.png', await sharp(projection, { raw: { width, height, channels: 1 } }).png().toBuffer());
  await save('source/registered-image.png', await sharp(rgb, { raw: { width: lensWidth, height: lensHeight, channels: 3 } }).png().toBuffer());
  await save('source/original-image.png', await sharp(Buffer.alloc(lensWidth * lensHeight * 4, 255),
    { raw: { width: lensWidth, height: lensHeight, channels: 4 } }).png().toBuffer());
  await save('source/provenance.json', Buffer.from(JSON.stringify({ densityProjection: { width, height, tangentBoundsKpc: projectionBounds },
    sourceRegistration: { tangentBoundsKpc: lens } })));
  await writeFile(join(root, directory, 'manifest.json'), JSON.stringify({
    schema: 'cssearth-nebula-reconstruction-artifacts@1', id: `reconstruction-${resultId}`, artifacts }));
  const prepared = { schema: 'cssearth-nebula-reconstruction@1', resultId, imageId: 'test-lens', subject: { id: `reconstruction-${resultId}`, directory },
    finiteMaterial: { modelResultId: 'b'.repeat(64), sourceResultId: 'c'.repeat(64) } } as unknown as PreparedReconstruction;
  return { root, prepared, width, height, lensWidth, lensHeight };
}
/** Drive the route handler with a bare request/response pair. */
async function get(handler: ReturnType<typeof lensDifferenceHandler>, url: string, method = 'GET') {
  const headers: Record<string, string> = {}, chunks: Buffer[] = [];
  const response = { statusCode: 200, setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
    end(body?: string | Buffer) { if (body !== undefined) chunks.push(Buffer.from(body)); } };
  await handler({ method, url } as IncomingMessage, response as unknown as ServerResponse);
  return { status: response.statusCode, headers, body: Buffer.concat(chunks) };
}

test('the route answers a transparent PNG for a lens that matches once delivery is divided out, and its legend JSON', async () => {
  const { root, prepared, width, height } = await fixture({ over: DELIVERY_FACTOR });
  try {
    const handler = lensDifferenceHandler(root, async id => { assert.equal(id, prepared.resultId); return prepared; });
    const json = await get(handler, `/?resultId=${prepared.resultId}`);
    assert.equal(json.status, 200); assert.equal(json.headers['content-type'], 'application/json');
    const summary = JSON.parse(json.body.toString());
    assert.equal(summary.schema, 'cssearth-nebula-lens-difference@1');
    assert.equal(summary.rangeLevels, DIFFERENCE_RANGE); assert.equal(summary.toleranceLevels, AGREEMENT_TOLERANCE);
    assert.equal(summary.deliveryFactor, DELIVERY_FACTOR);
    assert.deepEqual([summary.width, summary.height], [width, height]);
    assert.equal(summary.agreePercent, 100, JSON.stringify(summary));
    const png = await get(handler, `/?resultId=${prepared.resultId}&format=png`);
    assert.equal(png.headers['content-type'], 'image/png');
    const decoded = await sharp(png.body).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([decoded.info.width, decoded.info.height], [width, height]);
    for (let p = 3; p < decoded.data.length; p += 4) assert.equal(decoded.data[p], 0, `pixel ${(p - 3) / 4} painted`);
    // Mutation of the correction: the same lens compared as raw analytic light turns red.
    const raw = await lensDifference(root, prepared, { deliveryFactor: 1 });
    assert.ok(raw.summary.tooBrightPercent > 80 && raw.summary.tooDarkPercent === 0, JSON.stringify(raw.summary));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the route refuses writes, bad identities and non-lens results', async () => {
  const { root, prepared } = await fixture({ over: 1 });
  try {
    const handler = lensDifferenceHandler(root, async () => prepared);
    assert.equal((await get(handler, `/?resultId=${prepared.resultId}`, 'POST')).status, 400);
    assert.match((await get(handler, '/?resultId=nope')).body.toString(), /Invalid reconstruction identity/);
    const density = lensDifferenceHandler(root, async () => ({ ...prepared, finiteMaterial: undefined }) as PreparedReconstruction);
    assert.match((await get(density, `/?resultId=${prepared.resultId}`)).body.toString(), /baked image lens/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the map is written in the lens image frame, the frame the original-image overlay covers', async () => {
  // A lens registered on the left half of the model field: its map spans that half only, at the grid pitch.
  const { root, prepared, width, height, lensWidth, lensHeight } = await fixture({ over: 1.5, lensBounds: { min: [-4, -3], max: [0, 3] } });
  try {
    const { png, summary } = await lensDifference(root, prepared);
    assert.deepEqual([summary.width, summary.height], [lensWidth, lensHeight]);
    assert.deepEqual([lensWidth, lensHeight], [width / 2, height]);
    const decoded = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let painted = 0;
    for (let p = 3; p < decoded.data.length; p += 4) if (decoded.data[p]! > 0) painted++;
    assert.ok(painted / (lensWidth * lensHeight) > .6, `${painted} painted of ${lensWidth * lensHeight}`);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the Horálek lenses tell the truth: the bar reads too dark, and tone fitting removes most of the red', async (t) => {
  const root = process.cwd(), ids = { old: '95495a7d7cc10ea36f4845616a90b516058f47e13ffe00b2bcb431f22861441a',
    fitted: '60b47e1006da1556fb39e99a652992abf3a8c915caecfc3451b842881cb8f305' };
  const load = async (id: string) => JSON.parse(await readFile(join(root, `.local/nebula-lab/reconstructions/${id}/result.json`), 'utf8')) as PreparedReconstruction;
  const lenses = await Promise.all([ids.old, ids.fitted].map(load)).catch(() => null);
  if (!lenses) return t.skip('The Horálek lenses are not baked in this checkout.');
  const [old, fitted] = await Promise.all(lenses.map(prepared => lensDifference(root, prepared)));
  const band = (result: typeof old, keep: (x: number, y: number) => boolean) => {
    let sum = 0, n = 0; result!.field.forEach((delta, p) => { if (Number.isFinite(delta) && keep(p % result!.grid.width, Math.floor(p / result!.grid.width))) { sum += delta; n++; } });
    return sum / n;
  };
  // Both lenses share one image; its sky-removed luminance centroid on the 384 × 285 grid is (193.9, 137.7).
  const core = (x: number, y: number) => Math.hypot(x - 193.9, y - 137.7) < 24;
  assert.ok(band(old, core) < -10 && band(fitted, core) < -10, `core ${band(old, core)} / ${band(fitted, core)}`);
  assert.ok(old!.summary.tooBrightPercent > 2 * fitted!.summary.tooBrightPercent,
    `red share ${old!.summary.tooBrightPercent}% → ${fitted!.summary.tooBrightPercent}%`);
});
