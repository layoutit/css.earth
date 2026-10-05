import { presentPhysicalPoseInVolume, worldRotationCss, worldRotationFromQuaternion } from '@cssearth/engine';
import { preparedVolumeCameraTransform, LARGE_IMAGE_PIXELS, STACK_OPACITY_CEILING } from '../volume/prepared-volume-runtime.js';
import type { VolumeCameraPublication } from '../volume/types.js';
import type { PreparedCssImageLayers, PreparedImageLayerView } from '@cssearth/objects';
import { revealLayer } from '../rendering/layer-reveal.js';

/** A leaf as a rectangle in bank units: its centre, its unit edge directions, its half extents and its normal, from the
 * prepared corners. A sheet is left out of the drawing while the camera stands within one of its stack's sampling steps
 * of it (`publish`): a camera inside the bank, at a nebula's central star, would otherwise see the sheets through the
 * middle, which carry the star's own light, with texels larger than the view, and a sheet crossing the camera plane. */
interface Sheet { readonly c: readonly [number, number, number]; readonly u: readonly [number, number, number]; readonly v: readonly [number, number, number];
  readonly n: readonly [number, number, number]; readonly hu: number; readonly hv: number }
function sheetOf(centre: readonly [number, number, number], corners: readonly (readonly [number, number, number])[]): Sheet | null {
  const [a, b, , d] = corners;
  if (!a || !b || !d) return null;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const lu = Math.hypot(...u), lv = Math.hypot(...v);
  if (!(lu > 0) || !(lv > 0)) return null;
  const eu = [u[0]! / lu, u[1]! / lu, u[2]! / lu] as const, ev = [v[0]! / lv, v[1]! / lv, v[2]! / lv] as const;
  const n = [eu[1] * ev[2] - eu[2] * ev[1], eu[2] * ev[0] - eu[0] * ev[2], eu[0] * ev[1] - eu[1] * ev[0]], ln = Math.hypot(...n);
  if (!(ln > 0)) return null;
  return { c: centre, u: eu, v: ev, n: [n[0]! / ln, n[1]! / ln, n[2]! / ln], hu: lu / 2, hv: lv / 2 };
}
/** Whether the camera at `p` (bank units) is nearer than `reach` to the sheet: the distance from a point to a rectangle. */
function withinReach(sheet: Sheet, p: readonly number[], reach: number): boolean {
  const dx = p[0]! - sheet.c[0], dy = p[1]! - sheet.c[1], dz = p[2]! - sheet.c[2];
  const along = dx * sheet.n[0] + dy * sheet.n[1] + dz * sheet.n[2];
  const across = Math.max(0, Math.abs(dx * sheet.u[0] + dy * sheet.u[1] + dz * sheet.u[2]) - sheet.hu);
  const down = Math.max(0, Math.abs(dx * sheet.v[0] + dy * sheet.v[1] + dz * sheet.v[2]) - sheet.hv);
  return along * along + across * across + down * down < reach * reach;
}

