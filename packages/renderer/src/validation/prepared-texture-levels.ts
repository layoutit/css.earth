import type { PreparedTextureLevels, PreparedTexturePlacements, PreparedTextureTileLeaves } from '../rendering/prepared-texture-levels.js';
import type { PreparedVariant } from '../rendering/prepared-presentation.js';
import { isArray } from '@cssearth/core';
// Shared by offline qualification and the browser's external JSON boundary.
export function requireTextureLevels(value: unknown, variants: readonly Pick<PreparedVariant, 'writes' | 'required'>[], resources: {has(key:string):boolean}): asserts value is PreparedTextureLevels {
  const fail = (): never => { throw new TypeError('Invalid prepared texture levels.'); };
  const record = (value: unknown, fields?: readonly string[]): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || fields && Object.keys(value).some(key => !fields.includes(key))) throw new TypeError('Invalid prepared texture levels.');
    return value as Record<string, unknown>;
  };
  const plan = record(value, ['hysteresis', 'fixedLevel', 'levels', 'placements', 'tileLeaves']);
  if (typeof plan.hysteresis !== 'number' || !Number.isFinite(plan.hysteresis) || plan.hysteresis < 0 || plan.hysteresis >= 1 ||
      !isArray(plan.levels) || plan.levels.length < 2 || plan.levels.length > 8) throw new TypeError('Invalid prepared texture levels.');
  if (plan.fixedLevel !== undefined && (typeof plan.fixedLevel !== 'number' || !Number.isInteger(plan.fixedLevel) || plan.fixedLevel < 0 || plan.fixedLevel >= plan.levels.length)) fail();
  // One pass over the variants: the textures they write, their write names, and the textures some variant writes
  // without requiring. Each mapping entry below is then answered by lookup, not by rescanning every variant's writes.
  const textures = new Set<string | null>(), names = new Set<string>(), unrequired = new Set<string>();
  for (const variant of variants) {
    const required = new Set(variant.required);
    for (const write of variant.writes) if (write.kind === 'texture') {
      textures.add(write.resource); names.add(write.name);
      if (write.resource !== null && !required.has(write.resource)) unrequired.add(write.resource);
    }
  }
  if (plan.placements !== undefined) requireTexturePlacements(plan.placements, name => names.has(name));
  if (plan.tileLeaves !== undefined) requireTextureTileLeaves(plan.tileLeaves, variants);
  let previous = -1; let addresses: string[] | undefined;
  for (const [i, input] of plan.levels.entries()) {
    const level = record(input, ['minimumDiameter', 'resources', 'tiles']);
    if (typeof level.minimumDiameter !== 'number' || !Number.isFinite(level.minimumDiameter) || level.minimumDiameter <= previous || i === 0 && level.minimumDiameter !== 0) throw new TypeError('Invalid prepared texture levels.');
    previous = level.minimumDiameter;
    const mapping = record(level.resources), keys = Object.keys(mapping).sort();
    if (!keys.length || addresses && (keys.length !== addresses.length || keys.some((key, i) => key !== addresses![i]))) throw new TypeError('Invalid prepared texture levels.');
    addresses = keys;
    for (const [source, target] of Object.entries(mapping)) {
      if (!textures.has(source) || !resources.has(source) || typeof target !== 'string' || !resources.has(target)) throw new TypeError('Invalid prepared texture levels.');
      if (unrequired.has(source)) throw new TypeError('Invalid prepared texture levels.');
    }
    // A sheet tile: the page's offset in the sheet and the sheet's width over the page's, for a page this level maps.
    if (level.tiles !== undefined) for (const [source, input] of Object.entries(record(level.tiles))) {
      const tile = record(input, ['x', 'y', 'scale']);
      if (!(source in mapping) || ![tile.x, tile.y, tile.scale].every(value => typeof value === 'number' && Number.isFinite(value)) ||
        (tile.x as number) < 0 || (tile.y as number) < 0 || !((tile.scale as number) >= 1)) throw new TypeError(`Invalid prepared texture tile ${source}: ${JSON.stringify(input)}.`);
    }
  }
}

