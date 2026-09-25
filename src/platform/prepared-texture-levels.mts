import type { PreparedTextureLevels, PreparedTexturePlacements } from '../renderers/css/rendering/prepared-texture-levels.js';
import type { PreparedVariant } from '../renderers/css/rendering/prepared-presentation.js';
import { isArray } from '@cssearth/core';
// Shared by offline qualification and the browser's external JSON boundary.
export function requireTextureLevels(value: unknown, variants: readonly Pick<PreparedVariant, 'writes' | 'required'>[], resources: {has(key:string):boolean}): asserts value is PreparedTextureLevels {
  const fail = (): never => { throw new TypeError('Invalid prepared texture levels.'); };
  const record = (value: unknown, fields?: readonly string[]): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || fields && Object.keys(value).some(key => !fields.includes(key))) throw new TypeError('Invalid prepared texture levels.');
    return value as Record<string, unknown>;
  };
  const plan = record(value, ['hysteresis', 'fixedLevel', 'levels', 'placements']);
  if (typeof plan.hysteresis !== 'number' || !Number.isFinite(plan.hysteresis) || plan.hysteresis < 0 || plan.hysteresis >= 1 ||
      !isArray(plan.levels) || plan.levels.length < 2 || plan.levels.length > 8) throw new TypeError('Invalid prepared texture levels.');
  if (plan.fixedLevel !== undefined && (typeof plan.fixedLevel !== 'number' || !Number.isInteger(plan.fixedLevel) || plan.fixedLevel < 0 || plan.fixedLevel >= plan.levels.length)) fail();
  const textures = new Set(variants.flatMap(variant => variant.writes.filter(write => write.kind === 'texture').map(write => write.resource)));
  if (plan.placements !== undefined) {
    const names = new Set(variants.flatMap(variant => variant.writes.filter(write => write.kind === 'texture').map(write => write.name)));
    requireTexturePlacements(plan.placements, name => names.has(name));
  }
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

/** Where the faces behind each named write sit (PreparedTexturePlacements): texture pages that keep their first level,
 * or leaf-box blocks that keep their first step, while the camera cannot see them. `accepts` names the writes. */
export function requireTexturePlacements(value: unknown, accepts: (name: string) => boolean): asserts value is PreparedTexturePlacements {
  const fail = (name = ''): never => { throw new TypeError(`Invalid prepared texture placement${name ? ` ${name}` : 's'}.`); };
  const record = (value: unknown, fields?: readonly string[]): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || fields && Object.keys(value).some(key => !fields.includes(key))) fail();
    return value as Record<string, unknown>;
  };
  const placements = record(value, ['body', 'writes']), body = record(placements.body, ['center', 'radius']);
  const point = (value: unknown) => isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item));
  const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
  if (!point(body.center) || !positive(body.radius)) fail();
  const writes = record(placements.writes);
  if (!Object.keys(writes).length) fail();
  for (const [name, input] of Object.entries(writes)) {
    const write = record(input, ['center', 'radius', 'normal', 'spread']);
    const normal = write.normal as number[];
    if (!accepts(name) || !point(write.center) || !positive(write.radius) || !point(normal) || Math.abs(Math.hypot(...normal) - 1) > 1e-3 ||
        typeof write.spread !== 'number' || !(write.spread >= 0 && write.spread <= Math.PI)) fail(name);
  }
}