/** Transparent prepared layer banks. No opaque viewport matte is allowed here. */
export function mountPreparedCssImageLayers({ host, before, payload, resolveResource }: {
  host: HTMLElement; before: Element; payload: PreparedCssImageLayers; resolveResource(path: string): string;
}) {
  const document = host.ownerDocument, root = document.createElement('div');
  root.className = 'prepared-image-layer-bank'; root.dataset.imageLayerObject = payload.id;
  // The bank fills the universe root; its projections are transparent and their scenes composite once (volume.css).
  // A stack without leaves draws nothing: it is not mounted and takes no part in the choice of view.
  const drawn = payload.stacks.filter(stack => stack.leaves.length > 0);
  const views = payload.bankViews.filter(view => drawn.some(stack => stack.axis === view.axis));
  const banks = drawn.map(stack => {
    const projection = document.createElement('div');
    projection.className = 'css-volume-projection';
    projection.dataset.imageLayerAxis = stack.axis;
    projection.style.opacity = '0'; projection.style.visibility = 'hidden';
    // Same camera-driven scene as a volume: its will-change keeps slice raster scales through rotation. A stack is one
    // scene, or the runs of leaves its view names (sceneSizes): each run under a camera of its own in the stack's
    // projection, painted in the stack's order, so the browser sorts and cuts only one run's leaves against each other.
    const textures: { element: HTMLElement; path: string; large: boolean; sheet: Sheet | null; shown: string }[] = [], scenes: { camera: HTMLElement; scene: HTMLElement }[] = [];
    const view = views.find(view => view.axis === stack.axis);
    let next = 0;
    for (const size of view?.sceneSizes ?? [stack.leaves.length]) {
      const camera = document.createElement('div'), scene = document.createElement('div'), mesh = document.createElement('div');
      camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
      for (const leaf of stack.leaves.slice(next, next + size)) {
        const element = document.createElement('s');
        element.dataset.imageLayerLeaf = leaf.id;
        Object.assign(element.style, leaf.style);
        textures.push({ element, path: leaf.texturePath, large: leaf.widthPx * leaf.heightPx >= LARGE_IMAGE_PIXELS,
          sheet: leaf.verticesUnits ? sheetOf(leaf.centerUnits, leaf.verticesUnits) : null, shown: '' });
        mesh.appendChild(element);
      }
      next += size;
      scene.appendChild(mesh); camera.appendChild(scene); projection.appendChild(camera); scenes.push({ camera, scene });
    }
    root.appendChild(projection);
    return { axis: stack.axis, projection, scenes, textures, loaded: false, perspective: '', perspectiveOrigin: '', transform: '', reach: view?.samplingStepUnits ?? 0 };
  });
  host.insertBefore(root, before);
  let destroyed = false;
  const url = (path: string) => resolveResource(path).replace(/["\\\n\r]/g, char => `\\${char}`);
  // A large leaf coming back decodes off the main thread first: M31's 7,085 px detail layer decoded inside one 168 ms
  // paint each time its bank or the whole bank came back on the iPad (2026-09-30).
  const revealLarge = (bank: (typeof banks)[number]) => {
    if (bank.loaded) for (const texture of bank.textures) if (texture.large) revealLayer(texture.element, resolveResource(texture.path));
  };
  return Object.freeze({ root,
    /** The bank root is shown again: its large leaves wait for their decode (layer-reveal.ts). */
    revealLarge() { for (const bank of banks) if (bank.projection.style.display !== 'none') revealLarge(bank); },
    /** `around`: the bank is drawn around a body that stands inside it, at that place (reference metres). The sheets the
     * camera stands on are left out, and so are the sheets through the body: they hold the picture's own image of it, a
     * saturated glare many times its size, and the body is drawn in their place (Eta Carinae inside the Homunculus was a
     * white screen 1,200 AU out, 2026-10-05). As its page's own subject a bank draws every sheet, as it always has. */
    publish(publication: VolumeCameraPublication, around: readonly [number, number, number] | false = false) {
      if (destroyed) return;
      const transform = preparedVolumeCameraTransform(publication, payload.frame);
      const cssTransform = `translate3d(${transform.translationCssPixels.map(value => `${value}px`).join(',')}) ${worldRotationCss(transform.rotation)}`;
      const local = presentPhysicalPoseInVolume(publication.world.pose, payload.frame);
      const body = around ? presentPhysicalPoseInVolume({ positionM: around, orientationXyzw: publication.world.pose.orientationXyzw }, payload.frame).positionUnits : null;
      const weights = imageLayerAxisWeights(local.orientationXyzw, views);
      const [ox, oy] = publication.viewport.principalOffsetPixels;
      const perspective = `${transform.focalPixels}px`, perspectiveOrigin = `calc(50% + ${ox}px) calc(50% + ${oy}px)`;
      for (const bank of banks) {
        // Every write is on change: this publishes every camera frame (motion-freezes-membership.md). A stack's scenes
        // share one camera, so what was last written is kept once for the stack, not read back from each scene.
        const set = (element: HTMLElement, property: 'opacity' | 'visibility' | 'display', value: string) => {
          if (element.style[property] !== value) element.style[property] = value;
        };
        if (bank.perspective !== perspective) { bank.perspective = perspective; for (const { camera } of bank.scenes) camera.style.perspective = perspective; }
        if (bank.perspectiveOrigin !== perspectiveOrigin) { bank.perspectiveOrigin = perspectiveOrigin; for (const { camera } of bank.scenes) camera.style.perspectiveOrigin = perspectiveOrigin; }
        if (bank.transform !== cssTransform) { bank.transform = cssTransform; for (const { scene } of bank.scenes) scene.style.transform = cssTransform; }
        const weight = weights[bank.axis];
        const returning = weight > 0 && bank.projection.style.display === 'none';
        if (weight > 0 && !bank.loaded) {
          // Leaves cut from one atlas share its address.
          const images = new Map<string, string>();
          for (const { element, path } of bank.textures) {
            let image = images.get(path);
            if (image === undefined) images.set(path, image = `url("${url(path)}")`);
            element.style.backgroundImage = image;
          }
          bank.loaded = true;
        }
        if (returning) revealLarge(bank);
        // Around a body, the sheets within one sampling step of the camera or of the body are left out (Sheet): an opacity
        // write on change only, and every sheet back when the bank is its page's subject again.
        if (weight > 0 && bank.reach > 0) for (const texture of bank.textures) {
          const shown = body && texture.sheet && (withinReach(texture.sheet, local.positionUnits, bank.reach) || withinReach(texture.sheet, body, bank.reach)) ? '0' : '';
          if (texture.shown !== shown) { texture.shown = shown; texture.element.style.opacity = shown; }
        }
        // Never 1 (STACK_OPACITY_CEILING): a drag across M31 had its longest frame at 108 to 111 ms with a bank's opacity
        // reaching 1, and 67 to 72 ms under the ceiling (iPad, 2026-10-04).
        set(bank.projection, 'opacity', String(Math.min(STACK_OPACITY_CEILING, weight)));
        set(bank.projection, 'visibility', weight > 0 ? 'visible' : 'hidden');
        // A zero-weight axis contributes nothing; its 3D leaves leave compositing.
        set(bank.projection, 'display', weight > 0 ? '' : 'none');
      }
    },
    destroy() { if (destroyed) return; destroyed = true; root.remove(); },
  });
}

/** Narrow continuous transitions keep near-edge-on faces out of the chosen projection. A view alone keeps the whole
 * weight, seen edge-on too. */
export function imageLayerAxisWeights(orientation: readonly [number, number, number, number], views: readonly PreparedImageLayerView[]) {
  const matrix = worldRotationFromQuaternion(orientation);
  const strengths = views.map(view => Math.abs(matrix[2] * view.normalUnits[0] + matrix[5] * view.normalUnits[1] +
    matrix[8] * view.normalUnits[2]) / view.samplingStepUnits);
  const maximum = Math.max(...strengths);
  const weights = strengths.map(value => {
    const t = Math.max(0, Math.min(1, ((maximum > 0 ? value / maximum : 1) - 1 + .16) / .16));
    return t * t * (3 - 2 * t);
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(views.map((view, index) => [view.axis, weights[index] / total])) as Record<'x' | 'y' | 'z', number>;
}