/** Tiled page leaves (PreparedTextureTileLeaves): one group per texture write, each leaf once. */
export function requireTextureTileLeaves(value: unknown, variants: readonly Pick<PreparedVariant, 'writes'>[]): asserts value is readonly PreparedTextureTileLeaves[] {
  const shown = (value: unknown) => JSON.stringify(value)?.slice(0, 160) ?? String(value);
  const fail = (reason: string): never => { throw new TypeError(`Invalid prepared texture tile leaves: ${reason}.`); };
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  if (!isArray(value)) fail(`tileLeaves is ${shown(value)}, not an array`);
  const writes = new Set(variants.flatMap(variant => variant.writes.flatMap(write => write.kind === 'texture' ? [`${write.target}:${write.name}`] : [])));
  const groups = new Set<string>(), leaves = new Set<number>();
  for (const input of value as unknown[]) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail(`group ${shown(input)} is not a record`);
    const group = input as Record<string, unknown>, key = `${String(group.target)}:${String(group.name)}`;
    const extra = Object.keys(group).filter(name => !['target', 'name', 'unit', 'width', 'initial', 'leaves'].includes(name));
    if (extra.length) fail(`group ${key} has unknown fields ${extra.join(', ')}`);
    if (!writes.has(key) || groups.has(key)) fail(`group ${key} is not one texture write, once`);
    groups.add(key);
    if (!finite(group.unit) || group.unit === 0 || !finite(group.width) || !(group.width > 0)) fail(`group ${key} has unit ${shown(group.unit)} and width ${shown(group.width)}`);
    if (group.initial !== undefined) {
      const tile = group.initial as Record<string, unknown> | null;
      if (!tile || typeof tile !== 'object' || Object.keys(tile).some(name => !['x', 'y', 'scale'].includes(name)) ||
        ![tile.x, tile.y, tile.scale].every(finite) || !((tile.scale as number) >= 1)) fail(`group ${key} has initial tile ${shown(tile)}`);
    }
    if (!isArray(group.leaves) || !group.leaves.length) fail(`group ${key} has no leaves`);
    for (const leaf of group.leaves as unknown[]) {
      const node = isArray(leaf) && leaf.length === 3 && finite(leaf[1]) && finite(leaf[2]) ? leaf[0] : undefined;
      if (typeof node !== 'number' || !Number.isInteger(node) || node < 0 || leaves.has(node)) fail(`group ${key} has leaf ${shown(leaf)}`);
      else leaves.add(node);
    }
  }
}

/** Where the faces behind each named write sit (PreparedTexturePlacements): texture pages that keep their first level,
 * or leaf-box blocks that keep their first step, while the camera cannot see them. `accepts` names the writes. */
export function requireTexturePlacements(value: unknown, accepts: (name: string) => boolean): asserts value is PreparedTexturePlacements {
  const fail = (reason: string): never => { throw new TypeError(`Invalid prepared texture placements: ${reason}.`); };
  const shown = (value: unknown) => JSON.stringify(value)?.slice(0, 160) ?? String(value);
  const record = (value: unknown, label: string, fields?: readonly string[]): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} is ${shown(value)}, not a record`);
    const extra = fields ? Object.keys(value as object).filter(key => !fields.includes(key)) : [];
    if (extra.length) fail(`${label} has unknown field${extra.length > 1 ? 's' : ''} ${extra.join(', ')}`);
    return value as Record<string, unknown>;
  };
  const placements = record(value, 'placements', ['body', 'writes']), body = record(placements.body, 'body', ['center', 'radius']);
  const point = (value: unknown) => isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item));
  const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
  if (!point(body.center)) fail(`body center is ${shown(body.center)}`);
  if (!positive(body.radius)) fail(`body radius is ${shown(body.radius)}`);
  const writes = record(placements.writes, 'writes');
  if (!Object.keys(writes).length) fail('writes is empty');
  for (const [name, input] of Object.entries(writes)) {
    const write = record(input, `write ${name}`, ['center', 'radius', 'normal', 'spread']);
    const normal = write.normal as number[];
    if (!accepts(name)) fail(`write ${name} is not one this binding publishes`);
    if (!point(write.center) || !positive(write.radius)) fail(`write ${name} has center ${shown(write.center)} and radius ${shown(write.radius)}`);
    if (!point(normal) || Math.abs(Math.hypot(...normal) - 1) > 1e-3) fail(`write ${name} has normal ${shown(normal)}, not a unit vector`);
    if (typeof write.spread !== 'number' || !(write.spread >= 0 && write.spread <= Math.PI)) fail(`write ${name} has spread ${shown(write.spread)}`);
  }
}
