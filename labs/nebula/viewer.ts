import records from './subjects.json';
import sourceCatalog from './sources.json';
import * as runtimePolicy from '../../site/runtime-policy.mjs';
import { createObjectInteractionControls } from '../../src/renderers/css/navigation/object-interaction-controls';
import { worldCameraFromCenteredPresentation } from '../../src/renderers/css/navigation/world-camera';
import { worldRotationFromQuaternion } from '../../src/renderers/css/navigation/world-camera-math';
import { rotationFromMatrix3d } from '../../src/renderers/css/solar-system/heliocentric-geometry';
import { loadPreparedCssImageLayers } from '../../src/renderers/css/image-layers/loader';
import type { PreparedCssImageLayers } from '../../src/renderers/css/image-layers/loader';
import { mountPreparedCssImageLayers } from '../../src/renderers/css/image-layers/prepared-image-layer-runtime';
import { loadPreparedCssVolume } from '../../src/renderers/css/volume/loader';
import { mountPreparedCssVolume } from '../../src/renderers/css/volume/prepared-volume-runtime';
import type { PreparedCssVolume } from '../../src/renderers/css/volume/types';
import type { CameraDelta, CameraUpdate } from '../../src/renderers/css/navigation/types';
import '../../src/renderers/css/styles/volume.css';

declare const __NEBULA_REPO_ROOT__: string;
interface LabSubjectRecord {
  id: string;
  name: string;
  directory: string;
  /** Comparison image relative to directory, or imagePath relative to the repository. */
  image?: string;
  imagePath?: string;
  /** Reuse a photographed subject's reference catalogue for derived experiments. */
  sourceSubjectId?: string;
  comparisonImages?: { id: string; name: string; imagePath: string }[];
  sourcePageUrl?: string;
  credit?: string;
  modelNote?: string;
  framingRadiusUnits?: number;
  hasDetail?: boolean;
}
const subjectRecords: readonly LabSubjectRecord[] = records;
const localFile = (path: string) => `/@fs${__NEBULA_REPO_ROOT__}/${path}`;
const recipes = import.meta.glob('../../src/objects/*/source/recipe.json', { eager: true, import: 'default' }) as
  Record<string, { source: { publisherUrl: string; credit: string }; geometry: { supportRadiusKpc: number } }>;
