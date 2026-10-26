/** Observed whole-footprint pixels and recorded sky registration only; no density or legacy material is loaded. */
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { requireRecord } from '@cssearth/core';
import { readCompactFiniteEmission, parseDensityVolumeFrame } from '@cssearth/objects';
import { rotateWorldPosition, worldRotationFromQuaternion } from '@cssearth/engine';
import { SRGB_REFERENCE, linearToSrgb, srgbToLinear } from '@cssearth/bake/objects/color';

const METERS_PER_KPC = 3.0856775814913673e19;
const INPUT_PATH = 'src/objects/lmc-volume/source/compact/inputs.json';
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
type Plane = number[][];
type Rgb = number[][][];
type Vec3 = [number, number, number];
function need(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TypeError(message);
}
function quantile(values: number[], fraction: number): number {
  need(values.length > 0 && values.every(Number.isFinite), 'Cannot measure an empty/nonfinite training percentile');
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)]!;
}
function localPath(path: string): string {
  need(!isAbsolute(path) && !path.split(/[\\/]/u).includes('..'), 'Observation input path must stay relative to the checkout');
  return resolve(ROOT, path);
}

export interface ObservationWindow {x0:number;y0:number;width:number;height:number;}
export async function loadObservation(scale:1|2|4|8|16=1,window?:ObservationWindow,displayReference?:{sky:readonly number[];commonFactor:number}) {
  if(scale!==1&&scale!==2&&scale!==4&&scale!==8&&scale!==16)throw new Error('Only pilot and native reference sizes are allowed');
  if(window)need(Object.values(window).every(Number.isFinite)&&window.x0>=0&&window.y0>=0&&window.width>0&&window.height>0&&window.x0+window.width<=1&&window.y0+window.height<=1,'Invalid observation crop');
  if(displayReference)need(displayReference.sky.length===3&&displayReference.sky.every(Number.isFinite)&&displayReference.commonFactor>0,'Invalid inherited display reference');
  const WIDTH=64*scale,HEIGHT=48*scale,holdoutBlock=8*scale;
function grid<T>(make: (row: number, col: number) => T): T[][] {
  return Array.from({ length: HEIGHT }, (_, row) => Array.from({ length: WIDTH }, (_, col) => make(row, col)));
}
function rgb(): Rgb { return [grid(() => 0), grid(() => 0), grid(() => 0)]; }

  const value: unknown = JSON.parse(await readFile(resolve(ROOT, INPUT_PATH), 'utf8'));
  const raw = requireRecord(value, 'preserved observation metadata');
  const input = readCompactFiniteEmission(raw);
  const frame = parseDensityVolumeFrame(raw.frame);
  need(frame.referenceFrame === 'sun-icrf', 'Observation registration must state sun-icrf');
  need(Math.abs(frame.metersPerUnit / METERS_PER_KPC - 1) < 1e-12, 'Observation tangent coordinates must be kpc');
  const dataset = input.datasets.find(item => item.imageId === 'horalek-widefield');
  need(dataset, 'The preserved Horálek observation is missing');
  const bounds = dataset.bounds;
  const rotation = worldRotationFromQuaternion(frame.localToReferenceXyzw);
  const q=frame.localToReferenceXyzw;
  const inverseRotation=worldRotationFromQuaternion([-q[0],-q[1],-q[2],q[3]]);
  const originKpc: Vec3 = [frame.originM[0] / METERS_PER_KPC, frame.originM[1] / METERS_PER_KPC, frame.originM[2] / METERS_PER_KPC];
  const distanceKpc = Math.hypot(...originKpc);
  const planeNormal=rotateWorldPosition(rotation,[0,0,1]);
  const planeConstant=planeNormal[0]*originKpc[0]+planeNormal[1]*originKpc[1]+planeNormal[2]*originKpc[2];
  function pixelOf(pointIcrsKpc:readonly number[]):[number,number]|null {
    need(pointIcrsKpc.length===3&&pointIcrsKpc.every(Number.isFinite),'Expected a finite ICRS point');
    const denominator=planeNormal[0]*pointIcrsKpc[0]!+planeNormal[1]*pointIcrsKpc[1]!+planeNormal[2]*pointIcrsKpc[2]!;
    const f=planeConstant/denominator;if(!Number.isFinite(f)||f<=0)return null;
    const local=rotateWorldPosition(inverseRotation,[f*pointIcrsKpc[0]!-originKpc[0],f*pointIcrsKpc[1]!-originKpc[1],f*pointIcrsKpc[2]!-originKpc[2]]);
    const x=(local[0]-bounds.min[0])/(bounds.max[0]-bounds.min[0]),y=(bounds.max[1]-local[1])/(bounds.max[1]-bounds.min[1]);return window?[(x-window.x0)/window.width*WIDTH,(y-window.y0)/window.height*HEIGHT]:[x*WIDTH,y*HEIGHT];
  }
  need(Math.abs(distanceKpc / input.distance - 1) < 1e-9, 'Registration origin and recorded observer distance disagree');
  function rayAt(col: number, row: number): Vec3 {
    need(Number.isFinite(col) && Number.isFinite(row) && col >= 0 && col <= WIDTH && row >= 0 && row <= HEIGHT,
      'Ray coordinates must lie within the output-grid edge rectangle');
    const tx = bounds.min[0] + (window?window.x0+col/WIDTH*window.width:col/WIDTH) * (bounds.max[0] - bounds.min[0]);
    const ty = bounds.max[1] - (window?window.y0+row/HEIGHT*window.height:row/HEIGHT) * (bounds.max[1] - bounds.min[1]);
    const rotated = rotateWorldPosition(rotation, [tx, ty, 0]);
    const point: Vec3 = [rotated[0] + originKpc[0], rotated[1] + originKpc[1], rotated[2] + originKpc[2]];
    const length = Math.hypot(...point);
    need(Number.isFinite(length) && length > 0, 'Observation ray is not finite');
    return [point[0] / length, point[1] / length, point[2] / length];
  }
  const [imageBytes, coverageBytes] = await Promise.all([
    readFile(localPath(dataset.registered.path)), readFile(localPath(dataset.coverage.path)),
  ]);
  const [imageMetadata, coverageMetadata] = await Promise.all([
    sharp(imageBytes).metadata(), sharp(coverageBytes).metadata(),
  ]);
  need(imageMetadata.width === 1024 && imageMetadata.height === 761 && imageMetadata.channels === 3 &&
    imageMetadata.space === 'srgb' && imageMetadata.depth === 'uchar' && !imageMetadata.hasAlpha,
  'Expected preserved 1024×761 uchar sRGB Horálek image');
  need(coverageMetadata.width === 2048 && coverageMetadata.height === 1521 && coverageMetadata.channels === 4 &&
    coverageMetadata.depth === 'uchar' && coverageMetadata.hasAlpha, 'Unexpected preserved coverage dimensions/channels');
  const [image, coverage] = await Promise.all([
    sharp(imageBytes).raw().toBuffer({ resolveWithObject: true }),
    // This is the preserved registered mask's full-rectangle mapping, also used by its compact observation consumer.
    sharp(coverageBytes).resize(1024, 761, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const sourceWidth = image.info.width, sourceHeight = image.info.height;
  need(sourceWidth === 1024 && sourceHeight === 761 && image.info.channels === 3 &&
    image.data.length === sourceWidth * sourceHeight * 3, 'Decoded observation differs from its source dimensions');
  need(coverage.info.width === sourceWidth && coverage.info.height === sourceHeight && coverage.info.channels === 4 &&
    coverage.data.length === sourceWidth * sourceHeight * 4, 'Coverage mapping differs from observation dimensions');
  const linear = Array.from({ length: 256 }, (_, byte) => srgbToLinear(byte / 255));
  const sourceLinear = rgb(), rawRgb = rgb(), target = rgb();
  const validFraction: Plane = grid(() => 0);
  const mask = grid(() => false);
  // Define holdout membership before any sky/normalization measurement; only its intersection with valid bins is used.
  const holdoutPattern = grid((row, col) => (Math.floor(row / holdoutBlock) + Math.floor(col / holdoutBlock)) % 4 === 0);
  for (let row = 0; row < HEIGHT; row++) for (let col = 0; col < WIDTH; col++) {
    const x0 = window?(window.x0+col/WIDTH*window.width)*sourceWidth:col * sourceWidth / WIDTH, x1 = window?(window.x0+(col+1)/WIDTH*window.width)*sourceWidth:(col + 1) * sourceWidth / WIDTH;
    const y0 = window?(window.y0+row/HEIGHT*window.height)*sourceHeight:row * sourceHeight / HEIGHT, y1 = window?(window.y0+(row+1)/HEIGHT*window.height)*sourceHeight:(row + 1) * sourceHeight / HEIGHT;
    const area = (x1 - x0) * (y1 - y0), validSum = [0, 0, 0], allSum = [0, 0, 0];
    let validArea = 0;
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
      const weight = Math.max(0, Math.min(x1, sx + 1) - Math.max(x0, sx)) *
        Math.max(0, Math.min(y1, sy + 1) - Math.max(y0, sy));
      if (!(weight > 0)) continue;
      const index = sy * sourceWidth + sx;
      const values = [linear[image.data[index * 3]!], linear[image.data[index * 3 + 1]!], linear[image.data[index * 3 + 2]!]];
      const finite = values.every(value => typeof value === 'number' && Number.isFinite(value));
      need(finite, 'Decoded observation has a nonfinite display sample');
      const valid = coverage.data[index * 4 + 3]! >= 250;
      for (let channel = 0; channel < 3; channel++) {
        allSum[channel]! += values[channel]! * weight;
        if (valid) validSum[channel]! += values[channel]! * weight;
      }
      if (valid) validArea += weight;
    }
    validFraction[row]![col] = validArea / area;
    const available = validArea / area >= 0.95;
    mask[row]![col] = available;
    for (let channel = 0; channel < 3; channel++) {
      rawRgb[channel]![row]![col] = linearToSrgb(allSum[channel]! / area);
      sourceLinear[channel]![row]![col] = available ? validSum[channel]! / validArea : 0;
    }
  }
  const heldout = grid((row, col) => mask[row]![col]! && holdoutPattern[row]![col]!);
  const train = grid((row, col) => mask[row]![col]! && !holdoutPattern[row]![col]!);
  const count = (selection: boolean[][]) => selection.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  need(count(train) > 0 && count(heldout) > 0, 'Observation needs both training and held-out bins');
  const sky = displayReference?[...displayReference.sky]:[0, 1, 2].map(channel => {
    const values: number[] = [];
    for (let row = 0; row < HEIGHT; row++) for (let col = 0; col < WIDTH; col++)
      if (train[row]![col]) values.push(sourceLinear[channel]![row]![col]!);
    return quantile(values, 0.05);
  });
  const clipping = { all: [0, 0, 0], train: [0, 0, 0], heldout: [0, 0, 0] };
  const positiveTrain: number[] = [];
  for (let row = 0; row < HEIGHT; row++) for (let col = 0; col < WIDTH; col++) if (mask[row]![col]) {
    for (let channel = 0; channel < 3; channel++) {
      const beforeClamp = sourceLinear[channel]![row]![col]! - sky[channel]!;
      if (beforeClamp < 0) {
        clipping.all[channel]!++;
        if (train[row]![col]) clipping.train[channel]!++;
        if (heldout[row]![col]) clipping.heldout[channel]!++;
      }
      const value = Math.max(0, beforeClamp);
      target[channel]![row]![col] = value;
      if (train[row]![col] && value > 0) positiveTrain.push(value);
    }
  }
  const trainPositiveP99 = quantile(positiveTrain, 0.99), commonFactor = displayReference?.commonFactor??0.08 / trainPositiveP99;
  need(Number.isFinite(commonFactor) && commonFactor > 0, 'Observation normalization is invalid');
  for (const channel of target) for (const row of channel) for (let col = 0; col < WIDTH; col++) row[col]! *= commonFactor;
  need(target.flat(2).every(value => Number.isFinite(value) && value >= 0), 'Observation target must remain finite and nonnegative');
  const metadata = {
    kind: 'lmc-whole-horalek-observation@1', datasetId: dataset.imageId, inputMetadata: INPUT_PATH,
    sourcePath: dataset.registered.path, maskPath: dataset.coverage.path,
    sourceUrl: 'https://noirlab.edu/public/images/iotw2547a/', sourceWidth, sourceHeight,
    sourceCoverageWidth: coverageMetadata.width, sourceCoverageHeight: coverageMetadata.height,
    outputWidth: WIDTH, outputHeight: HEIGHT, fullFootprint: !window, cropped: !!window,cropWindow:window??null,inheritsDisplayReference:!!displayReference,
    inputRole: 'Observed registered star-removed publisher photograph and measured registration only; no old fitted field, prior, material or tone curve consumed',
    binning: 'Exact source-pixel area-weighted mean after IEC sRGB inverse transfer; every part of the full source rectangle contributes',
    coverage: { mapping: 'Full normalized rectangle resized to RGB dimensions with Lanczos3, then alpha >=250',
      minimumValidAreaFraction: 0.95, validBins: count(mask), trainBins: count(train), heldoutBins: count(heldout), validAreaFractions: validFraction },
    holdout: { blockSize: holdoutBlock, rule: `(floor(row/${holdoutBlock})+floor(col/${holdoutBlock})) modulo 4 == 0; intersected with valid mask before fit` },
    transfer: { sourceEncoding: 'sRGB display bytes', linearization: 'IEC 61966-2-1 inverse transfer', source: SRGB_REFERENCE,
      physicalCalibration: false, bandInterpretation: 'Publisher RGB appearance; unknown instrument passbands and display processing' },
    sky: { method: 'Per-channel fifth percentile of valid training bins only', percentileDefinition: 'Sorted element floor((N-1)*p)',
      rgbLinearDisplay: sky, fitParameter: false, negativeValuesClampedToZero: true, clippedChannelBins: clipping },
    normalization: { method: 'One common factor over pooled strictly positive training channels after fixed sky removal',
      trainPositiveP99, targetPositiveTrainP99: 0.08, commonFactor, perChannelGain: false, perViewGain: false },
    redisplay: { formula: 'sRGB(clamp(normalizedPrediction/commonFactor + sky.rgbLinearDisplay[channel],0,1))',
      rawRgb: 'Full-rectangle valid-or-invalid source RGB averaged in linear display space and re-encoded to normalized sRGB; no sky subtraction or fit normalization',
      clippingIsIrreversible: true, backgroundNotInStellarField: true },
    registration: { distanceKpc, recordedDistanceKpc: input.distance, tangentBoundsKpc: bounds,
      referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, originM: frame.originM,
      localToReferenceXyzw: frame.localToReferenceXyzw, metersPerUnit: frame.metersPerUnit,
      frameBoundsIgnored: true, pixelConvention: 'rayAt accepts fractional output-grid coordinates; call (col+0.5,row+0.5) at pixel centers',
      rayConstruction: 'Normalize(originM/metersPerKpc + localToReference*[tx,ty,0]); x increases min-to-max, y decreases max-to-min, with no guessed sky flip' },
    limitations: [
      'Complete preserved photograph footprint, not complete coverage of the LMC stellar outskirts; missing coverage is not measured zero.',
      'Inverse display transfer is not instrument calibration, intrinsic luminosity, extinction correction or natural-color recovery.',
      'Existing registration and star-removal uncertainties remain inherited; no new astrometric or compact-source qualification is claimed.',
      'Fifth-percentile sky is an authored fixed nuisance estimate and can remove real faint galaxy light; clipping counts are retained.',
      'The source frame origin is heliocentric sun-icrf; an Earth-sized baseline is not separately resolved at the LMC distance.',
    ],
  };
  return { width: WIDTH, height: HEIGHT, target, mask, heldout, rayAt, pixelOf, metadata, rawRgb };
}
