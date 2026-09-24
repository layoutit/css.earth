/** Dactyl source/registration diagnostic. Never writes a preparation recipe or scene. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { readFitsPrimary } from '../../observation/fits.mts';
import { controlledShapeCamera, decodeCalibratedCamera } from '../../terrestrial-layers/shape-camera-mosaic.mts';
import { readDaf } from '../../../spice/daf.mts';
import { ckSegments } from '../../../spice/ck.mts';
import { parseTextKernel, number as kernelNumber, numbers as kernelNumbers } from '../../../spice/text-kernel.mts';
import { parseSpacecraftClock, encodeClock, clockToEt, etToClock } from '../../../spice/sclk.mts';
import { parseLeapSeconds, utcToEt, etToUtc } from '../../../spice/lsk.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { readPinnedFile } from '../../../spice/kernel-bank.mts';

type Pixel = [number, number];
type Vector = [number, number, number];
type Pose = [number, number, number, number, number];
const rad = Math.PI / 180;
const root = 'src/objects/dactyl/evidence/registration';
const output = resolve(process.argv[2] ?? 'output/dactyl-registration');
const checkLimbExtent = process.argv[3] === '--limb-extent';
if (process.argv[3] && !checkLimbExtent) throw new Error('Unknown diagnostic option.');

const inputBytes = await readFile(`${root}/inputs.json`);
const input = requireRecord(JSON.parse(inputBytes.toString('utf8')));
if (input.objectId !== 'dactyl' || input.schema !== 'cssearth-dactyl-registration-input@1') throw new Error('Wrong registration inputs.');
const pinned = new Map<string, Buffer>();
for (const item of requireArray(input.files)) {
  const file = requireRecord(item), path = requireString(file.path);
  if ((!path.startsWith('src/objects/') && !path.startsWith('tests/objects/fixtures/dactyl/')) || path.split('/').includes('..')) throw new Error('Invalid source path.');
  // Kernels are not committed; a missing one is restored from its pinned origin.
  const bytes = file.url === undefined ? await readFile(path) : await readPinnedFile(path, requireString(file.url), requireString(file.expectedSha256));
  pinned.set(requireString(file.id), bytes);
}
function bytes(id: string) {
  const value = pinned.get(id);
  if (!value) throw new Error(`Unpinned input: ${id}`);
  return value;
}
const json = (id: string) => requireRecord(JSON.parse(bytes(id).toString('utf8')));
const numbers = (value: unknown) => requireArray(value).map(n => requireFiniteNumber(n));
function pixel(value: unknown): Pixel {
  const n = numbers(value);
  if (n.length !== 2) throw new Error('Expected a pixel pair.');
  return [n[0], n[1]];
}
function field(label: string, key: string) {
  const value = new RegExp(`^${key}\\s*=\\s*(.*?)\\s*$`, 'm').exec(label)?.[1];
  if (!value) throw new Error(`Missing ${key}.`);
  return value.replace(/^"|"$/g, '');
}

const instrument = parseTextKernel(bytes('instrument').toString('ascii'), 'gll36001.ti');
const focalMm = kernelNumber(instrument, 'INS-77036_FOCAL_LENGTH');
const pitchMm = kernelNumber(instrument, 'INS-77036_PIXEL_SIZE');
const distortion = kernelNumber(instrument, 'INS-77036_DISTORTION_COEFF');
const centerOneBased = kernelNumbers(instrument, 'INS-77036_FOV_CENTER');
if (centerOneBased.length !== 2) throw new Error('Wrong SSI center.');
const opticalCenter: Pixel = [centerOneBased[0] - 1, centerOneBased[1] - 1];
// Native IK: R(actual) = r(ideal) + A*r^3, about the instrument's optical center.
function ideal(p: Pixel): Pixel {
  const dx = p[0] - opticalCenter[0], dy = p[1] - opticalCenter[1], R = Math.hypot(dx, dy);
  let r = R;
  for (let i = 0; i < 6; i++) r -= (r + distortion * r ** 3 - R) / (1 + 3 * distortion * r ** 2);
  const scale = R === 0 ? 1 : r / R;
  return [opticalCenter[0] + dx * scale, opticalCenter[1] + dy * scale];
}
function detector(p: Pixel): Pixel {
  const dx = p[0] - opticalCenter[0], dy = p[1] - opticalCenter[1];
  const scale = 1 + distortion * (dx * dx + dy * dy);
  return [opticalCenter[0] + dx * scale, opticalCenter[1] + dy * scale];
}

const original = decodeCalibratedCamera(bytes('vicar'), 'vicar-byte-dn');
const fits = readFitsPrimary(bytes('fits'));
if (original.width !== 800 || original.height !== 800 || fits.width !== 800 || fits.height !== 800 || fits.bitpix !== 8 || fits.scale !== 1 || fits.zero !== 0) throw new Error('Unexpected SSI layout.');
const pixels = Buffer.from(original.data.map(n => Math.round(n * 255)));
const orientation = [false, true].map(flip => {
  let differentPixels = 0, maxDifferenceDN = 0;
  for (let y = 0; y < 800; y++) for (let x = 0; x < 800; x++) {
    const difference = Math.abs(fits.values[y * 800 + x] - pixels[(flip ? 799 - y : y) * 800 + x]);
    if (difference !== 0) differentPixels++;
    maxDifferenceDN = Math.max(maxDifferenceDN, difference);
  }
  return { flipFitsVertically: flip, comparedPixels: 640000, differentPixels, maxDifferenceDN };
});
if (orientation[1].differentPixels !== 0) throw new Error('FITS no longer matches the original detector after vertical inversion.');

const lsk = parseLeapSeconds(parseTextKernel(bytes('lsk').toString('ascii'), 'naif0008.tls'));
const clock = parseSpacecraftClock(parseTextKernel(bytes('sclk').toString('ascii'), 'mk00062a.tsc'), -77);
const segments = ckSegments(readDaf(bytes('ck')));
const pointing = ['i1578', 'i2278', 'i2700'].map(id => {
  const label = bytes(`${id}-label`).toString('ascii');
  const utc = field(label, 'START_TIME'), sclk = field(label, 'SPACECRAFT_CLOCK_START_COUNT');
  const et = utcToEt(lsk, utc), ticks = etToClock(clock, lsk, et);
  const frameEt = clockToEt(clock, lsk, encodeClock(clock, sclk));
  const hits = segments.filter(s => s.instrument === -77001).flatMap(s => {
    const p = s.pointing(ticks);
    return p ? [{ frameId: s.reference, cMatrix: p.cMatrix, angularVelocity: p.angularVelocity }] : [];
  });
  if (hits.length > 1 || hits.some(p => p.frameId !== 2)) throw new Error('Ambiguous or changed CK coverage.');
  return { id, shutterCenterUtc: utc, et, encodedClock: ticks, labelFrameStartSclk: sclk,
    frameStartUtc: etToUtc(lsk, frameEt), shutterCenterMinusFrameStartSeconds: et - frameEt, toleranceTicks: 0,
    pointing: hits[0] ?? null };
});
const at2278 = pointing.find(p => p.id === 'i2278');
if (!at2278?.pointing) throw new Error('No pointing at i2278 shutter center.');
const oracle = json('oracle');
for (const value of requireArray(oracle.inputs)) {
  const reference = requireRecord(value), path = requireString(reference.path);
  const listed = requireArray(input.files).map(v => requireRecord(v)).find(f => f.path === path);
  if (!listed) throw new Error('Oracle used different inputs.');
}
for (const value of requireArray(oracle.otherExposures)) {
  const reference = requireRecord(value), actual = pointing.find(p => p.id === reference.id);
  if (!actual || actual.pointing !== null || reference.pointing !== null) throw new Error('CK gap differs from oracle.');
}
const native = requireRecord(oracle.i2278), oracleMatrix = requireArray(native.b1950CMatrix).map(numbers);
if (oracleMatrix.length !== 3 || oracleMatrix.some(r => r.length !== 3)) throw new Error('Invalid oracle matrix.');
const matrixError = Math.max(...at2278.pointing.cMatrix.flatMap((row, i) => row.map((v, j) => Math.abs(v - oracleMatrix[i][j]))));
const etError = Math.abs(at2278.et - requireFiniteNumber(native.et));
const ticksError = Math.abs(at2278.encodedClock - requireFiniteNumber(native.encodedClock));
if (matrixError > 1e-9 || etError > 1e-6 || ticksError > 1e-3) throw new Error('Shared CK evaluation disagrees with CSPICE.');
const radec = pixel(native.j2000BoresightRaDecDegrees);
const label = bytes('i2278-label').toString('ascii');
const labelRa = Number(field(label, 'RIGHT_ASCENSION')), labelDec = Number(field(label, 'DECLINATION'));
const spherical = (ra: number, dec: number) => [Math.cos(dec * rad) * Math.cos(ra * rad), Math.cos(dec * rad) * Math.sin(ra * rad), Math.sin(dec * rad)];
const a = spherical(...radec), b = spherical(labelRa, labelDec);
const separation = Math.acos(Math.max(-1, Math.min(1, a.reduce((s, x, i) => s + x * b[i], 0))));

const shape = json('shape'), axes = numbers(shape.semiaxesKm).map(n => n * 1000);
if (shape.schema !== 'cssearth-ellipsoid-parameters@1' || axes.length !== 3 || axes.some(n => n <= 0)) throw new Error('Unexpected source ellipsoid.');
const rangeKm = requireFiniteNumber(input.rangeKm);
function feature(value: unknown) {
  const f = requireRecord(value), lat = requireFiniteNumber(f.latitudeDegrees) * rad, lon = requireFiniteNumber(f.eastLongitudeDegrees) * rad;
  // Source XYZ, before the existing PolyCSS X/Y swap. Never use CSS axes here.
  const d = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  const radius = 1 / Math.sqrt(d.reduce((s, v, i) => s + (v / axes[i]) ** 2, 0));
  const xyz: Vector = [d[0] * radius, d[1] * radius, d[2] * radius];
  const nativePixel = pixel(f.detectorPixel);
  return { name: requireString(f.name), xyz, detectorPixel: nativePixel, idealPixel: ideal(nativePixel) };
}
const controls = requireRecord(input.features), fitFeature = feature(controls.fit), holdout = feature(controls.holdout);
const limb = requireRecord(input.limb), threshold = requireFiniteNumber(limb.thresholdDN);
const scan = numbers(limb.scan); // first line, last line, line step, first sample, last sample
if (scan.length !== 5 || scan.some(n => !Number.isSafeInteger(n)) || scan[2] <= 0 || scan[0] < 0 || scan[1] >= 800 || scan[3] < 1 || scan[4] >= 800) throw new Error('Invalid limb scan.');
const limbPixels: Pixel[] = [];
for (let y = scan[0]; y <= scan[1]; y += scan[2]) {
  let x = scan[3];
  while (x < scan[4] && pixels[y * 800 + x] < threshold) x++;
  if (x === scan[4]) throw new Error(`No limb at line ${y}.`);
  const before = pixels[y * 800 + x - 1], after = pixels[y * 800 + x];
  if (before >= threshold || after <= before) throw new Error('Ambiguous limb crossing.');
  limbPixels.push([x - 1 + (threshold - before) / (after - before), y]);
}
const limbIdeal = limbPixels.map(ideal);
// The shared helper requires Sun fields; this diagnostic never uses its Sun or lighting values.
const camera = (v: Pose) => controlledShapeCamera({ observerLatitude: v[0], observerWestLongitude: v[1], sunLatitude: 0, sunWestLongitude: 0,
  rangeKm, northAzimuthDegrees: v[2], pixelAngleMicroradians: pitchMm / focalMm * 1e6, center: [v[3], v[4]] });
function conic(v: Pose) {
  const cam = camera(v), dirs = axes.map((axis, i) => {
    const p: Vector = [0, 0, 0]; p[i] = axis;
    const projected = cam.project(p);
    if (!projected) throw new Error('Ellipsoid behind camera.');
    return [projected[0] - v[3], projected[1] - v[4]];
  });
  const xx = dirs.reduce((s, d) => s + d[0] ** 2, 0), xy = dirs.reduce((s, d) => s + d[0] * d[1], 0), yy = dirs.reduce((s, d) => s + d[1] ** 2, 0);
  const det = xx * yy - xy * xy;
  return { A: yy / det, B: -xy / det, C: xx / det };
}
function residuals(v: Pose) {
  // First-order distance to an orthographic ellipsoid envelope, not a terrain fit.
  const cam = camera(v), { A, B, C } = conic(v);
  const r = limbIdeal.map(p => {
    const x = p[0] - v[3], y = p[1] - v[4], gx = A * x + B * y, gy = B * x + C * y;
    return (x * gx + y * gy - 1) / (2 * Math.hypot(gx, gy));
  });
  const projected = cam.project(fitFeature.xyz);
  if (!projected) throw new Error('Fit control behind camera.');
  r.push((projected[0] - fitFeature.idealPixel[0]) * 2, (projected[1] - fitFeature.idealPixel[1]) * 2);
  const facing = fitFeature.xyz.reduce((s, x, i) => s + x / axes[i] ** 2 * cam.observer[i], 0);
  if (facing < 0) r.push(facing * 10000);
  return r;
}
const cost = (v: Pose) => residuals(v).reduce((s, x) => s + x * x, 0);
function improve(start: Pose) {
  let v: Pose = [...start], score = cost(v);
  for (let step = 8; step >= 0.03; step *= 0.5) for (let pass = 0; pass < 80; pass++) {
    let changed = false;
    for (let k = 0; k < 5; k++) for (const sign of [-1, 1]) {
      const w: Pose = [...v]; w[k] += sign * step * (k < 3 ? 1 : 0.3);
      if (Math.abs(w[0]) > 89) continue;
      const value = cost(w);
      if (value < score) { score = value; v = w; changed = true; }
    }
    if (!changed) break;
  }
  const cam = camera(v);
  function evaluate(f: ReturnType<typeof feature>) {
    const p = cam.project(f.xyz);
    if (!p) throw new Error('Control behind camera.');
    const predicted = detector([p[0], p[1]]);
    const outward = f.xyz.map((v, i) => v / axes[i] ** 2), length = Math.hypot(...outward);
    return { name: f.name, predictedDetectorPixel: predicted, residualPixels: Math.hypot(predicted[0] - f.detectorPixel[0], predicted[1] - f.detectorPixel[1]),
      observerFacingCosine: outward.reduce((s, v, i) => s + v / length * cam.observer[i], 0) };
  }
  const limbResiduals = residuals(v).slice(0, limbIdeal.length);
  return { pose: v, objective: score, limbRmsIdealPixels: Math.sqrt(limbResiduals.reduce((s, x) => s + x * x, 0) / limbResiduals.length),
    fitControl: evaluate(fitFeature), checkControl: evaluate(holdout) };
}
const seeds: Pose[] = [];
const initialCenter = ideal(pixel(input.initialCenterDetector));
for (const lat of [-75, -45, -15, 15, 45, 75]) for (let lon = 0; lon < 360; lon += 45) for (let roll = 0; roll < 360; roll += 30) seeds.push([lat, lon, roll, ...initialCenter]);
const solutions = seeds.map(improve).sort((a, b) => a.objective - b.objective);
const best = solutions[0], inspectedAlternative = solutions.slice().sort((a, b) => a.checkControl.residualPixels - b.checkControl.residualPixels)[0];

await mkdir(output, { recursive: true });
const region = { left: 158, top: 188, width: 64, height: 64 }, zoom = 6;
const crop = await sharp(pixels, { raw: { width: 800, height: 800, channels: 1 } }).extract(region).linear(2).resize(384, 384, { kernel: 'nearest' }).png().toBuffer();
await writeFile(resolve(output, 'i2278-original-crop.png'), crop);
function overlay(s: typeof best, title: string, subtitle: string) {
  const pos = (p: Pixel) => [(p[0] - region.left + 0.5) * zoom + 8, (p[1] - region.top + 0.5) * zoom + 68];
  const dot = (p: Pixel, color: string) => { const [x, y] = pos(p); return `<circle cx="${x}" cy="${y}" r="2" fill="${color}"/>`; };
  const cross = (p: Pixel, color: string) => { const [x, y] = pos(p); return `<path d="M${x - 6},${y}h12 M${x},${y - 6}v12" stroke="${color}" fill="none" stroke-width="1.5"/>`; };
  const { A, B, C } = conic(s.pose);
  const edge: string[] = [];
  for (let i = 0; i <= 180; i++) {
    const angle = i / 180 * 2 * Math.PI, x = Math.cos(angle), y = Math.sin(angle), r = 1 / Math.sqrt(A * x * x + 2 * B * x * y + C * y * y);
    edge.push(pos(detector([s.pose[3] + x * r, s.pose[4] + y * r])).join(','));
  }
  return Buffer.from(`<svg width="400" height="490" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="490" fill="#15191f"/><g fill="white" font-family="Arial,sans-serif"><text x="12" y="24" font-size="17">${title}</text><text x="12" y="46" font-size="12">${subtitle}</text></g><image x="8" y="68" width="384" height="384" href="data:image/png;base64,${crop.toString('base64')}"/><polyline points="${edge.join(' ')}" fill="none" stroke="#e6e9ef" stroke-width="1"/>${limbPixels.map(p => dot(p, '#00e6da')).join('')}${cross(fitFeature.detectorPixel, '#f2bf40')}${cross(holdout.detectorPixel, '#ed6cab')}${dot(s.fitControl.predictedDetectorPixel, '#f2bf40')}${cross(s.checkControl.predictedDetectorPixel, '#6da7ff')}<text x="12" y="475" fill="#d9dee6" font-family="Arial,sans-serif" font-size="12">${holdout.name} discrepancy: ${s.checkControl.residualPixels.toFixed(2)} native px</text></svg>`);
}
await sharp({ create: { width: 800, height: 490, channels: 3, background: '#15191f' } }).composite([
  { input: await sharp(overlay(best, 'Fit: limb + Acmon', 'Celmis withheld from objective and selection')).png().toBuffer(), left: 0, top: 0 },
  { input: await sharp(overlay(inspectedAlternative, 'Alternative after inspecting Celmis', 'Celmis is no longer an independent holdout')).png().toBuffer(), left: 400, top: 0 },
]).png().toFile(resolve(output, 'orientation-candidates.png'));

const dependencies = ['tools/objects/terrestrial-layers/shape-camera-mosaic.mts', 'tools/objects/observation/fits.mts', 'tools/spice/ck.mts', 'tools/spice/daf.mts', 'tools/spice/sclk.mts', 'tools/spice/lsk.mts', 'tools/spice/text-kernel.mts'];
const report = { schema: 'cssearth-dactyl-registration-result@1', qualifiedSurface: false,
  baseCommit: input.baseCommit, dependencies,
  runtime: { node: process.version, sharp: sharp.versions.sharp },
  originalDetector: { orientation, vicarPixelOffset: original.offset, width: 800, height: 800, originalLabelUtc: field(bytes('vicar-label').toString('ascii'), 'IMAGE_TIME') },
  pointing, oracleComparison: { oracle: oracle.tool, matrixMaxAbsoluteError: matrixError, etErrorSeconds: etError, clockErrorTicks: ticksError,
    tolerances: { matrix: 1e-9, etSeconds: 1e-6, clockTicks: 1e-3 },
    j2000ComparisonFromNativeOracleOnly: { reconstructedRaDecDegrees: radec, labelRaDecDegrees: [labelRa, labelDec],
      separationDegrees: separation / rad, angularSeparationInNativePixels: separation * focalMm / pitchMm } },
  fit: { geometry: 'fixed published ellipsoid envelope, not a recovered crater mesh', sourceAxes: 'X: 0E; Y: 90E; Z: north, before the existing CSS X/Y swap',
    semiaxesMetres: axes, rangeKm, rangeMeaning: input.rangeMeaning,
    distortion: { model: 'R = r + A*r^3; R detector, r ideal', coefficient: distortion, opticalCenterZeroBased: opticalCenter },
    camera: 'body pose fitted to image controls; reconstructed CK does not provide Dactyl orientation',
    cameraPoseOrder: ['observer latitude deg', 'observer west longitude deg', 'north azimuth clockwise from image up deg', 'center ideal sample', 'center ideal line'],
    features: { fit: fitFeature, holdout }, limbDetectorPixels: limbPixels, limbThresholdDN: threshold,
    search: { starts: seeds.length, initialLatitudes: [-75, -45, -15, 15, 45, 75], initialLongitudeStep: 45, initialRollStep: 30, latitudeBounds: [-89, 89], finalAngularStepDegrees: 0.03125,
      method: 'coordinate descent, step 8 to 0.03125, at most 80 passes per step; center step = 0.3 times angular step',
      objective: 'limb approximate normal distances squared + twice-weighted Acmon coordinate residuals squared + backface penalty; Celmis excluded', globalOptimumProven: false },
    bestFit: best, alternativeSelectedUsingCelmis: inspectedAlternative, alternativeHasIndependentHoldout: false,
    limitations: ['Two analyst-picked named features, each with about one-pixel picking uncertainty; not a distributed published control network.',
      'Rounded source range held at 3900 km; range, source shape and point uncertainty are not inferred confidence intervals.',
      'Envelope is orthographic, point projection is perspective; finite runtime mesh facets and crater relief are not fitted.',
      'No photometric calibration, shadow removal, unseen-coverage fill or prepared photographic surface.'] },
  display: { crop: region, gain: 2, zoom, interpolation: 'nearest', clippedPixels: 0 },
};
// Count clipping on the exact displayed source region, not the whole detector.
for (let y = region.top; y < region.top + region.height; y++) for (let x = region.left; x < region.left + region.width; x++) if (pixels[y * 800 + x] * 2 > 255) report.display.clippedPixels++;
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(resolve(output, 'solutions.json'), JSON.stringify(solutions, null, 2) + '\n');
if (checkLimbExtent) {
  const originalLimb = limbPixels.map((p): Pixel => [p[0], p[1]]);
  // These added detector crossings are an explicit outline-sensitivity experiment,
  // not new published surface controls. Keep the right-hand terminator excluded.
  const capScans = [
    { name: 'lower', firstSample: 182, lastSample: 204, sampleStep: 2, startLine: 248, endLine: 190, direction: -1 },
    { name: 'upper', firstSample: 188, lastSample: 191, sampleStep: 2, startLine: 190, endLine: 248, direction: 1 },
  ];
  const cases = [{ name: 'left only', detectorPixels: originalLimb, bestFit: best }];
  for (const scan of capScans) {
    for (let x = scan.firstSample; x <= scan.lastSample; x += scan.sampleStep) {
      let y = scan.startLine;
      while (y !== scan.endLine && pixels[y * 800 + x] < threshold) y += scan.direction;
      if (y === scan.startLine || y === scan.endLine) throw new Error(`No unambiguous ${scan.name} cap at sample ${x}.`);
      const previous = y - scan.direction, before = pixels[previous * 800 + x], after = pixels[y * 800 + x];
      if (before >= threshold || after <= before) throw new Error('Ambiguous cap crossing.');
      limbPixels.push([x, previous + scan.direction * (threshold - before) / (after - before)]);
    }
    limbIdeal.splice(0, limbIdeal.length, ...limbPixels.map(ideal));
    const bestFit = seeds.map(improve).sort((a, b) => a.objective - b.objective)[0];
    const name = scan.name === 'lower' ? 'left + lower cap' : 'left + lower + upper caps';
    cases.push({ name, detectorPixels: limbPixels.map((p): Pixel => [p[0], p[1]]), bestFit });
  }
  const panels: Buffer[] = [];
  for (const result of cases) {
    limbPixels.splice(0, limbPixels.length, ...result.detectorPixels);
    panels.push(await sharp(overlay(result.bestFit, result.name, 'Selected by limb + Acmon; Celmis not fitted')).png().toBuffer());
  }
  await sharp({ create: { width: 1200, height: 490, channels: 3, background: '#15191f' } })
    .composite(panels.map((panel, i) => ({ input: panel, left: 400 * i, top: 0 })))
    .png().toFile(resolve(output, 'limb-extent.png'));
  const extent = {
    schema: 'cssearth-dactyl-limb-extent@1', qualifiedSurface: false,
    thresholdDN: threshold, capScans,
    selection: 'Each case minimizes the same limb-and-Acmon objective across the same 576 starts; Celmis is never used to rank these cases.',
    limitations: [
      'Analyst-selected bright-outline crossings, not a published control network; cap samples are added cumulatively and are not equal arc-length samples.',
      'Celmis was inspected during development. The residual is a diagnostic check, not a newly blind independent validation.',
      'Changing which outline samples are included changes the fitted orientation. The result cannot qualify a photographic surface.',
    ], cases,
  };
  await writeFile(resolve(output, 'limb-extent.json'), JSON.stringify(extent, null, 2) + '\n');
  console.log(JSON.stringify({ limbExtent: cases.map(c => ({ case: c.name, count: c.detectorPixels.length, limbRms: c.bestFit.limbRmsIdealPixels, celmisError: c.bestFit.checkControl.residualPixels })) }, null, 2));
}
console.log(JSON.stringify({ output, qualifiedSurface: false, decodedExactly: orientation[1].differentPixels === 0, matrixError,
  limbRmsPixels: best.limbRmsIdealPixels, withheldCelmisResidualPixels: best.checkControl.residualPixels,
  alternativeCelmisResidualPixels: inspectedAlternative.checkControl.residualPixels }, null, 2));
