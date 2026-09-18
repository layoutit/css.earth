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
import { sha256 } from '../../src/platform/sha256.mts';
import { requireArray, requireRecord } from '../source-values.mts';
import { readPdfImage } from '../pdf-image.mts';
import { deriveObserverCameras, loadObserverCameraInputs, loadOrientation, type DerivedCamera } from './terrestrial-layers/observer-cameras.mts';
import { decodeCalibratedCamera, loadCameraShape } from './terrestrial-layers/shape-camera-mosaic.mts';
import { radialTerrainForLens } from './terrestrial-layers/radial-models.mts';
import { observerCaster, turnedOrientation, type TurnableCaster } from './terrestrial-layers/registration-sweeps.mts';
import { COMPARISON_EVIDENCE_SCHEMA, COMPARISON_SPEC_FILE, axisDifferenceDegrees, columnCells, outlineOverlap, panelAxisDegrees, panelDisc, parseComparisonSpec, type Mask, type Raster } from './surface-observations/published-comparison.mts';

const ROOT = resolve(import.meta.dirname, '../..');
const TURN_STEP = 10, SWEEP = { from: -30, to: 30, step: 2 };
const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const area = (mask: Mask) => mask.data.reduce((sum, value) => sum + value, 0);

/** A new record may leave the figure's pixel digest as 64 zeros; `--write` then adopts the figure it finds, once. */
const UNPINNED = '0'.repeat(64);

