import { cross3 as cross } from '../../../src/platform/vector3.mts';
/**
 * Bounded New Horizons LORRI pointing registration for a fixed PCK body frame
 * and fixed released STL.  This is deliberately not a pose or shape solver.
 *
 * Usage: node --experimental-strip-types tools/objects/new-horizons/prepare-photographic-cameras.mts \
 *   src/objects/nix/source/preparation/photography.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFitsHeader } from '../observation/fits.mts';
import { newHorizonsCamera, decodeNewHorizonsLorri } from '../terrestrial-layers/new-horizons-geo.mts';
import { bindSipCamera } from '../terrestrial-layers/llorri-geo.mts';
import { observedLimb, limbThreshold, type LimbEdgePoint } from '../terrestrial-layers/limb-refinement.mts';
import { loadStlShape } from '../terrestrial-layers/obj-shape.mts';
import { array, boolean, number, optional, shape, text } from '../terrestrial-layers/source-records.mts';
import { pckRotation } from '../../spice/frames.mts';
import { parseTextKernel } from '../../spice/text-kernel.mts';
import { transpose } from '../../spice/ck.mts';
import { comparePhotographicInteriors } from './compare-photographic-interiors.mts';
import { writeInteriorComparison } from './render-interior-comparison.mts';

const SPEED_OF_LIGHT_KM_PER_SECOND = 299792.458;
const MAXIMUM_OFFSET_PIXELS = 32;
const PARTITION_ROWS = 12;
const GENERATOR_PATH = fileURLToPath(import.meta.url);

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const unit = (value: readonly number[]) => { const length = Math.hypot(...value); if (!(length > 0)) throw new Error('Zero-length ray.'); return value.map(v => v / length); };
const sub = (a: readonly number[], b: readonly number[]) => a.map((value, index) => value - b[index]);


const crop = shape({ left: number, top: number, width: number, height: number });
const recipeShape = shape({ schema: text, bodyId: text, naifBodyId: number,
  mesh: shape({ path: text, compression: text, metersPerUnit: number, expectedVertices: number, expectedFaces: number }),
  pck: shape({ path: text, timeMode: text }),
  frames: array(shape({ id: text, imagePath: text, outputCameraPath: text, crop,
    independentExposure: value => value === undefined ? undefined : shape({ imagePath: text, crop })(value),
    interiorValidations: optional(array(shape({ id: text, imagePath: text, crop, supersampling: number, reverse: optional(boolean) }))) })),
  outputEvidencePath: text,
});
type Recipe = ReturnType<typeof recipeShape>;
type BoundFrame = ReturnType<typeof decodeNewHorizonsLorri> & ReturnType<typeof bindSipCamera>;
type CandidateCamera = Pick<BoundFrame, 'camera' | 'rayPixel' | 'projectPoint'>;

function recipePath(root: string, path: string) {
  if (!path || path.startsWith('/') || path.split('/').includes('..')) throw new Error(`Recipe path must be source-relative: ${path}`);
  return resolve(root, path);
}

function evidencePath(root: string, path: string) {
  if (!path.startsWith('../evidence/') || path.slice('../evidence/'.length).split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Evidence path must be the package evidence sibling: ${path}`);
  }
  return resolve(root, path);
}

function validateRecipe(recipe: Recipe) {
  if (recipe.schema !== 'cssearth-nh-lorri-photography@1' || !Number.isInteger(recipe.naifBodyId) || recipe.naifBodyId < 1 ||
      recipe.mesh.compression !== 'gzip' || !(recipe.mesh.metersPerUnit > 0) || !Number.isInteger(recipe.mesh.expectedVertices) || !Number.isInteger(recipe.mesh.expectedFaces) ||
      recipe.pck.timeMode !== 'receive-minus-range-light-time' || !recipe.frames.length ||
      recipe.frames.some(frame => !frame.id || [frame.crop.left, frame.crop.top, frame.crop.width, frame.crop.height].some(value => !Number.isInteger(value)) ||
        frame.crop.left < 0 || frame.crop.top < 0 || frame.crop.width < 8 || frame.crop.height < 8 ||
        (frame.independentExposure !== undefined && ([frame.independentExposure.crop.left, frame.independentExposure.crop.top, frame.independentExposure.crop.width, frame.independentExposure.crop.height].some(value => !Number.isInteger(value)) ||
          frame.independentExposure.crop.left < 0 || frame.independentExposure.crop.top < 0 || frame.independentExposure.crop.width < 8 || frame.independentExposure.crop.height < 8)))) {
    throw new Error('Invalid New Horizons photography recipe.');
  }
}

function validateTargetIdentity(header: Record<string, string | number | boolean | undefined>, bodyId: string, imagePath: string) {
  const target = header.SPCTCB;
  if (typeof target !== 'string' || target.trim().toLowerCase() !== bodyId.toLowerCase()) {
    throw new Error(`FITS target does not match recipe body ${bodyId}: ${imagePath}`);
  }
}

function partitions(points: LimbEdgePoint[], top: number): LimbEdgePoint[] {
  return points.map(point => ({ ...point, partition: Math.floor((point.y - top) / PARTITION_ROWS) % 2 === 0 ? 'fit' : 'holdout' }));
}

function makeBound(bytes: Buffer, bodyToJ2000: readonly (readonly number[])[], offsetPixels: number[]): BoundFrame {
  const camera = newHorizonsCamera(bytes, { bodyToJ2000, offsetPixels });
  const decoded = decodeNewHorizonsLorri(bytes, camera);
  // bindSipCamera is intentionally retained for every ray: a detector offset
  // does not bypass the FITS TAN-SIP distortion.
  return { ...decoded, ...bindSipCamera(camera), camera };
}

/** Candidate trials retain the one decoded source frame.  Only its camera
 * closure changes, so fitting cannot spend most of its work reading HDUs. */
