/** A pinned processing recipe can lend completed native layers to a broader intake. No processing is performed here. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { readObservationRecipe, scienceObservationSources, type ObservationRecipe, type ObservationSource } from './recipe.js';

export async function loadNativeSeparationCache(recipe: ObservationRecipe): Promise<ObservationRecipe | undefined> {
  const pin = recipe.nativeSeparationCache?.recipe;
  if (!pin) return undefined;
  const bytes = await readFile(pin.path);
  if (createHash('sha256').update(bytes).digest('hex') !== pin.sha256) throw new Error('Native separation cache recipe pin differs.');
  const cached = readObservationRecipe(JSON.parse(bytes.toString()));
  if (cached.id === recipe.id) throw new Error('Native separation cache must reference a distinct processing recipe.');
  return cached;
}

export function nativeSeparationCacheSource(recipe: ObservationRecipe, cached: ObservationRecipe, source: ObservationSource): ObservationSource | undefined {
  const candidate = scienceObservationSources(cached).find(image => image.id === source.id);
  if (!candidate) return undefined;
  if (candidate.sha256 !== source.sha256 || candidate.width !== source.width || candidate.height !== source.height || candidate.stellarTreatment !== source.stellarTreatment)
    throw new Error(`${source.id}: cached separation original, native grid or stellar treatment differs.`);
  if (cached.nativeRemoval.scriptSha256 !== recipe.nativeRemoval.scriptSha256 || cached.nativeRemoval.model.sha256 !== recipe.nativeRemoval.model.sha256)
    throw new Error(`${source.id}: cached separation model/script signature differs.`);
  return candidate;
}

export function nativeSeparationCacheDirectory(recipe: ObservationRecipe, cached: ObservationRecipe, source: ObservationSource): string | undefined {
  const candidate = nativeSeparationCacheSource(recipe, cached, source);
  return candidate && resolve('.local/nebula-lab/observations', cached.id, candidate.id, candidate.stellarTreatment === 'preserve' ? 'native-preserved' : 'native-nox');
}
