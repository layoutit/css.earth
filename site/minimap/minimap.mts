import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../../src/renderers/css/navigation/world-camera.js';
import { requiredElement } from '../browser-types.mts';
import prepared from './prepared.json' with { type: 'json' };
import { cssCameraAxesFromOrientation } from '../../src/renderers/css/dist/navigation.js';
import { minimapPointRange } from './point-range.mts';
import { minimapPointCovered } from './point-coverage.mts';
import { MOBILE_VIEWPORT_QUERY } from '../runtime-policy.mts';

// Spatial overview, published by the same camera as the main world.
// No second scene/camera, navigation writes, ephemeris work, or runtime geometry.
export function mountSpaceMinimap(documentTarget: Document) {
  const overlays = documentTarget.querySelector('.object-scene-overlays');
  if (!overlays) throw new Error('Minimap preview requires the shared scene overlay layer.');
  const root = documentTarget.createElement('div');
  root.className = 'space-minimap';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'Local space minimap, following the main camera position, orientation and zoom.');
  root.innerHTML = `<div class="space-minimap-shell" aria-hidden="true"><div class="space-minimap-content"><div class="space-minimap-galaxy" hidden></div><div class="space-minimap-world">${prepared.gridMarkup}</div><div class="space-minimap-points">${prepared.pointMarkup}</div></div></div>`;
  overlays.append(root);
  const grid = requiredElement(root, '.space-minimap-world');
  // Prepared markup holds body markers only: catalogue stars are drawn by the
  // SVG star layer and never get a DOM leaf. Keep one slot per prepared point.
  const bodyDots = new Map([...root.querySelectorAll<HTMLElement>('.space-minimap-dot')].map(dot => [dot.dataset.body, dot]));
  const dots = prepared.points.map(point => {
    if (point.classification === 'catalog-star') return null;
    const dot = bodyDots.get(point.id);
    if (!dot) throw new Error(`Minimap marker is missing for ${point.id}.`);
    return dot;
  });
  const markerRadii = new Map<string | undefined, number>();
  const dotRadii = dots.map(dot => {
    if (!dot) return 0;
    const classification = dot.dataset.classification;
    if (!markerRadii.has(classification)) {
      markerRadii.set(classification, parseFloat(documentTarget.defaultView!.getComputedStyle(dot).width) / 2);
    }
    return markerRadii.get(classification)!;
  });
  const galaxy = requiredElement(root, '.space-minimap-galaxy');
  const starColor = prepared.points.map(point => point.color);
  const projected = dots.map((dot, index) => ({
    index, radius: dotRadii[index], x: 0, y: 0, alpha: 0,
    // Only the existing full-opacity marker classes can cover another point.
    // An unfamiliar/transparent CSS color conservatively keeps drawing below it.
    opaque: dot !== null && ['planet', 'star'].includes(prepared.points[index].classification) &&
      /^rgb\(/.test(documentTarget.defaultView!.getComputedStyle(dot).backgroundColor),
  }));
  // Immutable per-point inputs, read once: publication allocates nothing per point.
  const count = dots.length;
  const px = new Float64Array(count), py = new Float64Array(count), pz = new Float64Array(count);
  const baseOpacity = new Float64Array(count), insetRadius = new Float64Array(count);
  const catalogStar = new Uint8Array(count), hiddenMask = new Uint8Array(count);
  const indexById = new Map<string, number>();
  prepared.points.forEach((point, index) => {
    [px[index], py[index], pz[index]] = point.positionM;
    baseOpacity[index] = point.classification === 'catalog-star' ? CATALOG_STAR_OPACITY
      : ['planet', 'star'].includes(point.classification) ? 1 : .85;
    // Bound the 3D neighborhood independently of the middle plane's tilt.
    // Inset by the marker radius so its full screen projection stays inside
    // the invisible sphere, including when the grid is exactly edge-on.
    insetRadius[index] = prepared.radius - dotRadii[index] - .5;
    catalogStar[index] = point.classification === 'catalog-star' ? 1 : 0;
    indexById.set(point.id, index);
  });
  // The minimap is decorative. Catalogue stars are drawn once per camera
  // orientation as a few SVG paths; a zoom moves them with one group transform.
  const starLayer = createStarLayer(requiredElement(root, '.space-minimap-points'),
    Array.from({ length: count }, (_, index) => index).filter(index => catalogStar[index]), starColor, px, py, pz, prepared.radius);
  // Body dots keep a layout box; per-frame entry and exit only toggle visibility.
  for (const dot of dots) if (dot) { dot.style.visibility = 'hidden'; dot.hidden = false; }
  // Last published DOM state. Unchanged dots and attributes are not written.
  const writtenX = new Float64Array(count).fill(Number.NaN), writtenY = new Float64Array(count).fill(Number.NaN);
  const writtenAlpha = new Float64Array(count).fill(Number.NaN);
  const shown = new Uint8Array(count);
  const visibleStamp = new Uint32Array(count);
  let visibleList: number[] = [], nextVisible: number[] = [], generation = 0;
  const attributes = new Map<string, string>();
  const setData = (name: string, value: string) => {
    if (attributes.get(name) !== value) { root.dataset[name] = value; attributes.set(name, value); }
  };
  const included = new Uint8Array(count), foreground: (typeof projected)[number][] = [];
  let viewportKey = '', coverageGuard = Infinity;
  let focus: {positionM: readonly number[]; radiusM: number} = prepared.defaultFocus;
  let lastView = '', lastGridTransform = '', lastGalaxyTransform = '', lastGalaxyOpacity = '', destroyed = false;
  // Phones hide the minimap, so its points are never worth projecting there.
  const phone = documentTarget.defaultView!.matchMedia(MOBILE_VIEWPORT_QUERY);
  return {
    selectObject(frame: PreparedWorldCameraFrame) { focus = { positionM: frame.originM, radiusM: frame.bodyRadiusM }; lastView = ''; },
    /** Omit these bodies from the next publication. The asteroid setting hides
     * its dots here as well, so the overview agrees with the main world. */
    setHiddenBodies(ids: readonly string[]) {
      hiddenMask.fill(0);
      for (const id of ids) { const index = indexById.get(id); if (index !== undefined) hiddenMask[index] = 1; }
      lastView = '';
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport) {
      if (destroyed || phone.matches) return;
      const compatible = world.referenceFrame === prepared.referenceFrame && world.epochJdTt === prepared.epochJdTt;
      if (root.hidden !== !compatible) root.hidden = !compatible;
      if (!compatible) return;
      const view = [...world.pose.orientationXyzw, ...world.pose.positionM, viewport.focalPixels, viewport.widthPixels, viewport.heightPixels].join(',');
      if (view === lastView) return;
      lastView = view;
      const dpr = Math.min(1, documentTarget.defaultView!.devicePixelRatio || 1);
      const nextViewportKey = `${viewport.widthPixels},${viewport.heightPixels},${dpr}`;
      if (nextViewportKey !== viewportKey) {
        viewportKey = nextViewportKey;
        const mapScale = Number(documentTarget.defaultView!.getComputedStyle(root).getPropertyValue('--map-scale'));
        // Reserve a device-pixel diagonal at the edges, using DPR 1 even on
        // denser screens. Responsive scaling may require a larger local guard.
        coverageGuard = mapScale > 0 ? Math.SQRT2 / (mapScale * dpr) : Infinity;
      }
      // The diagram is drawn in screen axes, +y down.
      const cameraToReference = cssCameraAxesFromOrientation(world.pose.orientationXyzw);
      const referenceToCamera = transpose(cameraToReference);
      const toFocus = focus.positionM.map((value, axis) => value - world.pose.positionM[axis]);
      const focusEye = rotate(referenceToCamera, toFocus);
      const depth = Math.max(focus.radiusM, -focusEye[2], Math.hypot(...toFocus) * .05);
      const spanPixels = Math.min(viewport.widthPixels ?? 1000, viewport.heightPixels ?? 800);
      const rangeM = Math.max(1, depth * spanPixels / (2 * viewport.focalPixels) * 1.15);
      const forward = rotate(cameraToReference, [0, 0, -depth]);
      const centerM = world.pose.positionM.map((value, axis) => value + forward[axis]);
      const scale = prepared.radius / rangeM;
      const galaxyFade = Math.max(0, Math.min(1, Math.log(rangeM / prepared.galaxy.fadeStartM) / Math.log(prepared.galaxy.fullM / prepared.galaxy.fadeStartM)));
      const plane = galaxyFade > 0 ? prepared.galaxy.planeToReference : prepared.diagramToReference;
      const diagramToCamera = multiply(referenceToCamera, plane);
      // The grid alone consumes this matrix. An inherited custom property on
      // the root can invalidate unrelated retained points when it changes.
      const gridTransform = cssMatrix(diagramToCamera, true);
      if (gridTransform !== lastGridTransform) {
        grid.style.transform = gridTransform;
        lastGridTransform = gridTransform;
      }
      setData('radiusM', String(rangeM));
      setData('centerM', centerM.join(','));
      setData('scope', rangeM >= 5e6 * 3.085677581491367e16 ? 'nearby-universe' : rangeM >= 1e5 * 3.085677581491367e16 ? 'local-group' : galaxyFade > 0 ? 'galaxy' : rangeM > 1e16 ? 'stellar' : 'system');
      let visibleBodies = 0;
      const [cx, cy, cz] = centerM;
      const [m0, m1, m2, m3, m4, m5] = referenceToCamera;
      starLayer.publish(referenceToCamera, centerM, scale);
      included.fill(0);
      const [first, end] = minimapPointRange(prepared.points, prepared.pointOrderX, cx, rangeM);
      for (let entry = first; entry < end; entry++) {
        const index = prepared.pointOrderX[entry];
        if (hiddenMask[index] || catalogStar[index]) continue;
        const dx = px[index] - cx, dy = py[index] - cy, dz = pz[index] - cz;
        const fraction = Math.hypot(dx, dy, dz) * scale / insetRadius[index];
        if (fraction >= 1) continue;
        const projection = projected[index];
        projection.x = (m0 * dx + m1 * dy + m2 * dz) * scale;
        projection.y = (m3 * dx + m4 * dy + m5 * dz) * scale;
        const classification = prepared.points[index].classification;
        const startM = classification === 'galaxy' ? 1e5 * 3.085677581491367e16 : classification === 'galaxy-cluster' ? 5e6 * 3.085677581491367e16 : 0;
        const scaleOpacity = startM > 0 ? Math.max(0, Math.min(1, Math.log2(rangeM / startM))) : 1;
        if (scaleOpacity === 0) continue;
        projection.alpha = baseOpacity[index] * Math.min(1, (1 - fraction) / .06) * scaleOpacity;
        included[index] = 1;
        visibleBodies++;
      }
      // Prepared point order is the retained DOM paint order. Visit foreground
      // markers first, while leaving the DOM, source positions and counts intact.
      foreground.length = 0; nextVisible.length = 0;
      const stamp = ++generation;
      for (let index = count - 1; index >= 0; index--) {
        if (!included[index]) continue;
        const point = projected[index];
        let covered = false;
        for (let front = 0; front < foreground.length && !covered; front++) covered = minimapPointCovered(point, foreground[front]!, coverageGuard);
        if (covered) continue;
        const dot = dots[index]!;
        visibleStamp[index] = stamp; nextVisible.push(index);
        if (!shown[index]) { dot.style.visibility = ''; shown[index] = 1; }
        if (writtenX[index] !== point.x || writtenY[index] !== point.y) {
          dot.style.transform = `translate(${point.x}px,${point.y}px)`;
          writtenX[index] = point.x; writtenY[index] = point.y;
        }
        if (writtenAlpha[index] !== point.alpha) { dot.style.opacity = String(point.alpha); writtenAlpha[index] = point.alpha; }
        if (point.opaque && point.alpha === 1) foreground.push(point);
      }
      for (const index of visibleList) {
        if (visibleStamp[index] !== stamp && shown[index]) { dots[index]!.style.visibility = 'hidden'; shown[index] = 0; }
      }
      [visibleList, nextVisible] = [nextVisible, visibleList];
      setData('visibleBodies', String(visibleBodies));
      if (galaxy.hidden !== (galaxyFade === 0)) galaxy.hidden = galaxyFade === 0;
      if (!galaxy.hidden) {
        const eye = rotate(referenceToCamera, prepared.galaxy.positionM.map((value, axis) => value - centerM[axis]));
        const rotation = multiply(referenceToCamera, prepared.galaxy.planeToReference);
        const size = prepared.galaxy.widthM * scale / 176;
        const transform = `translate(${eye[0] * scale}px,${eye[1] * scale}px) ${cssMatrix(rotation.map(value => value * size))}`;
        if (transform !== lastGalaxyTransform) { galaxy.style.transform = transform; lastGalaxyTransform = transform; }
        const opacity = String(galaxyFade * .65);
        if (opacity !== lastGalaxyOpacity) { galaxy.style.opacity = opacity; lastGalaxyOpacity = opacity; }
      }
    },
    destroy() { destroyed = true; root.remove(); },
  };
}

