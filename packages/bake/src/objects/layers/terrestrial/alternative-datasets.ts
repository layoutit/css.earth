/** An alternative mesh is named by its first dataset; further datasets that describe the same body frame may share it. */
export function alternativeDatasetIds(model: {datasetId?: unknown; additionalDatasetIds?: unknown}): string[] {
  const extra = model.additionalDatasetIds ?? [];
  if (typeof model.datasetId !== 'string' || !Array.isArray(extra) || extra.some(id => typeof id !== 'string')) throw new TypeError('Invalid alternative surface model datasets.');
  return [model.datasetId, ...extra as string[]];
}
export function alternativeForDataset<T extends {datasetId?: unknown; additionalDatasetIds?: unknown}>(alternatives: readonly T[], datasetId: string): T | undefined {
  return alternatives.find(model => alternativeDatasetIds(model).includes(datasetId));
}

/** A dataset owns one source mesh.  Alternative meshes are never a fallback for
 * another dataset: sampling and its source-distance limit must use this same model. */
export function radialModelForDataset<T extends {datasetIds: readonly string[]}>(models: readonly T[], datasetId: string): T {
  const model = models.find(candidate => candidate.datasetIds.includes(datasetId));
  if (!model) throw new TypeError(`Dataset ${datasetId} has no radial model.`);
  return model;
}

/** Return the declared mesh profile for a dataset before terrain is loaded, so
 * profile validation applies each observation's transfer limit to its owner. */
export function radialTerrainForDataset(config: {geometry: {radialTerrain?: unknown; radialTerrainAlternatives?: {datasetId: string; additionalDatasetIds?: string[]}[]}}, datasetId: string) {
  const alternative = alternativeForDataset(config.geometry.radialTerrainAlternatives ?? [], datasetId);
  if (!alternative) return config.geometry.radialTerrain;
  const { datasetId: _datasetId, additionalDatasetIds: _additional, ...terrain } = alternative;
  return terrain;
}
