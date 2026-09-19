import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { lensLevelStatistics, lensLevels, resampleOntoProjection, type LensLevelGrid } from './lens-levels.ts';
import type { PreparedReconstruction } from '../../features/reconstruction/reconstruction-types.ts';

const WIDTH = 40, HEIGHT = 30, PIXELS = WIDTH * HEIGHT, OUTSIDE = 120, FLOOR = 130;
/**
 * A grid in the shape the route builds: the first `OUTSIDE` pixels lie beyond the overlay footprint and
 * carry bright values, and the footprint itself starts on a flat floor so its 5th percentile is exactly
 * the authored pedestal.
 */
function grid(options: { pedestal?: number; gain?: number; maskAll?: boolean } = {}): LensLevelGrid {
  const pedestal = options.pedestal ?? 0, gain = options.gain ?? 1;
  const projection = new Uint8Array(PIXELS), source = new Float64Array(PIXELS * 3), mask = new Uint8Array(PIXELS);
  for (let p = 0; p < PIXELS; p++) {
    const inside = p >= OUTSIDE, covered = inside || options.maskAll === true;
    const index = p - OUTSIDE;
    const signal = !inside ? 250 : index < FLOOR ? 0 : (index - FLOOR) % 121;
    const raw = inside ? [pedestal + signal, pedestal + Math.round(signal * .8), pedestal + Math.round(signal * .6)] : [250, 250, 250];
    mask[p] = covered ? 1 : 0;
    for (let c = 0; c < 3; c++) source[p * 3 + c] = raw[c]!;
    projection[p] = Math.min(255, Math.round(gain * Math.max(...raw)));
  }
  return { width: WIDTH, height: HEIGHT, projection, source, mask };
}

test('a projection that matches its own image reports unit ratios, a zero delta and an identity transfer', () => {
  const levels = lensLevelStatistics(grid());
  assert.equal(levels.footprintPixels, PIXELS - OUTSIDE);
  assert.deepEqual(levels.skyPedestal, [0, 0, 0]);
  assert.equal(Math.round(levels.flux.percent * 1e6) / 1e6, 0);
  assert.ok(levels.hueErrorDegrees < 1e-4, `hue ${levels.hueErrorDegrees}`);
  for (const channel of levels.channels) {
    assert.equal(channel.p50Ratio, 1, `${channel.name} p50`);
    assert.equal(channel.p90Ratio, 1, `${channel.name} p90`);
    assert.equal(channel.signedMeanDelta, 0);
    assert.equal(channel.absoluteMeanDelta, 0);
    assert.deepEqual(channel.renderHistogram, channel.sourceHistogram);
    for (const [bin, median] of channel.transfer.entries())
      if (median !== null) assert.ok(Math.abs(median - (bin + .5) * 8) <= 8, `${channel.name} transfer bin ${bin} is the diagonal`);
  }
});

test('a brighter projection lifts the ratios, the delta and the transfer above the diagonal by the same factor', () => {
  const levels = lensLevelStatistics(grid({ gain: 2 }));
  for (const channel of levels.channels) {
    assert.ok(Math.abs(channel.p90Ratio - 2) < .05, `${channel.name} p90 ratio ${channel.p90Ratio}`);
    assert.ok(channel.signedMeanDelta > 0 && channel.signedMeanDelta === channel.absoluteMeanDelta);
    const measured = channel.transfer.flatMap((median, bin) => (median === null || bin === 0 ? [] : [median / ((bin + .5) * 8)]));
    assert.ok(measured.length > 4 && measured.every(value => Math.abs(value - 2) < .25), `${channel.name} transfer ${measured.join(',')}`);
  }
  assert.ok(Math.abs(levels.flux.percent - 100) < 1, `flux ${levels.flux.percent}`);
  // Doubling every channel by the same factor is a level change, never a hue change.
  assert.ok(levels.hueErrorDegrees < 1e-4, `hue ${levels.hueErrorDegrees}`);
});

test('only the overlay footprint is measured, and dropping the mask would change every number', () => {
  const measured = lensLevelStatistics(grid());
  const mutant = lensLevelStatistics(grid({ maskAll: true }));
  assert.equal(mutant.footprintPixels, PIXELS);
  assert.notDeepEqual(mutant.channels[0]!.sourceHistogram, measured.channels[0]!.sourceHistogram);
  assert.notEqual(mutant.channels[0]!.sourceP90, measured.channels[0]!.sourceP90);
  // The footprint statistic itself must not move when the excluded pixels change.
  const brighter = grid(), darker = grid();
  for (let p = 0; p < OUTSIDE; p++) { brighter.projection[p] = 255; darker.projection[p] = 0; }
  assert.deepEqual(lensLevelStatistics(brighter).channels, lensLevelStatistics(darker).channels);
});

