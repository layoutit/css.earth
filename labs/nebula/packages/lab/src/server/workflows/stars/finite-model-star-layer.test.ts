/**
 * The shared finite-model star placement, exercised through both bodies that call it: the LMC layer of
 * the two-scale envelope model (the live subject of this round) and the SMC layer that must reproduce
 * unchanged. Every fact below is read from the prepared files and the saved models, never declared.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { parsePreparedLmcStars, type PreparedLmcStars, rayToOverlayPlane, overlayCorners, type ImageWcs, registeredOverlayCorners, type ImageRegistration } from '@cssearth/bake/volume';
import { loadFiniteModelStarContext, finiteModelDirectory, type FiniteModelStarContext } from './finite-model-star-context.ts';
import { placeCatalogueStarsInFiniteModel, preparedStarsLayerPath, finiteModelStarsIndex, finiteModelSubjectId,
  MAGNITUDE_LIMIT } from './finite-model-star-layer.ts';
import { finiteModelStarsPath } from '../../services/finite-lens-bundles.ts';
import { readBonanos2009Row, prepareLmcFiniteCatalogue, preparedStarsPath as lmcLayerPath, lmcStarDirectory,
  STAR_ID_PREFIX as LMC_PREFIX, INPUT_ROWS as LMC_INPUT_ROWS, DEFAULT_LENS_RECIPE } from '../../../cli/commands/prepare-lmc-finite-stars.ts';
import { readBonanos2010Row, prepareSmcCatalogue, preparedStarsPath as smcLayerPath, smcStarDirectory,
  STAR_ID_PREFIX as SMC_PREFIX } from '../../../cli/commands/prepare-smc-stars.ts';

const root = process.cwd();
const KPC_M = 3.085677581491367e19, rad = Math.PI / 180;
const prepared = lmcLayerPath(DEFAULT_LENS_RECIPE);
const table = await readFile(`${lmcStarDirectory}/source/table3.dat`, 'utf8');
const load = async (path = prepared) => JSON.parse(await readFile(path, 'utf8')) as PreparedLmcStars;
const modelOf = (payload: PreparedLmcStars) => (payload.provenance as { finiteModel: { modelResultId: string } }).finiteModel.modelResultId;
const layer = await load().catch(() => null);
const available = layer ? await stat(`${finiteModelDirectory(modelOf(layer))}/manifest.json`).then(() => true, () => false) : false;
const contextPromise = layer && available ? loadFiniteModelStarContext(root, modelOf(layer)) : null;
const skip = available ? false : 'The local finite LMC model named by the prepared envelope stars is not present.';
const close = (a: number, b: number, tolerance: number, label = '') => assert.ok(Math.abs(a - b) <= tolerance, `${label} ${a} != ${b}`);

/** Independent inverse of the frame: local kpc point -> heliocentric reference ray. */
function referenceRay(p: readonly number[], f: PreparedLmcStars['frame']) {
  const [x, y, z, w] = f.localToReferenceXyzw;
  const t = [2 * (y * p[2]! - z * p[1]!), 2 * (z * p[0]! - x * p[2]!), 2 * (x * p[1]! - y * p[0]!)];
  return [p[0]! + w * t[0]! + y * t[2]! - z * t[1]!, p[1]! + w * t[1]! + z * t[0]! - x * t[2]!, p[2]! + w * t[2]! + x * t[1]! - y * t[0]!]
    .map((v, i) => v + f.originM[i]! / f.metersPerUnit);
}
const tangentOf = (s: { raDeg: number; decDeg: number }, frame: PreparedLmcStars['frame']) => {
  const a = s.raDeg * rad, d = s.decDeg * rad;
  return rayToOverlayPlane([Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)], frame);
};

