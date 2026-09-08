import { createNebulaLabViewer, localFile, subjects } from './viewer';
import { createBenchmarkView } from './benchmark-view';
import { defaultOverlayPlacement } from './overlay-placement';
import { createOverlayPlacementControls } from './overlay-placement-controls';
import { createToneControls } from './tone-controls';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const subject = element<HTMLSelectElement>('subject');
const controls = element<HTMLFieldSetElement>('render-controls');
const cameraPose = element<HTMLSelectElement>('camera-pose');
const axis = element<HTMLSelectElement>('axis');
const layer = element<HTMLInputElement>('layer');
const layerValue = element<HTMLOutputElement>('layer-value');
const status = element('status');
const image = element<HTMLImageElement>('source-image');
const imageStatus = element('source-image-status');
const sourceChoice = element<HTMLSelectElement>('source-choice');
const sourceLink = element<HTMLAnchorElement>('source-link');
const sourceCredit = element('source-credit');
const densityViewControls = element<HTMLFieldSetElement>('density-view-controls');
const densityAdjustmentPanel = element<HTMLElement>('density-adjustment-panel');
const densityToneFieldset = element<HTMLFieldSetElement>('density-tone-fieldset');
const overlayPanel = element<HTMLElement>('image-overlay-panel');
const overlayControls = element<HTMLFieldSetElement>('overlay-controls');
const overlayOptions = element('overlay-options');
const overlayChoice = element<HTMLSelectElement>('overlay-choice');
const overlayEnabled = element<HTMLInputElement>('overlay-enabled');
const overlayEnabledLabel = element<HTMLLabelElement>('overlay-enabled-label');
const overlayOpacity = element<HTMLInputElement>('overlay-opacity');
const overlayStatus = element('overlay-status');
const overlayRegistration = element('overlay-registration');
const overlayCredit = element('overlay-credit');
const overlaySource = element<HTMLAnchorElement>('overlay-source');
const tabs = ['render-tab', 'density-tab', 'source-tab', 'structure-tab'].map(id => element<HTMLButtonElement>(id));
const tabNames = ['render', 'density', 'source', 'structure'];
const benchmark = createBenchmarkView({ host: element('structure-panel'),
  catalogueUrl: localFile('labs/nebula/models/benchmarks.json') });
type Viewer = Awaited<ReturnType<typeof createNebulaLabViewer>>;
let viewer: Viewer | null = null;
let busy = false, disposed = false;
let sourceSubject: string | null = null;
let currentTab = 0;
let currentMode: 'photo' | 'density' = 'photo';
let modeRequest = 0;
let requestedMode: 'photo' | 'density' = 'photo';
let modePending = false;
type Overlay = Awaited<ReturnType<Viewer['loadOverlayCatalogue']>>[number];
let currentOverlays: Overlay[] = [];
let selectedOverlayId: string | null = null;
let overlayActivation = 0;
const densityTone = createToneControls({ host: element('density-tone-controls'), target: 'density',
  async onApply(_context, resources, isCurrent) {
    if (!viewer) throw new Error('Viewer is unavailable.');
    await viewer.applyToneResources('density', undefined, resources, isCurrent);
  } });
const imageTone = createToneControls({ host: element('image-tone-controls'), target: 'image',
  async onApply(context, resources, isCurrent) {
    if (!viewer) throw new Error('Viewer is unavailable.');
    await viewer.applyToneResources('image', context.imageId, resources, isCurrent);
  } });
function invalidateToneContexts() { densityTone.setContext(null); imageTone.setContext(null); }

for (const value of subjects) subject.add(new Option(value.name, value.id));

function selectTab(index: number, updateUrl = true) {
  currentTab = index;
  tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
  element('render-panel').setAttribute('aria-hidden', String(index !== 0 && index !== 1));
  element('source-panel').hidden = index !== 2;
  element('structure-panel').hidden = index !== 3;
  status.hidden = index === 3;
  if (index === 0) void switchMode('photo');
  if (index === 1) void switchMode('density');
  if (index === 2) showSource();
  if (index === 3) void benchmark.open();
  setBusy(busy);
  void refreshOverlayControls();
  if (updateUrl) {
    const url = new URL(location.href);
    if (index === 0) url.searchParams.delete('tab'); else url.searchParams.set('tab', tabNames[index]);
    history.replaceState(history.state, '', url);
  }
  updateCredit();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(index));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
      (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    selectTab(next); tabs[next].focus();
  });
});

