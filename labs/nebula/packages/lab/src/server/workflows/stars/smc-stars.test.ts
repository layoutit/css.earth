import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { parsePreparedLmcStars, type PreparedLmcStars, rayToOverlayPlane } from '@cssearth/bake/volume';
import { prepareSmcCatalogue, readBonanos2010Row, readSmcStarManifest, finiteModelStarsIndex, preparedStarsPath, MAGNITUDE_LIMIT } from '../../../cli/commands/prepare-smc-stars.ts';
import { loadFiniteModelStarContext, finiteModelDirectory, type FiniteModelStarContext } from './finite-model-star-context.ts';

const root = process.cwd();
/** Every prepared SMC star layer: one per finite model, each naming its own model, recipe and depth density. */
const layers = ['labs/nebula/models/smc/stars/prepared/stars.json', 'labs/nebula/models/smc/stars/prepared/stars-ellipsoid.json'];
const prepared = process.env.SMC_STAR_LAYER ?? layers[0]!;
const load = async (path = prepared) => JSON.parse(await readFile(path, 'utf8')) as PreparedLmcStars;
const modelOf = (payload: PreparedLmcStars) => (payload.provenance as { finiteModel: { modelResultId: string } }).finiteModel.modelResultId;
const modelId = async () => modelOf(await load());
const available = await modelId().then(id => stat(`${finiteModelDirectory(id)}/manifest.json`)).then(() => true, () => false);
const contextPromise = available ? modelId().then(id => loadFiniteModelStarContext(root, id)) : null;
const skip = available ? false : 'The local finite SMC model named by the prepared stars is not present.';
const close = (a: number, b: number, tolerance: number, label = '') => assert.ok(Math.abs(a - b) <= tolerance, `${label} ${a} != ${b}`);
const KPC_M = 3.085677581491367e19;

/** Independent inverse of the frame: local kpc point -> heliocentric reference ray. */
function referenceRay(p: readonly number[], f: PreparedLmcStars['frame']) {
  const [x, y, z, w] = f.localToReferenceXyzw;
  const t = [2 * (y * p[2]! - z * p[1]!), 2 * (z * p[0]! - x * p[2]!), 2 * (x * p[1]! - y * p[0]!)];
  return [p[0]! + w * t[0]! + y * t[2]! - z * t[1]!, p[1]! + w * t[1]! + z * t[0]! - x * t[2]!, p[2]! + w * t[2]! + x * t[1]! - y * t[0]!]
    .map((v, i) => v + f.originM[i]! / f.metersPerUnit);
}
const tangentOf = (s: { raDeg: number; decDeg: number }, frame: PreparedLmcStars['frame']) => {
  const a = s.raDeg * Math.PI / 180, d = s.decDeg * Math.PI / 180;
  return rayToOverlayPlane([Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)], frame);
};

test('pinned Bonanos (2010) rows replay deterministically into the prepared SMC stars and the model frame', { skip }, async () => {
  const context = (await contextPromise)!, payload = await load();
  const { files } = await readSmcStarManifest(root);
  for (const file of files) assert.equal(createHash('sha256').update(await readFile(`labs/nebula/models/smc/stars/source/${file.path}`)).digest('hex'), file.sha256);
  const table = await readFile('labs/nebula/models/smc/stars/source/table3.dat', 'utf8');
  const first = prepareSmcCatalogue(table, context), second = prepareSmcCatalogue(table, context);
  assert.deepEqual(first, second, 'Two replays must place every star identically.');
  assert.deepEqual(first.stars, payload.stars);
  assert.equal(first.inputRows, 3654);
  parsePreparedLmcStars(payload, context.frame);
  const index = JSON.parse(await readFile(finiteModelStarsIndex(context.modelResultId), 'utf8'));
  assert.equal(index.stars.path, prepared);
  assert.equal(index.stars.sha256, createHash('sha256').update(await readFile(prepared)).digest('hex'));
  // Frame units: kpc, and the payload frame is exactly the finite model frame the viewer loads.
  assert.ok(Math.abs(payload.frame.metersPerUnit / KPC_M - 1) < 1e-12);
  const lensFrame = JSON.parse(await readFile(`${finiteModelDirectory(context.modelResultId)}/object.json`, 'utf8')).properties.volume;
  assert.deepEqual(payload.frame, lensFrame);
  const rad = Math.PI / 180;
  for (const s of payload.stars) {
    const p = referenceRay(s.positionUnits, payload.frame), r = Math.hypot(...p);
    close(((Math.atan2(p[1]!, p[0]!) / rad) + 360) % 360, s.raDeg, 1e-9, s.id); close(Math.asin(p[2]! / r) / rad, s.decDeg, 1e-9, s.id);
  }
  const s = payload.stars[0]!, lost = referenceRay(s.positionUnits.map(v => v * 3), payload.frame);
  assert.ok(Math.abs(Math.asin(lost[2]! / Math.hypot(...lost)) / rad - s.decDeg) > 1e-6, 'A lost physical scale must fail the ray check.');
  const depths = payload.stars.map(star => star.positionUnits[2]).sort((a, b) => a - b);
  assert.ok(depths[Math.floor(depths.length * .9)]! - depths[Math.floor(depths.length * .1)]! > 1, 'Depths collapsed onto a plane.');
});