const CATALOG_STAR_OPACITY = .6;
const SVG_NS = 'http://www.w3.org/2000/svg';
// Round caps at 2.2 px emit the measured light of the former 1.5 px CSS dots.
// Opacity is bucketed into eight steps, so at most 17 colours x 8 paths exist.
// Stars are drawn in their prepared positions rotated into the camera, in units
// of STAR_UNIT_M. Only a camera rotation rewrites the paths; a zoom or pan writes
// one group transform. Non-scaling strokes keep every dot 2.2 px at any scale,
// pixel-identical to an untransformed dot. The round minimap clips its edge.
const STAR_UNIT_M = 1e15;
function createStarLayer(host: Element, stars: readonly number[], colors: readonly string[],
  px: Float64Array, py: Float64Array, pz: Float64Array, radiusPx: number) {
  const document = host.ownerDocument;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none';
  const group = document.createElementNS(SVG_NS, 'g');
  svg.append(group);
  host.prepend(svg);
  const members = new Map<string, number[]>();
  for (const index of stars) { const list = members.get(colors[index]) ?? []; list.push(index); members.set(colors[index], list); }
  const paths = [...members].map(([color, indices]) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', color);
    path.setAttribute('stroke-opacity', String(CATALOG_STAR_OPACITY));
    path.setAttribute('stroke-width', '2.2'); path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    group.append(path);
    return { path, indices };
  });
  let orientation = '', transform = '', displayed = true;
  const unit = (value: number) => Math.round(value / STAR_UNIT_M * 1e6) / 1e6;
  return {
    publish(m: readonly number[], center: readonly number[], scale: number) {
      // The minimap shows a sphere around its centre. When no star lies inside it,
      // the layer leaves layout: an SVG transform would otherwise lay out every path.
      let nearest = Infinity;
      for (const i of stars) nearest = Math.min(nearest, Math.hypot(px[i] - center[0], py[i] - center[1], pz[i] - center[2]));
      const inside = nearest * scale < radiusPx;
      if (inside !== displayed) { svg.style.display = inside ? '' : 'none'; displayed = inside; }
      if (!inside) return;
      const key = `${m[0]},${m[1]},${m[2]},${m[3]},${m[4]},${m[5]}`;
      if (key !== orientation) {
        orientation = key;
        for (const { path, indices } of paths) {
          let d = '';
          for (const i of indices) d += `M${unit(m[0] * px[i] + m[1] * py[i] + m[2] * pz[i])} ${unit(m[3] * px[i] + m[4] * py[i] + m[5] * pz[i])}h0`;
          path.setAttribute('d', d);
        }
      }
      const s = scale * STAR_UNIT_M;
      const x = -(m[0] * center[0] + m[1] * center[1] + m[2] * center[2]) * scale;
      const y = -(m[3] * center[0] + m[4] * center[1] + m[5] * center[2]) * scale;
      const next = `matrix(${s},0,0,${s},${x},${y})`;
      if (next !== transform) { group.setAttribute('transform', next); transform = next; }
    },
  };
}

// Transport the prepared diagram into the shared camera's eye coordinates.
function transpose(m: readonly number[]) { return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]; }
function rotate(m: readonly number[], p: readonly number[]) { return [0, 1, 2].map(row => m[row * 3] * p[0] + m[row * 3 + 1] * p[1] + m[row * 3 + 2] * p[2]); }
function multiply(a: readonly number[], b: readonly number[]) {
  return [0, 1, 2].flatMap(row => [0, 1, 2].map(col =>
    a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col]));
}
function cssMatrix(m: readonly number[], preservePrecision = false) {
  // Keep the precision of the former variable-substituted grid matrix. Chrome
  // rounds direct matrix tokens on its fast parser; calc uses full precision.
  // The diagram has no perspective, so its flat pieces project orthographically:
  // the 2D part of the rotation draws the same picture without a 3D scene, and
  // the spokes, ring and dots share one compositor layer instead of one each.
  const first = preservePrecision ? `calc(${m[0]})` : m[0];
  return `matrix(${[first, m[3], m[1], m[4], 0, 0].join(',')})`;
}
