import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../volume/types.js';

const LEAF_STYLE = ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition'] as const;
/** A sphere of patches is seen from outside: it fades in as the camera leaves it, from its radius to twice that. */
const OUTSIDE_FADE_RADII = [1, 2] as const;
export interface PreparedImageMesh {
  readonly id: string; readonly frame: DensityVolumeFrame; readonly radiusUnits: number; readonly texturePath: string;
  readonly leaves: readonly { readonly style: Readonly<Record<(typeof LEAF_STYLE)[number], string>> }[];
}

/** A `cssearth-image-mesh@1` bank (packages/bake/cli/prepare-map-sphere.mts): patches of one atlas around a centre. */
export function parseImageMesh(value: unknown, at = 'image mesh'): PreparedImageMesh {
  const data = value as { schema?: unknown; id?: unknown; frame?: unknown; radiusUnits?: unknown; texture?: { path?: unknown }; leaves?: unknown } | null;
  if (!data || data.schema !== 'cssearth-image-mesh@1' || typeof data.id !== 'string' || !data.id) throw new TypeError(`${at}: expected a cssearth-image-mesh@1 bank with an id.`);
  const texturePath = data.texture?.path;
  if (typeof texturePath !== 'string' || !/^[a-z0-9-]+(\/[a-z0-9.-]+)+$/u.test(texturePath)) throw new TypeError(`${data.id}: the mesh needs its texture path.`);
  if (typeof data.radiusUnits !== 'number' || !(data.radiusUnits > 0)) throw new TypeError(`${data.id}: the mesh needs a positive radius.`);
  if (!Array.isArray(data.leaves) || !data.leaves.length || data.leaves.length > 1536) throw new TypeError(`${data.id}: the mesh holds 1 to 1536 leaves.`);
  const leaves = data.leaves.map((raw: unknown, index: number) => {
    const style = (raw as { style?: Record<string, unknown> } | null)?.style;
    if (!style || !LEAF_STYLE.every(key => typeof style[key] === 'string' && style[key])) throw new TypeError(`${data.id}: leaf ${index} needs its ${LEAF_STYLE.join(', ')}.`);
    return Object.freeze({ style: Object.freeze(Object.fromEntries(LEAF_STYLE.map(key => [key, style[key] as string]))) as PreparedImageMesh['leaves'][number]['style'] });
  });
  return Object.freeze({ id: data.id, frame: parseDensityVolumeFrame(data.frame), radiusUnits: data.radiusUnits, texturePath, leaves: Object.freeze(leaves) });
}

/**
 * A closed image mesh around its frame's origin, seen from outside (the cosmic microwave background): one retained leaf
 * per patch under one scene transform, each drawn only from its front, so the far side never shows through. It is
 * fetched the first time the camera leaves it, and fades in from its radius to twice that.
 */
export function mountImageMesh({ host, before, url, fetchJson, resolveResource }: {
  host: HTMLElement; before: Node | null; url: string; fetchJson(url: string): Promise<unknown>; resolveResource(path: string): string;
}) {
  const document = host.ownerDocument;
  const root = document.createElement('div'), camera = document.createElement('div'), scene = document.createElement('div');
  root.className = 'css-volume-projection'; root.dataset.imageMesh = 'loading';
  Object.assign(root.style, { background: 'transparent', display: 'none' });
  camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; scene.style.willChange = 'transform';
  camera.append(scene); root.append(camera); host.insertBefore(root, before);
  let payload: PreparedImageMesh | null = null, loading = false, destroyed = false, latest: VolumeCameraPublication | null = null;
  let perspective = '', origin = '', transform = '', opacity = '';
  const draw = (publication: VolumeCameraPublication) => {
    const view = preparedVolumeCameraTransform(publication, payload!.frame);
    const [x, y] = publication.viewport.principalOffsetPixels;
    // Written on change: this publishes every camera frame (motion-freezes-membership.md).
    const nextPerspective = `${format(view.focalPixels)}px`, nextOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
    const nextTransform = `translate3d(${view.translationCssPixels.map(value => `${format(value)}px`).join(',')}) ${worldRotationCss(view.rotation)}`;
    if (nextPerspective !== perspective) camera.style.perspective = perspective = nextPerspective;
    if (nextOrigin !== origin) camera.style.perspectiveOrigin = origin = nextOrigin;
    if (nextTransform !== transform) scene.style.transform = transform = nextTransform;
  };
  return Object.freeze({ root,
    /** Publishes the camera and returns the mesh's opacity, so what lies inside it can give way as it closes over. */
    publish(publication: VolumeCameraPublication, shown = 1): number {
      if (destroyed) return 0;
      const distanceM = Math.hypot(...publication.world.pose.positionM);
      const radiusM = payload ? payload.radiusUnits * payload.frame.metersPerUnit : null;
      // Before the bank loads its radius is unknown; it loads once the camera is past the fade's far end of any mesh
      // this size could have, which the caller's own opacity (shown) already gates.
      const t = radiusM === null ? 0 : Math.max(0, Math.min(1, (distanceM / radiusM - OUTSIDE_FADE_RADII[0]) / (OUTSIDE_FADE_RADII[1] - OUTSIDE_FADE_RADII[0])));
      const alpha = Math.max(0, Math.min(1, shown)) * t * t * (3 - 2 * t);
      if (payload) {
        const nextOpacity = String(Number(alpha.toFixed(3)));
        if (nextOpacity !== opacity) root.style.opacity = opacity = nextOpacity;
        const display = alpha > 0 ? '' : 'none';
        if (root.style.display !== display) root.style.display = display;
        if (alpha > 0) draw(publication);
        return alpha;
      }
      latest = publication;
      if (loading || !(shown > 0)) return 0;
      loading = true;
      void fetchJson(url).then(value => {
        if (destroyed) return;
        payload = parseImageMesh(value, url);
        const mesh = document.createElement('div'); mesh.className = 'css-volume-mesh';
        const image = `url("${resolveResource(payload.texturePath).replace(/["\\\n\r]/gu, character => `\\${character}`)}")`;
        for (const leaf of payload.leaves) {
          const node = document.createElement('s');
          Object.assign(node.style, { ...leaf.style, textDecoration: 'none', backgroundImage: image, backfaceVisibility: 'hidden' });
          mesh.append(node);
        }
        scene.append(mesh);
        root.dataset.imageMesh = payload.id;
        if (latest) this.publish(latest, shown);
      }).catch(error => { root.dataset.imageMesh = 'failed'; console.error(`Image mesh ${url} failed`, error); });
      return 0;
    },
    destroy() { destroyed = true; root.remove(); } });
}

function format(value: number): string { return String(Number(value.toFixed(6))); }
