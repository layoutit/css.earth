import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from './source-values.mts';
import type { RuntimeSourceReader } from './runtime-source-graph.mts';

export interface AuthoredWorldFrameReceiptInput {
  descriptor: unknown;
  directory: string;
  readText: RuntimeSourceReader;
  closure?: Set<string>;
}

export interface AuthoredWorldFrameInput extends AuthoredWorldFrameReceiptInput {
  scene: unknown;
  runtime: unknown;
}

const fail = (detail: string): never => { throw new TypeError(`Authored physical frame ${detail}.`); };

/**
 * The part of the physical frame check that reads tracked files only: the receipt
 * (`prepared/world-navigation.json`) must repeat the descriptor's frame, each recipe source must be
 * declared in the manifest, the frame must carry valid units, and an authored context must reproduce it.
 * `requireAuthoredWorldFrame` continues from here with the restored scene and runtime.
 */
export async function requireAuthoredWorldFrameReceipt({ descriptor: descriptorInput, directory, readText, closure }: AuthoredWorldFrameReceiptInput) {
  const descriptor = requireRecord(descriptorInput, 'Authored descriptor');
  const properties = requireRecord(descriptor.properties, 'Authored properties');
  const path = resolve(directory, 'prepared/world-navigation.json');
  const receipt = requireRecord(JSON.parse(await readText(path)), 'Authored physical frame receipt');
  closure?.add(path);
  const frame = requireRecord(properties.worldFrame, 'Authored physical frame');
  const recipe = requireRecord(properties.recipe, 'Authored recipe');
  const sources = requireArray(recipe.sources, 'Authored recipe sources').map(value => requireRecord(value, 'Authored source'));
  const manifestPath = resolve(directory, 'source/manifest.json'), manifest = requireRecord(JSON.parse(await readText(manifestPath)), 'Source manifest');
  closure?.add(manifestPath);
  const records = ['inputs', 'documents', 'generatedIntermediates'].flatMap(key => requireArray(manifest[key] ?? [], key).map(value => requireRecord(value, key)));
  for (const source of sources) {
    const path = requireString(source.path, 'Authored source path');
    if (!records.some(entry => `source/${String(entry.path)}` === path)) throw new TypeError(`Authored physical frame source ${path} is not declared in the manifest.`);
  }
  if (receipt.schema !== 'cssearth-world-navigation-preparation@1' || receipt.id !== descriptor.id ||
    !isDeepStrictEqual(receipt.frame, frame)) fail('receipt differs from its descriptor');
  if (typeof frame.epochJdTt !== 'number' || !Number.isFinite(frame.epochJdTt) || ![frame.bodyRadiusM, frame.metersPerUnit].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)) fail('has invalid physical units');
  const context = sources.find(source => source.id === 'world-context');
  if (context) {
    const authored = requireRecord(JSON.parse(await readText(resolve(directory, requireString(context.path, 'World context source path')))), 'Authored world context');
    const authoredFrame = requireRecord(authored.frame, 'Authored context frame');
    const fields = ['referenceFrame', 'epochJdTt', 'originM', 'presentationToReference', 'metersPerUnit', 'bodyRadiusM'];
    if (authoredFrame.orbitUpReference !== undefined) fields.push('orbitUpReference');
    const numerical = Object.fromEntries(fields.map(field => [field, authoredFrame[field]]));
    if (receipt.model !== 'authored-context-focus' || !isDeepStrictEqual(frame, numerical)) fail('does not reproduce its authored context');
  }
  return { receipt, frame, recipe, contextual: Boolean(context) };
}

/** Check the final numerical stage separately from raw geometry intermediates. */
export async function requireAuthoredWorldFrame({ scene: sceneInput, runtime: runtimeInput, ...input }: AuthoredWorldFrameInput): Promise<void> {
  const scene = requireRecord(sceneInput, 'Authored scene');
  const runtime = requireRecord(runtimeInput, 'Authored runtime');
  const { receipt, frame, recipe, contextual } = await requireAuthoredWorldFrameReceipt(input);
  if (scene.worldFrame !== undefined && !isDeepStrictEqual(scene.worldFrame, frame)) fail('differs from the source scene frame');
  if (contextual) return;
  const camera = requireRecord(runtime.camera, 'Authored runtime camera');
  const shape = requireRecord(recipe.shape, 'Authored shape');
  const renderedRadius = requireFiniteNumber(receipt.sourceRadiusUnits, 'Source radius') * requireFiniteNumber(receipt.tilePixels, 'Tile pixels') * requireFiniteNumber(camera.sceneScale, 'Scene scale');
  if (!Number.isFinite(renderedRadius) || renderedRadius <= 0 || receipt.renderedRadiusUnits !== renderedRadius ||
    receipt.sceneScale !== camera.sceneScale || frame.bodyRadiusM !== requireFiniteNumber(shape.radiusKm, 'Shape radius') * 1000 ||
    frame.metersPerUnit !== requireFiniteNumber(frame.bodyRadiusM, 'Body radius') / renderedRadius) fail('does not reproduce its authored shape and prepared scene scale');
}
