import { array, finite, positive, record, text } from './runtime-validation/guards.js';

export const DATASET_BILLBOARDS_SCHEMA = 'cssearth-dataset-billboards@1';

type Vector = readonly [number, number, number];
/** What the universe knows about a volume dataset bank before fetching its datasets: prepared by
 * `pnpm prepare:dataset-billboards` from the bank's prepared payload. */
export interface DatasetBankBillboard {
  readonly id: string;
  readonly contextVisibility: 'galactic' | 'independent';
  /** A cloud that accompanies a body stays dark until that body's dataset asks for it. */
  readonly attached: boolean;
  /** A volume bank's authored framing radius, in its frame's units: its caption hangs under this sphere. */
  readonly framingRadiusUnits?: number;
  /** The default dataset's impostor view that faces the Sun, as one cell of the shared atlas. */
  readonly billboard?: { readonly cell: number; readonly radiusUnits: number; readonly back: Vector; readonly right: Vector; readonly down: Vector };
}
export interface DatasetBillboards {
  readonly atlas: { readonly columns: number; readonly rows: number; readonly cellPx: number };
  readonly banks: ReadonlyMap<string, DatasetBankBillboard>;
}

const vector = (value: unknown, label: string): Vector => {
  const values = array(value, label);
  if (values.length !== 3) throw new TypeError(`${label} must have three components.`);
  return Object.freeze(values.map(item => finite(item, label))) as unknown as Vector;
};
const count = (value: unknown, label: string) => {
  const number = finite(value, label);
  if (!Number.isSafeInteger(number) || number < 0) throw new TypeError(`${label} must be a non-negative integer.`);
  return number;
};

export function parseDatasetBillboards(value: unknown): DatasetBillboards {
  const input = record(value, 'dataset billboards', ['schema', 'atlas', 'banks']);
  if (input.schema !== DATASET_BILLBOARDS_SCHEMA) throw new TypeError('Unsupported dataset billboards.');
  const atlasInput = record(input.atlas, 'dataset billboard atlas', ['columns', 'rows', 'cellPx']);
  const atlas = Object.freeze({ columns: count(atlasInput.columns, 'atlas columns'), rows: count(atlasInput.rows, 'atlas rows'),
    cellPx: positive(atlasInput.cellPx, 'atlas cell size') });
  if (atlas.columns < 1 || atlas.rows < 1) throw new TypeError(`Dataset billboard atlas needs at least one column and row, not ${atlas.columns} x ${atlas.rows}.`);
  const banks = new Map<string, DatasetBankBillboard>();
  for (const value of array(input.banks, 'dataset billboard banks')) {
    const bank = record(value, 'dataset billboard bank', ['id', 'contextVisibility', 'attached', 'framingRadiusUnits', 'billboard']);
    const id = text(bank.id, 'dataset billboard bank id');
    if (banks.has(id)) throw new TypeError(`Dataset billboard bank ${id} is listed twice.`);
    if (bank.contextVisibility !== 'galactic' && bank.contextVisibility !== 'independent') throw new TypeError('Unsupported dataset context visibility.');
    if (typeof bank.attached !== 'boolean') throw new TypeError('Dataset billboard bank must state whether it is attached.');
    let billboard: DatasetBankBillboard['billboard'];
    if (bank.billboard !== undefined) {
      const input = record(bank.billboard, 'dataset billboard', ['cell', 'radiusUnits', 'back', 'right', 'down']);
      const cell = count(input.cell, 'dataset billboard cell');
      if (cell >= atlas.columns * atlas.rows) throw new TypeError('Dataset billboard cell is outside its atlas.');
      billboard = Object.freeze({ cell, radiusUnits: positive(input.radiusUnits, 'dataset billboard radius'),
        back: vector(input.back, 'dataset billboard back'), right: vector(input.right, 'dataset billboard right'), down: vector(input.down, 'dataset billboard down') });
    }
    const framingRadiusUnits = bank.framingRadiusUnits === undefined ? undefined : positive(bank.framingRadiusUnits, 'dataset billboard framing radius');
    banks.set(id, Object.freeze({ id, contextVisibility: bank.contextVisibility, attached: bank.attached,
      ...(framingRadiusUnits === undefined ? {} : { framingRadiusUnits }), ...(billboard ? { billboard } : {}) }));
  }
  return Object.freeze({ atlas, banks });
}