export async function measurePublishedComparison(objectId: string, { adopt = false } = {}) {
  const sourceDirectory = resolve(ROOT, 'src/objects', objectId, 'source'), specPath = resolve(sourceDirectory, COMPARISON_SPEC_FILE);
  const stated = JSON.parse(await readFile(specPath, 'utf8')), spec = parseComparisonSpec(stated);
  const { record, recipe, frames } = await loadObserverCameraInputs(sourceDirectory);
  if (spec.lensId !== record.lensId) throw new TypeError(`The comparison names lens ${spec.lensId}; the observer cameras derive ${record.lensId}.`);
  const mesh = await loadCameraShape(sourceDirectory, radialTerrainForLens(recipe as unknown as Parameters<typeof radialTerrainForLens>[0], record.lensId));

  // The paper, by its manifest pin, then the figure, by its object number and pixel digest.
  const manifest = requireRecord(JSON.parse(await readFile(resolve(sourceDirectory, 'manifest.json'), 'utf8')));
  const input = requireArray(manifest.inputs).map(value => requireRecord(value)).find(entry => entry.id === spec.document.input);
  if (!input) throw new TypeError(`The manifest has no input ${spec.document.input}.`);
  const paper = await readFile(resolve(sourceDirectory, String(input.path)));
  if (sha256(paper) !== input.expectedSha256) throw new Error(`${input.path} does not match its pin; restore it before measuring.`);
  const image = readPdfImage(paper, spec.document.object), pixels = sha256(image.data);
  if (spec.document.sha256 === UNPINNED && adopt) {
    Object.assign(stated.document, { width: image.width, height: image.height, sha256: pixels }); Object.assign(spec.document, stated.document);
    await writeFile(specPath, JSON.stringify(stated, null, 2) + '\n');
    console.log(`Adopted object ${spec.document.object} as ${spec.figure}: ${image.width}×${image.height}, pixels ${pixels}. Look at the figure before trusting it, then run pnpm pin:documents ${objectId}.`);
  }
  if (image.width !== spec.document.width || image.height !== spec.document.height || pixels !== spec.document.sha256)
    throw new Error(`Object ${spec.document.object} is not the pinned ${spec.figure}: ${image.width}×${image.height}, pixels ${pixels}.${spec.document.sha256 === UNPINNED ? ' Run with --write to adopt it.' : ''}`);
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

  const faceNormals = (mesh.indices as number[][]).map(([a, b, c]) => {
    const p = mesh.positions as number[][], u = p[b].map((v, k) => v - p[a][k]), w = p[c].map((v, k) => v - p[a][k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], m = Math.hypot(...n);
    const outward = n[0] * (p[a][0] + p[b][0] + p[c][0]) + n[1] * (p[a][1] + p[b][1] + p[c][1]) + n[2] * (p[a][2] + p[b][2] + p[c][2]) < 0 ? -1 : 1;
    return n.map(v => outward * v / m);
  });
  const render = (caster: TurnableCaster, width: number, height: number) => {
    const mask = new Uint8Array(width * height), shade = new Uint8Array(width * height), origin = caster.positionMeters, sun = caster.sunDirection;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const hit = mesh.intersect(origin, caster.ray(x, y)); if (!hit) continue;
      const n = faceNormals[hit.faceId], i = y * width + x;
      mask[i] = 1; shade[i] = Math.round(40 + 215 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]));
    }
    return { mask: { width, height, data: mask } as Mask, shade };
  };

  const columns = [], visuals: { label: string; model: Mask; shade: Uint8Array; ours: Mask; cellModel: number; cellImage: number; column: number }[] = [];
  for (const [index, column] of spec.columns.entries()) {
    if (column.frame === null) continue;
    const camera = atZero.find(entry => entry.id === column.frame);
    if (!camera) throw new TypeError(`Figure column ${column.label} names ${column.frame}, which is not a frame of lens ${spec.lensId}.`);
    // The survey figures label each column with its frame's exposure start to the second.
    if (!(Math.abs(Date.parse(`${column.label}Z`) - Date.parse(`${camera.exposure.start}Z`)) < 1000))
      throw new TypeError(`Figure column ${column.label} names ${column.frame}, whose exposure starts at ${camera.exposure.start}.`);
    const { width, height } = decodeCalibratedCamera(await readFile(resolve(sourceDirectory, camera.path)), 'fits-zimpol-intensity');
    const caster = observerCaster(camera.sighting, base), model = panelDisc(figure, cell(spec.rows.model, index)), photograph = panelDisc(figure, cell(spec.rows.image, index));
    const turns: Record<string, number> = {};
    for (let turn = 0; turn < 360; turn += TURN_STEP) turns[turn] = round(outlineOverlap(render(turn === 0 ? caster : caster.turned(turn), width, height).mask, model));
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
      axis: { paperDegrees: paperAxis === null ? null : round(paperAxis, 1), oursDegrees: ours === null ? null : round(ours, 1), differenceDegrees: paperAxis === null || ours === null ? null : round(axisDifferenceDegrees(ours, paperAxis), 1) } });
    visuals.push({ label: column.label, model, shade: drawn.shade, ours: drawn.mask, cellModel: spec.rows.model, cellImage: spec.rows.image, column: index });
  }
  const evidence = {
    schema: COMPARISON_EVIDENCE_SCHEMA, objectId, lensId: spec.lensId, source: spec.source, figure: spec.figure,
    document: { input: spec.document.input, sha256: String(input.expectedSha256), object: spec.document.object, pixels: spec.document.sha256 },
    rotation: { path: record.rotation.path, columnOrder: record.rotation.columnOrder ?? null },
    columns,
    nativeOutline: { frames: atZero.length, residualPixelsAtZero: sweep[0], bestOffsetDegrees: Number(best[0]), sweepDegrees: SWEEP, residualPixels: sweep },
  };
  return { evidence, figure, cell, visuals };
}

