/** Read only the processing prerequisites from the canonical bake recipe. */
import type { BakeRecipe } from './config.ts';

export type ProcessingEnvironmentRecipe = Pick<BakeRecipe, 'environment'> & { removal: Pick<BakeRecipe['removal'], 'model'> };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function readProcessingEnvironmentRecipe(value: unknown): ProcessingEnvironmentRecipe {
  if (!record(value) || value.schema !== 'cssearth-nebula-bake@1' || !record(value.environment) || !record(value.removal) || !record(value.removal.model))
    throw new TypeError('Expected the processing environment and model in a nebula bake recipe.');
  const environment = value.environment, model = value.removal.model;
  if (!Array.isArray(environment.pythonVersions) || !environment.pythonVersions.length || environment.pythonVersions.length > 4 ||
      !environment.pythonVersions.every((version: unknown): version is string => typeof version === 'string' && /^3\.(?:9|10|11|12)$/.test(version)) ||
      new Set(environment.pythonVersions).size !== environment.pythonVersions.length)
    throw new TypeError('Processing requires explicit supported Python versions (3.9–3.12).');
  if (!Array.isArray(environment.packages) || !environment.packages.length || environment.packages.length > 32 ||
      !environment.packages.every((spec: unknown): spec is string => typeof spec === 'string' && spec.length <= 128 && /^[a-z0-9][a-z0-9._-]*==[0-9]+(?:\.[0-9]+)*$/i.test(spec)) ||
      new Set(environment.packages.map(spec => spec.split('==')[0]!.toLowerCase().replace(/[-_.]+/g, '-'))).size !== environment.packages.length)
    throw new TypeError('Processing packages need unique exact name==version pins.');
  if (typeof model.path !== 'string' || !model.path.startsWith('.local/open-star-removal/') || /[\\:?#]/.test(model.path) ||
      model.path.split('/').some(part => !part || part === '.' || part === '..') ||
      typeof model.url !== 'string') throw new TypeError('Invalid local NOX model path.');
  let url: URL;
  try { url = new URL(model.url); } catch { throw new TypeError('The pinned NOX model needs an HTTPS URL.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new TypeError('The pinned NOX model needs an HTTPS URL.');
  return { environment: { pythonVersions: [...environment.pythonVersions], packages: [...environment.packages] },
    removal: { model: { path: model.path, url: model.url } } };
}
