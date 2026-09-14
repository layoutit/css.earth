import type { PreparedGalaxyCatalog } from '@cssearth/catalog';

/** Stratified sampling preserves sparse outskirts and gives dense cells more representatives.
 * Every output identity retains its catalogue position and measurement references. */
export function prepareGalaxyDisplaySample(catalog: PreparedGalaxyCatalog) {
  const rows = catalog.objects.filter(row => row.membership.group === 'local-group' && !row.detailedObjectId);
  const cellSizeM = 150_000 * 3.085677581491367e16;
  const cells = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.positionM.map(value => Math.floor(value / cellSizeM)).join(',');
    const cell = cells.get(key) ?? []; cell.push(row); cells.set(key, cell);
  }
  for (const cell of cells.values()) cell.sort((a, b) => a.id.localeCompare(b.id));
  const selected: string[] = [], used = new Map<string, number>();
  while (selected.length < Math.min(48, rows.length)) {
    const next = [...cells].filter(([key, cell]) => (used.get(key) ?? 0) < cell.length)
      .sort(([ak, a], [bk, b]) => Math.sqrt(b.length) / (1 + (used.get(bk) ?? 0)) - Math.sqrt(a.length) / (1 + (used.get(ak) ?? 0)) || ak.localeCompare(bk))[0];
    if (!next) break;
    const [key, cell] = next, index = used.get(key) ?? 0;
    selected.push(cell[index]!.id); used.set(key, index + 1);
  }
  return { schema: 'cssearth-galaxy-display-sample@1', ids: selected, budget: 48, cellSizeM,
    method: 'Deterministic spatial-cell sampling weighted by square-root catalogue counts; unmodified catalogue positions. Display density is not mass density.' };
}