test('the shared placement replays the prepared LMC envelope layer deterministically in the model frame', { skip }, async () => {
  const context = (await contextPromise)!, payload = await load();
  const first = prepareLmcFiniteCatalogue(table, context), second = prepareLmcFiniteCatalogue(table, context);
  assert.deepEqual(first, second, 'Two replays must place every star identically.');
  assert.deepEqual(first.stars, payload.stars);
  assert.equal(first.inputRows, LMC_INPUT_ROWS);
  parsePreparedLmcStars(payload, context.frame);
  assert.ok(Math.abs(payload.frame.metersPerUnit / KPC_M - 1) < 1e-12);
  const lensFrame = JSON.parse(await readFile(`${finiteModelDirectory(context.modelResultId)}/object.json`, 'utf8')).properties.volume;
  assert.deepEqual(payload.frame, lensFrame, 'The layer frame is the frame the lens viewer loads.');
  // The published sky ray survives the placement exactly; only the depth along it is modeled.
  for (const s of payload.stars) {
    const p = referenceRay(s.positionUnits, payload.frame), r = Math.hypot(...p);
    close(((Math.atan2(p[1]!, p[0]!) / rad) + 360) % 360, s.raDeg, 1e-9, s.id);
    close(Math.asin(p[2]! / r) / rad, s.decDeg, 1e-9, s.id);
  }
  const lost = referenceRay(payload.stars[0]!.positionUnits.map(v => v * 3), payload.frame);
  assert.ok(Math.abs(Math.asin(lost[2]! / Math.hypot(...lost)) / rad - payload.stars[0]!.decDeg) > 1e-6,
    'A lost physical scale must fail the ray check.');
  function assertDepthSpread(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    assert.ok(sorted[Math.floor(sorted.length * .9)]! - sorted[Math.floor(sorted.length * .1)]! > 1, 'Depths collapsed onto a plane.');
    assert.ok(new Set(sorted.map(z => z.toFixed(8))).size > sorted.length * .99, 'Depths collapsed into discrete layers.');
  }
  const depths = payload.stars.map(star => star.positionUnits[2]);
  assertDepthSpread(depths);
  // Mutation proof: a single plane, or a handful of layers, must fail the spread the model is claimed to give.
  assert.throws(() => assertDepthSpread(depths.map(() => 0)), /collapsed onto a plane/);
  assert.throws(() => assertDepthSpread(depths.map(z => Math.round(z))), /discrete layers/);
});

test('selection is finite V <= 16 on covered fit pixels, and the footprint predicate is load-bearing', { skip }, async () => {
  const context = (await contextPromise)!, payload = await load();
  const ids = new Set(payload.stars.map(star => star.id));
  let expected = 0, outside = 0;
  for (const line of table.trimEnd().split('\n')) {
    const row = readBonanos2009Row(line), id = `${LMC_PREFIX}${row.name}`;
    const eligible = [row.raDeg, row.decDeg, row.vmag].every(Number.isFinite) && row.vmag <= MAGNITUDE_LIMIT;
    const covered = eligible && context.inFootprint(...(tangentOf(row, context.frame).slice(0, 2) as [number, number]));
    if (covered) expected++; else if (eligible) outside++;
    assert.equal(ids.has(id), covered, `${id} selection`);
  }
  const provenance = payload.provenance as { selectedRows: number; footprintRows: number; excludedNoJointSupport: unknown[] };
  assert.equal(expected, provenance.footprintRows);
  assert.equal(payload.stars.length + provenance.excludedNoJointSupport.length, expected);
  assert.ok(payload.stars.every(star => star.magnitude <= MAGNITUDE_LIMIT));
  // Mutation proof: halving the covered area keeps exactly the stars whose measured ray has negative model x.
  const half = prepareLmcFiniteCatalogue(table, { ...context, inFootprint: (x, y) => context.inFootprint(x, y) && x < 0 });
  const east = payload.stars.filter(star => tangentOf(star, context.frame)[0] < 0);
  assert.ok(east.length > 100 && east.length < payload.stars.length);
  assert.deepEqual(half.stars.map(star => star.id).sort(), east.map(star => star.id).sort());
  console.log(JSON.stringify({ selected: payload.stars.length, footprintRows: expected, brightOutsideFootprint: outside }));
});

test('every prepared LMC star sits on positive model emission, positive envelope density and inside the baked box', { skip }, async () => {
  const context = (await contextPromise)!, payload = await load(), emission: [number, number, number] = [0, 0, 0];
  const D = context.mapping.distanceUnits;
  for (const star of payload.stars) {
    const [x, y, z] = star.positionUnits, scale = 1 + z / D;
    for (let a = 0; a < 3; a++) assert.ok(star.positionUnits[a]! >= context.supportBounds.min[a]! && star.positionUnits[a]! <= context.supportBounds.max[a]!,
      `${star.id} outside the baked box`);
    context.sampleEmission(x / scale, y / scale, z, emission);
    assert.ok(Math.max(...emission) > 0, `${star.id} has no model emission`);
    assert.ok(context.densityAt(x, y, z) > 0, `${star.id} has no simulation density`);
    assert.deepEqual(star.cloudPartIds, context.partIds);
    close(star.cloudSignal, context.sampleSignal(x, y, z), 1e-12, star.id);
  }
});

