import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parsePreparedWorldContext, mountPreparedWorldContext } from '../../../src/renderers/css/universe/prepared-world-context.js';
import { mountPreparedOrbitLines } from '../../../src/renderers/css/solar-system/prepared-orbit-lines.js';
import { mountPreparedCssSky, preparedSkyCameraTransform } from '../../../src/renderers/css/sky/prepared-sky-runtime.js';
import { loadPreparedCssVolume } from '../../../src/renderers/css/volume/loader.js';
import { savedWorldCamera } from '../../../src/renderers/css/navigation/saved-world-camera.js';
import { rotateWorldPosition, transposeWorldRotation, worldRotationFromQuaternion } from '../../../src/renderers/css/navigation/world-camera-math.js';
import type { PreparedWorldCameraFrame } from '../../../src/renderers/css/navigation/world-camera.js';
import type { SharedView } from '../../../src/renderers/css/navigation/view-url.js';
import { contextMarkerSprite } from '../../../src/navigation/marker-presentation.mts';
import { PREPARED_NAVIGATION_MARKERS } from '../../../site/prepared-navigation-markers.mjs';
import type { OrbitSegment } from '../../../src/renderers/css/solar-system/heliocentric-view.js';

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
export function addNativeSolarContext(document: Document, frame: PreparedWorldCameraFrame, saved: SharedView, selectedId: string) {
  const viewport = { focalPixels: 1000, widthPixels: 1e9, heightPixels: 1e9, principalOffsetPixels: [0, 0] as const };
  const world = savedWorldCamera(saved, frame, viewport);
  const rotation = transposeWorldRotation(worldRotationFromQuaternion(world.pose.orientationXyzw));
  const eye = (position: readonly number[]) => rotateWorldPosition(rotation, [position[0] - world.pose.positionM[0], position[1] - world.pose.positionM[1], position[2] - world.pose.positionM[2]]);
  const stage = document.querySelector<HTMLElement>('.planet-stage')!;
  const worldStage = document.querySelector<HTMLElement>('.planet-world-stage')!;
  const overlays = document.querySelector<HTMLElement>('.planet-scene-overlays')!;
  if (!volume.sky) throw new Error('The shared prepared sky is missing.');
  const sky = mountPreparedCssSky({ host: worldStage, before: stage, payload: volume.sky, resources: volume.resources,
    resolveResource: path => `/src/objects/milky-way/prepared/${path}` });
  sky.publish(world, viewport);
  sky.root.style.zIndex = '-2';
  const skyTransform = preparedSkyCameraTransform(world, viewport, volume.sky.parallax);
  const translation = /^translate3d\(([-\d.e+]+)px,([-\d.e+]+)px,([-\d.e+]+)px\) (.*)$/u.exec(skyTransform);
  if (!translation) throw new Error('The shared sky camera did not publish its physical transform.');
  for (const camera of sky.root.querySelectorAll<HTMLElement>('.prepared-celestial-sky-camera')) camera.style.perspective = 'var(--native-focal)';
  for (const scene of sky.root.querySelectorAll<HTMLElement>('.prepared-celestial-sky-scene')) scene.style.transform =
    `translate3d(${translation[1]}px,${translation[2]}px,calc(var(--native-focal) + ${Number(translation[3]) - viewport.focalPixels}px - var(--native-dolly-m) / ${volume.sky.parallax?.metersPerCssPixel ?? Infinity} * 1px)) ${translation[4]}`;

  // The live builder supplies the exact marker DOM and shared styles.
  const end = document.createElement('span'); end.hidden = true; overlays.append(end);
  const context = mountPreparedWorldContext({ host: stage, presentationHost: overlays, before: end, plan, sprites });
  const rules: string[] = [];
  const project = (point: readonly number[]) => ({
    x: `calc(var(--native-focal) * ${number(point[0])} / max(1, ${number(-point[2])} + var(--native-dolly-m)))`,
    y: `calc(var(--native-focal) * ${number(point[1])} / max(1, ${number(-point[2])} + var(--native-dolly-m)))`,
    depth: `calc(${number(-point[2])} + var(--native-dolly-m))`,
  });
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
    marker.dataset.contextInverseScale = '1';
    marker.dataset.contextBodyVisible = 'false';
    marker.dataset.contextSelected = String(entry.id === selectedId);
    marker.style.inset = '14px';
    mover.replaceWith(link); link.append(marker);
    if (entry.id === selectedId) link.classList.add('native-context-selected');
    // A CSS timeline boundary clips the link's whole hit target to the actual
    // responsive viewport, so offscreen points do not enter keyboard order.
    const startDistanceM = saved.camera.distanceKilometers! * 1000;
    const p = eye(point.positionM), maxLog = Math.log(solarMaximumDistanceM / startDistanceM);
    link.style.setProperty('--native-enter-log', `log(max(${entry.id === selectedId ? 64 : .5}, (${number(startDistanceM + p[2])} + max(${point.radiusM + 1}, ${Math.abs(p[0])} * var(--native-focal) / (50cqw - 22px), ${Math.abs(p[1])} * var(--native-focal) / (50cqh - 22px))) / ${startDistanceM}))`);
    const boundary = `calc(10% + min(0, var(--native-enter-log)) * ${10 / Math.LN2}% + max(0, var(--native-enter-log)) * ${90 / maxLog}%)`;
    rules.push(`@keyframes native-point-${entry.id}{from{visibility:hidden}to{visibility:visible}}`);
    link.style.animation = `native-point-${entry.id} steps(1,end) both`;
    link.style.setProperty('animation-timeline', '--native-zoom');
    link.style.setProperty('animation-range-end', boundary);

    if (orbitRoot && 'orbit' in point && point.orbit) {
      const orbit = point.orbit;
      const segments: OrbitSegment[] = orbit.verticesM.map((_, i) => [0, 0, 1, 0, orbit.trail[i] ?? 1]);
      const paint = mountPreparedOrbitLines(orbitRoot, { renderer: 'bars', capacity: segments.length });
      paint.publish(segments);
      orbitRoot.style.width = orbitRoot.style.height = '100%'; orbitRoot.style.opacity = 'calc(.65 * var(--native-orbit-alpha))';
      const prepared = orbit.verticesM.map(position => project(eye(position)));
      for (const [i, node] of paint.elements.entries()) {
        if (!node || i >= prepared.length) continue;
        const a = prepared[i], b = prepared[(i + 1) % prepared.length];
        if (!(node instanceof document.defaultView!.HTMLElement)) throw new Error('The native orbit requires retained CSS bars.');
        node.style.setProperty('--nx0', a.x); node.style.setProperty('--ny0', a.y);
        node.style.setProperty('--nx1', b.x); node.style.setProperty('--ny1', b.y);
        node.style.setProperty('--ndx', 'calc(var(--nx1) - var(--nx0))'); node.style.setProperty('--ndy', 'calc(var(--ny1) - var(--ny0))');
        node.style.transform = 'translate(var(--nx0),var(--ny0)) rotate(atan2(var(--ndy),var(--ndx))) scaleX(calc(hypot(var(--ndx),var(--ndy)) / 1px))';
        node.style.opacity = `calc(${orbit.trail[i] ?? 1} * clamp(0, sign(min(${a.depth},${b.depth})), 1))`;
      }
    }
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
  return rules.join('\n');
}
