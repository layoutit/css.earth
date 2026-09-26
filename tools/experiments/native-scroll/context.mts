import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { orbitVertices, parsePreparedWorldContext } from '@cssearth/renderer/prepared-data/world-context.ts';
import { mountPreparedWorldContext } from '@cssearth/renderer/universe/prepared-world-context.ts';
import { mountPreparedOrbitLines } from '@cssearth/renderer/solar-system/prepared-orbit-lines.ts';
import { mountPreparedCssSky, preparedSkyCameraTransform } from '@cssearth/renderer/sky/prepared-sky-runtime.ts';
import { loadPreparedCssVolume } from '@cssearth/renderer/volume/loader.ts';
import { savedWorldCamera } from '@cssearth/renderer/navigation/saved-world-camera.ts';
import { cssViewFromOrientation, rotateWorldPosition } from '@cssearth/renderer/navigation/world-camera-math.ts';
import type { PreparedWorldCameraFrame } from '@cssearth/renderer/navigation/world-camera.ts';
import type { SharedView } from '@cssearth/renderer/navigation/view-url.ts';
import { contextMarkerSprite } from '../../../src/navigation/marker-presentation.mts';
import { PREPARED_NAVIGATION_MARKERS } from '../../../site/prepared-navigation-markers.mjs';
import type { OrbitSegment } from '@cssearth/renderer/solar-system/types.ts';
import type { NativeCameraRotation } from './native-camera.mts';
import { prepareNativeOrbitCulling,nativeOrbitCullingCss } from './orbit-culling.mts';
import { BODY_INDICATOR_DIAMETER } from '@cssearth/renderer/universe/world-context/context-scale.ts';

const root = pathToFileURL(resolve('.') + '/');
const plan = parsePreparedWorldContext(JSON.parse(await readFile(new URL('src/objects/sun/prepared/world-context.json', root), 'utf8')));
const descriptor: unknown = JSON.parse(await readFile(new URL('src/objects/milky-way/object.json', root), 'utf8'));
const volume = await loadPreparedCssVolume(descriptor, { read: async path => {
  const bytes = await readFile(new URL(`src/objects/milky-way/${path}`, root));
  return Uint8Array.from(bytes).buffer;
} });
const sprites = Object.fromEntries(Object.entries(PREPARED_NAVIGATION_MARKERS).map(([id, marker]) => [id, contextMarkerSprite(marker)]));
const planetIds = new Set(plan.classificationViews?.planet?.memberIds);
const points = [plan.focus, ...plan.bodies];
const solarIds = new Set([plan.focus.id, ...planetIds]);
export const solarMaximumDistanceM = 4 * Math.max(...plan.bodies.filter(body => planetIds.has(body.id)).map(body => Math.hypot(...body.positionM)));
const number = (value: number) => Math.abs(value) < 1e-12 ? '0' : String(value);

/** Local proof: existing sky, marker and chord builders; CSS projects the
 * prepared positions along one fixed physical camera direction. */