/** A side-by-side image per compared column: the paper's model panel, our rendering, and the paper's photograph with our outline. */
async function evidenceImage(result: Awaited<ReturnType<typeof measurePublishedComparison>>, path: string) {
  const { figure, cell, visuals } = result, tile = 220, gap = 8, label = 150;
  const width = label + 3 * tile + 2 * gap, height = 40 + visuals.length * (tile + gap), canvas = Buffer.alloc(width * height * 3, 16);
  const put = (x: number, y: number, rgb: number[]) => { if (x >= 0 && y >= 0 && x < width && y < height) canvas.set(rgb, (y * width + x) * 3); };
  const figurePixel = (x: number, y: number) => [0, 1, 2].map(k => Number(figure.data[(y * figure.width + x) * 3 + k]));
  for (const [row, visual] of visuals.entries()) {
    const top = 40 + row * (tile + gap);
    for (const [slot, cellRow] of [[0, visual.cellModel], [2, visual.cellImage]] as const) {
      const box = cell(cellRow, visual.column), side = Math.min(box.x1 - box.x0, box.y1 - box.y0);
      for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) put(label + slot * (tile + gap) + x, top + y, figurePixel(box.x0 + Math.floor(x * side / tile), box.y0 + Math.floor(y * side / tile)));
    }
    // Our rendering and outline, scaled so the body has the paper model's area, centred where the paper's body is.
    const centroid = (m: Mask) => { let n = 0, sx = 0, sy = 0; m.data.forEach((v, i) => { if (v) { n++; sx += i % m.width; sy += Math.floor(i / m.width); } }); return [sx / n, sy / n]; };
    const box = cell(visual.cellModel, visual.column), side = Math.min(box.x1 - box.x0, box.y1 - box.y0);
    const scale = Math.sqrt(area(visual.ours) / area(visual.model)), [ox, oy] = centroid(visual.ours), [mx, my] = centroid(visual.model);
    const source = (x: number, y: number) => [Math.round(ox + (x * side / tile - mx) * scale), Math.round(oy + (y * side / tile - my) * scale)];
    for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
      const [sx, sy] = source(x, y), inside = sx >= 0 && sy >= 0 && sx < visual.ours.width && sy < visual.ours.height, i = sy * visual.ours.width + sx;
      const v = inside ? visual.shade[i] : 0; put(label + (tile + gap) + x, top + y, [v, v, v]);
      const edge = inside && visual.ours.data[i] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = sx + dx, ny = sy + dy; return nx < 0 || ny < 0 || nx >= visual.ours.width || ny >= visual.ours.height || !visual.ours.data[ny * visual.ours.width + nx]; });
      if (edge) put(label + 2 * (tile + gap) + x, top + y, [0, 220, 255]);
    }
  }
  const text = (x: number, y: number, s: string) => `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#e6e6e6">${s}</text>`;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${text(label + 6, 26, 'Paper: model')}${text(label + tile + gap + 6, 26, 'Ours: same epoch')}${text(label + 2 * (tile + gap) + 6, 26, 'Paper photo, our outline')}${visuals.map((v, r) => text(10, 40 + r * (tile + gap) + tile / 2, v.label.replace('T', ' '))).join('')}</svg>`;
  await sharp(canvas, { raw: { width, height, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).webp({ quality: 86 }).toFile(path);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [objectId, flag] = process.argv.slice(2);
  if (!objectId || (flag !== undefined && flag !== '--write')) { console.error('usage: node tools/objects/published-comparison.mts <object-id> [--write]'); process.exit(2); }
  const result = await measurePublishedComparison(objectId, { adopt: flag === '--write' }), { evidence } = result;
  for (const c of evidence.columns) console.log(`${c.label}  overlap with the paper's model ${c.overlapWithModel}, with its photograph ${c.overlapWithPhotograph}, same shape at both scales ${c.sameShapeOverlap}; best turn ${c.bestTurnDegrees}°; axis ours ${c.axis.oursDegrees}° against ${c.axis.paperDegrees}° (${c.axis.differenceDegrees}°)`);
  const o = evidence.nativeOutline;
  console.log(`native outline over ${o.frames} frames: ${o.residualPixelsAtZero} px at our phase, smallest at ${o.bestOffsetDegrees}°`);
  if (flag === '--write') {
    const directory = resolve(ROOT, 'src/objects', objectId, 'evidence'); await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'published-comparison.json'), JSON.stringify(evidence, null, 2) + '\n');
    await evidenceImage(result, resolve(directory, 'published-comparison.webp'));
    console.log(`Wrote evidence/published-comparison.json and its image for ${objectId}.`);
  }
}
