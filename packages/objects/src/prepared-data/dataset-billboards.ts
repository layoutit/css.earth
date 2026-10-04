import { array, finite, positive, record, text } from './runtime-validation/guards.js';

export const DATASET_BILLBOARDS_SCHEMA = 'cssearth-dataset-billboards@2';

type Vector = readonly [number, number, number];
/** One impostor view that faces the Sun, as an image of its own. */
export interface DatasetBillboardView { readonly radiusUnits: number; readonly back: Vector; readonly right: Vector; readonly down: Vector }
/** What the universe knows about a volume dataset bank before fetching its datasets: prepared by
 * `pnpm prepare:dataset-billboards` from the bank's prepared payload. */
export interface DatasetBankBillboard {
  readonly id: string;
  readonly contextVisibility: 'galactic' | 'independent';
  /** A cloud that accompanies a body stays dark until that body's dataset asks for it. */
  readonly attached: boolean;
  /** A volume bank's authored framing radius, in its frame's units: its caption hangs under this sphere. */
  readonly framingRadiusUnits?: number;
  /** The default dataset's impostor view that faces the Sun: an image of its own, named by the bank's id. */
  readonly billboard?: DatasetBillboardView;
  /** The dataset `billboard` pictures. A bank with one dataset leaves it out. */
  readonly defaultDataset?: string;
  /** The same view of each other dataset that has prepared impostors, by dataset id: an image named by the bank's id and
   * the dataset's. A billboard stands for the dataset that is selected; a selected dataset with no view draws none. */
  readonly datasets?: ReadonlyMap<string, DatasetBillboardView>;
}
export interface DatasetBillboards {
  /** The edge of every billboard image, in pixels. */
  readonly imagePx: number;
  readonly banks: ReadonlyMap<string, DatasetBankBillboard>;
}

const vector = (value: unknown, label: string): Vector => {
  const values = array(value, label);
  if (values.length !== 3) throw new TypeError(`${label} must have three components.`);
  return Object.freeze(values.map(item => finite(item, label))) as unknown as Vector;
};
const view = (input: Record<string, unknown>): DatasetBillboardView => Object.freeze({ radiusUnits: positive(input.radiusUnits, 'dataset billboard radius'),
  back: vector(input.back, 'dataset billboard back'), right: vector(input.right, 'dataset billboard right'), down: vector(input.down, 'dataset billboard down') });
export function parseDatasetBillboards(value: unknown): DatasetBillboards {
  const input = record(value, 'dataset billboards', ['schema', 'imagePx', 'banks']);
  if (input.schema !== DATASET_BILLBOARDS_SCHEMA) throw new TypeError('Unsupported dataset billboards.');
  const imagePx = positive(input.imagePx, 'dataset billboard image size');
  const banks = new Map<string, DatasetBankBillboard>();
  for (const value of array(input.banks, 'dataset billboard banks')) {
    const bank = record(value, 'dataset billboard bank', ['id', 'contextVisibility', 'attached', 'framingRadiusUnits', 'billboard', 'defaultDataset', 'datasets']);
    const id = text(bank.id, 'dataset billboard bank id');
    if (banks.has(id)) throw new TypeError(`Dataset billboard bank ${id} is listed twice.`);
    if (bank.contextVisibility !== 'galactic' && bank.contextVisibility !== 'independent') throw new TypeError('Unsupported dataset context visibility.');
    if (typeof bank.attached !== 'boolean') throw new TypeError('Dataset billboard bank must state whether it is attached.');
    const billboard = bank.billboard === undefined ? undefined : view(record(bank.billboard, 'dataset billboard', ['radiusUnits', 'back', 'right', 'down']));
    let defaultDataset: string | undefined, datasets: Map<string, DatasetBillboardView> | undefined;
    if (bank.datasets !== undefined) {
      defaultDataset = text(bank.defaultDataset, `${id} default dataset`);
      datasets = new Map();
      for (const value of array(bank.datasets, `${id} dataset billboards`)) {
        const input = record(value, 'dataset billboard', ['id', 'radiusUnits', 'back', 'right', 'down']), dataset = text(input.id, `${id} dataset id`);
        if (dataset === defaultDataset || datasets.has(dataset)) throw new TypeError(`Dataset billboard ${id} lists ${dataset} twice.`);
        datasets.set(dataset, view(input));
      }
    } else if (bank.defaultDataset !== undefined) throw new TypeError(`Dataset billboard bank ${id} names a default dataset without other datasets.`);
    const framingRadiusUnits = bank.framingRadiusUnits === undefined ? undefined : positive(bank.framingRadiusUnits, 'dataset billboard framing radius');
    banks.set(id, Object.freeze({ id, contextVisibility: bank.contextVisibility, attached: bank.attached,
      ...(framingRadiusUnits === undefined ? {} : { framingRadiusUnits }), ...(billboard ? { billboard } : {}),
      ...(datasets ? { defaultDataset, datasets } : {}) }));
  }
  return Object.freeze({ imagePx, banks });
}
