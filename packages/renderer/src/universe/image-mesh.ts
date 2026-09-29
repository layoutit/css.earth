import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import { parseDensityVolumeFrame, type DensityVolumeFrame } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../volume/types.js';
import { DEFAULT_CONTEXT_LABEL_OPACITY } from '../labels/label-presentation.js';
import { placeSelectedBodyLabel } from './selected-body-label.js';
import { silhouetteBottom, sphereSilhouette } from './sphere-silhouette.js';

const LEAF_STYLE = ['width', 'height', 'transform', 'backgroundSize', 'backgroundPosition'] as const;
/** A sphere of patches is seen from outside: it fades in as the camera leaves it, from its radius to twice that. */
const OUTSIDE_FADE_RADII = [1, 2] as const;
/** The limb plate's box in CSS pixels before it is scaled to the outline; its image is smooth, so its size is only a raster budget. */
const LIMB_BOX_PX = 1024;
export interface PreparedImageMesh {
  readonly id: string; readonly name: string; readonly frame: DensityVolumeFrame; readonly radiusUnits: number; readonly texturePath: string;
  /** A camera-facing plate over the sphere that darkens toward its outline; the outline sits at `edge` of the plate's half-width. */
  readonly limb: { readonly path: string; readonly edge: number } | null;
  readonly leaves: readonly { readonly style: Readonly<Record<(typeof LEAF_STYLE)[number], string> & { borderRadius?: string }> }[];
}

/** A `cssearth-image-mesh@1` bank (packages/bake/cli/prepare-map-sphere.mts): patches of one atlas around a centre. */
export function parseImageMesh(value: unknown, at = 'image mesh'): PreparedImageMesh {
  const data = value as { schema?: unknown; id?: unknown; name?: unknown; frame?: unknown; radiusUnits?: unknown; texture?: { path?: unknown };
    limb?: { path?: unknown; edge?: unknown }; leaves?: unknown } | null;
  if (!data || data.schema !== 'cssearth-image-mesh@1' || typeof data.id !== 'string' || !data.id) throw new TypeError(`${at}: expected a cssearth-image-mesh@1 bank with an id.`);
  if (typeof data.name !== 'string' || !data.name.trim()) throw new TypeError(`${data.id}: the mesh needs the name its caption shows.`);
  const path = (candidate: unknown) => typeof candidate === 'string' && /^[a-z0-9-]+(\/[a-z0-9.-]+)+$/u.test(candidate);
  const texturePath = data.texture?.path;
  if (!path(texturePath)) throw new TypeError(`${data.id}: the mesh needs its texture path.`);
  const limb = data.limb === undefined ? null : data.limb;
  if (limb !== null && (!path(limb.path) || typeof limb.edge !== 'number' || !(limb.edge > 0.5 && limb.edge <= 1))) {
    throw new TypeError(`${data.id}: the limb plate needs its image path and the outline's place on it (edge, above 0.5 and at most 1), not ${JSON.stringify(limb)}.`);
  }
  if (typeof data.radiusUnits !== 'number' || !(data.radiusUnits > 0)) throw new TypeError(`${data.id}: the mesh needs a positive radius.`);
  if (!Array.isArray(data.leaves) || !data.leaves.length || data.leaves.length > 1536) throw new TypeError(`${data.id}: the mesh holds 1 to 1536 leaves.`);
  const leaves = data.leaves.map((raw: unknown, index: number) => {
    const style = (raw as { style?: Record<string, unknown> } | null)?.style;
    if (!style || !LEAF_STYLE.every(key => typeof style[key] === 'string' && style[key])) throw new TypeError(`${data.id}: leaf ${index} needs its ${LEAF_STYLE.join(', ')}.`);
    // A polar cap of the standard sphere is its square plate rounded to a disc (packages/bake/src/scene/polar-cap.ts).
    if (style.borderRadius !== undefined && style.borderRadius !== '50%') throw new TypeError(`${data.id}: leaf ${index} rounds only to a disc (border-radius 50%).`);
    return Object.freeze({ style: Object.freeze(Object.fromEntries([...LEAF_STYLE, ...(style.borderRadius ? ['borderRadius' as const] : [])]
      .map(key => [key, style[key] as string]))) as PreparedImageMesh['leaves'][number]['style'] });
  });
  return Object.freeze({ id: data.id, name: data.name, frame: parseDensityVolumeFrame(data.frame), radiusUnits: data.radiusUnits, texturePath: texturePath as string,
    limb: limb ? Object.freeze({ path: limb.path as string, edge: limb.edge as number }) : null, leaves: Object.freeze(leaves) });
}

/**
 * A closed image mesh around its frame's origin, seen from outside (the cosmic microwave background): one retained leaf
 * per patch under one scene transform, each drawn only from its front, so the far side never shows through. It is
 * fetched the first time the camera leaves it, and fades in from its radius to twice that. Like a body, it has a limb
 * plate that faces the camera and fits its outline, and its name below it in the selected body's caption style
 * (`labelHost`, the layer over the scene).
 */
