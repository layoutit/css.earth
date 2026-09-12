import type { PreparedTextureLevels } from '../../rendering/prepared-texture-levels.js';
import type { PreparedResourceEntry } from '../../rendering/prepared-residency.js';
import type { Lens, TextureLevelProfile } from './types.js';

export interface SurfaceTextureLevels {
  textureLevels: PreparedTextureLevels;
  /** Resource entries for one exterior lens, lowest level first. */
  entries(lens: Lens, pool: string): PreparedResourceEntry[];
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

/**
 * Silhouette-driven levels for the prepared surface maps of a retained globe.
 * The raster recipe writes every lens at densities 1 and 2 with the same atlas
 * layout, and the leaves size backgrounds in CSS pixels, so a level changes
 * only the prepared URL. Nothing is resampled here or at runtime.
 *
 * Thresholds follow Earth's rule (texels per CSS pixel of the projected disc).
 * A disc d CSS pixels across shows half the equator, so at its centre a map
 * W texels around 360 degrees gives W / (pi * d) texels per CSS pixel. The next
 * level is needed once the current one would give fewer than the authored
 * texelsPerCssPixel: d >= W / (pi * texelsPerCssPixel). Device DPR is not an input.
 */
export function prepareSurfaceTextureLevels(profile: TextureLevelProfile, lenses: readonly Lens[], surfaceWidth: unknown): SurfaceTextureLevels {
  const { hysteresis, texelsPerCssPixel } = parseTextureLevelProfile(profile);
  if (typeof surfaceWidth !== 'number' || !Number.isSafeInteger(surfaceWidth) || surfaceWidth < 1) throw new TypeError('Surface texture levels need the prepared surface width.');
  const widths = [surfaceWidth, 2 * surfaceWidth];
  const levels = widths.map((_, i) => ({ minimumDiameter: i ? widths[i - 1] / (Math.PI * texelsPerCssPixel) : 0, resources: {} as Record<string, string> }));
  const exterior = lenses.filter(lens => lens.view === 'exterior');
  if (!exterior.length) throw new TypeError('Surface texture levels need an exterior lens.');
  const urls = new Map<string, string[]>();
  for (const lens of exterior) {
    const addresses = [lens.surfaceUrl, lens.surface2xUrl];
    if (addresses.some(url => typeof url !== 'string' || !url.startsWith('/scenes/')) || addresses[0] === addresses[1]) {
      throw new TypeError(`Lens ${lens.id} needs prepared density 1 and 2 surfaces for texture levels.`);
    }
    const key = `surface:${lens.id}`;
    const keys = widths.map((width, i) => i === widths.length - 1 ? key : `${key}:level:${width}`);
    keys.forEach((resource, i) => { levels[i].resources[key] = resource; });
    urls.set(lens.id, addresses as string[]);
  }
  return {
    textureLevels: { hysteresis, levels },
    entries(lens, pool) {
      const addresses = urls.get(lens.id);
      if (!addresses) throw new TypeError(`Lens ${lens.id} has no prepared texture levels.`);
      return addresses.map((url, i) => ({ key: levels[i].resources[`surface:${lens.id}`], url, pool }));
    },
  };
}