function setBusy(value: boolean) {
  busy = value; subject.disabled = value || currentTab === 3; controls.disabled = value || currentTab === 3;
  const density = currentMode === 'density';
  const currentSubject = subjects.find(item => item.id === sourceSubject);
  const densityMissing = density && !subjects.find(item => item.id === sourceSubject)?.density;
  document.querySelectorAll<HTMLInputElement>('input[name="component"]').forEach(input => {
    input.disabled = value || density || (input.value === 'detail' && currentSubject?.hasDetail === false);
  });
  cameraPose.disabled = value || densityMissing; axis.disabled = value || densityMissing;
  layer.disabled = value || densityMissing || layer.max === '-1';
  element<HTMLButtonElement>('all-layers').disabled = value || densityMissing;
  element<HTMLButtonElement>('reset').disabled = value || densityMissing;
  densityViewControls.disabled = value || currentTab !== 1 || !density;
  densityToneFieldset.disabled = value || currentTab !== 1 || !density;
  overlayControls.disabled = value || currentTab !== 1 || !density;
  element<HTMLButtonElement>('reference-view').disabled = value || densityMissing;
  element<HTMLButtonElement>('fit-cloud').disabled = value || densityMissing;
  element('viewer').setAttribute('aria-busy', String(value));
}
function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  status.textContent = message; status.dataset.error = 'true';
  console.error(error);
}
async function run(action: () => unknown | Promise<unknown>) {
  if (!viewer || busy || disposed) return;
  try { await action(); } catch (error) { fail(error); }
}
function updateSource(id: string) {
  const item = subjects.find(value => value.id === id);
  if (!item) return;
  if (sourceSubject !== id) {
    sourceSubject = id;
    sourceChoice.replaceChildren(...item.sourceImages.map(source => new Option(source.name, source.id)));
    element('source-choice-wrapper').hidden = item.sourceImages.length < 2;
  }
  element('model-note').textContent = currentMode === 'density' && currentTab === 1 && item.density ? item.density.modelNote :
    'modelNote' in item && typeof item.modelNote === 'string' ? item.modelNote : 'Depth is modeled from a source image; it is not a measured 3D reconstruction.';
  document.querySelector<HTMLInputElement>('input[name="component"][value="detail"]')!.disabled = item.hasDetail === false;
  showSource();
  updateCredit();
}
function chosenSource() {
  return subjects.find(value => value.id === sourceSubject)?.sourceImages.find(source => source.id === sourceChoice.value);
}
function updateCredit() {
  const item = element('source-panel').hidden ? subjects.find(value => value.id === sourceSubject) : chosenSource();
  const density = currentMode === 'density' && currentTab === 1 ? subjects.find(value => value.id === sourceSubject)?.density : null;
  sourceLink.hidden = currentTab === 3 || !(density?.sourcePageUrl ?? item?.sourcePageUrl);
  if (density?.sourcePageUrl ?? item?.sourcePageUrl) sourceLink.href = density?.sourcePageUrl ?? item!.sourcePageUrl!;
  sourceCredit.textContent = density?.credit ?? item?.credit ?? '';
  sourceCredit.hidden = element('model-note').hidden = currentTab === 3;
}
let overlayRequest = 0;
function overlaySelectionKey(catalogue: string) { return `cssearth-nebula-selected-overlay:${catalogue}`; }
function storedOverlayId(catalogue: string) {
  try { return localStorage.getItem(overlaySelectionKey(catalogue)); } catch { return null; }
}
function rememberOverlayId(catalogue: string, id: string) {
  try { localStorage.setItem(overlaySelectionKey(catalogue), id); } catch { /* Selection still works without storage. */ }
}
function toneReadyFor(subjectId: string) {
  const host = element('viewer');
  return !busy && !modePending && host.dataset.ready === 'true' && host.dataset.mode === 'density' && host.dataset.subject === subjectId;
}
function renderSelectedOverlay() {
  if (!viewer || !selectedOverlayId) return;
  const item = subjects.find(value => value.id === sourceSubject), overlay = currentOverlays.find(value => value.id === selectedOverlayId);
  if (!item?.density?.overlays || !overlay) return;
  const prior = viewer.getOverlayState().find(value => value.id === overlay.id);
  overlayChoice.value = overlay.id;
  overlayEnabled.id = `overlay-${overlay.id}`; overlayEnabledLabel.htmlFor = overlayEnabled.id;
  overlayEnabled.checked = prior?.enabled ?? false;
  overlayOpacity.value = String(Math.round((prior?.opacity ?? overlay.initialOpacity ?? .55) * 100));
  overlayOpacity.setAttribute('aria-label', `${overlay.label} opacity`);
  const identity = defaultOverlayPlacement(), fitted = overlay.initialPlacement ?? identity;
  const placement = createOverlayPlacementControls({ id: overlay.id, label: overlay.label,
    placement: prior?.placement ?? fitted, defaults: fitted, ...(overlay.initialPlacement ? { original: identity } : {}),
    savedLocally: element('viewer').dataset.overlayStorage === 'saved',
    async onCopy() {
      const saved = viewer!.getOverlayState().find(value => value.id === overlay.id);
      const value = saved?.placement ?? fitted;
      await navigator.clipboard.writeText(JSON.stringify({
        schema: 'cssearth-nebula-image-placement@1', subjectId: item.id,
        overlayCatalogue: item.density!.overlays, imageId: overlay.id,
        positionKpc: { x: value.x, y: value.y, z: value.z },
        rotationDegrees: { x: value.rotationX, y: value.rotationY, z: value.rotationZ },
        scale: value.scale, opacity: saved?.opacity ?? overlay.initialOpacity ?? .55, tone: imageTone.getValue(),
      }, null, 2));
    },
    onChange: partial => { try { viewer!.setOverlayPlacement(overlay.id, partial); } catch (error) { fail(error); } } });
  overlayOptions.replaceChildren(placement);
  overlayRegistration.textContent = overlay.registrationNote; overlayCredit.textContent = overlay.credit;
  overlaySource.href = overlay.sourcePageUrl;
  overlayStatus.textContent = `${currentOverlays.indexOf(overlay) + 1} of ${currentOverlays.length} images`;
  overlayPanel.dataset.selectedOverlay = overlay.id;
  imageTone.setContext(toneReadyFor(item.id) ? { subjectId: item.id, imageId: overlay.id } : null);
}
async function activateOverlay(id: string) {
  if (!viewer) return;
  const activation = ++overlayActivation, state = new Map(viewer.getOverlayState().map(value => [value.id, value]));
  for (const overlay of currentOverlays) {
    if (activation !== overlayActivation) return;
    const saved = state.get(overlay.id);
    if (overlay.id !== id && saved?.enabled) await viewer.setOverlay(overlay.id, false, saved.opacity);
  }
  if (activation !== overlayActivation) return;
  const selected = currentOverlays.find(overlay => overlay.id === id), saved = state.get(id);
  await viewer.setOverlay(id, true, saved?.opacity ?? selected?.initialOpacity ?? .55);
  if (activation === overlayActivation && selectedOverlayId === id) renderSelectedOverlay();
}
async function refreshOverlayControls() {
  const item = subjects.find(value => value.id === sourceSubject), catalogue = item?.density?.overlays;
  const densityVisible = currentTab === 1 && currentMode === 'density' && Boolean(item?.density);
  const visible = densityVisible && Boolean(catalogue);
  densityViewControls.hidden = !densityVisible; densityAdjustmentPanel.hidden = !densityVisible; overlayPanel.hidden = !visible;
  densityTone.setContext(densityVisible && item && toneReadyFor(item.id) ? { subjectId: item.id } : null);
  if (!visible) imageTone.setContext(null);
  currentOverlays = []; selectedOverlayId = null; overlayOptions.replaceChildren();
  overlayStatus.textContent = ''; overlayRegistration.textContent = ''; overlayCredit.textContent = ''; overlaySource.removeAttribute('href');
  if (!visible || !viewer || !catalogue) return;
  const request = ++overlayRequest;
  try {
    const overlays = await viewer.loadOverlayCatalogue();
    if (request !== overlayRequest || currentTab !== 1 || currentMode !== 'density') return;
    currentOverlays = overlays;
    overlayChoice.replaceChildren(...overlays.map(overlay => new Option(overlay.label, overlay.id)));
    const stored = storedOverlayId(catalogue), enabled = viewer.getOverlayState().find(value => value.enabled)?.id;
    selectedOverlayId = overlays.some(overlay => overlay.id === stored) ? stored :
      overlays.some(overlay => overlay.id === enabled) ? enabled! : overlays[0]?.id ?? null;
    if (selectedOverlayId) renderSelectedOverlay();
  } catch (error) { if (request === overlayRequest) overlayStatus.textContent = error instanceof Error ? error.message : String(error); }
  setBusy(busy);
}
overlayChoice.addEventListener('change', () => {
  const item = subjects.find(value => value.id === sourceSubject);
  if (!item?.density?.overlays) return;
  selectedOverlayId = overlayChoice.value; rememberOverlayId(item.density.overlays, selectedOverlayId);
  renderSelectedOverlay(); overlayEnabled.checked = true; void run(() => activateOverlay(selectedOverlayId!));
});
overlayEnabled.addEventListener('change', () => {
  if (!selectedOverlayId) return;
  void run(() => overlayEnabled.checked ? activateOverlay(selectedOverlayId!) :
    viewer!.setOverlay(selectedOverlayId!, false, Number(overlayOpacity.value) / 100));
});
overlayOpacity.addEventListener('input', () => {
  if (!selectedOverlayId) return;
  void run(() => viewer!.setOverlay(selectedOverlayId!, overlayEnabled.checked, Number(overlayOpacity.value) / 100));
});
function showSource() {
  if (element('source-panel').hidden) return;
  const item = chosenSource();
  if (!item) return;
  imageStatus.textContent = 'Loading source image…';
  image.alt = item.name;
  image.src = item.sourceUrl;
  updateCredit();
}
sourceChoice.addEventListener('change', showSource);
image.addEventListener('load', () => { imageStatus.textContent = ''; });
image.addEventListener('error', () => { imageStatus.textContent = 'The local source image could not be loaded.'; });

