import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { RADIAL_BINS, lensRadialProfile, lensRadialHandler, radialProfileStatistics } from './lens-radial.ts';
import { lensLevelStatistics, type LensLevelGrid } from './lens-levels.ts';
import type { PreparedReconstruction } from '../../features/reconstruction/reconstruction-types.ts';

const SIZE = 41, CENTER = (SIZE - 1) / 2, WIDTH = SIZE, HEIGHT = SIZE, PIXELS = WIDTH * HEIGHT;
const radiusAt = (index: number) => { const x = index % WIDTH, y = Math.floor(index / WIDTH); return Math.hypot(x - CENTER, y - CENTER); };
/** A centrally concentrated brightness profile, like the branch's subject: bright core, smooth falloff. Always
 * positive over this 41x41 domain (minimum ~22 at the corners, radius <= 28.3), so the render's chromaticity
 * normalisation (level * raw/peak) never hits the "no colour information" zero-clamp — the one thing that would
 * make a raw pixel value, rather than the deliberate render target below, decide what gets delivered. */
const profile = (r: number) => Math.round(220 - 7 * r);
const sourceValues = Array.from({ length: PIXELS }, (_, p) => profile(radiusAt(p)));
/** The 5th-percentile sky pedestal `lensLevelPairs` computes from these same raw values (`quantile`, ./lens-levels.ts). */
const SKY = [...sourceValues].sort((a, b) => a - b)[Math.floor(PIXELS * .05)]!;
const sourceLevelAt = (p: number) => Math.max(0, sourceValues[p]! - SKY);
const levelAtRadius = (r: number) => Math.max(0, profile(r) - SKY);

/**
 * A grid whose grey source is the profile above, and whose delivered render level at each pixel is exactly
 * `targetRenderLevel(p)` (grey source ⇒ chromaticity is 1, so `untonedRender` reduces to the projection byte
 * unchanged). This lets a control be defined directly in the same "source level" space `lensLevelPairs` reports,
 * with no incidental sky-pedestal or clamp interaction to reason about.
 */
function buildGrid(targetRenderLevel: (p: number) => number): LensLevelGrid {
  const projection = new Uint8Array(PIXELS), source = new Float64Array(PIXELS * 3), mask = new Uint8Array(PIXELS).fill(1);
  for (let p = 0; p < PIXELS; p++) {
    source.fill(sourceValues[p]!, p * 3, p * 3 + 3);
    projection[p] = Math.min(255, Math.max(0, Math.round(targetRenderLevel(p))));
  }
  return { width: WIDTH, height: HEIGHT, projection, source, mask };
}
const material = { channelGain: null, toneCurve: null };
const identity = (p: number) => sourceLevelAt(p);
/** Reverses radius rank: the pixel at rank i (sorted by radius ascending) renders the source LEVEL of rank
 * N-1-i. This is a bijection on the pixel domain over the exact array `lensLevelStatistics` histograms, so the
 * multiset of rendered levels is EXACTLY the multiset of source levels — the histogram cannot tell the two
 * apart — while spatially the profile is inverted: brightness moves from the centre to the rim. */
const radiusOrder = Array.from({ length: PIXELS }, (_, p) => p).sort((a, b) => radiusAt(a) - radiusAt(b) || a - b);
const sourceLevelByRank = radiusOrder.map(p => sourceLevelAt(p));
const reversedTarget = new Array<number>(PIXELS);
radiusOrder.forEach((p, rank) => { reversedTarget[p] = sourceLevelByRank[sourceLevelByRank.length - 1 - rank]!; });
const reversedByRadius = (p: number) => reversedTarget[p]!;
/** Radially compressed by factor `k`: at a fixed radius the render reads like the source read at k·r, so k>1 falls off faster. */
const compressedBy = (k: number) => (p: number) => levelAtRadius(radiusAt(p) * k);

test('a render that matches its source at every radius reports agreement, not just an overall match', () => {
  const stats = radialProfileStatistics(buildGrid(identity), material);
  assert.equal(stats.footprintPixels, PIXELS);
  assert.deepEqual(stats.centroid, { x: CENTER, y: CENTER });
  const defined = stats.radialBins.filter(bin => bin.ratio !== null);
  assert.ok(defined.length > RADIAL_BINS / 2, `too few defined bins: ${defined.length}`);
  for (const bin of defined) assert.ok(Math.abs(bin.ratio! - 1) < .1, `bin @${bin.radius.toFixed(1)} ratio ${bin.ratio}`);
  assert.ok(stats.rmsLogRatio! < .1, `rmsLogRatio ${stats.rmsLogRatio}`);
  assert.ok(Math.abs(stats.halfLightRadiusRatio! - 1) < .1, `half-light ratio ${stats.halfLightRadiusRatio}`);
});