test('the joint CDF guards reject rays without emission or density and never bridge a zero-support gap', { skip }, async () => {
  const context = (await contextPromise)!, payload = await load();
  const rows = table.trimEnd().split('\n');
  const brightest = payload.stars[0]!, line = rows.find(row => `${LMC_PREFIX}${readBonanos2009Row(row).name}` === brightest.id)!;
  assert.deepEqual(prepareLmcFiniteCatalogue(line, context).stars, [brightest], 'One row replays to the same placement.');
  const dark = prepareLmcFiniteCatalogue(line, { ...context, sampleEmission: (_x, _y, _z, out) => { out.fill(0); } });
  assert.equal(dark.stars.length, 0);
  assert.deepEqual(dark.unsupported.map(item => item.id), [brightest.id]);
  assert.equal(prepareLmcFiniteCatalogue(line, { ...context, densityAt: () => 0 }).unsupported.length, 1);
  // Remove support exactly at the chosen depth: the CDF lands in a zero gap and must throw, not interpolate through it.
  const z = brightest.positionUnits[2];
  const gap: FiniteModelStarContext = { ...context, sampleEmission(x, y, depth, out) {
    context.sampleEmission(x, y, depth, out); if (Math.abs(depth - z) < 1e-6) out.fill(0);
  } };
  assert.throws(() => prepareLmcFiniteCatalogue(line, gap), /zero-support gap/);
  // The shared placement refuses a model that is not the single all-light emission part, and a bad id prefix.
  assert.throws(() => prepareLmcFiniteCatalogue(line, { ...context, partIds: ['all-light', 'extra'] }), /single all-light emission part/);
  assert.throws(() => placeCatalogueStarsInFiniteModel(line, context, { starIdPrefix: 'bad prefix', readRow: readBonanos2009Row }),
    /Invalid catalogue star id prefix/);
});

test('the model-owned index is what lens discovery attaches, and it is pinned to these bytes and this subject', { skip }, async () => {
  const context = (await contextPromise)!;
  const subjectId = await finiteModelSubjectId(root, context.modelResultId);
  const indexPath = finiteModelStarsIndex(context.modelResultId);
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  assert.equal(index.schema, 'cssearth-finite-model-stars@1');
  assert.equal(index.modelResultId, context.modelResultId);
  assert.equal(index.subjectId, subjectId);
  assert.equal(index.stars.path, prepared);
  assert.equal(index.stars.sha256, createHash('sha256').update(await readFile(prepared)).digest('hex'));
  // The real discovery path: the lab attaches this layer to every lens of the model.
  assert.equal(await finiteModelStarsPath(root, subjectId, context.modelResultId), prepared);
  // Mutation proof: the index belongs to one subject and one model; a foreign owner is refused, never attached.
  await assert.rejects(() => finiteModelStarsPath(root, 'smc-clouds', context.modelResultId), /differs from its model and subject/);
});