test('footprint selection is finite V <= 16 on covered fit pixels, with nothing silently dropped', { skip }, async () => {
  const context = (await contextPromise)!, payload = await load();
  const table = await readFile('labs/nebula/models/smc/stars/source/table3.dat', 'utf8');
  const ids = new Set(payload.stars.map(star => star.id));
  let expected = 0, outside = 0;
  for (const line of table.trimEnd().split('\n')) {
    const row = readBonanos2010Row(line), id = `Bonanos2010:${row.name}`;
    const eligible = [row.raDeg, row.decDeg, row.vmag].every(Number.isFinite) && row.vmag <= MAGNITUDE_LIMIT;
    const covered = eligible && context.inFootprint(...(tangentOf(row, context.frame).slice(0, 2) as [number, number]));
    if (covered) expected++; else if (eligible) outside++;
    assert.equal(ids.has(id), covered, `${id} selection`);
  }
  const provenance = payload.provenance as { selectedRows: number; excludedNoJointSupport: unknown[]; footprintRows: number };
  assert.equal(expected, provenance.footprintRows);
  assert.equal(payload.stars.length + provenance.excludedNoJointSupport.length, expected);
  assert.ok(payload.stars.every(star => star.magnitude <= MAGNITUDE_LIMIT));
  // Selection follows the footprint predicate: halving the covered area keeps exactly the stars whose measured ray has negative model x.
  const half = prepareSmcCatalogue(table, { ...context, inFootprint: (x: number, y: number) => context.inFootprint(x, y) && x < 0 });
  const east = payload.stars.filter(star => tangentOf(star, context.frame)[0] < 0);
  assert.ok(east.length > 100 && east.length < payload.stars.length);
  assert.deepEqual(half.stars.map(star => star.id).sort(), east.map(star => star.id).sort());
  assert.equal(outside, 0, 'This pinned model footprint covers every bright catalogue row; a change must be reviewed.');
});