export function mountImageMesh({ host, before, labelHost, url, fetchJson, resolveResource }: {
  host: HTMLElement; before: Node | null; labelHost?: HTMLElement; url: string; fetchJson(url: string): Promise<unknown>; resolveResource(path: string): string;
}) {
  const document = host.ownerDocument;
  const root = document.createElement('div'), camera = document.createElement('div'), scene = document.createElement('div');
  root.className = 'css-volume-projection'; root.dataset.imageMesh = 'loading';
  Object.assign(root.style, { background: 'transparent', display: 'none' });
  camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; scene.style.willChange = 'transform';
  camera.append(scene); root.append(camera); host.insertBefore(root, before);
  const limb = document.createElement('i');
  limb.style.cssText = `position:absolute;left:50%;top:50%;width:${LIMB_BOX_PX}px;height:${LIMB_BOX_PX}px;margin:${-LIMB_BOX_PX / 2}px 0 0 ${-LIMB_BOX_PX / 2}px;` +
    'background:center/100% 100% no-repeat;display:none;pointer-events:none;will-change:transform';
  const label = document.createElement('span');
  label.className = 'prepared-context-label prepared-selected-body-label'; label.ariaHidden = 'true';
  label.style.cssText = 'position:absolute;left:50%;top:50%;opacity:0;pointer-events:none;will-change:transform';
  let labelSize: readonly [number, number] | null = null;
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
    const box = entries.at(-1)?.contentRect;
    if (box) labelSize = [box.width, box.height];
  });
  let payload: PreparedImageMesh | null = null, loading = false, destroyed = false, latest: VolumeCameraPublication | null = null;
  let perspective = '', origin = '', transform = '', opacity = '', limbTransform = '', labelTransform = '', labelOpacity = '';
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
  // The outline and the caption below it: transforms and opacity only, written on change.
  const outline = (publication: VolumeCameraPublication, alpha: number, captioned: boolean) => {
    const centreM = payload!.frame.originM, radiusM = payload!.radiusUnits * payload!.frame.metersPerUnit;
    const shape = alpha > 0 ? sphereSilhouette(publication.world, publication.viewport, centreM, radiusM) : null;
    if (payload!.limb) {
      const scale = (semiAxis: number) => format(semiAxis / payload!.limb!.edge / (LIMB_BOX_PX / 2));
      const next = shape ? `translate(${format(shape.x)}px,${format(shape.y)}px) rotate(${format(shape.angle)}rad) scale(${scale(shape.major)},${scale(shape.minor)})` : '';
      if (next !== limbTransform) { limbTransform = next; if (next) limb.style.transform = next; limb.style.display = next ? '' : 'none'; }
    }
    const placement = captioned && shape && labelSize && placeSelectedBodyLabel(publication.world, publication.viewport, { positionM: centreM, radiusM },
      { overview: false, focused: false, preview: undefined, edge: () => silhouetteBottom(shape) }, labelSize[0], labelSize[1]);
    const nextLabel = placement ? `translate(${format(placement.left)}px,${format(placement.top)}px) translate(-50%,0)` : labelTransform;
    if (nextLabel !== labelTransform) label.style.transform = labelTransform = nextLabel;
    const nextOpacity = String(placement ? Number((alpha * DEFAULT_CONTEXT_LABEL_OPACITY).toFixed(3)) : 0);
    if (nextOpacity !== labelOpacity) label.style.opacity = labelOpacity = nextOpacity;
  };
  return Object.freeze({ root,
    /** Publishes the camera and returns the mesh's opacity, so what lies inside it can give way as it closes over. */
    /** `captioned` is false while another subject owns the view's caption (a catalogue focus): the mesh then names nothing. */
    publish(publication: VolumeCameraPublication, shown = 1, captioned = true): number {
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
        outline(publication, alpha, captioned);
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
        label.textContent = payload.name; label.dataset.imageMeshLabel = payload.id;
        (labelHost ?? host).append(label); observer?.observe(label);
        // The limb is a decoration of the sphere: one that cannot be resolved leaves the sphere and its caption drawn.
        if (payload.limb) {
          try {
            limb.style.backgroundImage = `url("${resolveResource(payload.limb.path).replace(/["\\\n\r]/gu, character => `\\${character}`)}")`;
            root.append(limb);
          } catch (error) { console.error(`Image mesh ${url} limb unavailable`, error); }
        }
        root.dataset.imageMesh = payload.id;
        if (latest) this.publish(latest, shown, captioned);
      }).catch(error => { root.dataset.imageMesh = 'failed'; console.error(`Image mesh ${url} failed`, error); });
      return 0;
    },
    destroy() { destroyed = true; observer?.disconnect(); label.remove(); root.remove(); } });
}

function format(value: number): string { return String(Number(value.toFixed(6))); }
