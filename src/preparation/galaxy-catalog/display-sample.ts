import type { PreparedGalaxyCatalog } from '@cssearth/catalog';
import { M_PER_PC } from '@cssearth/astronomy';
import { keys } from './config.js';
import { requireRecord as record } from '@cssearth/core';

export interface GalaxyDisplaySampling { budget: number; cellSizeMpc: number; }

export function parseGalaxyDisplaySampling(value: unknown): GalaxyDisplaySampling {
  const input = record(value, 'Galaxy display sampling');
  keys(input, ['budget', 'cellSizeMpc'], 'Galaxy display sampling');
  const { budget, cellSizeMpc } = input;
  if (typeof budget !== 'number' || !Number.isSafeInteger(budget) || budget <= 0 ||
      typeof cellSizeMpc !== 'number' || !Number.isFinite(cellSizeMpc) || cellSizeMpc <= 0 ||
      !Number.isFinite(cellSizeMpc * 1e6 * M_PER_PC)) throw new TypeError('Invalid galaxy display sampling parameters.');
  return { budget, cellSizeMpc };
}

/** Stratified sampling balances sparse and dense cells within the declared display budget.
 * Every output identity retains its catalogue position and measurement references. */
export function prepareGalaxyDisplaySample(catalog: PreparedGalaxyCatalog, sampling: GalaxyDisplaySampling) {
  const rows = catalog.objects.filter(row => row.membership.group === 'local-group' && !row.detailedObjectId);
  const cellSizeM = sampling.cellSizeMpc * 1e6 * M_PER_PC;
  const cells = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.positionM.map(value => Math.floor(value / cellSizeM)).join(',');
    const cell = cells.get(key) ?? []; cell.push(row); cells.set(key, cell);
  }
  for (const cell of cells.values()) cell.sort((a, b) => a.id.localeCompare(b.id));
  const selected: string[] = [], used = new Map<string, number>();
  while (selected.length < Math.min(sampling.budget, rows.length)) {
    const next = [...cells].filter(([key, cell]) => (used.get(key) ?? 0) < cell.length)
      .sort(([ak, a], [bk, b]) => Math.sqrt(b.length) / (1 + (used.get(bk) ?? 0)) - Math.sqrt(a.length) / (1 + (used.get(ak) ?? 0)) || ak.localeCompare(bk))[0];
    if (!next) break;
    const [key, cell] = next, index = used.get(key) ?? 0;
    selected.push(cell[index]!.id); used.set(key, index + 1);
  }
  return { schema: 'cssearth-galaxy-display-sample@1', ids: selected, budget: sampling.budget, cellSizeM,
    method: 'Deterministic spatial-cell sampling weighted by square-root catalogue counts; unmodified catalogue positions. Display density is not mass density.' };
}