function makeCandidate(bytes: Buffer, bodyToJ2000: readonly (readonly number[])[], offsetPixels: number[]): CandidateCamera {
  const camera = newHorizonsCamera(bytes, { bodyToJ2000, offsetPixels });
  return { camera, ...bindSipCamera(camera) };
}

function statistics(points: readonly LimbEdgePoint[], frame: CandidateCamera, mesh: Awaited<ReturnType<typeof loadStlShape>>, normals: readonly number[][], partition: string) {
  const eye = frame.camera.positionKm.map(value => value * 1000);
  const residual = (point: LimbEdgePoint) => {
    let lit = false;
    const hit = (distance: number) => {
      const [u, v] = frame.rayPixel(point.x + distance * point.normal[0], point.y + distance * point.normal[1]);
      const intersection = mesh.intersect(eye, unit(frame.camera.rayMatrix.map(row => dot(row, [u, v, 1]))));
      if (intersection) lit = dot(normals[intersection.faceId], frame.camera.sunDirection) > .01;
      return intersection;
    };
    let inside = 0, outside: number | null = null;
    if (hit(0)) {
      for (const distance of [.5, 1, 2, 4, 8, 16, 32]) { if (!hit(distance)) { outside = distance; break; } inside = distance; }
    } else {
      let previous = 0;
      for (const distance of [.5, 1, 2, 4, 8, 16, 32]) { if (hit(-distance)) { inside = -distance; outside = -previous; break; } previous = distance; }
    }
    if (outside === null) return null;
    let miss = outside;
    for (let iteration = 0; iteration < 9; iteration++) { const middle = (inside + miss) / 2; if (hit(middle)) inside = middle; else miss = middle; }
    return { value: (inside + miss) / 2, lit };
  };
  const selected = points.filter(point => point.partition === partition);
  const measured = selected.map(residual), matched = measured.filter((value): value is { value: number; lit: boolean } => value !== null);
  const lit = matched.filter(value => value.lit);
  return { candidatePoints: selected.length, litMatches: lit.length, unmatched: measured.filter(value => value === null).length,
    unlit: measured.filter(value => value !== null && !value.lit).length,
    rmsPixels: matched.length ? Math.sqrt(matched.reduce((sum, value) => sum + value.value ** 2, 0) / matched.length) : null,
    litRmsPixels: lit.length ? Math.sqrt(lit.reduce((sum, value) => sum + value.value ** 2, 0) / lit.length) : null,
    maximumPixels: matched.length ? Math.max(...matched.map(value => Math.abs(value.value))) : null,
    residual };
}

