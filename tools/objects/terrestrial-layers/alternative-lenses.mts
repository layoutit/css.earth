/** An alternative mesh is named by its first lens; further lenses that describe the same body frame may share it. */
export function alternativeLensIds(model: {lensId?: unknown; additionalLensIds?: unknown}): string[] {
  const extra = model.additionalLensIds ?? [];
  if (typeof model.lensId !== 'string' || !Array.isArray(extra) || extra.some(id => typeof id !== 'string')) throw new TypeError('Invalid alternative surface model lenses.');
  return [model.lensId, ...extra as string[]];
}
export function alternativeForLens<T extends {lensId?: unknown; additionalLensIds?: unknown}>(alternatives: readonly T[], lensId: string): T | undefined {
  return alternatives.find(model => alternativeLensIds(model).includes(lensId));
}