subject.addEventListener('change', async () => {
  if (!viewer || busy) return;
  invalidateToneContexts();
  setBusy(true); status.textContent = 'Loading prepared layers…'; delete status.dataset.error;
  try { await viewer.setSubject(subject.value); }
  catch (error) { fail(error); }
  finally { if (!disposed) { setBusy(false); void refreshOverlayControls(); } }
});
document.querySelectorAll<HTMLInputElement>('input[name="component"]').forEach(input => {
  input.addEventListener('change', () => { if (input.checked) void run(() => viewer!.setComponent(input.value as 'all' | 'diffuse' | 'detail')); });
});
axis.addEventListener('change', () => void run(() => viewer!.setAxis(axis.value as 'auto' | 'x' | 'y' | 'z')));
cameraPose.addEventListener('change', () => void run(() => viewer!.setPose(cameraPose.value as Parameters<Viewer['setPose']>[0])));
layer.addEventListener('input', () => void run(() => viewer!.setLayer(Number(layer.value) < 0 ? null : Number(layer.value))));
element('all-layers').addEventListener('click', () => void run(() => viewer!.setLayer(null)));
element('reset').addEventListener('click', () => void run(() => viewer!.reset()));
element('reference-view').addEventListener('click', () => void run(() => viewer!.referenceView()));
element('fit-cloud').addEventListener('click', () => void run(() => viewer!.fitCloud()));

