import { loadRadialTerrain } from './radial-terrain.mjs';

/** Separate source meshes share a physical scale and one retained scene. */
export async function loadRadialModels(context) {
  const { config } = context;
  const alternatives = config.geometry.radialTerrainAlternatives ?? [];
  if (!Array.isArray(alternatives) || alternatives.length > 7) throw new TypeError('Invalid alternative surface models.');
  if (!config.geometry.radialTerrain && !alternatives.length) return [];
  const ids = [config.presentation.defaultLens, ...alternatives.map(model => model.lensId)];
  const lenses = ['observations', 'scientific', 'mosaics', 'observedColors', 'shapeViews', 'surfaceObservations']
    .flatMap(key => (config.raster[key] ?? []).map(lens => lens.id));
  if (new Set(ids).size !== ids.length ||
      ids.some(id => !/^[a-z][a-z0-9-]*$/.test(id) || !lenses.includes(id)) ||
      alternatives.length && !config.geometry.radialTerrain) throw new TypeError('Invalid alternative surface models.');
  const base = await loadRadialTerrain(context);
  if (!base) return [];
  const models = [{ id: ids[0], lensIds: lenses.filter(id => !ids.slice(1).includes(id)), radial: base, config }];
  for (const { lensId, ...profile } of alternatives) {
    const selected = { ...config, geometry: { ...config.geometry, radialTerrain: profile } };
    models.push({ id: lensId, lensIds: [lensId], config: selected,
      radial: await loadRadialTerrain({ ...context, config: selected }) });
  }
  return models;
}

export function combineRadialModels(models, namespace) {
  if (models.length < 2) return models[0]?.radial ?? null;
  const faces = [], leaves = [], lensRanges = [];
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
