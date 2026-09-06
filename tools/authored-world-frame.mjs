import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';

/** Check the final numerical stage separately from raw geometry intermediates. */
export async function requireAuthoredWorldFrame({ descriptor, scene, runtime, directory, readText, closure }) {
  const fail = detail => { throw new TypeError(`Authored physical frame ${detail}.`); };
  const path = resolve(directory, 'prepared/world-navigation.json');
  const receipt = JSON.parse(await readText(path));
  closure?.add(path);
  const frame = descriptor.properties.worldFrame, recipe = descriptor.properties.recipe;
  if (receipt.schema !== 'cssearth-world-navigation-preparation@1' || receipt.id !== descriptor.id ||
    !isDeepStrictEqual(receipt.sources, recipe.sources) || !isDeepStrictEqual(receipt.frame, frame)) fail('receipt differs from its authored source pins or descriptor');
  if (scene.worldFrame !== undefined && !isDeepStrictEqual(scene.worldFrame, frame)) fail('differs from the source scene frame');
  if (!frame || !Number.isFinite(frame.epochJdTt) || ![frame.bodyRadiusM, frame.metersPerUnit].every(value => Number.isFinite(value) && value > 0)) fail('has invalid physical units');
  const context = recipe.sources.find(source => source.id === 'world-context');
  if (context) {
    const authored = JSON.parse(await readText(resolve(directory, context.path)));
    const fields = ['referenceFrame', 'epochJdTt', 'originM', 'presentationToReference', 'metersPerUnit', 'bodyRadiusM'];
    if (authored.frame.orbitUpReference !== undefined) fields.push('orbitUpReference');
    const numerical = Object.fromEntries(fields.map(field => [field, authored.frame[field]]));
    if (receipt.model !== 'authored-context-focus' || !isDeepStrictEqual(frame, numerical)) fail('does not reproduce its authored context');
    return;
  }
  const renderedRadius = receipt.sourceRadiusUnits * receipt.tilePixels * runtime.camera.sceneScale;
  if (!Number.isFinite(renderedRadius) || renderedRadius <= 0 || receipt.renderedRadiusUnits !== renderedRadius ||
    receipt.sceneScale !== runtime.camera.sceneScale || frame.bodyRadiusM !== recipe.shape.radiusKm * 1000 ||
    frame.metersPerUnit !== frame.bodyRadiusM / renderedRadius) fail('does not reproduce its authored shape and prepared scene scale');
}
