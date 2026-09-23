import type { ObjectRuntimeDefinition } from '../runtime/object-runtime-types.js';
import type { ObjectSelection } from '../runtime/object-contract.js';
import type { PreparedWorldCameraFrame } from '../navigation/world-camera.js';
import type { SharedView } from '../navigation/view-url.js';
import { savedWorldCamera } from '../navigation/saved-world-camera.js';
import { presentWorldCamera } from '../navigation/world-camera.js';
import { preparedCameraBasis } from '../navigation/prepared-camera-basis.js';
import { physicalProjectionFromCamera } from '../prepared-data/physical-projection.js';
import { createPreparedFramePublisher } from './prepared-presentation.js';

/** A native response publishes into the retained prepared tree with the live
 * material and frame publishers. CSS resolves its responsive focal length. */
export function publishPreparedNativeView(definition: ObjectRuntimeDefinition, selection: ObjectSelection,
  stage: HTMLElement, frame: PreparedWorldCameraFrame, saved: SharedView) {
  const focalCss = definition.camera.projection.cssPerspective;
  const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const };
  const world = savedWorldCamera(saved, frame, viewport), presentation = presentWorldCamera(world, frame, viewport);
  const nodes = definition.tree.nodes.map((_, index) => {
    const node = stage.querySelector<HTMLElement>(`[data-prepared-node="${index}"]`);
    if (!node) throw new TypeError('A saved native view requires its complete prepared tree.');
    return node;
  });
  const camera = nodes[definition.tree.camera], scene = nodes[definition.tree.scene];
  camera.style.perspective = focalCss;
  camera.style.scale = '1';
  camera.style.perspectiveOrigin = '50% 50%';
  stage.style.setProperty('--prepared-view-focal', focalCss);
  const [x, y, z] = presentation.bodyCenterUnits;
  const scale = definition.camera.sceneScale;
  scene.style.transform = `translate3d(${x}px,${y}px,calc(${focalCss} + ${z}px)) scale3d(${scale},${scale},${scale}) ${presentation.sceneMatrix}`;
  scene.hidden = z >= 0 || frame.bodyRadiusM / presentation.distanceM < 1e-10;
  const basis = preparedCameraBasis(definition.camera, presentation.sceneMatrix, definition.sun?.localDirection);
  const view = { ...basis, projection: physicalProjectionFromCamera(presentation.rotation, presentation.bodyCenterUnits, scale, viewport),
    controlPitch: definition.camera.defaultControlPitchDegrees,
    controlYaw: definition.camera.defaultControlYawDegrees,
    zoom: definition.camera.defaultZoom,
    principalOffset: viewport.principalOffsetPixels, stageViewport: viewport,
    levelOfDetail: { stage: "geometry", silhouetteDiameter: null, billboardOpacity: 0, markerOpacity: 0 },
    body: { visible: !scene.hidden, silhouette: presentation.silhouette },
  };
  const assets = new Map(definition.assets.entries.map(entry => [entry.key, entry.url]));
  if (!scene.hidden) createPreparedFramePublisher(definition, stage, nodes, scene).publish({ selection, view,
    resources: { has: key => assets.has(key), url: key => assets.get(key) ?? null } });
  // Projected caption/halo sizes are proportional to focal length. Keep that
  // relationship in CSS instead of assuming the request came from a desktop.
  for (const binding of definition.viewBindings) if (binding.kind === 'silhouette-fit' && presentation.silhouette) {
    const ellipse = presentation.silhouette, target = nodes[binding.target];
    const angle = Math.atan2(ellipse.radial[1], ellipse.radial[0]) * 180 / Math.PI;
    const length = (value: number) => `calc(var(--prepared-view-focal) * ${value / viewport.focalPixels})`;
    const radius = (value: number) => `calc(max(${binding.minimumRadius}px, ${length(value)}) / 1px * ${binding.unitScale})`;
    target.style.transform = `translate(${length(ellipse.centre[0])},${length(ellipse.centre[1])}) rotate(${angle}deg) scale(${radius(ellipse.radialSemiAxis)},${radius(ellipse.tangentialSemiAxis)}) rotate(${-angle}deg)`;
  }
  const timelines = [
    ...(definition.motion ?? []).map(plan => ({ ...plan, mode: 'motion' as const,
      duration: plan.timings.find(timing => Object.entries(timing.when).every(([name, value]) => ({ ...selection, speed: saved.playback.speed })[name] === value))?.duration ?? plan.duration,
      iterations: 'infinite', time: 0 })),
    ...definition.animations.map(plan => ({ ...plan, iterations: '1',
      time: Math.max(0, Math.min(plan.duration, (view.controlPitch - plan.sourceMinimum) * plan.millisecondsPerDegree)) })),
  ];
  if (saved.playback.times.length !== timelines.filter(plan => plan.mode === 'motion').length) throw new TypeError('Saved playback does not match the prepared scene.');
  let motionIndex = 0;
  const rules: string[] = [];
  for (const [index, plan] of timelines.entries()) {
    const name = `prepared-view-${definition.id}-${index}`;
    const time = plan.mode === 'motion' ? saved.playback.times[motionIndex++] : plan.time;
    const frames = nativeKeyframes(plan.keyframes);
    rules.push(`@keyframes ${name}{${frames.map(frame => `${frame.offset * 100}%{${frame.style}}`).join('')}}`);
    nodes[plan.target].style.animation = `${name} ${plan.duration}ms linear ${-time}ms ${plan.iterations} both paused`;
  }
  if (rules.length) {
    const style = stage.ownerDocument.createElement('style');
    style.dataset.preparedViewAnimations = '';
    style.textContent = rules.join('\n');
    stage.append(style);
  }
  return { world, view, nodes };
}

function nativeKeyframes(value: Keyframe[] | PropertyIndexedKeyframes): { offset: number; style: string }[] {
  const input: Keyframe[] = Array.isArray(value) ? value : (() => {
    const length = Math.max(...Object.values(value).map(entry => Array.isArray(entry) ? entry.length : 1));
    return Array.from({ length }, (_, index) => Object.fromEntries(Object.entries(value).map(([key, values]) =>
      [key, Array.isArray(values) ? values[index] : values])));
  })();
  if (input.length < 2) throw new TypeError('A prepared animation requires at least two frames.');
  const offsets = input.map(frame => frame.offset ?? null);
  offsets[0] ??= 0; offsets[offsets.length - 1] ??= 1;
  for (let start = 0; start < offsets.length - 1;) {
    let end = start + 1;
    while (offsets[end] === null) end++;
    for (let index = start + 1; index < end; index++) offsets[index] = offsets[start]! + (offsets[end]! - offsets[start]!) * (index - start) / (end - start);
    start = end;
  }
  return input.map((frame, index) => ({ offset: offsets[index]!, style: Object.entries(frame)
    .filter(([name, value]) => !['offset', 'easing', 'composite'].includes(name) && value !== undefined && value !== null)
    .map(([name, value]) => `${name.replace(/[A-Z]/gu, letter => `-${letter.toLowerCase()}`)}:${value}`).join(';') }));
}
