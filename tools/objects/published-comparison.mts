/**
 * Measure how a ground-based photograph lens reproduces the comparison figure of the paper that published its frames.
 *
 *   node tools/objects/published-comparison.mts <object-id>          report the measurements
 *   node tools/objects/published-comparison.mts <object-id> --write  also write evidence/published-comparison.json and its image
 *
 * The body's `source/preparation/published-comparison.json` names the figure: a pinned paper, the figure's image object
 * and its pixels' digest, which rows hold photographs and the model the lens rides, and which lens frame each column
 * shows, in which dark band. A new record may state the digest as 64 zeros; `--write` adopts the figure it finds and
 * says so. Everything is measured through the pipeline's own cameras, derived from the body's observer-cameras record.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { sha256 } from '@cssearth/core/node';
import { requireArray, requireRecord } from '@cssearth/core';
import { readPdfImage } from '../fits/pdf-image.mts';
import { lamBytes } from './sphere-survey/lam.mts';
import { deriveObserverCameras, loadObserverCameraInputs, loadOrientation, type DerivedCamera } from './terrestrial-layers/observer-cameras.mts';
import { decodeCalibratedCamera, loadCameraShape } from './terrestrial-layers/shape-camera-mosaic.mts';
import { radialTerrainForLens } from './terrestrial-layers/alternative-lenses.mts';
import { observerCaster, turnedOrientation, type TurnableCaster } from './terrestrial-layers/registration-sweeps.mts';
import { COMPARISON_EVIDENCE_SCHEMA, COMPARISON_SPEC_FILE, PHASE_SWEEP_STEP_DEGREES, axisDifferenceDegrees, bestImageTurnDegrees, columnCells, comparisonBlock, outlineOverlap, panelAxisDegrees, panelDisc, parseComparisonEvidence, parseComparisonSpec, withComparisonBlock, type Mask, type Raster } from './surface-observations/published-comparison.mts';

const ROOT = resolve(import.meta.dirname, '../..');
const SWEEP = { from: -30, to: 30, step: 2 };
const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const area = (mask: Mask) => mask.data.reduce((sum, value) => sum + value, 0);

/** A new record may leave the figure's pixel digest as 64 zeros; `--write` then adopts the figure it finds, once. */
const UNPINNED = '0'.repeat(64);