test('the photograph’s sky pedestal is removed from the source and never from the render', () => {
  const pedestal = 20;
  const built = grid({ pedestal }), measured = lensLevelStatistics(built);
  assert.deepEqual(measured.skyPedestal, [pedestal, pedestal, pedestal]);
  const floor = lensLevelStatistics(grid());
  // The render is the projection wearing the image's chromaticity, so the pedestal shifts only the source.
  assert.ok(measured.channels[0]!.renderP90 > floor.channels[0]!.renderP90);
  assert.equal(measured.channels[0]!.sourceP90, floor.channels[0]!.sourceP90);
  assert.ok(Math.abs(measured.channels[0]!.signedMeanDelta - pedestal) < 1,
    `red reports ${measured.channels[0]!.signedMeanDelta} against the ${pedestal} DN pedestal`);
  // Mutation: an implementation that skipped the subtraction would report no excess at all, so the
  // assertion above fails the moment the pedestal stops being removed.
  let unsubtracted = 0, covered = 0;
  for (let p = 0; p < PIXELS; p++) {
    if (!built.mask[p]) continue;
    covered++;
    const peak = Math.max(built.source[p * 3]!, built.source[p * 3 + 1]!, built.source[p * 3 + 2]!);
    unsubtracted += (peak > 0 ? built.projection[p]! * built.source[p * 3]! / peak : 0) - built.source[p * 3]!;
  }
  assert.ok(Math.abs(unsubtracted / covered) < 1, `an unsubtracted pedestal reports ${unsubtracted / covered}`);
});

test('the lens raster is placed through its own tangent bounds, never stretched onto the projection grid', () => {
  const lensWidth = 8, lensHeight = 8;
  const rgb = new Uint8Array(lensWidth * lensHeight * 3).fill(120), alpha = new Uint8Array(lensWidth * lensHeight * 4).fill(255);
  const projectionBounds = { min: [-4, -3], max: [4, 3] };
  // This lens covers the left half of the model's field only.
  const placed = resampleOntoProjection({ width: WIDTH, height: HEIGHT, projectionBounds,
    lensWidth, lensHeight, lensBounds: { min: [-4, -3], max: [0, 3] }, rgb, rgbChannels: 3, alpha, alphaChannels: 4 });
  let left = 0, right = 0;
  for (let j = 0; j < HEIGHT; j++) for (let i = 0; i < WIDTH; i++) if (placed.mask[j * WIDTH + i]) (i < WIDTH / 2 ? left++ : right++);
  assert.equal(right, 0, 'a half-field lens must not paint the other half');
  // The sampler drops the outer half texel it cannot interpolate, exactly as the material sampler does.
  assert.ok(left > .75 * (WIDTH / 2 * HEIGHT), `left half covered ${left}`);
  // Mutation: stretching the same raster over the whole field — the reading a fit:'fill' resize gives —
  // covers both halves instead, so the assertion above is load-bearing.
  const stretched = resampleOntoProjection({ width: WIDTH, height: HEIGHT, projectionBounds,
    lensWidth, lensHeight, lensBounds: projectionBounds, rgb, rgbChannels: 3, alpha, alphaChannels: 4 });
  let stretchedRight = 0;
  for (let j = 0; j < HEIGHT; j++) for (let i = WIDTH / 2; i < WIDTH; i++) if (stretched.mask[j * WIDTH + i]) stretchedRight++;
  assert.ok(stretchedRight > 0, 'the stretched reading paints the half this lens never observed');
});

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
/** A saved lens in the exact file shape `bakeFiniteLens` publishes, with its own manifest pins. */
async function fixture(options: { lensBounds?: { min: number[]; max: number[] }; corrupt?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'nebula-lens-levels-'));
  const resultId = 'a'.repeat(64), directory = `.local/nebula-lab/reconstructions/${resultId}`;
  const width = 32, height = 24, lensWidth = 64, lensHeight = 48;
  const projectionBounds = { min: [-4, -3], max: [4, 3] };
  const artifacts: Record<string, { sha256: string; bytes: number }> = {};
  const save = async (path: string, bytes: Buffer) => {
    const full = join(root, directory, path);
    await mkdir(dirname(full), { recursive: true }); await writeFile(full, bytes);
    artifacts[path] = { sha256: digest(bytes), bytes: bytes.length };
  };
  const projection = Buffer.alloc(width * height);
  for (let p = 0; p < width * height; p++) projection[p] = 40 + (p % 180);
  const rgb = Buffer.alloc(lensWidth * lensHeight * 3), rgba = Buffer.alloc(lensWidth * lensHeight * 4, 255);
  // One smooth ramp across the lens raster, at a fixed 1 : 0.5 : 0.25 chromaticity.
  for (let p = 0; p < lensWidth * lensHeight; p++) {
    const value = 20 + Math.round(200 * (p % lensWidth) / (lensWidth - 1));
    rgb[p * 3] = value; rgb[p * 3 + 1] = Math.round(value * .5); rgb[p * 3 + 2] = Math.round(value * .25);
  }
  await save('source/fit-projection.png', await sharp(projection, { raw: { width, height, channels: 1 } }).png().toBuffer());
  await save('source/registered-image.png', await sharp(rgb, { raw: { width: lensWidth, height: lensHeight, channels: 3 } }).png().toBuffer());
  await save('source/original-image.png', await sharp(rgba, { raw: { width: lensWidth, height: lensHeight, channels: 4 } }).png().toBuffer());
  await save('source/provenance.json', Buffer.from(JSON.stringify({
    method: 'simulation-guided-finite-material@1',
    densityProjection: { width, height, tangentBoundsKpc: projectionBounds },
    sourceRegistration: { tangentBoundsKpc: options.lensBounds ?? projectionBounds } })));
  if (options.corrupt) await writeFile(join(root, directory, 'source/registered-image.png'),
    await sharp(Buffer.alloc(lensWidth * lensHeight * 3, 9), { raw: { width: lensWidth, height: lensHeight, channels: 3 } }).png().toBuffer());
  await writeFile(join(root, directory, 'manifest.json'), JSON.stringify({
    schema: 'cssearth-nebula-reconstruction-artifacts@1', id: `reconstruction-${resultId}`, artifacts }));
  const prepared = { schema: 'cssearth-nebula-reconstruction@1', resultId, imageId: 'test-lens', removalResultId: '', placement: {},
    subject: { id: `reconstruction-${resultId}`, directory }, finiteMaterial: { modelResultId: 'b'.repeat(64), sourceResultId: 'c'.repeat(64) },
  } as unknown as PreparedReconstruction;
  return { root, prepared, width, height };
}

