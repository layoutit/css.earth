import type { RadialState } from '../solid/solid-contract.ts';
import { loadRadialTerrain } from './radial-terrain.ts';
import { alternativeDatasetIds } from '../alternative-datasets.ts';
type TerrainContext = Parameters<typeof loadRadialTerrain>[0];
const datasetGroups = ['observations', 'scientific', 'observedColors', 'shapeViews', 'surfaceObservations'] as const;
interface ModelConfig {
  namespace: string;
  geometry: {radius: number; radiusKm: number; radialTerrain?: unknown; radialTerrainAlternatives?: (Record<string, unknown> & {datasetId: string; additionalDatasetIds?: string[]; display?: unknown})[]};
  presentation: {defaultDataset: string};
  raster: Partial<Record<typeof datasetGroups[number], {id: string}[]>>;
}
export interface LoadedRadialModel {
  id: string;
  datasetIds: string[];
  radial: RadialState;
  config: ModelConfig;
  /** The models some of these datasets are read from while they draw on this mesh (`display: "body-mesh"`), by dataset. */
  sampling?: Map<string, {grid: RadialState['grid']; config: ModelConfig}>;
}
interface CombinedRadial {faces: RadialState['faces']; leaves: RadialState['leaves']; datasetRanges?: {datasetId: string; start: number; count: number}[];}

/** Separate source meshes share a physical scale and one retained scene. */
export async function loadRadialModels<T extends ModelConfig>(context: Omit<TerrainContext, 'config'> & {config: T}) {
  const { config } = context;
  const alternatives = config.geometry.radialTerrainAlternatives ?? [];
  if (!Array.isArray(alternatives) || alternatives.length > 7) throw new TypeError('Invalid alternative surface models.');
  if (!config.geometry.radialTerrain && !alternatives.length) return [];
  const datasets = datasetGroups
    .flatMap(key => (config.raster[key] ?? []).map(dataset => dataset.id));
  // The body's mesh is named after the default dataset. A default that draws on another model's mesh leaves the body's
  // mesh named after its shape view, or its first dataset.
  const alternativeIds = alternatives.flatMap(alternativeDatasetIds), own = datasets.filter(id => !alternativeIds.includes(id));
  const bodyId = alternativeIds.includes(config.presentation.defaultDataset)
    ? (config.raster.shapeViews ?? []).map(dataset => dataset.id).find(id => own.includes(id)) ?? own[0]
    : config.presentation.defaultDataset;
  if (bodyId === undefined) throw new TypeError('Invalid alternative surface models.');
  const ids = [bodyId, ...alternativeIds];
  if (new Set(ids).size !== ids.length ||
      ids.some(id => !/^[a-z][a-z0-9-]*$/.test(id) || !datasets.includes(id)) ||
      alternatives.length && !config.geometry.radialTerrain) throw new TypeError('Invalid alternative surface models.');
  const base = await loadRadialTerrain(context);
  if (!base) return [];
  const sampling = new Map<string, {grid: RadialState['grid']; config: T}>();
  const models: {id: string; datasetIds: string[]; radial: typeof base; config: T; sampling?: typeof sampling}[] = [{ id: ids[0], datasetIds: datasets.filter(id => !ids.slice(1).includes(id)), radial: base, config, sampling }];
  for (const { datasetId, additionalDatasetIds: _additional, display, ...profile } of alternatives) {
    if (display !== undefined && display !== 'body-mesh') throw new TypeError('An alternative surface model draws on its own mesh, or on the body\'s with display "body-mesh".');
    const selected = { ...config, geometry: { ...config.geometry, radialTerrain: profile } };
    const radial = await loadRadialTerrain({ ...context, config: selected });
    if (!radial) throw new TypeError('Alternative model lacks its terrain source.');
    const own = alternativeDatasetIds({ datasetId, additionalDatasetIds: _additional });
    // The same body in another published model: its datasets are read from it and drawn on the body's mesh, so a
    // selection never swaps meshes. A second mesh is for a dataset that is itself another shape.
    if (display === 'body-mesh') { models[0]!.datasetIds.push(...own); for (const id of own) sampling.set(id, { grid: radial.grid, config: selected }); continue; }
    models.push({ id: datasetId, datasetIds: own, config: selected, radial });
  }
  return models;
}

export function combineRadialModels(models: Awaited<ReturnType<typeof loadRadialModels>>, namespace: string): CombinedRadial | null {
  if (models.length < 2) return models[0]?.radial ?? null;
  const faces: RadialState['faces'] = [], leaves: RadialState['leaves'] = [], datasetRanges: NonNullable<CombinedRadial['datasetRanges']> = [];
  for (const model of models) {
    const start = faces.length, count = model.radial.faces.length;
    for (const datasetId of model.datasetIds) datasetRanges.push({ datasetId, start, count });
    faces.push(...model.radial.faces);
    leaves.push(...model.radial.leaves.map(leaf => ({ ...leaf,
      attributes: { ...leaf.attributes, 'data-surface-model': model.id },
      style: `${leaf.style};display:var(--${namespace}-${model.id}-display,${model === models[0] ? 'block' : 'none'})` })));
  }
  return { faces, leaves, datasetRanges };
}