test('a centre <-> annulus brightness swap conserves the histogram exactly, and levels cannot see it, but the radial profile flags it', () => {
  const grid = buildGrid(reversedByRadius);
  // Proof the swap is histogram-blind: the delivered render levels are a permutation of the delivered source levels.
  const levels = lensLevelStatistics(grid, material);
  for (const channel of levels.channels) {
    // The permutation conserves the exact multiset of levels, so every histogram-derived Levels number reads
    // as a perfect match: identical bins, identical percentiles, identical worst bin, zero net bias.
    assert.deepEqual([...channel.sourceHistogram], [...channel.renderHistogram], 'the two histograms must be identical bin-for-bin');
    assert.ok(Math.abs(channel.p50Ratio - 1) < .01, `Levels p50 ratio should read matched, got ${channel.p50Ratio}`);
    assert.ok(Math.abs(channel.p90Ratio - 1) < .01, `Levels p90 ratio should read matched, got ${channel.p90Ratio}`);
    assert.equal(channel.worstBin.pixels, 0, `Levels' own worst-bin count should read 0, got ${channel.worstBin.pixels}`);
    assert.ok(Math.abs(channel.signedMeanDelta) < .5, `Levels net bias should read ~0, got ${channel.signedMeanDelta}`);
  }
  const stats = radialProfileStatistics(grid, material);
  const defined = stats.radialBins.filter(bin => bin.ratio !== null);
  const core = defined[0]!, rim = defined.at(-1)!;
  // The outermost bins clamp to a zero source mean (the bottom 5% the sky pedestal removes), so their ratio is
  // null by design (a ratio against ~0 is meaningless) — inspect the outermost bin that still has a defined one.
  assert.ok(core.ratio !== null && core.ratio < .6, `core ratio should read far below 1, got ${core.ratio}`);
  assert.ok(rim.ratio !== null && rim.ratio > 1.5, `outer ratio should read far above 1, got ${rim.ratio}`);
  assert.ok(stats.rmsLogRatio! > .3, `rmsLogRatio should be large, got ${stats.rmsLogRatio}`);
  assert.ok(stats.worstBin !== null && Math.abs(Math.log(stats.worstBin.ratio)) > .3, JSON.stringify(stats.worstBin));
  // The permutation also shows up as a pushed-out half-light radius: flux arrives late because it was moved outward.
  assert.ok(stats.halfLightRadiusRatio! > 1.2, `half-light ratio should read pushed out, got ${stats.halfLightRadiusRatio}`);
});

test('a radially compressed render is caught by the half-light radius even though no single bin is wildly wrong', () => {
  const matched = radialProfileStatistics(buildGrid(identity), material);
  const compressed = radialProfileStatistics(buildGrid(compressedBy(1.4)), material);
  assert.ok(Math.abs(matched.halfLightRadiusRatio! - 1) < .1);
  assert.ok(compressed.halfLightRadiusRatio! < .85, `compressed half-light ratio ${compressed.halfLightRadiusRatio}`);
  assert.ok(compressed.halfLightRadiusRatio! > 0, 'half-light ratio must stay positive');
  // A milder compression reads as a milder shift, monotone in the compression factor.
  const milder = radialProfileStatistics(buildGrid(compressedBy(1.15)), material);
  assert.ok(milder.halfLightRadiusRatio! > compressed.halfLightRadiusRatio! && milder.halfLightRadiusRatio! < 1,
    `milder ${milder.halfLightRadiusRatio} vs compressed ${compressed.halfLightRadiusRatio}`);
});

test('a missing bright core remains the worst radial defect even when its render is exactly zero', () => {
  const stats = radialProfileStatistics(buildGrid(p => radiusAt(p) < 8 ? 0 : identity(p)), material);
  assert.ok(stats.radialBins.some(bin => bin.ratio === 0));
  assert.equal(stats.worstBin?.ratio, 0);
  assert.ok(stats.rmsLogRatio !== null && Number.isFinite(stats.rmsLogRatio) && stats.rmsLogRatio > 1);
  const dark = radialProfileStatistics(buildGrid(() => 0), material);
  assert.equal(dark.worstBin?.ratio, 0);
  assert.ok(dark.rmsLogRatio !== null && Number.isFinite(dark.rmsLogRatio) && dark.rmsLogRatio > 1);
  assert.equal(dark.halfLightRadiusRender, null);
});