test('every prepared star has positive joint emission and density support and model cutoff membership', { skip }, async () => {
  const context = (await contextPromise)!, payload = await load(), emission: [number, number, number] = [0, 0, 0];
  const signal = await sharp(await readFile(`${finiteModelDirectory(context.modelResultId)}/source/aligned-image.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const values = Float32Array.from({ length: signal.info.width * signal.info.height }, (_, i) => (signal.data[3 * i]! * .2126 + signal.data[3 * i + 1]! * .7152 + signal.data[3 * i + 2]! * .0722) / 255);
  const maximum = values.reduce((a, b) => Math.max(a, b), 0), b = context.mapping.boundsUnits, D = context.mapping.distanceUnits;
  for (const star of payload.stars) {
    const [x, y, z] = star.positionUnits, scale = 1 + z / D;
    for (let a = 0; a < 3; a++) assert.ok(star.positionUnits[a]! >= context.supportBounds.min[a]! && star.positionUnits[a]! <= context.supportBounds.max[a]!, `${star.id} outside the baked box`);
    context.sampleEmission(x / scale, y / scale, z, emission);
    assert.ok(Math.max(...emission) > 0, `${star.id} has no model emission`);
    assert.ok(context.densityAt(x, y, z) > 0, `${star.id} has no simulation density`);
    assert.deepEqual(star.cloudPartIds, ['all-light']);
    // Independent bilinear read of the cutoff raster on the Earth-facing tangent grid.
    const gx = (x / scale - b.min[0]) / (b.max[0] - b.min[0]) * signal.info.width - .5, gy = (b.max[1] - y / scale) / (b.max[1] - b.min[1]) * signal.info.height - .5;
    const ix = Math.max(0, Math.min(signal.info.width - 1, Math.floor(gx))), iy = Math.max(0, Math.min(signal.info.height - 1, Math.floor(gy)));
    const tx = Math.max(0, Math.min(1, gx - ix)), ty = Math.max(0, Math.min(1, gy - iy)), w = signal.info.width;
    const at = (c: number, r: number) => values[Math.min(signal.info.height - 1, r) * w + Math.min(w - 1, c)]!;
    close(star.cloudSignal, ((1 - ty) * ((1 - tx) * at(ix, iy) + tx * at(ix + 1, iy)) + ty * ((1 - tx) * at(ix, iy + 1) + tx * at(ix + 1, iy + 1))) / maximum, 1e-6, star.id);
  }
});

test('the joint CDF guards reject rays without emission or density and never bridge a zero-support gap', { skip }, async () => {
  const context = (await contextPromise)!, payload = await load();
  const table = (await readFile('labs/nebula/models/smc/stars/source/table3.dat', 'utf8')).trimEnd().split('\n');
  const brightest = payload.stars[0]!, line = table.find(row => `Bonanos2010:${readBonanos2010Row(row).name}` === brightest.id)!;
  const noEmission: FiniteModelStarContext = { ...context, sampleEmission: (_x, _y, _z, out) => { out.fill(0); } };
  const dark = prepareSmcCatalogue(line, noEmission);
  assert.equal(dark.stars.length, 0); assert.deepEqual(dark.unsupported.map(item => item.id), [brightest.id]);
  assert.equal(prepareSmcCatalogue(line, { ...context, densityAt: () => 0 }).unsupported.length, 1);
  // Remove support exactly at the chosen depth: the CDF lands in a zero gap and must throw, not interpolate through it.
  const z = brightest.positionUnits[2];
  const gap: FiniteModelStarContext = { ...context, sampleEmission(x, y, depth, out) { context.sampleEmission(x, y, depth, out); if (Math.abs(depth - z) < 1e-6) out.fill(0); } };
  assert.throws(() => prepareSmcCatalogue(line, gap), /zero-support gap/);
  assert.deepEqual(prepareSmcCatalogue(line, context).stars, [brightest]);
});

test('bright catalogue stars coincide with point sources in the registered original of the model and of every lens', { skip }, async () => {
  const context = (await contextPromise)!, payload = await load(), D = context.mapping.distanceUnits;
  async function registration(directory: string, bounds: { min: number[]; max: number[] }) {
    const image = await sharp(await readFile(`${directory}/source/original-image.png`)).raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = image.info, b = bounds;
    const luma = (c: number, r: number) => { const i = channels * (r * width + c); return image.data[i]! * .2126 + image.data[i + 1]! * .7152 + image.data[i + 2]! * .0722; };
    const at = (positionUnits: readonly number[]) => {
      const scale = 1 + positionUnits[2]! / D;
      return [(positionUnits[0]! / scale - b.min[0]!) / (b.max[0]! - b.min[0]!) * width - .5, (b.max[1]! - positionUnits[1]! / scale) / (b.max[1]! - b.min[1]!) * height - .5] as const;
    };
    const covered = (positionUnits: readonly number[]) => { const [px, py] = at(positionUnits); const c = Math.round(px), r = Math.round(py);
      return c >= 8 && r >= 8 && c < width - 8 && r < height - 8 && image.data[channels * (r * width + c) + 3]! >= 250; };
    function offset(positionUnits: readonly number[], window = 6) {
      const [px, py] = at(positionUnits);
      let best = -1, bx = 0, by = 0;
      for (let r = Math.round(py) - window; r <= Math.round(py) + window; r++) for (let c = Math.round(px) - window; c <= Math.round(px) + window; c++)
        if (c >= 0 && r >= 0 && c < width && r < height && luma(c, r) > best) { best = luma(c, r); bx = c; by = r; }
      return Math.hypot(bx - px, by - py);
    }
    const stars = payload.stars.filter(star => covered(star.positionUnits)).slice(0, 40);
    const median = (values: number[]) => values.sort((a, c) => a - c)[Math.floor(values.length / 2)]!;
    const mirror = (p: readonly number[]) => [-p[0]!, p[1]!, p[2]!];
    return { width, stars: stars.length, median: median(stars.map(star => offset(star.positionUnits))),
      within1px: stars.filter(star => offset(star.positionUnits) <= 1).length,
      mirroredWithin1px: stars.filter(star => covered(mirror(star.positionUnits)) && offset(mirror(star.positionUnits)) <= 1).length };
  }
  const model = await registration(finiteModelDirectory(context.modelResultId), context.mapping.boundsUnits);
  const results: Record<string, unknown> = { model };
  assert.ok(model.stars >= 30 && model.median < 2 && model.within1px > model.mirroredWithin1px * 2, JSON.stringify(model));
  const bundle = await readFile(`.local/nebula-lab/finite-lenses-${context.modelResultId}.json`, 'utf8').then(text => JSON.parse(text) as { lenses: { imageId: string; resultId: string }[] }, () => null);
  for (const lens of bundle?.lenses ?? []) {
    const directory = finiteModelDirectory(lens.resultId);
    const provenance = JSON.parse(await readFile(`${directory}/source/provenance.json`, 'utf8'));
    const result = await registration(directory, provenance.sourceRegistration.tangentBoundsKpc);
    results[lens.imageId] = result;
  }
  console.log(JSON.stringify(results));
});

test('each prepared layer belongs to its own model and uses the depth density that model\'s envelope pins', { skip }, async () => {
  const seen = new Map<string, string>();
  for (const path of layers) {
    const payload = await load(path).catch(() => null);
    if (!payload) continue;
    const finite = payload.provenance as { finiteModel: { modelResultId: string; lensRecipe: { path: string }; depthDensity: { path: string; sha256: string } } };
    const model = finite.finiteModel.modelResultId;
    assert.equal(seen.get(model), undefined, 'Two layers must not claim one model.');
    seen.set(model, path);
    assert.equal(preparedStarsPath(finite.finiteModel.lensRecipe.path), path, 'The layer path follows its lens recipe.');
    const recipe = JSON.parse(await readFile(finite.finiteModel.lensRecipe.path, 'utf8'));
    assert.equal(recipe.modelResultId, model, 'The checked-in recipe still names this model.');
    const index = JSON.parse(await readFile(finiteModelStarsIndex(model), 'utf8'));
    assert.equal(index.stars.path, path);
    assert.equal(index.stars.sha256, createHash('sha256').update(await readFile(path)).digest('hex'), `${path} index pin`);
    // The depth density is the cloud the model's own envelope names, and it is the pinned bytes on disk.
    const envelope = JSON.parse(await readFile(`${finiteModelDirectory(model)}/source/envelope.json`, 'utf8'));
    const request = JSON.parse(await readFile(`${finiteModelDirectory(model)}/source/provenance.json`, 'utf8')).request;
    assert.deepEqual(finite.finiteModel.depthDensity, envelope.priorCloud ?? request.cloud.provenance);
    assert.equal(createHash('sha256').update(await readFile(finite.finiteModel.depthDensity.path)).digest('hex'), finite.finiteModel.depthDensity.sha256);
  }
  assert.ok(seen.size >= 2, `Expected a star layer per prepared model, found ${seen.size}.`);
});
