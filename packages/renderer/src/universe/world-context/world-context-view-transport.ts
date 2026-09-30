import type { WorldBodyPresentation, WorldContextView } from './world-context-planner.js';

/** A view whose bodies are already columns (packWorldBodies): the retained world context packs its bodies straight from
 * their own state, so a frame builds no object per body. */
export type PackedWorldContextView = Omit<WorldContextView, 'bodies'> & { readonly bodyColumns: Float64Array };

/** Per-body presentation crosses the worker boundary as one transferred column
 * block instead of hundreds of structured-cloned objects every frame. Optional
 * flags keep their absence (NaN), so the worker rebuilds the exact objects. */
const FIELDS = 15;
const flag = (value: boolean | undefined) => value === undefined ? Number.NaN : value ? 1 : 0;
const optional = (value: number) => Number.isNaN(value) ? undefined : value === 1;

export function packWorldBodies(bodies: readonly WorldBodyPresentation[]): Float64Array {
  const values = new Float64Array(bodies.length * FIELDS);
  for (let index = 0, offset = 0; index < bodies.length; index++, offset += FIELDS) {
    const body = bodies[index]!;
    values[offset] = flag(body.hovered); values[offset + 1] = flag(body.bodyHidden); values[offset + 2] = flag(body.orbitHidden);
    values[offset + 3] = flag(body.labelHidden); values[offset + 4] = flag(body.labelSuppressed); values[offset + 5] = flag(body.indicatorHidden);
    values[offset + 6] = body.labelSize.width; values[offset + 7] = body.labelSize.height; values[offset + 8] = flag(body.labelShown);
    values[offset + 9] = body.labelPlacement; values[offset + 10] = flag(body.indicatorShown); values[offset + 11] = body.indicatorRadius;
    values[offset + 12] = body.orbitAppearance.width; values[offset + 13] = body.orbitAppearance.opacity;
    values[offset + 14] = flag(body.highlighted);
  }
  return values;
}

/** A block of columns for `count` bodies, in `packWorldBodies`'s layout. */
export const createWorldBodyColumns = (count: number) => new Float64Array(count * FIELDS);

/** Back an entry's presentation fields with its row of `columns`, in `packWorldBodies`'s layout: a write to any of them
 * lands in the row at once, so a frame sends the columns as they stand (one copy) instead of reading every body. A field
 * object (`labelSize`, `orbitAppearance`) is replaced, never changed in place. */
export function bindWorldBodyColumns<T extends WorldBodyPresentation>(entry: T, columns: Float64Array, index: number): T {
  const offset = index * FIELDS, target = entry as unknown as Record<string, unknown>;
  const bind = (key: keyof WorldBodyPresentation, write: (value: unknown) => void) => {
    let value = target[key];
    write(value);
    Object.defineProperty(target, key, { enumerable: true, configurable: true, get: () => value, set(next: unknown) { value = next; write(next); } });
  };
  const flagAt = (slot: number) => (value: unknown) => { columns[offset + slot] = flag(value as boolean | undefined); };
  const numberAt = (slot: number) => (value: unknown) => { columns[offset + slot] = value as number; };
  bind('hovered', flagAt(0)); bind('bodyHidden', flagAt(1)); bind('orbitHidden', flagAt(2)); bind('labelHidden', flagAt(3));
  bind('labelSuppressed', flagAt(4)); bind('indicatorHidden', flagAt(5));
  bind('labelSize', value => { const size = value as WorldBodyPresentation['labelSize']; columns[offset + 6] = size.width; columns[offset + 7] = size.height; });
  bind('labelShown', flagAt(8)); bind('labelPlacement', numberAt(9)); bind('indicatorShown', flagAt(10)); bind('indicatorRadius', numberAt(11));
  bind('orbitAppearance', value => { const line = value as WorldBodyPresentation['orbitAppearance']; columns[offset + 12] = line.width; columns[offset + 13] = line.opacity; });
  bind('highlighted', flagAt(14));
  return entry;
}

export function unpackWorldBodies(values: Float64Array): WorldBodyPresentation[] {
  if (values.length % FIELDS !== 0) throw new TypeError('World body presentation columns are malformed.');
  const bodies: WorldBodyPresentation[] = [];
  for (let offset = 0; offset < values.length; offset += FIELDS) {
    const body: WorldBodyPresentation = {
      hovered: values[offset] === 1, orbitHidden: values[offset + 2] === 1, labelHidden: values[offset + 3] === 1,
      labelSize: { width: values[offset + 6]!, height: values[offset + 7]! },
      labelShown: values[offset + 8] === 1, labelPlacement: values[offset + 9]!,
      indicatorShown: values[offset + 10] === 1, indicatorRadius: values[offset + 11]!,
      orbitAppearance: { width: values[offset + 12]!, opacity: values[offset + 13]! },
    };
    const bodyHidden = optional(values[offset + 1]!), labelSuppressed = optional(values[offset + 4]!), indicatorHidden = optional(values[offset + 5]!);
    if (bodyHidden !== undefined) body.bodyHidden = bodyHidden;
    if (labelSuppressed !== undefined) body.labelSuppressed = labelSuppressed;
    if (indicatorHidden !== undefined) body.indicatorHidden = indicatorHidden;
    const highlighted = optional(values[offset + 14]!);
    if (highlighted !== undefined) body.highlighted = highlighted;
    bodies.push(body);
  }
  return bodies;
}