const candidates = import.meta.glob('../../.local/nebula-lab/*-{cutout,diffuse,residual,mask}.png',
  { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const subjects = subjectRecords.map(record => {
  const recipe = recipes[`../../${record.directory}/source/recipe.json`];
  const imagePath = record.imagePath ?? (record.image ? `${record.directory}/${record.image}` : null);
  if (!imagePath) throw new TypeError(`Lab subject ${record.id} has no comparison image path.`);
  const sourceUrl = localFile(imagePath);
  const sourcePageUrl = record.sourcePageUrl ?? recipe?.source.publisherUrl;
  const credit = record.credit ?? recipe?.source.credit;
  const declared = sourceCatalog.subjects.find(item => item.subjectId === (record.sourceSubjectId ?? record.id))?.sources;
  const sourceImages = declared?.map(source => ({ id: source.id, name: source.name,
    sourceUrl: localFile(`labs/nebula/${source.path}`), sourcePageUrl: source.sourcePageUrl, credit: source.credit }))
    ?? [{ id: `${record.id}-source`, name: `${record.name} · source`, sourceUrl, sourcePageUrl, credit }];
  for (const comparison of record.comparisonImages ?? []) {
    sourceImages.push({ id: comparison.id, name: comparison.name, sourceUrl: localFile(comparison.imagePath),
      sourcePageUrl: sourceImages[0]?.sourcePageUrl,
      credit: `Offline extraction used by this volume. ${sourceImages[0]?.credit ?? ''}` });
  }
  for (const kind of ['cutout', 'diffuse', 'residual', 'mask']) {
    const url = candidates[`../../.local/nebula-lab/${record.id}-${kind}.png`];
    if (url) sourceImages.push({ id: `${record.id}-${kind}`, name: `Extraction candidate · ${kind}`, sourceUrl: url,
      sourcePageUrl, credit: `Local extraction experiment. Not a calibrated measurement. ${credit ?? ''}` });
  }
  return { ...record, sourceUrl, sourcePageUrl, credit, sourceImages, hasDetail: record.hasDetail ?? Boolean(recipe),
    framingRadiusUnits: record.framingRadiusUnits ?? recipe?.geometry.supportRadiusKpc };
});
type Axis = 'auto' | 'x' | 'y' | 'z';
type Component = 'all' | 'diffuse' | 'detail';
export interface LabState {
  subjectId: string; component: Component; axis: Axis; layer: number | null;
  layerCount: number; status: string; error?: string; distanceUnits?: number;
}

/** One inspected object; production input, transforms and retained leaves, without the application shell. */
export async function createNebulaLabViewer({ host, subjectId, onState }: {
  host: HTMLElement; subjectId: string; onState(state: LabState): void;
}) {
  const document = host.ownerDocument;
  const end = document.createElement('span'); end.hidden = true; host.append(end);
  host.style.touchAction = 'none';
  let subject = subjects.find(item => item.id === subjectId) ?? subjects[0];
  let payload: PreparedCssVolume | PreparedCssImageLayers | null = null;
  let mounted: { publish(publication: Parameters<ReturnType<typeof mountPreparedCssImageLayers>['publish']>[0]): void; destroy(): void } | null = null;
  let banks: { axis: Exclude<Axis, 'auto'>; root: HTMLElement; leaves: { nodes: HTMLElement[]; detail: boolean }[] }[] = [];
  let axis: Axis = 'auto', component: Component = 'all', layer: number | null = null;
  let layerCount = 0, status = 'Loading prepared object', error: string | undefined;
  let disposed = false, loadVersion = 0, frameRequest = 0, revision = 0;
  let radius = 1, fitDistance = 6, width = 1, height = 1, focal = 1;
  let rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180);
  const values = { rotX: 0, rotY: 0, zoom: 1, distance: fitDistance };
  const report = () => onState({ subjectId: subject.id, component, axis, layer, layerCount, status,
    ...(error ? { error } : {}), distanceUnits: values.distance });
  const schedule = () => {
    if (!disposed && !frameRequest) frameRequest = requestAnimationFrame(() => { frameRequest = 0; publish(); });
  };
  const camera = {
    get state() { return values; },
    update(partial: CameraUpdate) {
      if (partial.rotX !== undefined) values.rotX = partial.rotX;
      if (partial.rotY !== undefined) values.rotY = partial.rotY;
      if (partial.distance !== undefined) values.distance = Math.max(radius * .02, Math.min(fitDistance * 100, partial.distance));
      else if (partial.zoom !== undefined) values.distance = fitDistance / Math.max(.01, Math.min(100, partial.zoom));
      values.zoom = fitDistance / values.distance;
      schedule();
    },
  };
  function rotate(delta: CameraDelta) {
    camera.update({ rotX: values.rotX + delta.controlPitchDelta, rotY: values.rotY + delta.controlYawDelta,
      ...(delta.zoom === undefined ? {} : { zoom: delta.zoom }), ...(delta.distance === undefined ? {} : { distance: delta.distance }) });
    const m = delta.rotation ? worldRotationFromQuaternion(delta.rotation as [number, number, number, number]) : null;
    // CSS parsing reduces precision. Keep numeric matrices until the renderer writes CSS.
    const increment = m
      ? new DOMMatrix([m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1])
      : new DOMMatrix().rotateAxisAngle(1, 0, 0, delta.controlPitchDelta).rotateAxisAngle(0, 1, 0, delta.controlYawDelta);
    rotation = increment.multiply(rotation); revision++;
  }
  const controls = createObjectInteractionControls({ inputSurface: host, runtimePolicy, camera,
    trackballMetrics() {
      const rect = host.getBoundingClientRect(), projected = focal * radius / values.distance;
      return { centerX: rect.x + width / 2, centerY: rect.y + height / 2,
        radius: Math.max(width / 5, Math.min(width, projected)), surfaceRadius: projected,
        focalLength: focal, viewportWidth: width, tumbleOnly: true };
    },
    sceneMatrix: () => rotation.toString(), rotate, minimumZoom: .01, maximumZoom: 100,
    dolly: { stepPerDelta: .0015 }, surfaceFlyToHitTest: () => false,
    onStart() { host.style.cursor = 'grabbing'; }, onEnd() { host.style.cursor = 'grab'; },
    onError(failure) { error = String(failure); status = 'Interaction error'; report(); },
  });
  function dominantBank() {
    return banks.reduce((best, bank) => Number(bank.root.style.opacity) > Number(best.root.style.opacity) ? bank : best, banks[0]);
  }
  function inspectLayers() {
    if (!banks.length) return;
    const selected = axis === 'auto' ? dominantBank() : banks.find(bank => bank.axis === axis)!;
    const eligible = selected.leaves.filter(leaf => component === 'all' || (component === 'detail' ? leaf.detail : !leaf.detail));
    const countChanged = layerCount !== eligible.length; layerCount = eligible.length;
    if (layer !== null) layer = Math.max(0, Math.min(layerCount - 1, layer));
    for (const bank of banks) {
      if (axis !== 'auto') {
        bank.root.style.opacity = bank === selected ? '1' : '0';
        bank.root.style.visibility = bank === selected ? 'visible' : 'hidden';
      }
      let index = 0;
      for (const leaf of bank.leaves) {
        const included = component === 'all' || (component === 'detail' ? leaf.detail : !leaf.detail);
        for (const node of leaf.nodes) node.style.visibility = included && (layer === null || index === layer) ? '' : 'hidden';
        if (included) index++;
      }
    }
    if (countChanged) report();
  }
  function publish() {
    if (!mounted || !payload || disposed) return;
    const frame = payload.frame;
    const world = worldCameraFromCenteredPresentation({ rotation: rotationFromMatrix3d(rotation), distanceUnits: values.distance },
      { ...frame, presentationToReference: worldRotationFromQuaternion(frame.localToReferenceXyzw), bodyRadiusM: radius * frame.metersPerUnit },
      { focalPixels: focal, principalOffsetPixels: [0, 0] });
    mounted.publish({ world, viewport: { widthPixels: width, heightPixels: height, focalPixels: focal, principalOffsetPixels: [0, 0] } });
    inspectLayers(); host.dataset.cameraRevision = String(revision); host.dataset.distance = String(values.distance);
  }
  function measure() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight); focal = Math.max(width, height) * 1.15;
    schedule();
  }
  const observer = new ResizeObserver(measure); observer.observe(host); measure();
  function reset() {
    controls.stop(); rotation = new DOMMatrix().rotateAxisAngle(1, 0, 0, 180);
    fitDistance = Math.max(radius * 2, focal * radius / (Math.min(width, height) * .32));
    values.distance = fitDistance; values.zoom = 1; values.rotX = values.rotY = 0; revision++;
    schedule(); report();
  }
  async function setSubject(id: string) {
    const next = subjects.find(item => item.id === id);
    if (!next) throw new TypeError(`Unknown lab subject: ${id}`);
    const version = ++loadVersion;
    controls.stop(); subject = next; status = 'Loading prepared object'; error = undefined;
    axis = 'auto'; component = 'all'; layer = null;
    mounted?.destroy(); mounted = null; banks = []; payload = null; host.dataset.ready = 'false'; report();
    try {
      const fetchBytes = async (path: string) => {
        const response = await fetch(localFile(`${next.directory}/${path}`));
        if (!response.ok) throw new Error(`Missing prepared resource: ${path} (${response.status})`);
        return response.arrayBuffer();
      };
      const descriptor = JSON.parse(new TextDecoder().decode(await fetchBytes('object.json')));
      const isImage = descriptor.type === 'image-layer-bank';
      const loaded = await (isImage ? loadPreparedCssImageLayers : loadPreparedCssVolume)(descriptor, { read: fetchBytes });
      if (disposed || version !== loadVersion) return;
      const resourceUrl = (path: string) => localFile(`${next.directory}/prepared/${path}`);
      // Decode the selected fixed bank before presenting it; no source processing happens in the lab renderer.
      const queue = [...loaded.resources];
      await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
        while (queue.length && !disposed && version === loadVersion) {
          const resource = queue.shift()!; const image = new Image(); image.src = resourceUrl(resource.path); await image.decode();
        }
      }));
      if (disposed || version !== loadVersion) return;
      payload = loaded;
      const options = { host, before: end, payload: loaded, resolveResource: resourceUrl };
      const instance = isImage ? mountPreparedCssImageLayers({ ...options, payload: loaded as PreparedCssImageLayers }) : mountPreparedCssVolume(options);
      mounted = instance;
      const roots = 'root' in instance ? [...instance.root.querySelectorAll<HTMLElement>('[data-image-layer-axis]')] : instance.roots;
      banks = loaded.stacks.map((stack, index) => {
        const nodes = [...roots[index].querySelectorAll<HTMLElement>('.css-volume-mesh s')], copies = isImage ? 1 : 3;
        return { axis: stack.axis, root: roots[index], leaves: stack.leaves.map((leaf, leafIndex) => ({
          nodes: nodes.slice(leafIndex * copies, (leafIndex + 1) * copies), detail: leaf.id.endsWith('detail') })) };
      });
      radius = next.framingRadiusUnits ?? Math.max(...loaded.frame.boundsUnits.max.map((v, index) => (v - loaded.frame.boundsUnits.min[index]) / 2));
      status = `${loaded.resources.length} prepared images · ${(loaded.resources.reduce((sum, item) => sum + item.bytes, 0) / 1e6).toFixed(1)} MB`;
      host.dataset.subject = id; host.dataset.ready = 'true'; reset();
    } catch (failure) {
      if (disposed || version !== loadVersion) return;
      status = 'Could not load prepared object'; error = failure instanceof Error ? failure.message : String(failure); report();
    }
  }
  await setSubject(subject.id);
  return Object.freeze({ setSubject, reset,
    setComponent(value: Component) {
      if (!['all', 'diffuse', 'detail'].includes(value)) throw new TypeError('Unknown component.');
      component = value; if (value !== 'all') axis = 'z'; layer = null; publish(); report();
    },
    setAxis(value: Axis) {
      if (!['auto', 'x', 'y', 'z'].includes(value)) throw new TypeError('Unknown axis.');
      axis = value; if (value !== 'z') component = 'all'; layer = null; publish(); report();
    },
    setLayer(value: number | null) {
      if (value !== null && (!Number.isInteger(value) || value < 0)) throw new TypeError('Invalid layer index.');
      if (value !== null && axis === 'auto') axis = dominantBank().axis;
      layer = value; publish(); report();
    },
    destroy() {
      if (disposed) return; disposed = true; loadVersion++; cancelAnimationFrame(frameRequest);
      observer.disconnect(); controls.destroy(); mounted?.destroy(); end.remove();
    },
  });
}
