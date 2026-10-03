import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { eyeDistanceM, worldRotationCss } from '@cssearth/engine';
import { parseImageMesh, type PreparedImageMesh } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../volume/types.js';
import { DEFAULT_CONTEXT_LABEL_OPACITY } from '../labels/label-presentation.js';
import { placeSelectedBodyLabel } from './selected-body-label.js';
import { silhouetteBottom, sphereSilhouette } from './sphere-silhouette.js';

/** A sphere of patches is seen from outside: it fades in as the camera leaves it, from its radius to twice that. */
const OUTSIDE_FADE_RADII = [1, 2] as const;
/** The limb plate's box in CSS pixels before it is scaled to the outline; its image is smooth, so its size is only a raster budget. */
export const LIMB_BOX_PX = 1024;
/**
 * A closed image mesh around its frame's origin, seen from outside (the cosmic microwave background): one retained leaf
 * per patch under one scene transform, each drawn only from its front, so the far side never shows through. It is
 * fetched the first time the camera leaves it, and fades in from its radius to twice that. Like a body, it has a limb
 * plate that faces the camera and fits its outline, and its name below it in the selected body's caption style
 * (`labelHost`, the layer over the scene).
 *
 * A mesh with a cutaway opens one hemisphere (`setCutaway`, on unless the caller says otherwise): its marked leaves hide,
 * and a copy of the rest, drawn from both sides at the cutaway's opacity, is mounted at `interiorBefore`, behind what the
 * sphere holds, so the inside of the far wall shows through the opening under the points inside it.
 *
 * A hidden mesh (`setHidden`) draws no leaf, interior or limb and never asks for its texture; it only keeps its caption
 * below its outline, reading `hiddenCaption` (what the sphere bounds) instead of its own name.
 */
