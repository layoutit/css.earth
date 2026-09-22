import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { geometrySha, readGeometryPin } from '../geometry/registered-source.ts';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';
import { prepareJointInput } from './input.ts';
import { fitJointModels } from '@cssearth/nebula-reconstruction/methods/joint/fitter';
import { jointBounds, sampleJointEmission } from '@cssearth/nebula-reconstruction/methods/joint/geometry';
import { bakeJointVolume } from './volume.ts';
import { readJointResult, type JointPin, type JointResult, type JointCandidate } from '../../../features/joint-fit/result.ts';
import type { JointRequest } from '../../../features/joint-fit/model.ts';
export const JOINT_FIT_VERSION = 'molecular-wall-joint-fit@1';
const owners = ['model.ts', 'geometry.ts', 'fitter.ts', 'input.ts', 'prepare.ts', 'volume.ts', 'volume-model.ts'];
export async function validateJointResult(root: string, value: unknown) {
  const result = readJointResult(value);
  for (const pin of [result.graph, result.method, ...result.sources.map(s => s.image)]) await readGeometryPin(root, pin);
  for (const candidate of result.candidates) {
    const bank = validatePreparedCssVolume(JSON.parse((await readGeometryPin(root, candidate.volume.volume)).toString()));
    const directory = candidate.volume.volume.path.slice(0, candidate.volume.volume.path.lastIndexOf('/') + 1);
    for (const resource of bank.resources) await readGeometryPin(root, { path: `${directory}${resource.path}` });
  }
  return result;
}
export async function prepareJointFit(root: string, request: JointRequest, signal: AbortSignal, progress: (message: string) => void): Promise<JointResult> {
  signal.throwIfAborted(); progress('Connecting registered ridges and molecular pointings…');
  const input = await prepareJointInput(root, request);
  const implementation = await implementationPins(root, ['labs/nebula/packages/lab/src/server/workflows/joint-fit/prepare.ts']);
  const evidenceSha256 = geometrySha(JSON.stringify(input.evidence));
  const id = geometrySha(JSON.stringify({ version: JOINT_FIT_VERSION, implementation, input: input.inputs.identity, evidenceSha256, graph: input.graph.id,
    molecular: input.molecular.sourceSha256, molecularRecipe: input.molecular.recipeSha256, recipe: input.recipeSha256, request }));
  const directory = `.local/nebula-lab/joint-fit/${id}`, receipt = resolve(root, directory, 'result.json');
  try { return await validateJointResult(root, JSON.parse(await readFile(receipt, 'utf8'))); }
  catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; }
  const { fits, evaluatedModels } = fitJointModels(input.evidence, request.controls, input.recipe, progress, signal);
  await mkdir(resolve(root, directory), { recursive: true });
  async function save(name: string, bytes: Uint8Array): Promise<JointPin> {
    signal.throwIfAborted(); const path = `${directory}/${name}`, target = resolve(root, path);
    await writeFile(`${target}.pending`, bytes); await rename(`${target}.pending`, target); return { path, sha256: geometrySha(bytes) };
  }
  const spanArcsec = input.recipe.morphologyRadiusArcsec[1] * 2.2, diagramSize = 512;
  const diagramPoint = (x: number, y: number): [number, number] => [(x / spanArcsec + .5) * diagramSize, (.5 - y / spanArcsec) * diagramSize];
  const path = (points: [number, number][]) => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const sources: JointResult['sources'] = [];
  for (const source of input.inputs.sources) {
    const raster = new Uint8Array(diagramSize * diagramSize * 4), g = input.inputs.grid;
    for (let y = 0; y < diagramSize; y++) for (let x = 0; x < diagramSize; x++) {
      const [gx, gy] = input.skyToPixel(((x + .5) / diagramSize - .5) * spanArcsec, (.5 - (y + .5) / diagramSize) * spanArcsec);
      const sx = Math.floor(gx), sy = Math.floor(gy); if (sx < 0 || sy < 0 || sx >= g.width || sy >= g.height) continue;
      const src = (sy * g.width + sx) * 4, dest = (y * diagramSize + x) * 4;
      for (let c = 0; c < 4; c++) raster[dest + c] = source.registeredRgba[src + c]!;
    }
    const image = await save(`source-${source.id}.png`, await sharp(raster, { raw: { width: diagramSize, height: diagramSize, channels: 4 } }).png().toBuffer());
    sources.push({ id: source.id, label: source.label, image });
  }
  const candidates: JointCandidate[] = [];
  for (const fit of fits) {
    progress(`Preparing ${fit.parameters.family} in 3D…`);
    const volume = await bakeJointVolume({ root, outputDirectory: `${directory}/${fit.parameters.family}`, id: geometrySha(JSON.stringify({ id, parameters: fit.parameters })),
      boundsArcsec: jointBounds(fit.parameters), signal, progress: update => progress(update.message),
      sampleEmission(x, y, z, out) { sampleJointEmission(x, y, z, fit.parameters, out); } });
    const pointings = new Map<string, JointCandidate['pointings'][number]>();
    input.evidence.velocities.forEach((p, i) => {
      const residual = fit.residuals[i]!, found = pointings.get(p.pointingId), [x, y] = diagramPoint(p.x, p.y);
      const text = `${p.velocityLsrKmS.toFixed(1)} km/s LSR → ${residual.predictedLsrKmS === null
        ? `no model surface; objective penalty ${residual.residualKmS.toFixed(1)} km/s`
        : `${residual.predictedLsrKmS.toFixed(1)}; residual ${residual.residualKmS.toFixed(1)} km/s`}`;
      if (found) { found.measurements += `\n${text}`; found.residualKmS = Math.max(found.residualKmS, Math.abs(residual.residualKmS)); }
      else pointings.set(p.pointingId, { id: p.pointingId, x, y, heldOut: p.heldOut, residualKmS: Math.abs(residual.residualKmS), color: '', measurements: text });
    });
    for (const point of pointings.values()) point.color = `hsl(${Math.round(120 * (1 - Math.min(1, point.residualKmS / 30)))} 72% 56%)`;
    candidates.push({ fit, volume, outlinePath: path(fit.outline.map(([x, y]) => diagramPoint(x, y))) + ' Z', pointings: [...pointings.values()] });
  }
  const graph = await save('ridge-graph.json', Buffer.from(JSON.stringify(input.graph)));
  const method = await save('method.json', Buffer.from(JSON.stringify({ version: JOINT_FIT_VERSION, implementation, recipe: input.recipe, recipeSha256: input.recipeSha256,
    inputIdentity: input.inputs.identity, evidenceSha256, molecularSourceSha256: input.molecular.sourceSha256, molecularRecipeSha256: input.molecular.recipeSha256,
    molecularOffsetWestNorthArcsec: input.molecularOffset, registration: 'Small-angle J2000-to-lab-sky anchor at the 70 arcsec beam scale; no precision frame transformation.',
    graph: graph.sha256, request, evaluatedModels,
    selection: 'Training objective only. All velocity components of pointings in two opposite 45-degree sectors are withheld; adjacent beam footprints can still correlate.',
    geometry: 'Relative neutral thin-shell emission, with fixed authored thickness and a fixed 0.45 equatorial radial reduction for the bipolar family. No calibrated flux, photoskin, dust absorption or hydrodynamics.',
    velocity: 'Homologous speed proportional to 3D radius. Five sightlines at beam-center and one Gaussian sigma offsets supply ideal surface loci. This is not beam-weighted spectral synthesis. Missing intersections incur a fixed penalty; upper-limit intensities are retained as evidence but not fitted.',
    losses: 'Symmetric ridge-to-outline proximity plus robust nearest-velocity-surface distances, averaging velocity components per pointing. Loss scales are engineering choices, not measurement uncertainties or probabilities. Displayed velocity RMS uses matched predictions only; absent intersections remain counted and penalized in the objective.',
  }, null, 2)));
  const result: JointResult = { schema: 'cssearth-joint-fit-result@1', id, controls: request.controls, spanArcsec, diagramSize, sources, candidates, graph, method,
    ridgePaths: input.graph.polylines.map(line => path(line.points.map(p => diagramPoint(...input.pixelToSky(p.x, p.y))))),
    accounting: { ridgePoints: input.evidence.ridges.length, excludedRidgePoints: input.graph.polylines.reduce((n, line) => n + line.points.length, 0) - input.evidence.ridges.length,
      pointings: input.molecular.diagnostics.pointings, components: input.evidence.velocities.length, upperLimits: input.molecular.diagnostics.upperLimits, evaluatedModels, beamFwhmArcsec: input.evidence.beamFwhmArcsec },
    molecularSourceSha256: input.molecular.sourceSha256, inputIdentity: input.inputs.identity, interpretation: input.recipe.interpretation };
  readJointResult(result); await save('result.json', Buffer.from(JSON.stringify(result) + '\n')); return result;
}
