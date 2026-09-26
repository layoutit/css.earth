/** An alternative mesh is named by its first lens; further lenses that describe the same body frame may share it. */
export function alternativeLensIds(model: {lensId?: unknown; additionalLensIds?: unknown}): string[] {
  const extra = model.additionalLensIds ?? [];
  if (typeof model.lensId !== 'string' || !Array.isArray(extra) || extra.some(id => typeof id !== 'string')) throw new TypeError('Invalid alternative surface model lenses.');
  return [model.lensId, ...extra as string[]];
}
export function alternativeForLens<T extends {lensId?: unknown; additionalLensIds?: unknown}>(alternatives: readonly T[], lensId: string): T | undefined {
  return alternatives.find(model => alternativeLensIds(model).includes(lensId));
}

/** A lens owns one source mesh.  Alternative meshes are never a fallback for
 * another lens: sampling and its source-distance limit must use this same model. */
export function radialModelForLens<T extends {lensIds: readonly string[]}>(models: readonly T[], lensId: string): T {
  const model = models.find(candidate => candidate.lensIds.includes(lensId));
  if (!model) throw new TypeError(`Lens ${lensId} has no radial model.`);
  return model;
}

/** Return the declared mesh profile for a lens before terrain is loaded, so
 * profile validation applies each observation's transfer limit to its owner. */
export function radialTerrainForLens(config: {geometry: {radialTerrain?: unknown; radialTerrainAlternatives?: {lensId: string; additionalLensIds?: string[]}[]}}, lensId: string) {
  const alternative = alternativeForLens(config.geometry.radialTerrainAlternatives ?? [], lensId);
  if (!alternative) return config.geometry.radialTerrain;
  const { lensId: _lensId, additionalLensIds: _additional, ...terrain } = alternative;
  return terrain;
}