export function mountImageMesh({ host, before, interiorBefore = before, labelHost, url, fetchJson, resolveResource, cutaway: initialCutaway = true,
  hidden: initialHidden = false, hiddenCaption }: {
  host: HTMLElement; before: Node | null; interiorBefore?: Node | null; labelHost?: HTMLElement; url: string; fetchJson(url: string): Promise<unknown>;
  resolveResource(path: string): string; cutaway?: boolean; hidden?: boolean; hiddenCaption?: string;
}) {
  const document = host.ownerDocument;
  const root = document.createElement('div'), camera = document.createElement('div'), scene = document.createElement('div');
  // A transparent projection whose scene composites once; both are volume.css rules. Only its display, opacity and
  // camera change inline.
  root.className = 'css-volume-projection'; root.dataset.imageMesh = 'loading';
  root.style.display = 'none';
  camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene';
  camera.append(scene); root.append(camera); host.insertBefore(root, before);
  const interior = document.createElement('div'), interiorCamera = document.createElement('div'), interiorScene = document.createElement('div');
  interior.className = 'css-volume-projection'; interior.dataset.imageMeshInterior = '';
  interior.style.display = 'none';
  interiorCamera.className = 'css-volume-camera'; interiorScene.className = 'css-volume-scene';
  interiorCamera.append(interiorScene); interior.append(interiorCamera);
  let cutaway = initialCutaway, hidden = initialHidden, textured = false;
  const cutLeaves: HTMLElement[] = [], leaves: HTMLElement[] = [];
  // The limb plate's centred LIMB_BOX_PX box is a volume.css rule; its image, transform and display are inline.
  const limb = document.createElement('i');
  limb.style.display = 'none';
  const label = document.createElement('span');
  label.className = 'prepared-context-label prepared-selected-body-label'; label.ariaHidden = 'true';
  label.style.opacity = '0';
  let labelSize: readonly [number, number] | null = null;
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
    const box = entries.at(-1)?.contentRect;
    if (box) labelSize = [box.width, box.height];
  });
  let payload: PreparedImageMesh | null = null, loading = false, destroyed = false, latest: VolumeCameraPublication | null = null;
  let perspective = '', origin = '', transform = '', opacity = '', limbTransform = '', labelTransform = '', labelOpacity = '', interiorOpacity = '';
  let lastShown = 1, lastCaptioned = true, image = '', limbImage = '';
  // The texture and limb image are set the first time the sphere shows, so a hidden sphere never asks for them.
  const applyTexture = () => {
    if (textured || hidden || !payload) return;
    textured = true;
    for (const node of leaves) node.style.backgroundImage = image;
    if (limbImage) { limb.style.backgroundImage = limbImage; root.append(limb); }
  };
  const caption = () => hidden && hiddenCaption ? hiddenCaption : payload!.name;
  // Hidden, the caption and its fade follow what the sphere holds, when the bank says how far that reaches.
  const radiusUnits = () => hidden && payload!.holdsRadiusUnits !== null ? payload!.holdsRadiusUnits : payload!.radiusUnits;
  const open = () => cutaway && payload?.cutaway !== null && payload?.cutaway !== undefined;
  const draw = (publication: VolumeCameraPublication) => {
    const view = preparedVolumeCameraTransform(publication, payload!.frame);
    const [x, y] = publication.viewport.principalOffsetPixels;
    // Written on change: this publishes every camera frame (motion-freezes-membership.md).
    const nextPerspective = `${format(view.focalPixels)}px`, nextOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
    const nextTransform = `translate3d(${view.translationCssPixels.map(value => `${format(value)}px`).join(',')}) ${worldRotationCss(view.rotation)}`;
    if (nextPerspective !== perspective) { perspective = nextPerspective; camera.style.perspective = interiorCamera.style.perspective = nextPerspective; }
    if (nextOrigin !== origin) { origin = nextOrigin; camera.style.perspectiveOrigin = interiorCamera.style.perspectiveOrigin = nextOrigin; }
    if (nextTransform !== transform) { transform = nextTransform; scene.style.transform = interiorScene.style.transform = nextTransform; }
  };
  // The outline and the caption below it: transforms and opacity only, written on change.
  const outline = (publication: VolumeCameraPublication, alpha: number, captioned: boolean) => {
    const centreM = payload!.frame.originM, radiusM = radiusUnits() * payload!.frame.metersPerUnit;
    const shape = alpha > 0 ? sphereSilhouette(publication.world, publication.viewport, centreM, radiusM) : null;
    if (limbImage) {
      const scale = (semiAxis: number) => format(semiAxis / payload!.limb!.edge / (LIMB_BOX_PX / 2));
      const next = shape && !hidden ? `translate(${format(shape.x)}px,${format(shape.y)}px) rotate(${format(shape.angle)}rad) scale(${scale(shape.major)},${scale(shape.minor)})` : '';
      if (next !== limbTransform) { limbTransform = next; if (next) limb.style.transform = next; limb.style.display = next ? '' : 'none'; }
    }
    const placement = captioned && shape && labelSize && placeSelectedBodyLabel(publication.world, publication.viewport, { positionM: centreM, radiusM },
      { overview: false, preview: undefined, edge: () => silhouetteBottom(shape) }, labelSize[0], labelSize[1]);
    const nextLabel = placement ? `translate(${format(placement.left)}px,${format(placement.top)}px) translate(-50%,0)` : labelTransform;
    if (nextLabel !== labelTransform) label.style.transform = labelTransform = nextLabel;
    const nextOpacity = String(placement ? Number((alpha * DEFAULT_CONTEXT_LABEL_OPACITY).toFixed(3)) : 0);
    if (nextOpacity !== labelOpacity) label.style.opacity = labelOpacity = nextOpacity;
  };
  return Object.freeze({ root,
    /** Publishes the camera and returns how much the mesh covers what lies inside it, so that can give way as it closes over:
     * its opacity, or nothing while it is cut open. `captioned` is false while another subject owns the view's caption (a
     * selection preview, a galaxy shown as its scene's subject): the mesh then names nothing. */
    publish(publication: VolumeCameraPublication, shown = 1, captioned = true): number {
      if (destroyed) return 0;
      lastShown = shown; lastCaptioned = captioned; latest = publication;
      // From the mesh's own centre, through the eye's exact place (engine eyeDistanceM).
      const distanceM = payload ? eyeDistanceM(publication.world.pose, payload.frame.originM) : 0;
      const radiusM = payload ? radiusUnits() * payload.frame.metersPerUnit : null;
      // Before the bank loads its radius is unknown; it loads once the camera is past the fade's far end of any mesh
      // this size could have, which the caller's own opacity (shown) already gates.
      const t = radiusM === null ? 0 : Math.max(0, Math.min(1, (distanceM / radiusM - OUTSIDE_FADE_RADII[0]) / (OUTSIDE_FADE_RADII[1] - OUTSIDE_FADE_RADII[0])));
      const alpha = Math.max(0, Math.min(1, shown)) * t * t * (3 - 2 * t);
      if (payload) {
        // Hidden, only the caption shows.
        const sphere = hidden ? 0 : alpha;
        const nextOpacity = String(Number((open() ? sphere * payload.cutaway!.exteriorOpacity : sphere).toFixed(3)));
        if (nextOpacity !== opacity) root.style.opacity = opacity = nextOpacity;
        const display = sphere > 0 ? '' : 'none';
        if (root.style.display !== display) root.style.display = display;
        const inside = open() ? sphere * payload.cutaway!.interiorOpacity : 0, nextInterior = String(Number(inside.toFixed(3)));
        if (nextInterior !== interiorOpacity) interior.style.opacity = interiorOpacity = nextInterior;
        const interiorDisplay = inside > 0 ? '' : 'none';
        if (interior.style.display !== interiorDisplay) interior.style.display = interiorDisplay;
        if (sphere > 0) draw(publication);
        outline(publication, alpha, captioned);
        return open() ? 0 : sphere;
      }
      if (loading || !(shown > 0)) return 0;
      loading = true;
      void fetchJson(url).then(value => {
        if (destroyed) return;
        payload = parseImageMesh(value, url);
        const mesh = document.createElement('div'); mesh.className = 'css-volume-mesh';
        const inner = document.createElement('div'); inner.className = 'css-volume-mesh';
        image = `url("${resolveResource(payload.texturePath).replace(/["\\\n\r]/gu, character => `\\${character}`)}")`;
        for (const leaf of payload.leaves) {
          const node = document.createElement('s');
          // A leaf's box and cell are its own; its texture is the mesh's, and outside faces hide their backs (volume.css).
          Object.assign(node.style, leaf.style);
          mesh.append(node); leaves.push(node);
          if (leaf.cut) { cutLeaves.push(node); node.style.display = cutaway ? 'none' : ''; continue; }
          // The inside copy: the far wall is seen from within, so both faces are drawn (a face's back is its mirror image,
          // the sky as seen from inside the sphere).
          if (payload.cutaway) { const copy = node.cloneNode() as HTMLElement; inner.append(copy); leaves.push(copy); }
        }
        scene.append(mesh);
        if (payload.cutaway) { interiorScene.append(inner); host.insertBefore(interior, interiorBefore); }
        label.textContent = caption(); label.dataset.imageMeshLabel = payload.id;
        (labelHost ?? host).append(label); observer?.observe(label);
        // The limb is a decoration of the sphere: one that cannot be resolved leaves the sphere and its caption drawn.
        if (payload.limb) {
          try {
            limbImage = `url("${resolveResource(payload.limb.path).replace(/["\\\n\r]/gu, character => `\\${character}`)}")`;
          } catch (error) { console.error(`Image mesh ${url} limb unavailable`, error); }
        }
        applyTexture();
        root.dataset.imageMesh = payload.id;
        if (latest) this.publish(latest, shown, captioned);
      }).catch(error => { root.dataset.imageMesh = 'failed'; console.error(`Image mesh ${url} failed`, error); });
      return 0;
    },
    /** Opens or closes the cutaway: a one-off change of which leaves show, never made on every frame. */
    setCutaway(value: boolean) {
      if (destroyed || cutaway === value) return;
      cutaway = value;
      for (const node of cutLeaves) node.style.display = cutaway ? 'none' : '';
      if (payload && latest) this.publish(latest, lastShown, lastCaptioned);
    },
    /** Hides or shows the sphere, keeping its caption: a one-off change, never made on every frame. */
    setHidden(value: boolean) {
      if (destroyed || hidden === value) return;
      hidden = value;
      applyTexture();
      if (payload) label.textContent = caption();
      if (payload && latest) this.publish(latest, lastShown, lastCaptioned);
    },
    destroy() { destroyed = true; observer?.disconnect(); label.remove(); interior.remove(); root.remove(); } });
}

function format(value: number): string { return String(Number(value.toFixed(6))); }