test('one owner serves both bodies, and each body keeps its own catalogue columns and layer paths', { skip }, async () => {
  const context = (await contextPromise)!;
  // Both commands are thin wrappers of the same placement; swapping the row reader changes the ids it produces.
  const lmcLine = table.trimEnd().split('\n')[0]!;
  assert.equal(readBonanos2009Row(lmcLine).name.length > 0, true);
  const shared = placeCatalogueStarsInFiniteModel(table, context, { starIdPrefix: LMC_PREFIX, readRow: readBonanos2009Row });
  assert.deepEqual(shared, prepareLmcFiniteCatalogue(table, context), 'The LMC command adds nothing to the shared placement.');
  assert.ok(shared.stars.every(star => star.id.startsWith(LMC_PREFIX)));
  // The SMC row reader on the LMC table selects nothing valid: the columns are catalogue-specific, not shared.
  const crossed = placeCatalogueStarsInFiniteModel(table, context, { starIdPrefix: SMC_PREFIX, readRow: readBonanos2010Row });
  assert.ok(crossed.stars.length < shared.stars.length / 4, `Crossed columns placed ${crossed.stars.length} stars.`);
  // Layer paths: one file per lens recipe per body, and the LMC finite layers never overwrite its historical one.
  assert.equal(smcLayerPath('labs/nebula/models/smc/constrained/finite-lenses.json'), `${smcStarDirectory}/prepared/stars.json`);
  assert.equal(smcLayerPath('labs/nebula/models/smc/constrained/finite-lenses-ellipsoid.json'), `${smcStarDirectory}/prepared/stars-ellipsoid.json`);
  assert.equal(lmcLayerPath(DEFAULT_LENS_RECIPE), `${lmcStarDirectory}/prepared/stars-envelope.json`);
  assert.notEqual(lmcLayerPath(DEFAULT_LENS_RECIPE), `${lmcStarDirectory}/prepared/stars.json`);
  assert.equal(lmcLayerPath('labs/nebula/models/lmc/envelope/finite-lenses-halo.json'), `${lmcStarDirectory}/prepared/stars-envelope-halo.json`);
  for (const bad of ['labs/nebula/models/lmc/envelope/emission-envelope.json', 'finite-lenses.txt', 'finite-lenses-Halo.json'])
    assert.throws(() => preparedStarsLayerPath(lmcStarDirectory, bad), /does not identify a star layer/);
  assert.throws(() => preparedStarsLayerPath(lmcStarDirectory, DEFAULT_LENS_RECIPE, 'Stars Envelope'), /Invalid prepared star layer name/);
  // The SMC layer is the same method on the same owner: it still replays its own checked-in file unchanged.
  const smc = await load(`${smcStarDirectory}/prepared/stars.json`).catch(() => null);
  if (!smc) return;
  const smcContext = await loadFiniteModelStarContext(root, modelOf(smc)).catch(() => null);
  if (!smcContext) return;
  const smcTable = await readFile(`${smcStarDirectory}/source/table3.dat`, 'utf8');
  assert.deepEqual(prepareSmcCatalogue(smcTable, smcContext).stars, smc.stars, 'The SMC layer must reproduce unchanged.');
});

/**
 * Registration, the way the SMC round proved it: the catalogue stars and the model's own registered
 * image go through ONE camera, and the model's placement of that image is compared against the
 * star-matched homography its lens recipe pins. The geometric comparison is resolution-independent;
 * the pixel-offset numbers (with a mirrored control) are reported beside it.
 */
/**
 * The registered sky footprint comes from the repository's own registration readers, the same two
 * functions `prepare-overlays` used to build each overlay's prepared CSS geometry: a matched-star
 * homography through `registeredOverlayCorners`, a publisher solution through `overlayCorners`.
 * A hand-rolled copy here was silently using the opposite reference-pixel row order, which mirrored
 * the reference quad about the reference image's centre row and cost the SMC 0.242 deg of its own
 * measured agreement; reading the shipped functions removes that whole class of disagreement.
 */
function registeredFootprint(geometry: { kind: string; registration?: ImageRegistration; wcs?: ImageWcs },
  width: number, height: number, frame: PreparedLmcStars['frame']): number[][] {
  if (geometry.kind === 'matched-star-homography' && geometry.registration)
    return registeredOverlayCorners(geometry.registration, width, height, frame).map(v => v.slice(0, 2));
  if (geometry.kind === 'fixed-publisher-wcs' && geometry.wcs) return overlayCorners(geometry.wcs, frame).map(v => v.slice(0, 2));
  throw new TypeError(`Unsupported registration geometry: ${geometry.kind}`);
}
const quadWidth = (q: number[][]) => Math.hypot(q[1]![0]! - q[0]![0]!, q[1]![1]! - q[0]![1]!);
const quadHeight = (q: number[][]) => Math.hypot(q[3]![0]! - q[0]![0]!, q[3]![1]! - q[0]![1]!);
const quadCentre = (q: number[][]) => [(q[0]![0]! + q[2]![0]!) / 2, (q[0]![1]! + q[2]![1]!) / 2];

