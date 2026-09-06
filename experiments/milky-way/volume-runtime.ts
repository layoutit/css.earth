import { mountVolumeControls } from './volume-controls.js';
import type { VolumeCamera, VolumeVector } from './volume-controls.js';
import { worldRotationCss, validateWorldRotation } from '../../src/renderers/css/navigation/world-camera-math.js';

const stage = document.getElementById('viewport');
const cameras = Array.from(document.querySelectorAll<HTMLElement>('.polycss-camera'));
const scenes = Array.from(document.querySelectorAll<HTMLElement>('.polycss-scene'));
const projections = Array.from(document.querySelectorAll<HTMLElement>('.polycss-projection'));
const status = document.getElementById('status');
if (!stage || cameras.length !== 3 || scenes.length !== 3 || projections.length !== 3 || !status) throw new Error('Prepared volume shell is incomplete');
const element = stage;
const statusElement = status;
const faces = Array.from(document.querySelectorAll<HTMLElement>('s[data-slice]'));
const DEG = Math.PI / 180;
const TILE = 50;
const dot = (a: VolumeVector, b: VolumeVector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
let state: VolumeCamera | null = null;
let dominant = 'z';
function present(camera: VolumeCamera): void {
  state = camera;
  const focal = Math.min(element.clientWidth, element.clientHeight) / (2 * Math.tan(22.5 * DEG));
  for (const element of cameras) element.style.perspective = `${focal}px`;
  // Prepared PolyCSS vertices are [worldY, worldX, worldZ] × BASE_TILE.
  // Reuse the renderer's rotation serializer; camera translation remains physical.
  const { right: r, up: u, back: b, position } = camera;
  const rotation = [r[1], r[0], r[2], -u[1], -u[0], -u[2], b[1], b[0], b[2]];
  validateWorldRotation(rotation);
  const translation = [-dot(r, position) * TILE, dot(u, position) * TILE, focal - dot(b, position) * TILE];
  const transform = `translate3d(${translation.map(value => `${value}px`).join(',')}) ${worldRotationCss(rotation)}`;
  for (const scene of scenes) scene.style.transform = transform;
  const strengths = [Math.abs(b[0]), Math.abs(b[1]), Math.abs(b[2])];
  const axisIndex = strengths.indexOf(Math.max(...strengths));
  dominant = ['x', 'y', 'z'][axisIndex] ?? 'z';
  // Each stack first projects its retained 3D geometry using the SAME observer.
  // Blend those completed projections in 2D, never the dust leaves themselves:
  // per-leaf alpha would double attenuation, and mesh opacity would flatten depth.
  const maximum = Math.max(...strengths);
  const weights = strengths.map(strength => {
    const t = Math.max(0, Math.min(1, (strength - maximum + 0.16) / 0.16));
    return t * t * (3 - 2 * t);
  });
  let cumulative = 0;
  for (const [index, projection] of projections.entries()) {
    const weight = weights[index] ?? 0;
    cumulative += weight;
    projection.style.display = weight > 0 ? 'block' : 'none';
    // Opaque black backgrounds and cumulative source-over alpha produce a
    // normalized weighted average, not additive light or doubled extinction.
    projection.style.opacity = String(cumulative > 0 ? weight / cumulative : 0);
  }
  const active = ['x', 'y', 'z'].filter((_, index) => (weights[index] ?? 0) > 0).join('+').toUpperCase();
  statusElement.textContent = `Camera ${position.map(value => value.toFixed(1)).join(', ')} · ${faces.length} prepared PolyCSS faces · ${active} slices active`;
  document.body.dataset.axis = dominant;
}

async function start(): Promise<void> {
  const sources = JSON.parse(document.getElementById('resources')?.textContent ?? 'null') as unknown;
  if (!Array.isArray(sources) || sources.some(source => typeof source !== 'string')) throw new Error('Invalid prepared resource bank');
  const images = sources.map(source => {
    const image = new Image();
    image.src = source as string;
    return image;
  });
  await Promise.all(images.map(image => image.decode()));
  const config = JSON.parse(document.getElementById('scene-config')?.textContent ?? 'null') as { solarPositionUnits?: unknown } | null;
  const solar = config?.solarPositionUnits;
  if (!Array.isArray(solar) || solar.length !== 3 || !solar.every(value => typeof value === 'number' && Number.isFinite(value))) throw new Error('Missing prepared Solar position');
  const solarPosition: VolumeVector = [solar[0], solar[1], solar[2]];
  const initial = { yawRadians: 25 * DEG, pitchRadians: 52 * DEG, distance: 30, target: [0, 0, 0] as VolumeVector };
  const controls = mountVolumeControls({ element, onChange: present, initial, worldRadius: 10,
    presets: {
      above: { ...initial, pitchRadians: 89 * DEG },
      oblique: initial,
      edge: { ...initial, yawRadians: 0, pitchRadians: 0 },
      below: { ...initial, pitchRadians: -70 * DEG },
      inside: { yawRadians: Math.PI, pitchRadians: 0.03, distance: 0.2, target: solarPosition },
    },
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-preset]')) button.addEventListener('click', () => {
    controls.preset(button.dataset.preset ?? 'oblique');
    element.focus({ preventScroll: true });
  });
  document.getElementById('reset')?.addEventListener('click', () => controls.reset());
  document.getElementById('wireframe')?.addEventListener('change', event => {
    document.body.classList.toggle('wireframe', (event.target as HTMLInputElement).checked);
  });
  const resize = new ResizeObserver(() => { if (state) present(state); });
  resize.observe(element);
  const project = (point: VolumeVector): readonly [number, number, number] => {
    const camera = controls.camera();
    const delta: VolumeVector = [point[0] - camera.position[0], point[1] - camera.position[1], point[2] - camera.position[2]];
    const depth = -dot(delta, camera.back);
    const focal = Math.min(element.clientWidth, element.clientHeight) / (2 * Math.tan(22.5 * DEG));
    return [element.clientWidth / 2 + dot(delta, camera.right) * focal / depth,
      element.clientHeight / 2 - dot(delta, camera.up) * focal / depth, depth];
  };
  Object.assign(window, { polycssMilkyWay: { controls, project, faces, images, activeAxis: () => dominant } });
  document.body.dataset.ready = 'true';
  window.addEventListener('pagehide', () => { controls.destroy(); resize.disconnect(); }, { once: true });
}
start().catch(error => {
  statusElement.textContent = `Volume failed to load: ${error instanceof Error ? error.message : String(error)}`;
  document.body.dataset.error = 'true';
  throw error;
});
