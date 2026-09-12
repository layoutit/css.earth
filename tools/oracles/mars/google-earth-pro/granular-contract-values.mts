import { array, object, text, finite, integer, numbers } from './oracle-values.mts';
import { parseNativeSnapshot } from './render-contract-values.mts';

function vector(value: unknown, length: number) {
  const result = numbers(value);
  if (result.length !== length) throw new TypeError(`Expected ${length} finite vector entries.`);
  return result;
}
export function parseGranularSample(value: unknown) {
  const row = object(value), requested = object(row.requested), presentation = object(row.sunPresentation);
  const skyMap = parseNativeSnapshot(row.skyMap), catalogue = parseNativeSnapshot(row.catalogue);
  for (const name of ['view_dir', 'view_right', 'view_up']) {
    if (skyMap.uniforms[name]?.length < 3 || !skyMap.uniforms[name]) throw new TypeError(`Missing sky ray basis ${name}.`);
  }
  vector(skyMap.uniforms.starsToCameraMatrix, 16);
  vector(catalogue.uniforms.ig_ModelViewProjectionMatrix, 16);
  const completedAt = text(row.completedAt);
  if (!Number.isFinite(Date.parse(completedAt))) throw new TypeError('Invalid sample completion time.');
  const common = { ...row, index: integer(row.index), familyIndex: integer(row.familyIndex), completedAt,
    framePath: text(row.framePath), requested: { ...requested, family: text(requested.family), distance: finite(requested.distance),
      latitude: finite(requested.latitude), longitude: finite(requested.longitude), heading: finite(requested.heading), tilt: finite(requested.tilt) }, skyMap, catalogue };
  if (row.sun === null) return { ...common, sun: null, sunPresentation: { ...presentation, visibility: text(presentation.visibility) } };
  const sun = parseNativeSnapshot(row.sun);
  vector(sun.uniforms.ig_ModelViewMatrix, 16);
  return { ...common, sun, sunPresentation: { ...presentation, visibility: text(presentation.visibility),
    cameraDistance: finite(presentation.cameraDistance), localHalfExtent: finite(presentation.localHalfExtent),
    halfExtentPerCameraDistance: finite(presentation.halfExtentPerCameraDistance), centerNdc: vector(presentation.centerNdc, 3) } };
}
export type GranularSample = ReturnType<typeof parseGranularSample>;
export type DrawnGranularSample = Extract<GranularSample, { sun: Exclude<GranularSample['sun'], null> }>;
export function parseGranularContract(value: unknown) {
  const row = object(value), source = object(row.source), capture = object(row.capture);
  return { ...row, rawSamples: text(row.rawSamples), source: { ...source, version: text(source.version), architecture: text(source.architecture), executableSha256: text(source.executableSha256) },
    capture: { ...capture, viewport: capture.viewport, families: Object.fromEntries(Object.entries(object(capture.families)).map(([name, count]) => [name, integer(count)])) },
    exactProgramShaders: array(row.exactProgramShaders).map(value => { const shader = object(value); return { ...shader, program: integer(shader.program) }; }) };
}
export function parseSourceIndex(value: unknown) {
  const row = object(value); return { ...row, sourceApplication: { ...object(row.sourceApplication), rendererSha256: text(object(row.sourceApplication).rendererSha256) }, resources: array(row.resources) };
}
export function parseSkyboxContract(value: unknown) {
  const row = object(value), skyMap = object(row.skyMap), catalogue = object(row.catalogue);
  return { ...row, skyMap: { ...skyMap, draw: object(skyMap.draw), sampler: object(skyMap.sampler) }, catalogue: { ...catalogue,
    draw: object(catalogue.draw), sampler: object(catalogue.sampler), attributes: object(catalogue.attributes) } };
}
export function parseSunContract(value: unknown) {
  const row = object(value), path = object(row.defaultPath);
  return { ...row, defaultPath: { ...path, drawProgram: integer(path.drawProgram), primitive: integer(path.primitive), vertexCount: integer(path.vertexCount), blend: path.blend, depth: path.depth, texture: object(path.texture) } };
}
export function parseSequenceManifest(value: unknown) {
  const row = object(value); return { ...row, frameCount: integer(row.frameCount), keyframes: { ...object(row.keyframes), exported: array(object(row.keyframes).exported) } };
}