async function switchMode(next: 'photo' | 'density') {
  if (disposed) return;
  const repeatedPendingRequest = modePending && requestedMode === next;
  requestedMode = next;
  if (repeatedPendingRequest) return;
  const needsSwitch = currentMode !== next;
  currentMode = next;
  if (!viewer || !needsSwitch) { setBusy(busy); return; }
  invalidateToneContexts();
  const request = ++modeRequest;
  modePending = true;
  setBusy(true); delete status.dataset.error;
  try { await viewer.setMode(next); }
  catch (error) { if (request === modeRequest) fail(error); }
  finally {
    if (request !== modeRequest || disposed) return;
    modePending = false;
    currentMode = next; updateSource(subject.value); updateCredit(); setBusy(false); void refreshOverlayControls();
  }
}

setBusy(true);
const initialTab = Math.max(0, tabNames.indexOf(new URL(location.href).searchParams.get('tab') ?? 'render'));
selectTab(initialTab, false);
try {
  if (!subjects.length) throw new Error('No prepared subjects are available.');
  const requestedSubject = new URL(location.href).searchParams.get('subject');
  const initialSubject = subjects.find(item => item.id === requestedSubject) ?? subjects[0];
  viewer = await createNebulaLabViewer({ host: element('viewer'), subjectId: initialSubject.id,
    mode: initialTab === 1 ? 'density' : 'photo', onState(state) {
    if (disposed) return;
    currentMode = state.mode;
    subject.value = state.subjectId;
    updateSource(state.subjectId);
    cameraPose.value = state.pose;
    axis.value = state.axis;
    document.querySelectorAll<HTMLInputElement>('input[name="component"]').forEach(input => { input.checked = input.value === state.component; });
    layer.max = String(Math.max(-1, state.layerCount - 1));
    layer.value = String(state.layer ?? -1);
    layer.disabled = state.layerCount === 0;
    const text = state.layer === null ? 'All layers' : `Layer ${state.layer + 1} / ${state.layerCount}`;
    layerValue.textContent = text; layer.setAttribute('aria-valuetext', text);
    status.textContent = state.status ?? `${state.layerCount} layers`;
    delete status.dataset.error;
    if (state.error) fail(state.error);
  } });
  if (disposed) viewer.destroy();
  else {
    const desiredMode = currentTab === 1 ? 'density' : 'photo';
    if (desiredMode !== currentMode || desiredMode !== requestedMode) void switchMode(desiredMode);
    else { setBusy(false); void refreshOverlayControls(); }
  }
} catch (error) { fail(error); }

function destroy() { if (!disposed) { disposed = true; benchmark.destroy(); densityTone.destroy(); imageTone.destroy(); viewer?.destroy(); } }
window.addEventListener('pagehide', destroy, { once: true });
if (import.meta.hot) import.meta.hot.dispose(destroy);