test('the footprint mask is respected, and empty or degenerate bins report null rather than NaN', () => {
  // A small disk footprint inside the same field, with many more bins than the disk has room for at large radius.
  const disk = buildGrid(identity);
  const radius = 10;
  for (let p = 0; p < PIXELS; p++) disk.mask[p] = radiusAt(p) <= radius ? 1 : 0;
  const stats = radialProfileStatistics(disk, material, 40);
  assert.ok(stats.footprintPixels < PIXELS, 'the mask must shrink the footprint');
  const empty = stats.radialBins.filter(bin => bin.pixels === 0);
  assert.ok(empty.length > 0, 'a 40-bin profile of a radius-10 disk must have some empty outer bins');
  for (const bin of empty) assert.deepEqual([bin.sourceMean, bin.renderMean, bin.ratio, bin.signedDelta], [null, null, null, null]);
  assert.doesNotMatch(JSON.stringify(stats), /NaN|Infinity/, 'no NaN/Infinity may leak into the JSON-serialisable result');
  // Pixels outside the mask must not move the result: changing their values must not change any statistic.
  const untouched = buildGrid(identity);
  for (let p = 0; p < PIXELS; p++) untouched.mask[p] = radiusAt(p) <= radius ? 1 : 0;
  for (let p = 0; p < PIXELS; p++) if (!untouched.mask[p]) { untouched.projection[p] = 255; untouched.source.fill(0, p * 3, p * 3 + 3); }
  assert.deepEqual(radialProfileStatistics(untouched, material, 40), stats);
});

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
/** A saved lens in the file shape `bakeFiniteLens` publishes, reused from the difference-map fixture pattern. */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'nebula-lens-radial-'));
  const resultId = 'e'.repeat(64), directory = `.local/nebula-lab/reconstructions/${resultId}`;
  const width = 32, height = 24, bounds = { min: [-4, -3], max: [4, 3] };
  const artifacts: Record<string, { sha256: string; bytes: number }> = {};
  const save = async (path: string, bytes: Buffer) => {
    await mkdir(dirname(join(root, directory, path)), { recursive: true }); await writeFile(join(root, directory, path), bytes);
    artifacts[path] = { sha256: digest(bytes), bytes: bytes.length };
  };
  const cx = (width - 1) / 2, cy = (height - 1) / 2;
  const grey = (i: number, j: number) => Math.max(0, Math.round(200 - 9 * Math.hypot(i - cx, j - cy)));
  const projection = Buffer.alloc(width * height), rgb = Buffer.alloc(width * height * 3);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const value = grey(i, j); projection[j * width + i] = value; rgb.fill(value, (j * width + i) * 3, (j * width + i) * 3 + 3);
  }
  await save('source/fit-projection.png', await sharp(projection, { raw: { width, height, channels: 1 } }).png().toBuffer());
  await save('source/registered-image.png', await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toBuffer());
  await save('source/original-image.png', await sharp(Buffer.alloc(width * height * 4, 255), { raw: { width, height, channels: 4 } }).png().toBuffer());
  await save('source/provenance.json', Buffer.from(JSON.stringify({ densityProjection: { width, height, tangentBoundsKpc: bounds },
    sourceRegistration: { tangentBoundsKpc: bounds } })));
  await writeFile(join(root, directory, 'manifest.json'), JSON.stringify({
    schema: 'cssearth-nebula-reconstruction-artifacts@1', id: `reconstruction-${resultId}`, artifacts }));
  const prepared = { schema: 'cssearth-nebula-reconstruction@1', resultId, imageId: 'test-lens', subject: { id: `reconstruction-${resultId}`, directory },
    finiteMaterial: { modelResultId: 'b'.repeat(64), sourceResultId: 'c'.repeat(64) } } as unknown as PreparedReconstruction;
  return { root, prepared };
}
async function get(handler: ReturnType<typeof lensRadialHandler>, url: string, method = 'GET') {
  const headers: Record<string, string> = {}, chunks: Buffer[] = [];
  const response = { statusCode: 200, setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
    end(body?: string | Buffer) { if (body !== undefined) chunks.push(Buffer.from(body)); } };
  await handler({ method, url } as IncomingMessage, response as unknown as ServerResponse);
  return { status: response.statusCode, headers, body: Buffer.concat(chunks) };
}

test('the route answers the radial profile JSON for a saved lens whose render matches its own source', async () => {
  const { root, prepared } = await fixture();
  try {
    const handler = lensRadialHandler(root, async id => { assert.equal(id, prepared.resultId); return prepared; });
    const response = await get(handler, `/?resultId=${prepared.resultId}`);
    assert.equal(response.status, 200); assert.equal(response.headers['content-type'], 'application/json');
    const value = JSON.parse(response.body.toString());
    assert.equal(value.schema, 'cssearth-nebula-lens-radial@1');
    assert.equal(value.resultId, prepared.resultId);
    assert.ok(Array.isArray(value.radialBins) && value.radialBins.length === RADIAL_BINS);
    assert.ok(Math.abs(value.halfLightRadiusRatio - 1) < .2, JSON.stringify(value.halfLightRadiusRatio));
    const direct = await lensRadialProfile(root, prepared);
    assert.deepEqual(JSON.parse(JSON.stringify(direct)), value);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the route refuses writes, bad identities and non-lens results', async () => {
  const { root, prepared } = await fixture();
  try {
    const handler = lensRadialHandler(root, async () => prepared);
    assert.equal((await get(handler, `/?resultId=${prepared.resultId}`, 'POST')).status, 400);
    assert.match((await get(handler, '/?resultId=nope')).body.toString(), /Invalid reconstruction identity/);
    const density = lensRadialHandler(root, async () => ({ ...prepared, finiteMaterial: undefined }) as PreparedReconstruction);
    assert.match((await get(density, `/?resultId=${prepared.resultId}`)).body.toString(), /baked image lens/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
