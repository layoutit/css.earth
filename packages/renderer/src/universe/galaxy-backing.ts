import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../volume/types.js';

const LEAF_STYLE = ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition'] as const;
export interface BackingNearFade { readonly nearOpacity: number; readonly fadeM: readonly [number, number] }
export interface PreparedGalaxyBacking {
  readonly id: string; readonly frame: DensityVolumeFrame;
  readonly leaf: { readonly texturePath: string; readonly style: Readonly<Record<(typeof LEAF_STYLE)[number], string>> };
  /** How the whole image dims close up: full beyond `fadeM[0]`, down to `nearOpacity` within `fadeM[1]` (camera distance). */
  readonly nearFade?: BackingNearFade;
  /** Parts of the same image, transparent around them, drawn over it in order, each dimming on its own range. */
  readonly sections?: readonly ({ readonly texturePath: string } & BackingNearFade)[];
}

/** A `cssearth-galaxy-backing@1` bank (packages/bake/cli/prepare-galaxy-backing.mts): one face-on image plane in a galaxy's frame. */
export function parseGalaxyBacking(value: unknown, at = 'galaxy backing'): PreparedGalaxyBacking {
  const data = value as { schema?: unknown; id?: unknown; frame?: unknown; leaf?: { texturePath?: unknown; style?: Record<string, unknown> };
    nearFade?: unknown; sections?: unknown } | null;
  if (!data || data.schema !== 'cssearth-galaxy-backing@1' || typeof data.id !== 'string' || !data.id) throw new TypeError(`${at}: expected a cssearth-galaxy-backing@1 bank with an id.`);
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
    ...(sections ? { sections: Object.freeze(sections) } : {}) });
}

/**
 * A galaxy's face-on backing image, fixed in its frame under the catalogue dots. The plane never changes: camera motion
 * turns one scene transform, so it costs the compositor, not a repaint.
 */
export function mountGalaxyBacking({ host, before, payload, resolveResource }: {
  host: HTMLElement; before: Node | null; payload: PreparedGalaxyBacking; resolveResource(path: string): string;
}) {
  const document = host.ownerDocument;
  const root = document.createElement('div'), camera = document.createElement('div');
  const scene = document.createElement('div'), mesh = document.createElement('div'), node = document.createElement('s');
  root.className = 'css-volume-projection'; root.dataset.galaxyBacking = payload.id;
  // The projection's black backdrop would hide what lies behind the plane.
  root.style.background = 'transparent';
  camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
  scene.style.willChange = 'transform';
  Object.assign(node.style, { ...payload.leaf.style, textDecoration: 'none',
    backgroundImage: `url("${resolveResource(payload.leaf.texturePath).replace(/["\\\n\r]/gu, character => `\\${character}`)}")` });
  mesh.append(node); scene.append(mesh); camera.append(scene); root.append(camera); host.insertBefore(root, before);
  let perspective = '', origin = '', transform = '';
  return Object.freeze({ root, publish(publication: VolumeCameraPublication) {
    const view = preparedVolumeCameraTransform(publication, payload.frame);
    const [x, y] = publication.viewport.principalOffsetPixels;
    // Written on change: this publishes every camera frame (motion-freezes-membership.md).
    const nextPerspective = `${format(view.focalPixels)}px`, nextOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
    const nextTransform = `translate3d(${view.translationCssPixels.map(value => `${format(value)}px`).join(',')}) ${worldRotationCss(view.rotation)}`;
    if (nextPerspective !== perspective) camera.style.perspective = perspective = nextPerspective;
    if (nextOrigin !== origin) camera.style.perspectiveOrigin = origin = nextOrigin;
    if (nextTransform !== transform) scene.style.transform = transform = nextTransform;
  }, destroy() { root.remove(); } });
}

function format(value: number): string { return String(Number(value.toFixed(6))); }
