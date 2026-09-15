import type { WorldBodyPresentation } from './world-context-planner.js';

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
