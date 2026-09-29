import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../volume/types.js';
import { logarithmicFade } from './world-context/context-scale.js';

const LEAF_STYLE = ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition'] as const;
const PARSEC_M = 3.0856775814913673e16;
type PlaneLeaf = { readonly texturePath: string; readonly style: Readonly<Record<(typeof LEAF_STYLE)[number], string>> };
export interface PreparedCataloguePlanes {
  readonly id: string; readonly frame: DensityVolumeFrame;
  /** Near dots give way to far ones around this many parsecs per screen pixel at the frame origin. */
  readonly handoffPcPerPixel: number;
  /** The same points at two dot sizes: `near` first, then `far`. */
  readonly levels: readonly [{ readonly leaves: readonly PlaneLeaf[] }, { readonly leaves: readonly PlaneLeaf[] }];
  /** A face-on density map on the midplane, drawn under the dots at every distance. */
  readonly map: { readonly leaves: readonly PlaneLeaf[] };
}

/** A `cssearth-catalogue-planes@1` bank: disc-parallel PolyCSS leaves in a galaxy's frame, at a near and a far dot size. */
export function parseCataloguePlanes(value: unknown, at = 'catalogue planes'): PreparedCataloguePlanes {
  const data = value as { schema?: unknown; id?: unknown; frame?: unknown; handoffPcPerPixel?: unknown; levels?: unknown; map?: { leaves?: unknown } } | null;
  if (!data || data.schema !== 'cssearth-catalogue-planes@1' || typeof data.id !== 'string' || !data.id) throw new TypeError(`${at}: expected a cssearth-catalogue-planes@1 bank with an id.`);
  if (typeof data.handoffPcPerPixel !== 'number' || !(data.handoffPcPerPixel > 0)) throw new TypeError(`${data.id}: handoffPcPerPixel must be positive, got ${String(data.handoffPcPerPixel)}.`);
  const levels = data.levels as { id?: unknown; leaves?: unknown }[] | undefined;
  if (!Array.isArray(levels) || levels.length !== 2 || levels[0]?.id !== 'near' || levels[1]?.id !== 'far') throw new TypeError(`${data.id}: levels must be near then far.`);
  if (!data.map || typeof data.map !== 'object') throw new TypeError(`${data.id}: a catalogue plane bank needs its map.`);
  const parsed = [...levels, { id: 'map', leaves: data.map.leaves }].map(level => {
    if (!Array.isArray(level.leaves) || !level.leaves.length || level.leaves.length > 64) throw new TypeError(`${data.id}: level ${String(level.id)} holds 1 to 64 leaves.`);
    return Object.freeze({ leaves: Object.freeze(level.leaves.map((leaf: unknown, index: number): PlaneLeaf => {
      const entry = leaf as { texturePath?: unknown; style?: Record<string, unknown> } | null;
      if (!entry || typeof entry.texturePath !== 'string' || !/^[a-z0-9-]+(\/[a-z0-9.-]+)+$/u.test(entry.texturePath) ||
          !entry.style || !LEAF_STYLE.every(key => typeof entry.style![key] === 'string' && entry.style![key])) {
        throw new TypeError(`${data.id}: ${String(level.id)} leaf ${index} needs a texture path and its ${LEAF_STYLE.join(', ')}.`);
      }
      return Object.freeze({ texturePath: entry.texturePath, style: Object.freeze(Object.fromEntries(LEAF_STYLE.map(key => [key, entry.style![key] as string]))) as PlaneLeaf['style'] });
    })) });
  });
  return Object.freeze({ id: data.id, frame: parseDensityVolumeFrame(data.frame), handoffPcPerPixel: data.handoffPcPerPixel,
    levels: Object.freeze([parsed[0]!, parsed[1]!] as const), map: parsed[2]! });
}

/**
 * Prepared catalogue points drawn on fixed planes in their galaxy's frame (tools/objects/catalogue-points/volume.mts).
 * The planes never change: camera motion turns one scene transform per level, so the points cost the compositor, not a
 * repaint. The map lies under the dots; the near and far dot sizes crossfade by how many parsecs a screen pixel
 * covers at the frame origin.
 */
export function mountCataloguePlanes({ host, before, payload, resolveResource }: {
  host: HTMLElement; before: Node; payload: PreparedCataloguePlanes; resolveResource(path: string): string;
}) {
  const document = host.ownerDocument;
  const levels = [payload.map, ...payload.levels].map((level, index) => {
    const root = document.createElement('div'), camera = document.createElement('div');
    const scene = document.createElement('div'), mesh = document.createElement('div');
    root.className = 'css-volume-projection'; root.dataset.cataloguePlanes = `${payload.id}-${['map', 'near', 'far'][index]}`;
    // Over the galaxy's own slices: the projection's black backdrop would hide them. Each level is its own flat root,
    // so its opacity never flattens the planes' 3D.
    root.style.background = 'transparent'; root.style.display = 'none';
    camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
    scene.style.willChange = 'transform';
    for (const leaf of level.leaves) {
      const node = document.createElement('s');
      Object.assign(node.style, { ...leaf.style, textDecoration: 'none',
        backgroundImage: `url("${resolveResource(leaf.texturePath).replace(/["\\\n\r]/gu, character => `\\${character}`)}")` });
      mesh.append(node);
    }
    scene.append(mesh); camera.append(scene); root.append(camera); host.insertBefore(root, before);
    return { root, camera, scene, opacity: NaN, perspective: '', origin: '', transform: '' };
  });
  const handoffM = payload.handoffPcPerPixel * PARSEC_M;
  return Object.freeze({ roots: levels.map(level => level.root), publish(publication: VolumeCameraPublication) {
    const view = preparedVolumeCameraTransform(publication, payload.frame);
    const [x, y] = publication.viewport.principalOffsetPixels;
    const origin = payload.frame.originM, position = publication.world.pose.positionM;
    const metresPerPixel = Math.hypot(position[0] - origin[0], position[1] - origin[1], position[2] - origin[2]) / publication.viewport.focalPixels;
    // Over a factor of two either side of the handoff; a hidden level leaves compositing.
    const far = logarithmicFade(metresPerPixel, handoffM / 2, handoffM * 2);
    const perspective = `${format(view.focalPixels)}px`, perspectiveOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
    const transform = `translate3d(${view.translationCssPixels.map(value => `${format(value)}px`).join(',')}) ${worldRotationCss(view.rotation)}`;
    levels.forEach((level, index) => {
      const opacity = index === 0 ? 1 : index === 2 ? far : 1 - far;
      if (opacity !== level.opacity) {
        if ((opacity > 0) !== (level.opacity > 0)) level.root.style.display = opacity > 0 ? '' : 'none';
        level.root.style.opacity = String(opacity); level.opacity = opacity;
      }
      if (!(opacity > 0)) return;
      // Written on change: this publishes every camera frame (motion-freezes-membership.md).
      if (perspective !== level.perspective) level.camera.style.perspective = level.perspective = perspective;
      if (perspectiveOrigin !== level.origin) level.camera.style.perspectiveOrigin = level.origin = perspectiveOrigin;
      if (transform !== level.transform) level.scene.style.transform = level.transform = transform;
    });
  }, destroy() { for (const level of levels) level.root.remove(); } });
}

function format(value: number): string { return String(Number(value.toFixed(6))); }