test('one saved lens is measured from its own pinned rasters, and only from them', async () => {
  const { root, prepared, width, height } = await fixture();
  try {
    const levels = await lensLevels(root, prepared);
    assert.equal(levels.schema, 'cssearth-nebula-lens-levels@1');
    assert.equal(levels.resultId, prepared.resultId);
    assert.deepEqual(levels.grid, { width, height });
    assert.equal(levels.footprintPixels, width * height);
    assert.equal(levels.files.projection, 'source/fit-projection.png');
    assert.equal(levels.files.sha256['source/registered-image.png']!.length, 64);
    // The delivered render is the projection level wearing the image's peak-normalized chromaticity.
    const [red, green, blue] = levels.channels;
    assert.ok(Math.abs(green!.renderP90 / red!.renderP90 - .5) < .02, `green ${green!.renderP90} of red ${red!.renderP90}`);
    assert.ok(Math.abs(blue!.renderP90 / red!.renderP90 - .25) < .02);
    // The sky pedestal is read per channel from the same image, so it carries the same chromaticity.
    assert.ok(Math.abs(levels.skyPedestal[1]! / levels.skyPedestal[0]! - .5) < .05, levels.skyPedestal.join(','));
    assert.ok(Math.abs(levels.skyPedestal[2]! / levels.skyPedestal[0]! - .25) < .05, levels.skyPedestal.join(','));
    assert.ok(levels.flux.source > 0 && levels.flux.render > 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a lens raster that no longer matches its manifest pin is refused, and a non-lens result is refused', async () => {
  const { root, prepared } = await fixture({ corrupt: true });
  try {
    await assert.rejects(lensLevels(root, prepared), /Saved lens artifact differs: source\/registered-image\.png/);
    const density = { ...prepared, finiteMaterial: undefined } as PreparedReconstruction;
    await assert.rejects(lensLevels(root, density), /baked image lens/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a lens registered on half the model field covers half the footprint', async () => {
  const { root, prepared, width, height } = await fixture({ lensBounds: { min: [-4, -3], max: [0, 3] } });
  try {
    const levels = await lensLevels(root, prepared);
    assert.ok(Math.abs(levels.footprintPixels / (width * height) - .5) < .1,
      `${levels.footprintPixels} of ${width * height}`);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the route’s own accepted LMC lenses are measured, when they are present in this checkout', async (t) => {
  const root = process.cwd(), resultId = 'ab68c0e77c37c690181d44a0a1c438d534a655b9b4071c5495168922415fe559';
  const directory = `.local/nebula-lab/reconstructions/${resultId}`;
  const present = await readFile(join(root, directory, 'manifest.json')).then(() => true, () => false);
  if (!present) return t.skip('The accepted Horálek lens is not baked in this checkout.');
  const prepared = JSON.parse(await readFile(join(root, directory, 'result.json'), 'utf8')) as PreparedReconstruction;
  const levels = await lensLevels(root, prepared);
  assert.deepEqual(levels.grid, { width: 384, height: 285 });
  // NUMBERS.md §2 reads this lens's own registered image at p05 15/16/18 inside its footprint.
  assert.deepEqual(levels.skyPedestal.map(Math.round), [15, 16, 18]);
  // Its offline levels panel reports the same source p90 at 131/111/111, from a browser capture.
  for (const [index, expected] of [131, 111, 111].entries())
    assert.ok(Math.abs(levels.channels[index]!.sourceP90 - expected) <= 2,
      `${levels.channels[index]!.name} source p90 ${levels.channels[index]!.sourceP90} against the offline ${expected}`);
});