/** The measurement for a body's package, or for any source directory laid out like one, such as a setup run's scratch copy. */
export async function measurePublishedComparison(objectId: string, { adopt = false, sourceDirectory = resolve(ROOT, 'src/objects', objectId, 'source') } = {}) {
  const specPath = resolve(sourceDirectory, COMPARISON_SPEC_FILE);
  const stated = JSON.parse(await readFile(specPath, 'utf8')), spec = parseComparisonSpec(stated);
  const { record, recipe, frames } = await loadObserverCameraInputs(sourceDirectory);
  if (spec.lensId !== record.lensId) throw new TypeError(`The comparison names lens ${spec.lensId}; the observer cameras derive ${record.lensId}.`);
  const mesh = await loadCameraShape(sourceDirectory, radialTerrainForLens(recipe as unknown as Parameters<typeof radialTerrainForLens>[0], record.lensId));

  // The paper, read from its address (a cited paper is not kept in the repository), then the figure, by its object number.
  const paper = await lamBytes(spec.document.url);
  const image = readPdfImage(paper, spec.document.object), pixels = sha256(image.data);
  if (image.width !== spec.document.width || image.height !== spec.document.height)
    throw new Error(`Object ${spec.document.object} is not the ${image.width}×${image.height} ${spec.figure} the spec records.`);
  const figure: Raster = image, cell = columnCells(figure, spec);

  // The native outline over a sweep of rotational phase, through the same derivation the recipe's cameras come from.
  const base = await loadOrientation(sourceDirectory, record.rotation, ROOT);
  const sweep: Record<string, number> = {}; let atZero: DerivedCamera[] = [];
  for (let offset = SWEEP.from; offset <= SWEEP.to; offset += SWEEP.step) {
    const derived = await deriveObserverCameras(sourceDirectory, record, frames, mesh, ROOT, { orientation: offset === 0 ? base : turnedOrientation(base, offset) });
    sweep[offset] = round(derived.reduce((sum, camera) => sum + camera.limb.residualPixels, 0) / derived.length);
    if (offset === 0) atZero = derived;
  }
  const best = Object.entries(sweep).sort((a, b) => a[1] - b[1])[0];

  // Our outline at a camera: every pixel whose ray meets the mesh.
  const render = (caster: TurnableCaster, width: number, height: number) => {
    const mask = new Uint8Array(width * height), origin = caster.positionMeters;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mesh.intersect(origin, caster.ray(x, y))) mask[y * width + x] = 1;
    return { mask: { width, height, data: mask } as Mask };
  };

  const columns = [], visuals: { label: string; model: Mask; photograph: Mask; ours: Mask; cellModel: number; cellImage: number; column: number }[] = [];
  for (const [index, column] of spec.columns.entries()) {
    if (column.frame === null) continue;
    const camera = atZero.find(entry => entry.id === column.frame);
    if (!camera) throw new TypeError(`Figure column ${column.label} names ${column.frame}, which is not a frame of lens ${spec.lensId}.`);
    // The survey figures label each column with its frame's exposure start to the second.
    if (!(Math.abs(Date.parse(`${column.label}Z`) - Date.parse(`${camera.exposure.start}Z`)) < 1000))
      throw new TypeError(`Figure column ${column.label} names ${column.frame}, whose exposure starts at ${camera.exposure.start}.`);
    const { width, height } = decodeCalibratedCamera(await readFile(resolve(sourceDirectory, camera.path)), 'fits-zimpol-intensity');
    const caster = observerCaster(camera.sighting, base), model = panelDisc(figure, cell(spec.rows.model, index)), photograph = panelDisc(figure, cell(spec.rows.image, index), 40, spec.rows.labelLines);
    const turns: Record<string, number> = {};
    for (let turn = 0; turn < 360; turn += PHASE_SWEEP_STEP_DEGREES) turns[turn] = round(outlineOverlap(render(turn === 0 ? caster : caster.turned(turn), width, height).mask, model));
    const drawn = render(caster, width, height);
    // What the measure gives one shape at this pair of scales: our outline against itself drawn at the paper panel's pixel
    // scale. The two drawings differ only by their pixels, so this is the score to read the paper comparisons against.
    const scale = Math.sqrt(area(drawn.mask) / area(model)), [cx, cy] = camera.sighting.center;
    const resampled = observerCaster({ ...camera.sighting, pixelAngleMicroradians: camera.sighting.pixelAngleMicroradians * scale, center: [cx / scale, cy / scale] }, base);
    const floor = outlineOverlap(drawn.mask, render(resampled, Math.ceil(width / scale), Math.ceil(height / scale)).mask);
    const project = (z: number) => caster.project([0, 0, z]);
    const north = project(1e5), south = project(-1e5);
    const ours = north && south ? ((Math.atan2(-(north[1] - south[1]), north[0] - south[0]) * 180 / Math.PI) % 180 + 180) % 180 : null;
    const paperAxis = panelAxisDegrees(figure, cell(spec.rows.model, index));
    const bestTurn = Number(Object.entries(turns).sort((a, b) => b[1] - a[1])[0][0]);
    columns.push({ label: column.label, frame: column.frame, overlapWithModel: turns[0], overlapWithPhotograph: round(outlineOverlap(drawn.mask, photograph)), sameShapeOverlap: round(floor),
      bestTurnDegrees: bestTurn > 180 ? bestTurn - 360 : bestTurn, turns,
      imageTurnDegrees: { model: bestImageTurnDegrees(drawn.mask, model), photograph: bestImageTurnDegrees(drawn.mask, photograph) },
      axis: { paperDegrees: paperAxis === null ? null : round(paperAxis, 1), oursDegrees: ours === null ? null : round(ours, 1), differenceDegrees: paperAxis === null || ours === null ? null : round(axisDifferenceDegrees(ours, paperAxis), 1) } });
    visuals.push({ label: column.label, model, photograph, ours: drawn.mask, cellModel: spec.rows.model, cellImage: spec.rows.image, column: index });
  }
  const evidence = {
    schema: COMPARISON_EVIDENCE_SCHEMA, objectId, lensId: spec.lensId, source: spec.source, figure: spec.figure,
    document: { url: spec.document.url, object: spec.document.object, pixels },
    rotation: { path: record.rotation.path, columnOrder: record.rotation.columnOrder ?? null },
    columns,
    nativeOutline: { frames: atZero.length, residualPixelsAtZero: sweep[0], bestOffsetDegrees: Number(best[0]), sweepDegrees: SWEEP, residualPixels: sweep },
  };
  return { evidence, figure, cell, visuals };
}

/** Write `published-comparison.json` and its image into an evidence directory. */
export async function writeComparisonEvidence(result: Awaited<ReturnType<typeof measurePublishedComparison>>, directory: string) {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'published-comparison.json'), JSON.stringify(result.evidence, null, 2) + '\n');
  await evidenceImage(result, resolve(directory, 'published-comparison.webp'));
}