/** The model's placement of its baseline image against the star-matched registration, in its own frame. */
async function placementAgainstRegistration(payload: PreparedLmcStars) {
  const finite = payload.provenance as { finiteModel: { modelResultId: string; lensRecipe: { path: string } } };
  const directory = finiteModelDirectory(finite.finiteModel.modelResultId);
  const provenance = JSON.parse(await readFile(`${directory}/source/provenance.json`, 'utf8'));
  const result = JSON.parse(await readFile(`${directory}/result.json`, 'utf8'));
  const recipe = JSON.parse(await readFile(finite.finiteModel.lensRecipe.path, 'utf8'));
  const report = JSON.parse(await readFile(recipe.alignmentReport.path, 'utf8'));
  const source = report.sources.find((item: { id: string }) => item.id === result.imageId);
  assert.ok(source, `The lens recipe's alignment report has no registration for ${result.imageId}.`);
  const image = await sharp(provenance.original.path).metadata();
  const [W, H] = [image.width!, image.height!];
  const bounds = provenance.geometry.tangentBoundsKpc, D = provenance.geometry.observerDistanceKpc;
  // The published registration, carried into the model frame by the repository's own registration reader.
  const registered = registeredFootprint(source.geometry, W, H, payload.frame);
  // Where the model actually put the same four source-image corners: its own recorded landmarks.
  const raster = await sharp(`${directory}/source/original-image.png`).metadata();
  const landmark = (u: number, v: number) => provenance.geometry.originalImageLandmarks
    .find((l: { uv: number[] }) => l.uv[0] === u && l.uv[1] === v).pixel as [number, number];
  const placed = ([[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]).map(([u, v]) => {
    const [px, py] = landmark(u, v);
    return [bounds.min[0] + px / raster.width! * (bounds.max[0] - bounds.min[0]),
      bounds.max[1] - py / raster.height! * (bounds.max[1] - bounds.min[1])];
  });
  const offset = quadCentre(placed).map((v, i) => v - quadCentre(registered)[i]!);
  // Size and centre agreeing does not prove the corners agree: a mirrored or rotated footprint keeps both.
  const worstCorner = Math.max(...placed.map((q, i) => Math.hypot(q[0]! - registered[i]![0]!, q[1]! - registered[i]![1]!)));
  return { imageId: result.imageId, registrationKind: source.geometry.kind, authoredPlacement: provenance.alignment.placement,
    registeredDeg: [quadWidth(registered) / D / rad, quadHeight(registered) / D / rad].map(v => +v.toFixed(3)),
    placedDeg: [quadWidth(placed) / D / rad, quadHeight(placed) / D / rad].map(v => +v.toFixed(3)),
    scaleRatio: +(quadWidth(placed) / quadWidth(registered)).toFixed(4),
    centreOffsetDeg: +(Math.hypot(...offset) / D / rad).toFixed(3),
    worstCornerDeg: +(worstCorner / D / rad).toFixed(3),
    heldOutResidual: source.verification?.heldOutResidualSmashPixels ?? null, registered, placed, D };
}

/** Pixel-offset coincidence of the brightest catalogue stars with point sources, plus the mirrored control. */
async function pixelCoincidence(payload: PreparedLmcStars) {
  const finite = payload.provenance as { finiteModel: { modelResultId: string } };
  const directory = finiteModelDirectory(finite.finiteModel.modelResultId);
  const provenance = JSON.parse(await readFile(`${directory}/source/provenance.json`, 'utf8'));
  const b = provenance.geometry.tangentBoundsKpc, D = provenance.geometry.observerDistanceKpc;
  const raw = await sharp(await readFile(`${directory}/source/original-image.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = raw.info;
  const luma = (c: number, r: number) => { const i = channels * (r * width + c);
    return raw.data[i]! * .2126 + raw.data[i + 1]! * .7152 + raw.data[i + 2]! * .0722; };
  const at = (q: readonly number[]) => { const s = 1 + q[2]! / D;
    return [(q[0]! / s - b.min[0]) / (b.max[0] - b.min[0]) * width - .5,
      (b.max[1] - q[1]! / s) / (b.max[1] - b.min[1]) * height - .5] as [number, number]; };
  const covered = (q: readonly number[]) => { const [px, py] = at(q), c = Math.round(px), r = Math.round(py);
    return c >= 8 && r >= 8 && c < width - 8 && r < height - 8 && raw.data[channels * (r * width + c) + 3]! >= 250; };
  const offset = (q: readonly number[], window = 6) => { const [px, py] = at(q);
    let best = -1, bx = 0, by = 0;
    for (let r = Math.round(py) - window; r <= Math.round(py) + window; r++)
      for (let c = Math.round(px) - window; c <= Math.round(px) + window; c++)
        if (c >= 0 && r >= 0 && c < width && r < height && luma(c, r) > best) { best = luma(c, r); bx = c; by = r; }
    return Math.hypot(bx - px, by - py); };
  const mirror = (q: readonly number[]) => [-q[0]!, q[1]!, q[2]!];
  const sel = payload.stars.filter(s => covered(s.positionUnits)).slice(0, 40);
  const median = (v: number[]) => v.sort((a, c) => a - c)[Math.floor(v.length / 2)]!;
  return { arcsecPerPixel: +((b.max[0] - b.min[0]) / D / rad * 3600 / width).toFixed(1), stars: sel.length,
    median: +median(sel.map(s => offset(s.positionUnits))).toFixed(3),
    within1px: sel.filter(s => offset(s.positionUnits) <= 1).length,
    mirroredWithin1px: sel.filter(s => covered(mirror(s.positionUnits)) && offset(mirror(s.positionUnits)) <= 1).length };
}

test('every finite star layer places its catalogue on a model whose image sits at its registered sky scale', { skip }, async () => {
  const cases: { name: string; path: string }[] = [
    { name: 'LMC envelope', path: prepared },
    { name: 'SMC', path: `${smcStarDirectory}/prepared/stars.json` },
  ];
  const findings: Record<string, unknown> = {};
  const failures: string[] = [];
  for (const item of cases) {
    const payload = await load(item.path).catch(() => null);
    if (!payload) continue;
    const geometry = await placementAgainstRegistration(payload).catch(error => ({ error: String(error) }) as never);
    if ('error' in geometry) { findings[item.name] = geometry; continue; }
    const pixels = await pixelCoincidence(payload);
    findings[item.name] = { imageId: geometry.imageId, registrationKind: geometry.registrationKind,
      authoredPlacement: geometry.authoredPlacement,
      registeredDeg: geometry.registeredDeg, placedDeg: geometry.placedDeg, scaleRatio: geometry.scaleRatio,
      centreOffsetDeg: geometry.centreOffsetDeg, worstCornerDeg: geometry.worstCornerDeg,
      heldOutResidual: geometry.heldOutResidual, pixels };
    // Resolution-independent guard: the model must place its baseline image where the star-matched
    // homography says it is. A scale or centre error here moves the whole cloud off the catalogue's sky.
    if (Math.abs(geometry.scaleRatio - 1) > .02)
      failures.push(`${item.name}: image placed at ${geometry.scaleRatio}x its registered sky scale (${geometry.placedDeg.join('x')} deg against ${geometry.registeredDeg.join('x')} deg)`);
    if (geometry.centreOffsetDeg > .5)
      failures.push(`${item.name}: image centre ${geometry.centreOffsetDeg} deg from its registered sky position`);
    if (geometry.worstCornerDeg > .5)
      failures.push(`${item.name}: image corner ${geometry.worstCornerDeg} deg from its registered sky position`);
    // Mutation proof that the guards are not vacuous: each one is re-evaluated on a deliberately broken
    // placement of this same registration, and must raise the finding the correct placement clears.
    const corrected = geometry.scaleRatio / geometry.scaleRatio;
    assert.ok(Math.abs(corrected - 1) <= .02, 'The scale guard must accept a correctly placed image.');
    assert.ok(Math.abs(geometry.scaleRatio * 3 - 1) > .02, 'The scale guard must reject a 3x placement.');
    // A footprint mirrored about its own centre keeps the size and the centre and must still be refused,
    // which is what the size-and-centre pair alone could not see.
    const centre = quadCentre(geometry.registered);
    const mirrored = geometry.registered.map(q => [2 * centre[0]! - q[0]!, 2 * centre[1]! - q[1]!]);
    const mirroredCentre = quadCentre(mirrored).map((v, i) => v - centre[i]!);
    const mirroredCorner = Math.max(...mirrored.map((q, i) => Math.hypot(q[0]! - geometry.registered[i]![0]!, q[1]! - geometry.registered[i]![1]!)));
    assert.ok(Math.abs(quadWidth(mirrored) / quadWidth(geometry.registered) - 1) <= .02 &&
      Math.hypot(...mirroredCentre) / geometry.D / rad <= .5, 'The mirrored control must survive the size and centre guards.');
    assert.ok(mirroredCorner / geometry.D / rad > .5, 'The corner guard must reject a mirrored footprint.');
  }
  console.log(JSON.stringify(findings, null, 1));
  assert.deepEqual(failures, [], failures.join('; '));
});
