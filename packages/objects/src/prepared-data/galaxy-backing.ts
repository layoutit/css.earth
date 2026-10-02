import { parseDensityVolumeFrame, type DensityVolumeFrame } from '../density-volume.js';

export const GALAXY_BACKING_SCHEMA = 'cssearth-galaxy-backing@1';

const LEAF_STYLE = ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition'] as const;
export interface BackingNearFade { readonly nearOpacity: number; readonly fadeM: readonly [number, number] }
export interface PreparedGalaxyBacking {
  readonly id: string; readonly frame: DensityVolumeFrame;
  readonly leaf: { readonly texturePath: string; readonly style: Readonly<Record<(typeof LEAF_STYLE)[number], string>> };
  /** How the whole image dims close up: full beyond `fadeM[0]`, down to `nearOpacity` within `fadeM[1]` (camera distance). */
  readonly nearFade?: BackingNearFade;
  /** Every layer fades out as the camera closes on the galaxy's centre (the frame's origin): whole beyond the first
   * distance, gone within the second. Around the centre the sections keep their near opacity, and the image is a blur. */
  readonly centreFadeM?: readonly [number, number];
  /** Parts of the same image, transparent around them, drawn over it in order, each dimming on its own range. */
  readonly sections?: readonly ({ readonly texturePath: string } & BackingNearFade)[];
}

/** A `cssearth-galaxy-backing@1` bank (packages/bake/cli/prepare-galaxy-backing.mts): one face-on image plane in a galaxy's frame. */
export function parseGalaxyBacking(value: unknown, at = 'galaxy backing'): PreparedGalaxyBacking {
  const data = value as { schema?: unknown; id?: unknown; frame?: unknown; leaf?: { texturePath?: unknown; style?: Record<string, unknown> };
    nearFade?: unknown; centreFadeM?: unknown; sections?: unknown } | null;
  if (!data || data.schema !== GALAXY_BACKING_SCHEMA || typeof data.id !== 'string' || !data.id) throw new TypeError(`${at}: expected a ${GALAXY_BACKING_SCHEMA} bank with an id.`);
  const leaf = data.leaf;
  if (!leaf || typeof leaf.texturePath !== 'string' || !/^[a-z0-9-]+(\/[a-z0-9.-]+)+$/u.test(leaf.texturePath) ||
      !leaf.style || !LEAF_STYLE.every(key => typeof leaf.style![key] === 'string' && leaf.style![key])) {
    throw new TypeError(`${data.id}: the backing leaf needs a texture path and its ${LEAF_STYLE.join(', ')}.`);
  }
  const nearFade = (raw: unknown, name: string): BackingNearFade => {
    const fade = raw as { nearOpacity?: unknown; fadeM?: unknown } | null, range = fade?.fadeM;
    if (typeof fade?.nearOpacity !== 'number' || !(fade.nearOpacity >= 0 && fade.nearOpacity <= 1) || !Array.isArray(range) || range.length !== 2 ||
        !range.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0) || !(range[0] > range[1])) {
      throw new TypeError(`${data.id}: ${name} needs a nearOpacity in [0, 1] and fadeM [far, near] metres, far above near, got ${JSON.stringify(raw)}.`);
    }
    return Object.freeze({ nearOpacity: fade.nearOpacity, fadeM: Object.freeze([range[0], range[1]]) as readonly [number, number] });
  };
  const centreFade = data.centreFadeM;
  if (centreFade !== undefined && !(Array.isArray(centreFade) && centreFade.length === 2 && centreFade.every(value => typeof value === 'number' && Number.isFinite(value))
      && centreFade[0] > centreFade[1] && centreFade[1] > 0)) {
    throw new TypeError(`${data.id}: centreFadeM is [far, near] metres, far above near above 0, got ${JSON.stringify(centreFade)}.`);
  }
  const sections = data.sections === undefined ? undefined : Array.isArray(data.sections) ? data.sections.map((raw: unknown, index: number) => {
    const texturePath = (raw as { texturePath?: unknown } | null)?.texturePath;
    if (typeof texturePath !== 'string' || !/^[a-z0-9-]+(\/[a-z0-9.-]+)+$/u.test(texturePath)) {
      throw new TypeError(`${data.id}: backing section ${index} needs a texture path, got ${JSON.stringify(raw)}.`);
    }
    return Object.freeze({ texturePath, ...nearFade(raw, `backing section ${index}`) });
  }) : (() => { throw new TypeError(`${data.id}: backing sections must be a list, got ${JSON.stringify(data.sections)}.`); })();
  return Object.freeze({ id: data.id, frame: parseDensityVolumeFrame(data.frame), leaf: Object.freeze({ texturePath: leaf.texturePath,
    style: Object.freeze(Object.fromEntries(LEAF_STYLE.map(key => [key, leaf.style![key] as string]))) as PreparedGalaxyBacking['leaf']['style'] }),
    ...(data.nearFade === undefined ? {} : { nearFade: nearFade(data.nearFade, 'backing nearFade') }),
    ...(centreFade === undefined ? {} : { centreFadeM: Object.freeze([centreFade[0], centreFade[1]]) as unknown as readonly [number, number] }),
    ...(sections ? { sections: Object.freeze(sections) } : {}) });
}

