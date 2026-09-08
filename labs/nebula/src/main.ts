import { createNebulaLabViewer, subjects } from './viewer';
import { defaultOverlayPlacement } from './overlay-placement';
import { createOverlayPlacementControls } from './overlay-placement-controls';
import { createToneControls } from './tone-controls';
import { createCloudControls } from './cloud-controls';
import { createCloudDensityControls } from './cloud-density-controls';
import { createCloudStarControls } from './cloud-star-controls';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const subject = element<HTMLSelectElement>('subject');
const controls = element<HTMLFieldSetElement>('render-controls');
const cameraPose = element<HTMLSelectElement>('camera-pose');
const axis = element<HTMLSelectElement>('axis');
const layer = element<HTMLInputElement>('layer');
const layerValue = element<HTMLOutputElement>('layer-value');
const status = element('status');
const sourceLink = element<HTMLAnchorElement>('source-link');
const sourceCredit = element('source-credit');
const densityViewControls = element<HTMLFieldSetElement>('density-view-controls');
const densityAdjustmentPanel = element<HTMLElement>('density-adjustment-panel');
const densityToneFieldset = element<HTMLFieldSetElement>('density-tone-fieldset');
const overlayPanel = element<HTMLElement>('image-overlay-panel');
const cloudPanel = element<HTMLElement>('cloud-adjustment-panel');
const reconstructionImages = element<HTMLFieldSetElement>('reconstruction-image-controls');
const reconstructionImage = element<HTMLSelectElement>('reconstruction-image');
const reconstructionImageNote = element('reconstruction-image-note');
const reconstructionImageCredit = element('reconstruction-image-credit');
const reconstructionImageSource = element<HTMLAnchorElement>('reconstruction-image-source');
const reconstructionImageStatus = element('reconstruction-image-status');
const cloudDensityPanel = element<HTMLElement>('cloud-density-panel');
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
const tabs = ['density-tab', 'render-tab'].map(id => element<HTMLButtonElement>(id));
const tabNames = ['alignment', 'reconstruction'];
type Viewer = Awaited<ReturnType<typeof createNebulaLabViewer>>;
let viewer: Viewer | null = null;
let busy = false, disposed = false;
let sourceSubject: string | null = null;
let currentTab = 0;
let currentMode: 'photo' | 'density' = 'density';
let modeRequest = 0;
let requestedMode: 'photo' | 'density' = 'photo';
let modePending = false;
let pendingSubject: string | null = null;
let reconstructionImageError = '';
let reconstructionImageGroup: string | null = null;
type Overlay = Awaited<ReturnType<Viewer['loadOverlayCatalogue']>>[number];
let currentOverlays: Overlay[] = [];
let selectedOverlayId: string | null = null;
let overlayActivation = 0;
const cloudStarControls = createCloudStarControls({ host: element('cloud-star-controls'), onChange(options) { viewer?.setStars(options); } });
const cloudDensityControls = createCloudDensityControls({ host: element('cloud-density-controls'),
  async onApply(context, resources, isCurrent) {
    if (!viewer || viewer.getCloudParts()?.id !== context.subjectId) return;
    await viewer.applyCloudDensityResources(resources, context.filter, isCurrent);
    if (isCurrent()) { const host = element('viewer');
      host.dataset.cloudDensityFilter = JSON.stringify(context.filter); host.dataset.cloudDensityReady = 'true'; }
  },
});
const cloudControls = createCloudControls({ host: element('cloud-controls'),
  onChange(selection) {
    if (!viewer || viewer.getCloudParts()?.id !== selection.contextId) return;
    try { viewer.setCloudSelection(selection.enabledIds);
      const parts = viewer.getCloudParts()!.parts, defaults = parts.filter(part => part.defaultEnabled).map(part => part.id);
      const reference = defaults.length === selection.enabledIds.length && defaults.every(id => selection.enabledIds.includes(id));
      cloudControls.setStatus(reference ? 'Original reconstruction.' :
        'Contribution inspection: separate translucent pieces approximate the selected light.');
    } catch (error) { cloudControls.setError(error); }
  },
  onBrightness(value) { try { viewer?.setCloudBrightness(value); } catch (error) { cloudControls.setError(error); } },
});
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
  element('render-panel').setAttribute('aria-labelledby', tabs[index]!.id);
  if (index === 0) void switchMode('density');
  if (index === 1) void switchMode('photo');
  setBusy(busy);
  void refreshOverlayControls();
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('tab', tabNames[index]!);
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
  busy = value; subject.disabled = value; controls.disabled = value;
  reconstructionImage.disabled = value;
  tabs.forEach(tab => { tab.disabled = value; });
  cloudControls.setBusy(value);
  const density = currentMode === 'density';
  const currentSubject = subjects.find(item => item.id === sourceSubject);
  const hasCloudParts = !density && Boolean(currentSubject?.cloudParts);
  document.querySelector<HTMLElement>('.component-options')!.hidden = hasCloudParts || (!density && Boolean(currentSubject?.reconstructionImage));
  const densityMissing = density && !subjects.find(item => item.id === sourceSubject)?.density;
  document.querySelectorAll<HTMLInputElement>('input[name="component"]').forEach(input => {
    input.disabled = value || density || hasCloudParts || (input.value === 'detail' && currentSubject?.hasDetail === false);
  });
  cameraPose.disabled = value || densityMissing; axis.disabled = value || densityMissing;
  layer.disabled = value || densityMissing || layer.max === '-1';
  element<HTMLButtonElement>('all-layers').disabled = value || densityMissing;
  element<HTMLButtonElement>('reset').disabled = value || densityMissing;
  densityViewControls.disabled = value || currentTab !== 0 || !density;
  densityToneFieldset.disabled = value || currentTab !== 0 || !density;
  overlayControls.disabled = value || currentTab !== 0 || !density;
  element<HTMLButtonElement>('reference-view').disabled = value || densityMissing;
  element<HTMLButtonElement>('fit-cloud').disabled = value || densityMissing;
  element('viewer').setAttribute('aria-busy', String(value));
  element('viewer').inert = value;
  refreshReconstructionImages();
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
function updateSubject(id: string) {
  const item = subjects.find(value => value.id === id);
  if (!item) return;
  sourceSubject = id;
  element('model-note').textContent = currentMode === 'density' && currentTab === 0 && item.density ? item.density.modelNote :
    'modelNote' in item && typeof item.modelNote === 'string' ? item.modelNote : 'Depth is modeled from a source image; it is not a measured 3D reconstruction.';
  document.querySelector<HTMLInputElement>('input[name="component"][value="detail"]')!.disabled = item.hasDetail === false;
  updateCredit();
  refreshReconstructionImages();
}
function refreshReconstructionImages() {
  const item = subjects.find(value => value.id === (pendingSubject ?? sourceSubject));
  const metadata = item?.reconstructionImage;
  const visible = currentTab === 1 && Boolean(metadata);
  reconstructionImages.hidden = !visible;
  if (visible) cloudPanel.hidden = false;
  if (!metadata || !item) return;
  if (reconstructionImageGroup !== metadata.group) {
    reconstructionImageGroup = metadata.group;
    reconstructionImage.replaceChildren(...subjects.filter(value => value.reconstructionImage?.group === metadata.group)
      .map(value => new Option(value.reconstructionImage!.label, value.id)));
  }
  reconstructionImage.value = item.id;
  reconstructionImageNote.textContent = metadata.note;
  reconstructionImageCredit.textContent = item.credit ?? '';
  reconstructionImageSource.href = item.sourcePageUrl!;
  reconstructionImageStatus.textContent = reconstructionImageError || (busy ? `Loading ${metadata.label} prepared layers…` : '');
  reconstructionImageStatus.dataset.error = String(Boolean(reconstructionImageError));
}
function updateCredit() {
  const item = subjects.find(value => value.id === sourceSubject);
  const density = currentMode === 'density' && currentTab === 0 ? item?.density : null;
  sourceLink.hidden = !(density?.sourcePageUrl ?? item?.sourcePageUrl);
  if (density?.sourcePageUrl ?? item?.sourcePageUrl) sourceLink.href = density?.sourcePageUrl ?? item!.sourcePageUrl!;
  sourceCredit.textContent = density?.credit ?? item?.credit ?? '';
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
  const densityVisible = currentTab === 0 && currentMode === 'density' && Boolean(item?.density);
  const visible = densityVisible && Boolean(catalogue);
  const cloud = currentTab === 1 && currentMode === 'photo' && !busy && !modePending ? viewer?.getCloudParts() : null;
  cloudPanel.hidden = !(currentTab === 1 && item?.reconstructionImage) && !cloud;
  cloudDensityPanel.hidden = !cloud;
  cloudControls.setContext(cloud ? { id: cloud.id, parts: cloud.parts } : null);
  cloudDensityControls.setContext(cloud ? { subjectId: cloud.id } : null);
  cloudStarControls.setContext(cloud ? viewer?.getStars() ?? null : null);
  refreshReconstructionImages();
  densityViewControls.hidden = !densityVisible; densityAdjustmentPanel.hidden = !densityVisible; overlayPanel.hidden = !visible;
  densityTone.setContext(densityVisible && item && toneReadyFor(item.id) ? { subjectId: item.id } : null);
  if (!visible) imageTone.setContext(null);
  currentOverlays = []; selectedOverlayId = null; overlayOptions.replaceChildren();
  overlayStatus.textContent = ''; overlayRegistration.textContent = ''; overlayCredit.textContent = ''; overlaySource.removeAttribute('href');
  if (!visible || !viewer || !catalogue) return;
  const request = ++overlayRequest;
  try {
    const overlays = await viewer.loadOverlayCatalogue();
    if (request !== overlayRequest || currentTab !== 0 || currentMode !== 'density') return;
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
async function changeSubject(id: string) {
  if (!viewer || busy) return;
  pendingSubject = id; reconstructionImageError = '';
  invalidateToneContexts();
  cloudControls.setContext(null);
  cloudDensityControls.setContext(null);
  cloudStarControls.setContext(null);
  setBusy(true); status.textContent = 'Loading prepared layers…'; delete status.dataset.error;
  void refreshOverlayControls();
  try {
    await viewer.setSubject(id);
    const url = new URL(location.href); url.searchParams.set('subject', id);
    history.replaceState(history.state, '', url);
  }
  catch (error) { reconstructionImageError = error instanceof Error ? error.message : String(error); fail(error); }
  finally { pendingSubject = null; if (!disposed) { subject.value = sourceSubject ?? subject.value; setBusy(false); void refreshOverlayControls(); } }
}
subject.addEventListener('change', () => void changeSubject(subject.value));
reconstructionImage.addEventListener('change', () => void changeSubject(reconstructionImage.value));
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
  cloudDensityControls.setContext(null);
  cloudStarControls.setContext(null);
  const request = ++modeRequest;
  modePending = true;
  setBusy(true); delete status.dataset.error;
  let failed = false;
  try { await viewer.setMode(next); }
  catch (error) { failed = true; if (request === modeRequest) fail(error); }
  finally {
    if (request !== modeRequest || disposed) return;
    modePending = false;
    currentMode = element('viewer').dataset.mode === 'density' ? 'density' : 'photo';
    updateSubject(subject.value); updateCredit(); setBusy(false);
    if (failed) selectTab(currentMode === 'density' ? 0 : 1);
    else void refreshOverlayControls();
  }
}

setBusy(true);
const requestedTab = new URL(location.href).searchParams.get('tab');
const initialTab = requestedTab === 'reconstruction' || requestedTab === 'render' ? 1 : 0;
selectTab(initialTab);
try {
  if (!subjects.length) throw new Error('No prepared subjects are available.');
  const requestedSubject = new URL(location.href).searchParams.get('subject');
  const initialSubject = subjects.find(item => item.id === requestedSubject) ?? subjects[0];
  viewer = await createNebulaLabViewer({ host: element('viewer'), subjectId: initialSubject.id,
    mode: initialTab === 0 ? 'density' : 'photo', onState(state) {
    if (disposed) return;
    currentMode = state.mode;
    subject.value = state.subjectId;
    updateSubject(state.subjectId);
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
    const desiredMode = currentTab === 0 ? 'density' : 'photo';
    if (desiredMode !== (currentMode as string) || desiredMode !== requestedMode) void switchMode(desiredMode);
    else { setBusy(false); void refreshOverlayControls(); }
  }
} catch (error) { fail(error); }

function destroy() { if (!disposed) { disposed = true; densityTone.destroy(); imageTone.destroy(); cloudControls.destroy(); cloudDensityControls.destroy(); cloudStarControls.destroy(); viewer?.destroy(); } }
window.addEventListener('pagehide', destroy, { once: true });
if (import.meta.hot) import.meta.hot.dispose(destroy);