function fitOffset(points: readonly LimbEdgePoint[], bytes: Buffer, bodyToJ2000: readonly (readonly number[])[], mesh: Awaited<ReturnType<typeof loadStlShape>>, normals: readonly number[][]) {
  const cost = (offsetPixels: number[]) => {
    const measurement = statistics(points, makeCandidate(bytes, bodyToJ2000, offsetPixels), mesh, normals, 'fit');
    // Point membership is frozen from the nominal PCK prediction.  A trial
    // that loses a control is penalized; it cannot lower cost by discarding it.
    return points.reduce((sum, point) => {
      const value = measurement.residual(point);
      return sum + (value === null ? 1024 : Math.abs(value.value) <= 3 ? value.value ** 2 : 6 * Math.abs(value.value) - 9);
    }, 0) / points.length;
  };
  let offset = [0, 0], score = cost(offset);
  for (const step of [8, 4, 2, 1, .5, .25, .125]) for (let iteration = 0; iteration < 12; iteration++) {
    let improved = false;
    for (const delta of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const candidate = offset.map((value, index) => value + delta[index]);
      if (Math.hypot(...candidate) > MAXIMUM_OFFSET_PIXELS) continue;
      const candidateScore = cost(candidate);
      if (candidateScore < score) { offset = candidate; score = candidateScore; improved = true; }
    }
    if (!improved) break;
  }
  return { offset, score };
}

