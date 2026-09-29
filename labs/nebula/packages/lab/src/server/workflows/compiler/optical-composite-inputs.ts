/** Native source replay for a composite; the observation owner alone acquires or removes stars. */
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readObservationRecipe, scienceObservationSources } from '../../../features/observations/recipe.ts';
import { readObservations, observationsFromRecipe } from '../../../features/observations/models/model.ts';
import { jointPath, jointRecord } from '../../../features/joint-fit/model.ts';
import { compilerLayersReady, runCompilerSourceCommand, type CompilerProgress } from './prerequisites.ts';
import type { CompilerPin } from '@cssearth/bake/volume';

const missing = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT';
function pin(path: unknown): CompilerPin {
  if (!jointPath(path)) throw new TypeError('Missing native composite source path.');
  return { path };
}
export interface CompositeSourceRecipe { observationRecipe: string; observationCatalogue: string; detailSourceId: string; wideSourceId: string }

/** A preview catalogue alone is insufficient: require its source recipe and every full-native input. */
export async function opticalCompositeSourcePins(root: string, recipe: CompositeSourceRecipe): Promise<CompilerPin[] | undefined> {
  const recipeText = await readFile(resolve(root, recipe.observationRecipe), 'utf8'), observationsRecipe = readObservationRecipe(JSON.parse(recipeText));
  const planned = scienceObservationSources(observationsRecipe);
  if (recipe.observationCatalogue !== `.local/nebula-lab/observations/${observationsRecipe.id}/observations.json` ||
      planned.length !== 2 || !planned.some(source => source.id === recipe.detailSourceId) || !planned.some(source => source.id === recipe.wideSourceId))
    throw new TypeError('Composite observation recipe must own its two source identities and catalogue.');
  try {
    const catalogueBytes = await readFile(resolve(root, recipe.observationCatalogue)), raw: unknown = JSON.parse(catalogueBytes.toString());
    const catalogue = readObservations(raw);
    if (!observationsFromRecipe(raw, recipeText)) return undefined;
    if (!jointRecord(raw) || !Array.isArray(raw.images) || catalogue.id !== observationsRecipe.id || catalogue.images.length !== planned.length ||
        catalogue.images.some(image => !planned.some(source => source.id === image.id &&
          source.width === image.source.width && source.height === image.source.height))) throw new TypeError('Composite catalogue differs from its pinned source recipe.');
    if (!await compilerLayersReady(root, raw)) return undefined;
    const pins: CompilerPin[] = [{ path: recipe.observationRecipe }, { path: recipe.observationCatalogue }];
    if (observationsRecipe.nativeSeparationCache) pins.push(observationsRecipe.nativeSeparationCache.recipe);
    for (const value of raw.images) {
      if (!jointRecord(value) || !jointRecord(value.source) || !jointRecord(value.removal) || !jointRecord(value.removal.settings)) return undefined;
      const { source, removal } = value, settings = removal.settings;
      if (!jointRecord(settings) || !jointPath(settings.directory) || !settings.directory.startsWith('.local/nebula-lab/'))
        throw new TypeError('Missing composite native separation owner.');
      if (!jointRecord(settings.model) || settings.model.path !== observationsRecipe.nativeRemoval.model.path)
        throw new TypeError('Composite native separation differs from its configured NOX model or code.');
      pins.push(pin(source.path), pin(`${settings.directory}/result.json`), pin(`${settings.directory}/diffuse.png`), pin(`${settings.directory}/stars.png`));
    }
    for (const source of pins) await readFile(resolve(root, source.path));
    return pins;
  } catch (error) { if (missing(error)) return undefined; throw error; }
}

export async function restoreOpticalCompositeSources(root: string, recipe: CompositeSourceRecipe, signal: AbortSignal, progress: CompilerProgress): Promise<CompilerPin[]> {
  signal.throwIfAborted();
  let pins = await opticalCompositeSourcePins(root, recipe);
  if (!pins) {
    progress('Restoring composite observations and native separation through their source recipe…');
    await runCompilerSourceCommand(root, 'prepare-observations', recipe.observationRecipe, 'NEBULA_OBSERVATIONS_COMPLETE', signal, progress);
    pins = await opticalCompositeSourcePins(root, recipe);
    if (!pins) throw new Error('Composite observation preparation did not restore its full native inputs.');
  } else progress('Composite registration and full-native separation reused.');
  return pins;
}
