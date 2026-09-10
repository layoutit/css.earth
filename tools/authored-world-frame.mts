import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from './source-values.mts';
import type { RuntimeSourceReader } from './runtime-source-graph.mts';

export interface AuthoredWorldFrameInput {
  descriptor: unknown;
  scene: unknown;
  runtime: unknown;
  directory: string;
  readText: RuntimeSourceReader;
  closure?: Set<string>;
}

/** Check the final numerical stage separately from raw geometry intermediates. */
export async function requireAuthoredWorldFrame({ descriptor: descriptorInput, scene: sceneInput, runtime: runtimeInput, directory, readText, closure }: AuthoredWorldFrameInput): Promise<void> {
  const fail = (detail: string): never => { throw new TypeError(`Authored physical frame ${detail}.`); };
  const descriptor = requireRecord(descriptorInput, 'Authored descriptor');
  const properties = requireRecord(descriptor.properties, 'Authored properties');
  const scene = requireRecord(sceneInput, 'Authored scene');
  const runtime = requireRecord(runtimeInput, 'Authored runtime');
  const path = resolve(directory, 'prepared/world-navigation.json');
  const receipt = requireRecord(JSON.parse(await readText(path)), 'Authored physical frame receipt');
  closure?.add(path);
  const frame = requireRecord(properties.worldFrame, 'Authored physical frame');
  const recipe = requireRecord(properties.recipe, 'Authored recipe');
  const sources = requireArray(recipe.sources, 'Authored recipe sources').map(value => requireRecord(value, 'Authored source'));
  if (receipt.schema !== 'cssearth-world-navigation-preparation@1' || receipt.id !== descriptor.id ||
    !isDeepStrictEqual(receipt.sources, recipe.sources) || !isDeepStrictEqual(receipt.frame, frame)) fail('receipt differs from its authored source pins or descriptor');
  if (scene.worldFrame !== undefined && !isDeepStrictEqual(scene.worldFrame, frame)) fail('differs from the source scene frame');
  if (typeof frame.epochJdTt !== 'number' || !Number.isFinite(frame.epochJdTt) || ![frame.bodyRadiusM, frame.metersPerUnit].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)) fail('has invalid physical units');
  const context = sources.find(source => source.id === 'world-context');
  if (context) {
    const authored = requireRecord(JSON.parse(await readText(resolve(directory, requireString(context.path, 'World context source path')))), 'Authored world context');
    const authoredFrame = requireRecord(authored.frame, 'Authored context frame');
    const fields = ['referenceFrame', 'epochJdTt', 'originM', 'presentationToReference', 'metersPerUnit', 'bodyRadiusM'];
    if (authoredFrame.orbitUpReference !== undefined) fields.push('orbitUpReference');
    const numerical = Object.fromEntries(fields.map(field => [field, authoredFrame[field]]));
    if (receipt.model !== 'authored-context-focus' || !isDeepStrictEqual(frame, numerical)) fail('does not reproduce its authored context');
    return;
  }
  const camera = requireRecord(runtime.camera, 'Authored runtime camera');
  const shape = requireRecord(recipe.shape, 'Authored shape');
  const renderedRadius = requireFiniteNumber(receipt.sourceRadiusUnits, 'Source radius') * requireFiniteNumber(receipt.tilePixels, 'Tile pixels') * requireFiniteNumber(camera.sceneScale, 'Scene scale');
  if (!Number.isFinite(renderedRadius) || renderedRadius <= 0 || receipt.renderedRadiusUnits !== renderedRadius ||
    receipt.sceneScale !== camera.sceneScale || frame.bodyRadiusM !== requireFiniteNumber(shape.radiusKm, 'Shape radius') * 1000 ||
    frame.metersPerUnit !== requireFiniteNumber(frame.bodyRadiusM, 'Body radius') / renderedRadius) fail('does not reproduce its authored shape and prepared scene scale');
}
