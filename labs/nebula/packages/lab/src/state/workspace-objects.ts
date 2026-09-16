/** Hide derived views only when their actual base workspace is present. */
export function workspaceObjects<T extends { id: string; sourceSubjectId?: string }>(objects: readonly T[]): T[] {
  const ids = new Set(objects.map(object => object.id));
  return objects.filter(object => !object.sourceSubjectId || !ids.has(object.sourceSubjectId));
}