export function addNativeSolarContext(document: Document, frame: PreparedWorldCameraFrame, saved: SharedView, selectedId: string, nativeCamera?: NativeCameraRotation) {
  const viewport = { focalPixels: 1000, widthPixels: 1e9, heightPixels: 1e9, principalOffsetPixels: [0, 0] as const };
  const world = savedWorldCamera(saved, frame, viewport);
  const rotation = cssViewFromOrientation(world.pose.orientationXyzw);
  const eye = (position: readonly number[]) => rotateWorldPosition(rotation, [position[0] - world.pose.positionM[0], position[1] - world.pose.positionM[1], position[2] - world.pose.positionM[2]]);
  const stage = document.querySelector<HTMLElement>('.object-stage')!;
  const worldStage = document.querySelector<HTMLElement>('.object-world-stage')!;
  const overlays = document.querySelector<HTMLElement>('.object-scene-overlays')!;
  if (!volume.sky) throw new Error('The shared prepared sky is missing.');
  const sky = mountPreparedCssSky({ host: worldStage, before: stage, payload: volume.sky, resources: volume.resources,
    resolveResource: path => `/src/objects/milky-way/prepared/${path}` });
  sky.publish(world, viewport);
  // The live publisher can cull faces again for each camera pose. A native
  // camera retains all six and lets CSS perspective clip them as it turns.
  if (nativeCamera) for (const face of sky.root.querySelectorAll<HTMLElement>('[data-sky-face]')) face.style.removeProperty('visibility');
  sky.root.style.zIndex = '-2';
  const skyTransform = preparedSkyCameraTransform(world, viewport, volume.sky.parallax);
  const translation = /^translate3d\(([-\d.e+]+)px,([-\d.e+]+)px,([-\d.e+]+)px\) (.*)$/u.exec(skyTransform);
  if (!translation) throw new Error('The shared sky camera did not publish its physical transform.');
  for (const camera of sky.root.querySelectorAll<HTMLElement>('.prepared-celestial-sky-camera')) camera.style.perspective = 'var(--native-focal)';
  const skyScale = volume.sky.parallax?.metersPerCssPixel ?? Infinity;
  const initialSkyPoint = [Number(translation[1]), Number(translation[2]), Number(translation[3]) - viewport.focalPixels];
  const skyPoint = nativeCamera?.skyPoint(initialSkyPoint, skyScale) ?? initialSkyPoint.map(number);
  for (const scene of sky.root.querySelectorAll<HTMLElement>('.prepared-celestial-sky-scene')) scene.style.transform =
    `translate3d(calc(${skyPoint[0]} * 1px),calc(${skyPoint[1]} * 1px),calc(var(--native-focal) + ${skyPoint[2]} * 1px - var(--native-dolly-m) / ${skyScale} * 1px)) ${nativeCamera?.transform ?? ''} ${translation[4]}`;

  // The live builder supplies the exact marker DOM and shared styles.
  const end = document.createElement('span'); end.hidden = true; overlays.append(end);
  const context = mountPreparedWorldContext({ host: stage, presentationHost: overlays, before: end, plan, sprites });
  const rules: string[] = [nativeOrbitCullingCss];
  const onScreen = (p: readonly string[], depth = `calc(-1 * ${p[2]} + var(--native-dolly-m))`) => ({
    x: `calc(var(--native-focal) * ${p[0]} / max(1, ${depth}))`,
    y: `calc(var(--native-focal) * ${p[1]} / max(1, ${depth}))`,
    depth: `calc(-1 * ${p[2]} + var(--native-dolly-m))`,
  });
  const project = (point: readonly (number|string)[]) =>
    onScreen(nativeCamera?.eyePoint(point) ?? point.map(value=>typeof value==='number'?number(value):value));
  // Chord endpoints are written relative to the eye centre, so each frame multiplies them by the rotation
  // without first subtracting the centre. The written values are the doubles that subtraction produced.
  const eyeCentre = nativeCamera?.eyeCentre ?? [0, 0, 0];
  const fromEye = (value: number, axis: number) => String((Math.abs(value) < 1e-12 ? 0 : value) - eyeCentre[axis]!);
  // A shared expression rule keeps every chord's prepared coordinates static.
  // Registered results prevent repeated expansion of projection token trees.
  // Both screen coordinates consume the already registered endpoint depth,
  // instead of repeating its camera projection in each denominator.
  const endpoint = (names: readonly string[], depth: string) => onScreen(nativeCamera?.eyeOffsetPoint(names) ?? names, depth);
  const a=endpoint(['var(--native-p0x)','var(--native-p0y)','var(--native-p0z)'], 'var(--native-z0)');
  const b=endpoint(['var(--native-p1x)','var(--native-p1y)','var(--native-p1z)'], 'var(--native-z1)');
  for(const name of ['--nx0','--ny0','--nx1','--ny1','--ndx','--ndy']) rules.push(`@property ${name}{syntax:'<length>';inherits:false;initial-value:0px}`);
  for(const name of ['--native-z0','--native-z1']) rules.push(`@property ${name}{syntax:'<number>';inherits:false;initial-value:0}`);
  rules.push(`.native-solar-orbits .native-orbit-segment {
    --nx0:${a.x};--ny0:${a.y};--nx1:${b.x};--ny1:${b.y};
    --native-z0:${a.depth};--native-z1:${b.depth};
    --ndx:calc(var(--nx1) - var(--nx0));--ndy:calc(var(--ny1) - var(--ny0));
    transform:translate(var(--nx0),var(--ny0)) rotate(atan2(var(--ndy),var(--ndx))) scaleX(calc(hypot(var(--ndx),var(--ndy)) / 1px));
    opacity:calc(var(--native-trail) * clamp(0, sign(min(var(--native-z0),var(--native-z1))), 1));
  }`);
  for (const entry of context.inspect()) {
    const marker = entry.billboard, mover = marker.parentElement!;
    const orbitRoot = context.root.querySelector<HTMLElement>(`[data-context-orbit="${entry.id}"]`);
    if (!solarIds.has(entry.id)) { mover.remove(); orbitRoot?.remove(); continue; }
    const point = points.find(point => point.id === entry.id)!;
    const projected = project(eye(point.positionM));
    const link = document.createElement('a'); link.href = `/${entry.id}/`;
    link.className = 'native-context-link'; link.setAttribute('aria-label', `Go to ${point.name}`);
    link.dataset.nativeDestination = entry.id;
    link.style.setProperty('--native-point-depth', projected.depth);
    link.style.cssText += `;left:50%;top:50%;transform:translate(calc(${projected.x} - 22px),calc(${projected.y} - 22px));`;
    marker.removeAttribute('role'); marker.removeAttribute('aria-disabled'); marker.removeAttribute('tabindex');
    marker.style.visibility = 'inherit'; marker.style.opacity = '1';
    marker.dataset.contextIndicatorVisible = 'true'; marker.dataset.contextLabelVisible = 'true';
    marker.style.setProperty('--context-inverse-scale', '1');
    marker.dataset.contextBodyVisible = 'false';
    marker.dataset.contextSelected = String(entry.id === selectedId);
    marker.style.inset = '14px';
    mover.replaceWith(link); link.append(marker);
    if (entry.id === selectedId) link.classList.add('native-context-selected');
    // A CSS timeline boundary clips the link's whole hit target to the actual
    // responsive viewport, so offscreen points do not enter keyboard order.
    const startDistanceM = saved.camera.distanceKilometers! * 1000;
    const initialPoint = eye(point.positionM), p = nativeCamera?.eyePoint(initialPoint) ?? initialPoint.map(number);
    const maxLog = Math.log(solarMaximumDistanceM / startDistanceM);
    const detailDepth=entry.id===selectedId?`${point.radiusM*2} * var(--native-focal) / ${BODY_INDICATOR_DIAMETER}px`:String(point.radiusM+1);
    link.style.setProperty('--native-enter-log', `log(max(.5, (${startDistanceM} + ${p[2]} + max(${point.radiusM + 1}, ${detailDepth}, abs(${p[0]}) * var(--native-focal) / (50cqw - 22px), abs(${p[1]}) * var(--native-focal) / (50cqh - 22px))) / ${startDistanceM}))`);
    const boundary = `calc(10% + min(0, var(--native-enter-log)) * ${10 / Math.LN2}% + max(0, var(--native-enter-log)) * ${90 / maxLog}%)`;
    rules.push(`@keyframes native-point-${entry.id}{from{visibility:hidden}to{visibility:visible}}`);
    link.style.animation = `native-point-${entry.id} steps(1,end) both`;
    link.style.setProperty('animation-timeline', '--native-zoom');
    link.style.setProperty('animation-range-end', boundary);

    if (orbitRoot && 'orbit' in point && point.orbit) {
      const orbit = point.orbit, vertices = orbitVertices(orbit);
      const segments: OrbitSegment[] = vertices.map((_, i) => [0, 0, 1, 0, orbit.trail[i] ?? 1]);
      const paint = mountPreparedOrbitLines(orbitRoot, { renderer: 'bars', capacity: segments.length });
      paint.publish(segments);
      orbitRoot.style.width = orbitRoot.style.height = '100%'; orbitRoot.style.opacity = 'calc(.65 * var(--native-orbit-alpha))';
      const prepared = vertices.map(position => eye(position));
      for (const [i, node] of paint.elements.entries()) {
        if (!node || i >= prepared.length) continue;
        const a = prepared[i], b = prepared[(i + 1) % prepared.length];
        if (!(node instanceof document.defaultView!.HTMLElement)) throw new Error('The native orbit requires retained CSS bars.');
        node.classList.add('native-orbit-segment');
        node.style.removeProperty('transform');node.style.removeProperty('opacity');
        for(const [axis,j] of ['x','y','z'].map((axis,j)=>[axis,j] as const)){
          node.style.setProperty(`--native-p0${axis}`,fromEye(a[j],j));
          node.style.setProperty(`--native-p1${axis}`,fromEye(b[j],j));
        }
        node.style.setProperty('--native-trail',String(orbit.trail[i]??1));
      }
      rules.push(prepareNativeOrbitCulling(orbitRoot,vertices,paint.elements,(orbit.lod?.levels??[]).map(level=>({...level,vertexIndices:[...level.vertexIndices],trail:[...level.trail],activeChords:[...level.activeChords]})),orbit.lod?.bounds,eye,nativeCamera));
    }
  }
  // A segment hidden by its orbit's level of detail skips the projection: these initial values win the
  // cascade over the projection rule, so the hidden segment's calc() declarations are never evaluated.
  const projected = ['--nx0', '--ny0', '--nx1', '--ny1', '--native-z0', '--native-z1', '--ndx', '--ndy', 'transform', 'opacity'];
  const lodLevels = Math.max(0, ...points.map(point => 'orbit' in point && point.orbit ? (point.orbit.lod?.levels ?? []).length : 0));
  for (let level = 1; level <= lodLevels; level++) {
    rules.push(`@container native-orbit style(--native-orbit-lod:${level}){.native-solar-orbits .native-orbit-segment:not(.native-lod-${level}){${projected.map(name => `${name}:initial`).join(';')}}}`);
  }
  // Construction listeners have no role in this serialized, script-free proof.
  // Detach them without removing the one returned tree.
  const retained = context.root.cloneNode(true); context.destroy(); overlays.insertBefore(retained, end); end.remove();
  // Keep the orbit paint behind the selected detail, in the existing world
  // stage's depth bands. Native link hit targets stay above the input surface.
  const orbitPaint = document.createElement('div');
  orbitPaint.className = 'prepared-world-context native-solar-orbits';
  orbitPaint.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:-1';
  for (const orbit of overlays.querySelectorAll('.context-orbit')) orbitPaint.append(orbit);
  worldStage.insertBefore(orbitPaint, stage);
  return [...new Set(rules)].join('\n');
}
