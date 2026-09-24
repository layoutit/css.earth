import type { PreparedTextureLevels } from '../renderers/css/rendering/prepared-texture-levels.js';
import type { PreparedVariant } from '../renderers/css/rendering/prepared-presentation.js';
import { isArray } from '@cssearth/core';
// Shared by offline qualification and the browser's external JSON boundary.
export function requireTextureLevels(value: unknown, variants: readonly Pick<PreparedVariant, 'writes' | 'required'>[], resources: {has(key:string):boolean}): asserts value is PreparedTextureLevels {
  const fail = (): never => { throw new TypeError('Invalid prepared texture levels.'); };
  const record = (value: unknown, fields?: readonly string[]): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || fields && Object.keys(value).some(key => !fields.includes(key))) throw new TypeError('Invalid prepared texture levels.');
    return value as Record<string, unknown>;
  };
  const plan = record(value, ['hysteresis', 'fixedLevel', 'levels']);
  if (typeof plan.hysteresis !== 'number' || !Number.isFinite(plan.hysteresis) || plan.hysteresis < 0 || plan.hysteresis >= 1 ||
      !isArray(plan.levels) || plan.levels.length < 2 || plan.levels.length > 8) throw new TypeError('Invalid prepared texture levels.');
  if (plan.fixedLevel !== undefined && (typeof plan.fixedLevel !== 'number' || !Number.isInteger(plan.fixedLevel) || plan.fixedLevel < 0 || plan.fixedLevel >= plan.levels.length)) fail();
  const textures = new Set(variants.flatMap(variant => variant.writes.filter(write => write.kind === 'texture').map(write => write.resource)));
  let previous = -1; let addresses: string[] | undefined;
  for (const [i, input] of plan.levels.entries()) {
    const level = record(input, ['minimumDiameter', 'resources']);
    if (typeof level.minimumDiameter !== 'number' || !Number.isFinite(level.minimumDiameter) || level.minimumDiameter <= previous || i === 0 && level.minimumDiameter !== 0) throw new TypeError('Invalid prepared texture levels.');
    previous = level.minimumDiameter;
    const mapping = record(level.resources), keys = Object.keys(mapping).sort();
    if (!keys.length || addresses && (keys.length !== addresses.length || keys.some((key, i) => key !== addresses![i]))) throw new TypeError('Invalid prepared texture levels.');
    addresses = keys;
    for (const [source, target] of Object.entries(mapping)) {
      if (!textures.has(source) || !resources.has(source) || typeof target !== 'string' || !resources.has(target)) throw new TypeError('Invalid prepared texture levels.');
      if (variants.some(variant => variant.writes.some(write => write.kind === 'texture' && write.resource === source) && !variant.required.includes(source))) throw new TypeError('Invalid prepared texture levels.');
    }
  }
}
