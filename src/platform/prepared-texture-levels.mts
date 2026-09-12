import type { PreparedTextureLevels } from '../renderers/css/rendering/prepared-texture-levels.js';
import type { PreparedVariant } from '../renderers/css/rendering/prepared-presentation.js';
import type { PreparedResourceEntry } from '../renderers/css/rendering/prepared-residency.js';
import { isArray } from './is-array.mts';

/** Authored silhouette rule for prepared layer levels. */
export interface TextureLevelProfile { hysteresis: number; texelsPerCssPixel: number }
/** Every body levels its layers by this rule unless its profile declines them.
 * Two texels per CSS pixel of the projected disc, with a fifth of hysteresis. */
export const DEFAULT_TEXTURE_LEVELS: TextureLevelProfile = Object.freeze({ hysteresis: 0.2, texelsPerCssPixel: 2 });
// Shared by offline qualification and the browser's external JSON boundary.
export function requireTextureLevels(value: unknown, variants: readonly Pick<PreparedVariant, 'writes' | 'required'>[], resources: {has(key:string):boolean}): asserts value is PreparedTextureLevels {
  const fail = (): never => { throw new TypeError('Invalid prepared texture levels.'); };
  const record = (value: unknown, fields?: readonly string[]): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || fields && Object.keys(value).some(key => !fields.includes(key))) throw new TypeError('Invalid prepared texture levels.');
    return value as Record<string, unknown>;
  };
  const plan = record(value, ['hysteresis', 'levels']);
  if (typeof plan.hysteresis !== 'number' || !Number.isFinite(plan.hysteresis) || plan.hysteresis < 0 || plan.hysteresis >= 1 ||
      !isArray(plan.levels) || plan.levels.length < 2 || plan.levels.length > 8) throw new TypeError('Invalid prepared texture levels.');
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
      if (i === plan.levels.length - 1 && target !== source) throw new TypeError('Invalid prepared texture levels.');
      if (variants.some(variant => variant.writes.some(write => write.kind === 'texture' && write.resource === source) && !variant.required.includes(source))) throw new TypeError('Invalid prepared texture levels.');
    }
  }
}


/** One prepared layer offered for levelling: its resource key, the pool it loads
 * in, its prepared densities and the texel width of the lower one. A layer the
 * raster recipe wrote at one density only has no `two` and stays a single
 * resource, as does one whose width its recipe does not record. */
export interface LevelledTexture { key: string; pool: string; one: string; two?: string | undefined; width?: number | undefined }

export interface PreparedLayerLevels {
  textureLevels: PreparedTextureLevels;
  /** Both densities of every levelled layer, plus the single entry of the rest. */
  entries: PreparedResourceEntry[];
  /** The resource a mount and its startup set use; identity for an unlevelled key. */
  initialResource(key: string): string;
}

export function parseTextureLevelProfile(value: unknown): TextureLevelProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Texture level profile must be an object.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => key !== 'hysteresis' && key !== 'texelsPerCssPixel') ||
      typeof input.hysteresis !== 'number' || !(input.hysteresis >= 0 && input.hysteresis < 1) ||
      typeof input.texelsPerCssPixel !== 'number' || !Number.isFinite(input.texelsPerCssPixel) || input.texelsPerCssPixel < 1) {
    throw new TypeError('Invalid texture level profile.');
  }
  return { hysteresis: input.hysteresis, texelsPerCssPixel: input.texelsPerCssPixel };
}

/** The lower-density twin of a levelled layer, named by the density-1 surface
 * width that governs the switch for the whole body. */
export const levelledResourceKey = (key: string, width: number) => `${key}:level:${width}`;

/**
 * Silhouette-driven levels for every prepared layer of a retained body that the
 * raster recipe wrote at both densities. The recipe uses one atlas layout per
 * density and the leaves size backgrounds in CSS pixels, so a level changes only
 * the prepared URL. Nothing is resampled here or at runtime.
 *
 * One threshold governs the whole body, from the surface map that covers the
 * whole disc: a disc d CSS pixels across shows half the equator, so a map W
 * texels around 360 degrees gives W / (pi * d) texels per CSS pixel at its
 * centre, and the higher density is needed once the lower one would give fewer
 * than the authored `texelsPerCssPixel`: d >= W / (pi * texelsPerCssPixel).
 * Device pixel ratio is never an input.
 *
 * The other layers of a body ride that switch rather than carrying thresholds of
 * their own. They come from the same recipe over the same geometry, so at the
 * surface's threshold they land near the same authored density: measured across
 * the ringed giants, a body switching at its surface threshold holds its rings,
 * poles and material layers between 1.6 and 2.8 texels per CSS pixel against an
 * authored 2. A per-layer threshold would need each layer's own mapping of texels
 * to screen, which the prepared transport does not carry.
 */
export function preparePreparedTextureLevels(profile: TextureLevelProfile, thresholdWidth: unknown,
  textures: readonly LevelledTexture[]): PreparedLayerLevels | null {
  const { hysteresis, texelsPerCssPixel } = parseTextureLevelProfile(profile);
  const levelled = textures.filter(texture => typeof texture.two === 'string' && texture.two !== texture.one &&
    typeof texture.width === 'number' && Number.isSafeInteger(texture.width) && texture.width > 0);
  const single = textures.filter(texture => !levelled.includes(texture));
  const entry = (key: string, url: string, pool: string): PreparedResourceEntry => {
    if (typeof url !== 'string' || !url.startsWith('/scenes/')) throw new TypeError(`Prepared layer ${key} needs a prepared address.`);
    return { key, url, pool };
  };
  const plain = [...single.map(texture => entry(texture.key, texture.one, texture.pool))];
  if (!levelled.length) return null;
  if (typeof thresholdWidth !== 'number' || !Number.isSafeInteger(thresholdWidth) || thresholdWidth < 1) {
    throw new TypeError('Prepared texture levels need the density-1 width of the surface map.');
  }
  const resources = Object.fromEntries(levelled.map(texture => [texture.key, levelledResourceKey(texture.key, texture.width!)]));
  const textureLevels: PreparedTextureLevels = { hysteresis, levels: [
    { minimumDiameter: 0, resources },
    // The contract requires the last level to map every key to itself.
    { minimumDiameter: thresholdWidth / (Math.PI * texelsPerCssPixel),
      resources: Object.fromEntries(levelled.map(texture => [texture.key, texture.key])) },
  ] };
  return {
    textureLevels,
    entries: [...plain, ...levelled.flatMap(texture => [
      entry(levelledResourceKey(texture.key, texture.width!), texture.one, texture.pool),
      entry(texture.key, texture.two!, texture.pool),
    ])],
    initialResource: (key: string) => resources[key] ?? key,
  };
}