/**
 * One tile per compared column, up to four to a row: the paper's photograph panel with the outline of the paper's model
 * in amber and ours in cyan. The figure does not align a column's panels with each other (Elektra's photographs sit 4 to
 * 14 px from its model panels), so both outlines are centred on the photograph, as the overlap measure compares shapes:
 * the paper's model keeps its own size, and ours is scaled to it.
 */
async function evidenceImage(result: Awaited<ReturnType<typeof measurePublishedComparison>>, path: string) {
  const { figure, cell, visuals } = result, tile = 220, gap = 8, header = 30, perRow = Math.min(4, visuals.length), rows = Math.ceil(visuals.length / perRow);
  const width = Math.max(perRow * tile + (perRow - 1) * gap, 2 * tile + gap), height = header + rows * tile + (rows - 1) * gap, canvas = Buffer.alloc(width * height * 3, 16);
  const put = (x: number, y: number, rgb: readonly number[]) => { if (x >= 0 && y >= 0 && x < width && y < height) canvas.set(rgb, (y * width + x) * 3); };
  const figurePixel = (x: number, y: number) => [0, 1, 2].map(k => Number(figure.data[(y * figure.width + x) * 3 + k]));
  const centroid = (m: Mask) => { let n = 0, sx = 0, sy = 0; m.data.forEach((v, i) => { if (v) { n++; sx += i % m.width; sy += Math.floor(i / m.width); } }); return [sx / n, sy / n]; };
  const within = (m: Mask, x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height && m.data[y * m.width + x] === 1;
  const edge = (inside: (x: number, y: number) => boolean, x: number, y: number) => inside(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inside(x + dx, y + dy));
  for (const [index, visual] of visuals.entries()) {
    const left = (index % perRow) * (tile + gap), top = header + Math.floor(index / perRow) * (tile + gap);
    const photo = cell(visual.cellImage, visual.column), step = Math.min(photo.x1 - photo.x0, photo.y1 - photo.y0) / tile;
    for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) put(left + x, top + y, figurePixel(photo.x0 + Math.floor(x * step), photo.y0 + Math.floor(y * step)));
    const [px, py] = centroid(visual.photograph), [mx, my] = centroid(visual.model), [ox, oy] = centroid(visual.ours);
    const inModel = (x: number, y: number) => within(visual.model, Math.floor(x * step - px + mx), Math.floor(y * step - py + my));
    const scale = Math.sqrt(area(visual.ours) / area(visual.model));
    const inOurs = (x: number, y: number) => within(visual.ours, Math.round(ox + (x * step - px) * scale), Math.round(oy + (y * step - py) * scale));
    for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) if (edge(inModel, x, y)) put(left + x, top + y, [255, 176, 0]);
    for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) if (edge(inOurs, x, y)) put(left + x, top + y, [0, 220, 255]);
  }
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="2" y="20" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#e6e6e6">Paper photographs, with the outlines of <tspan fill="#ffb000">the paper's model</tspan> and <tspan fill="#00dcff">ours</tspan> centred on each</text></svg>`;
  await sharp(canvas, { raw: { width, height, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).webp({ quality: 86 }).toFile(path);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [objectId, flag] = process.argv.slice(2);
  if (!objectId || (flag !== undefined && flag !== '--write')) { console.error('usage: node tools/objects/published-comparison.mts <object-id> [--write]'); process.exit(2); }
  const result = await measurePublishedComparison(objectId, { adopt: flag === '--write' }), { evidence } = result;
  for (const c of evidence.columns) console.log(`${c.label}  overlap with the paper's model ${c.overlapWithModel}, with its photograph ${c.overlapWithPhotograph}, same shape at both scales ${c.sameShapeOverlap}; best turn ${c.bestTurnDegrees}°; image turn onto the model ${c.imageTurnDegrees.model}°, onto the photograph ${c.imageTurnDegrees.photograph}°; axis ours ${c.axis.oursDegrees}° against ${c.axis.paperDegrees}° (${c.axis.differenceDegrees}°)`);
  const o = evidence.nativeOutline;
  console.log(`native outline over ${o.frames} frames: ${o.residualPixelsAtZero} px at our phase, smallest at ${o.bestOffsetDegrees}°`);
  if (flag === '--write') {
    await writeComparisonEvidence(result, resolve(ROOT, 'src/objects', objectId, 'evidence'));
    const readmePath = resolve(ROOT, 'src/objects', objectId, 'README.md'), { readme, replaced } = withComparisonBlock(await readFile(readmePath, 'utf8'), comparisonBlock(parseComparisonEvidence(evidence)));
    if (replaced) { await writeFile(readmePath, readme); console.log(`Wrote the comparison block into ${objectId}/README.md.`); }
    console.log(`Wrote evidence/published-comparison.json and its image for ${objectId}.`);
  }
}
