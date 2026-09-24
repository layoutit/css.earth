import type { RadialState } from './solid-contract.mts';
import { loadRadialTerrain } from './radial-terrain.mts';
import { alternativeLensIds } from './alternative-lenses.mts';
type TerrainContext = Parameters<typeof loadRadialTerrain>[0];
const lensGroups = ['observations', 'scientific', 'observedColors', 'shapeViews', 'surfaceObservations'] as const;
interface ModelConfig {
  namespace: string;
  geometry: {radius: number; radiusKm: number; radialTerrain?: unknown; radialTerrainAlternatives?: (Record<string, unknown> & {lensId: string; additionalLensIds?: string[]})[]};
  presentation: {defaultLens: string};
  raster: Partial<Record<typeof lensGroups[number], {id: string}[]>>;
}
export interface LoadedRadialModel {
  id: string;
  lensIds: string[];
  radial: RadialState;
  config: ModelConfig;
}
interface CombinedRadial {faces: RadialState['faces']; leaves: RadialState['leaves']; lensRanges?: {lensId: string; start: number; count: number}[];}

/** Separate source meshes share a physical scale and one retained scene. */
export async function loadRadialModels<T extends ModelConfig>(context: Omit<TerrainContext, 'config'> & {config: T}) {
  const { config } = context;
  const alternatives = config.geometry.radialTerrainAlternatives ?? [];
  if (!Array.isArray(alternatives) || alternatives.length > 7) throw new TypeError('Invalid alternative surface models.');
  if (!config.geometry.radialTerrain && !alternatives.length) return [];
  const ids = [config.presentation.defaultLens, ...alternatives.flatMap(alternativeLensIds)];
  const lenses = lensGroups
    .flatMap(key => (config.raster[key] ?? []).map(lens => lens.id));
  if (new Set(ids).size !== ids.length ||
      ids.some(id => !/^[a-z][a-z0-9-]*$/.test(id) || !lenses.includes(id)) ||
      alternatives.length && !config.geometry.radialTerrain) throw new TypeError('Invalid alternative surface models.');
  const base = await loadRadialTerrain(context);
  if (!base) return [];
  const models = [{ id: ids[0], lensIds: lenses.filter(id => !ids.slice(1).includes(id)), radial: base, config }];
  for (const { lensId, additionalLensIds: _additional, ...profile } of alternatives) {
    const selected = { ...config, geometry: { ...config.geometry, radialTerrain: profile } };
    const radial = await loadRadialTerrain({ ...context, config: selected });
    if (!radial) throw new TypeError('Alternative model lacks its terrain source.');
    models.push({ id: lensId, lensIds: alternativeLensIds({ lensId, additionalLensIds: _additional }), config: selected, radial });
  }
  return models;
}

export function combineRadialModels(models: Awaited<ReturnType<typeof loadRadialModels>>, namespace: string): CombinedRadial | null {
  if (models.length < 2) return models[0]?.radial ?? null;
  const faces: RadialState['faces'] = [], leaves: RadialState['leaves'] = [], lensRanges: NonNullable<CombinedRadial['lensRanges']> = [];
  for (const model of models) {
    const start = faces.length, count = model.radial.faces.length;
    for (const lensId of model.lensIds) lensRanges.push({ lensId, start, count });
    faces.push(...model.radial.faces);
    leaves.push(...model.radial.leaves.map(leaf => ({ ...leaf,
      attributes: { ...leaf.attributes, 'data-surface-model': model.id },
      style: `${leaf.style};display:var(--${namespace}-${model.id}-display,${model === models[0] ? 'block' : 'none'})` })));
  }
  return { faces, leaves, lensRanges };
}