async function prepare(recipeFile: string) {
  const recipeBytes = await readFile(recipeFile), recipe = recipeShape(JSON.parse(recipeBytes.toString('utf8')));
  validateRecipe(recipe);
  // Recipes live at source/preparation/photography.json.  Inputs, camera
  // closures, and evidence are all source-root-relative, like existing body
  // preparers; this also permits `evidence/...` without crossing a package.
  const source = dirname(dirname(recipeFile)), meshPath = recipePath(source, recipe.mesh.path), pckPath = recipePath(source, recipe.pck.path);
  const [meshBytes, pckBytes] = await Promise.all([readFile(meshPath), readFile(pckPath)]);
  const kernel = parseTextKernel(pckBytes.toString('utf8'), recipe.pck.path);
  const mesh = await loadStlShape(meshPath, recipe.mesh);
  const normals = mesh.indices.map(face => { const [a, b, c] = face.map(index => mesh.positions[index]); return unit(cross(sub(b, a), sub(c, a))); });
  const evidence: Record<string, unknown>[] = [];
  for (const frameRecipe of recipe.frames) {
    const imagePath = recipePath(source, frameRecipe.imagePath), imageBytes = await readFile(imagePath), header = readFitsHeader(imageBytes).header;
    validateTargetIdentity(header, recipe.bodyId, frameRecipe.imagePath);
    const receiveEt = number(header.SPCSCET), range = Math.hypot(...['SPCTSCX', 'SPCTSCY', 'SPCTSCZ'].map(key => number(header[key])));
    const emissionEt = receiveEt - range / SPEED_OF_LIGHT_KM_PER_SECOND, bodyToJ2000 = transpose(pckRotation(kernel, recipe.naifBodyId, emissionEt));
    const base = makeBound(imageBytes, bodyToJ2000, [0, 0]), { left, top, width, height } = frameRecipe.crop;
    if (left + width > base.width || top + height > base.height) throw new Error(`Crop is outside native LORRI frame: ${frameRecipe.id}`);
    const values = Float32Array.from({ length: width * height }, (_, index) => base.planes.IMAGE[(top + Math.floor(index / width)) * base.width + left + index % width]);
    const acceptPixel = (index: number) => base.acceptPixel((top + Math.floor(index / width)) * base.width + left + index % width);
    const threshold = limbThreshold(values, acceptPixel), points = partitions(observedLimb({ width, height, planes: { IMAGE: values }, acceptPixel }, threshold.threshold, 350, threshold.bodyMean, .2)
      .map(point => ({ ...point, x: point.x + left, y: point.y + top })), top);
    const beforeFit = statistics(points, base, mesh, normals, 'fit'), beforeHoldout = statistics(points, base, mesh, normals, 'holdout');
    const fixedFitPoints = points.filter(point => point.partition === 'fit' && (() => { const value = beforeFit.residual(point); return value !== null && value.lit; })());
    const usableHoldoutPoints = points.filter(point => point.partition === 'holdout' && (() => { const value = beforeHoldout.residual(point); return value !== null && value.lit; })());
    if (fixedFitPoints.length < 12 || usableHoldoutPoints.length < 12) throw new Error(`Insufficient usable lit-limb controls for two-offset fit: ${frameRecipe.id} (fit ${fixedFitPoints.length}, holdout ${usableHoldoutPoints.length}).`);
    const fitted = fitOffset(fixedFitPoints, imageBytes, bodyToJ2000, mesh, normals), registered = makeCandidate(imageBytes, bodyToJ2000, fitted.offset);
    const fit = statistics(fixedFitPoints, registered, mesh, normals, 'fit'), holdout = statistics(usableHoldoutPoints, registered, mesh, normals, 'holdout');
    const provenance = [
      { path: relative(source, meshPath) }, { path: relative(source, imagePath) },
      { path: relative(source, pckPath) }, { path: relative(source, recipeFile) },
    ];
    const camera = { ...registered.camera, provenance };
    await writeFile(recipePath(source, frameRecipe.outputCameraPath), JSON.stringify(camera, null, 2) + '\n');
    let independentExposure: unknown;
    if (frameRecipe.independentExposure) {
      const otherPath = recipePath(source, frameRecipe.independentExposure.imagePath), otherBytes = await readFile(otherPath);
      const otherHeader = readFitsHeader(otherBytes).header, otherReceiveEt = number(otherHeader.SPCSCET), otherRange = Math.hypot(...['SPCTSCX', 'SPCTSCY', 'SPCTSCZ'].map(key => number(otherHeader[key])));
      validateTargetIdentity(otherHeader, recipe.bodyId, frameRecipe.independentExposure.imagePath);
      if (otherBytes.equals(imageBytes)) throw new Error(`Independent exposure must be a distinct FITS image: ${frameRecipe.id}`);
      const otherEmissionEt = otherReceiveEt - otherRange / SPEED_OF_LIGHT_KM_PER_SECOND;
      // A prediction transfers the fitted detector translation only.  Its PCK
      // attitude and source spacecraft/sun vectors are rebuilt for this image.
      const other = makeBound(otherBytes, transpose(pckRotation(kernel, recipe.naifBodyId, otherEmissionEt)), fitted.offset), otherCrop = frameRecipe.independentExposure.crop;
      if (otherCrop.left + otherCrop.width > other.width || otherCrop.top + otherCrop.height > other.height) throw new Error(`Independent crop is outside native LORRI frame: ${frameRecipe.id}`);
      const otherValues = Float32Array.from({ length: otherCrop.width * otherCrop.height }, (_, index) => other.planes.IMAGE[(otherCrop.top + Math.floor(index / otherCrop.width)) * other.width + otherCrop.left + index % otherCrop.width]);
      const otherAccept = (index: number) => other.acceptPixel((otherCrop.top + Math.floor(index / otherCrop.width)) * other.width + otherCrop.left + index % otherCrop.width);
      const otherThreshold = limbThreshold(otherValues, otherAccept), otherPoints = partitions(observedLimb({ width: otherCrop.width, height: otherCrop.height, planes: { IMAGE: otherValues }, acceptPixel: otherAccept }, otherThreshold.threshold, 350, otherThreshold.bodyMean, .2)
        .map(point => ({ ...point, x: point.x + otherCrop.left, y: point.y + otherCrop.top })), otherCrop.top);
      independentExposure = { imagePath: frameRecipe.independentExposure.imagePath, receiveEt: otherReceiveEt, emissionEt: otherEmissionEt,
        holdout: (() => { const result = statistics(otherPoints, other, mesh, normals, 'holdout'); return { ...result, residual: undefined }; })() };
    }
    const interiorValidations: unknown[] = [];
    for (const validation of frameRecipe.interiorValidations ?? []) {
      if (!/^[a-z0-9-]+$/u.test(validation.id)) throw new Error("Invalid interior validation id.");
      const otherBytes = await readFile(recipePath(source, validation.imagePath));
      if (otherBytes.equals(imageBytes)) throw new Error('Interior validation must use a distinct exposure.');
      const otherHeader = readFitsHeader(otherBytes).header;
      validateTargetIdentity(otherHeader, recipe.bodyId, validation.imagePath);
      const otherReceiveEt = number(otherHeader.SPCSCET), otherRange = Math.hypot(...['SPCTSCX', 'SPCTSCY', 'SPCTSCZ'].map(key => number(otherHeader[key])));
      const otherEmissionEt = otherReceiveEt - otherRange / SPEED_OF_LIGHT_KM_PER_SECOND;
      const otherRotation = transpose(pckRotation(kernel, recipe.naifBodyId, otherEmissionEt));
      const otherBase = makeBound(otherBytes, otherRotation, [0, 0]);
      const c = validation.crop;
      if (![c.left, c.top, c.width, c.height].every(Number.isInteger) || c.left < 0 || c.top < 0 || c.width < 8 || c.height < 8 ||
          c.left + c.width > otherBase.width || c.top + c.height > otherBase.height) throw new Error('Interior validation crop is outside native image.');
      const localIndex = (index: number) => (c.top + Math.floor(index / c.width)) * otherBase.width + c.left + index % c.width;
      const values = Float32Array.from({ length: c.width * c.height }, (_, index) => otherBase.planes.IMAGE[localIndex(index)]);
      const acceptPixel = (index: number) => otherBase.acceptPixel(localIndex(index));
      const threshold = limbThreshold(values, acceptPixel);
      const otherPoints = partitions(observedLimb({ width: c.width, height: c.height, planes: { IMAGE: values }, acceptPixel }, threshold.threshold, 350, threshold.bodyMean, .2)
        .map(point => ({ ...point, x: point.x + c.left, y: point.y + c.top })), c.top);
      const nominal = statistics(otherPoints, otherBase, mesh, normals, 'fit');
      const fitPoints = otherPoints.filter(point => point.partition === 'fit' && nominal.residual(point)?.lit);
      if (fitPoints.length < 12) throw new Error('Interior validation has insufficient initial pointing controls.');
      const pointing = fitOffset(fitPoints, otherBytes, otherRotation, mesh, normals);
      const other = { ...otherBase, ...makeCandidate(otherBytes, otherRotation, pointing.offset) };
      const reference = { ...base, ...registered };
      const comparison = comparePhotographicInteriors(reference, other, mesh, c, validation.supersampling);
      const { buffers: _buffers, ...report } = comparison;
      const separation = Math.acos(Math.max(-1, Math.min(1, dot(unit(reference.camera.positionKm), unit(other.camera.positionKm))))) * 180 / Math.PI;
      const illustration = `${frameRecipe.id}-${validation.id}-interior-transfer.png`;
      const illustrationPath = resolve(dirname(evidencePath(source, recipe.outputEvidencePath)), illustration);
      await mkdir(dirname(illustrationPath), { recursive: true });
      await writeInteriorComparison(comparison, illustrationPath);
      let reverse: unknown;
      if (validation.reverse) {
        const corrected = { ...otherBase, ...makeCandidate(otherBytes, otherRotation, [pointing.offset[0] + comparison.fittedShift.dx, pointing.offset[1] + comparison.fittedShift.dy]) };
        const reversed = comparePhotographicInteriors(corrected, reference, mesh, frameRecipe.crop, 1);
        const { buffers: _reverseBuffers, ...reverseReport } = reversed;
        const reverseIllustration = `${frameRecipe.id}-${validation.id}-reverse-interior-transfer.png`;
        await writeInteriorComparison(reversed, resolve(dirname(illustrationPath), reverseIllustration));
        reverse = { ...reverseReport, illustration: reverseIllustration, referencePointingOffsetPixels: [pointing.offset[0] + comparison.fittedShift.dx, pointing.offset[1] + comparison.fittedShift.dy] };
      }
      interiorValidations.push({ id: validation.id, imagePath: validation.imagePath, receiveEt: otherReceiveEt, emissionEt: otherEmissionEt,
        observerDirectionDifferenceDegrees: separation, supersampling: validation.supersampling,
        initialPointingOffsetPixels: pointing.offset, ...report, illustration, reverse,
        method: 'Project native reference pixels through the unchanged mesh at the published PCK pose. Fit two relative detector translations on two diagonal interior quadrants; withhold the other two. Pixel membership is fixed for every trial. No attitude, shape, blur, or photometric model is fitted.',
        limits: 'The relative detector residual is not absolute surface position accuracy. Similar viewing directions may not constrain a model-frame error; source-frame qualification is a separate decision.' });
    }
    evidence.push({ id: frameRecipe.id, imagePath: frameRecipe.imagePath, outputCameraPath: frameRecipe.outputCameraPath,
      pck: { path: recipe.pck.path, naifBodyId: recipe.naifBodyId, receiveEt, emissionEt, lightTimeSeconds: receiveEt - emissionEt,
        timeMode: recipe.pck.timeMode }, registration: { offsetPixels: fitted.offset, fit: { ...fit, residual: undefined }, holdout: { ...holdout, residual: undefined },
        beforeFit: { ...beforeFit, residual: undefined }, beforeHoldout: { ...beforeHoldout, residual: undefined }, threshold,
        fittingPointCount: fixedFitPoints.length, holdoutPointCount: usableHoldoutPoints.length,
        method: 'Two detector pointing offsets only; maximum vector offset 32 pixels. PCK attitude, source mesh, range, and TAN-SIP model are fixed. Alternating 12-row crop blocks reserve a spatially disjoint lit-limb holdout.' }, independentExposure, interiorValidations,
      qualification: 'UNQUALIFIED: diagnostic projection only; photographic publication is deferred.',
      interpretation: 'Fixed PDS PCK pose applied to the released native STL axes, with two fitted detector translations. The source receive-time SPCSCET minus source range/c mode follows the apparent LT+S vector convention.',
      limitations: 'The lit-limb and interior-transfer checks have separate claims. Relative image agreement does not establish absolute surface control or resolve all possible STL-to-PCK frame errors. Photographic publication requires review of the source frame and the sensitivity of the interior check.' });
  }
  const output = evidencePath(source, recipe.outputEvidencePath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ schema: 'cssearth-nh-lorri-registration-evidence@1', bodyId: recipe.bodyId,
    generator: { path: 'tools/objects/new-horizons/prepare-photographic-cameras.mts' },
    helpers: await Promise.all(['compare-photographic-interiors.mts', 'render-interior-comparison.mts'].map(async name => ({
      path: `tools/objects/new-horizons/${name}`,
    }))),
    recipe: { path: relative(source, recipeFile) }, mesh: recipe.mesh, frames: evidence }, null, 2) + '\n');
}

const input = process.argv[2];
if (!input || process.argv.length !== 3) throw new Error('Usage: node --experimental-strip-types prepare-photographic-cameras.mts <source/preparation/photography.json>');
await prepare(resolve(input));
