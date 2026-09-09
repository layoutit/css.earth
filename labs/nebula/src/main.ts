import { readAppliedImage, writeAppliedImage, rememberAppliedLayer, verifyRestoredImage, type RestoredAppliedImage } from './star-removal/applied-image-state';
import { createNebulaLabViewer, subjects, registerReconstructionSubject } from './viewer/viewer';
import { createReconstructionControls } from './components/reconstruction-controls';
import { labView, labViewUrl } from './viewer/lab-routing';
import type { PreparedReconstruction } from './reconstruction/reconstruction-types';
import { defaultOverlayPlacement } from './alignment/overlay-placement';
import { createOverlayPlacementControls } from './components/overlay-placement-controls';
import { createToneControls } from './components/tone-controls';
import { createCloudControls } from './components/cloud-controls';
import { createCloudDensityControls } from './components/cloud-density-controls';
import { createCloudStarControls } from './components/cloud-star-controls';
import type { ImageLayer } from './viewer/overlay-variants';
import { createRemovalStrengthStore, validateRemovalStrength } from './star-removal/removal-strength';
import { createStarRemovalControls } from './components/star-removal-controls';

export const labObjects = [
  { id: 'lmc-clouds', name: 'LMC' },
  { id: 'smc-particles', name: 'SMC' },
] as const;
export interface AlignmentState {
  images: { id: string; label: string }[]; imageId: string; layer: ImageLayer; layers: ImageLayer[];
  enabled: boolean; opacity: number; removalStrength: number;
  registrationNote: string; credit: string; sourcePageUrl: string; status: string;
}
export interface LabShellState { objectId: string; view: 'alignment' | 'reconstruction'; busy: boolean; alignmentAvailable: boolean;
  pose: string; alignment?: AlignmentState;
  originalOverlay?: { available: boolean; enabled: boolean; opacity: number; loading: boolean }; }

export async function mountNebulaLab(options: { onShellState(state: LabShellState): void }) {
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const subject = element<HTMLSelectElement>('subject');
const controls = element<HTMLFieldSetElement>('render-controls');
const cameraPose = element<HTMLSelectElement>('camera-pose');
const status = element('status');
const sourceLink = element<HTMLAnchorElement>('source-link');
const densityViewControls = element<HTMLElement>('density-view-controls');
const densityAdjustmentPanel = element<HTMLElement>('density-adjustment-panel');
const densityToneFieldset = element<HTMLFieldSetElement>('density-tone-fieldset');
const overlayPanel = element<HTMLElement>('image-overlay-panel');
const cloudPanel = element<HTMLElement>('cloud-adjustment-panel');
const reconstructionImages = element<HTMLFieldSetElement>('reconstruction-image-controls');
const cloudDensityPanel = element<HTMLElement>('cloud-density-panel');
const overlayControls = element<HTMLFieldSetElement>('overlay-controls');
const overlayOptions = element('overlay-options');
const overlayChoice = element<HTMLSelectElement>('overlay-choice');
const overlayLayerControl = element('overlay-layer-control');
const overlayLayer = element('overlay-layer');
const layerButtons = [...overlayLayer.querySelectorAll<HTMLButtonElement>('[data-image-layer]')];
const overlayLayerNote = element('overlay-layer-note');
const removalControls = element('star-removal-controls');
const removalRange = element<HTMLInputElement>('star-removal-range');
const removalNumber = element<HTMLInputElement>('star-removal');
const removalNote = element('star-removal-note');
const removalStrengths = createRemovalStrengthStore();
const starRemoval = createStarRemovalControls(element('automatic-star-removal'), {
  async onApply(result, isCurrent) {
    if (!viewer || selectedOverlayId !== result.imageId || !isCurrent()) return false;
    if (!result.applied || !result.sourcePreviewSha256) throw new TypeError('Removal source proof is missing.');
    restoringImages.get(result.imageId)?.abort(); restoringImages.delete(result.imageId);
    const request = ++layerActivation;
    const current = () => isCurrent() && request === layerActivation && selectedOverlayId === result.imageId && currentTab === 0 && currentMode === 'density';
    imageTone.setContext(null);
    await viewer.installRemovalLayers(result.imageId, result.sourcePreviewSha256, result.applied, current);
    if (!current()) return false;
    removalStrengths.set(result.imageId, 100);
    await activateOverlay(result.imageId, false);
    if (!current()) return false;
    await viewer.setOverlayLayer(result.imageId, 'diffuse', current);
    if (!current()) return false;
    writeAppliedImage(result, 'diffuse'); restorationMessages.delete(result.imageId);
    element('viewer').dataset.removalResultId = result.applied.resultId; renderSelectedOverlay(); return true;
  },
});
const overlayEnabled = element<HTMLInputElement>('overlay-enabled');
const overlayEnabledLabel = element<HTMLLabelElement>('overlay-enabled-label');
const overlayOpacity = element<HTMLInputElement>('overlay-opacity');
const overlayStatus = element('overlay-status');
const overlayRegistration = element('overlay-registration');
const overlayCredit = element('overlay-credit');
const overlaySource = element<HTMLAnchorElement>('overlay-source');
const tabs = ['density-tab', 'render-tab'].map(id => element<HTMLButtonElement>(id));
const tabNames = ['alignment', 'reconstruction'] as const;
type Viewer = Awaited<ReturnType<typeof createNebulaLabViewer>>;
let viewer: Viewer | null = null;
let busy = false, disposed = false;
let sourceSubject: string | null = null;
let currentTab = 0;
let currentMode: 'photo' | 'density' = 'density';
let activePose = 'front', alignmentState: AlignmentState | undefined;
let originalOverlayState: LabShellState['originalOverlay'];
let modeRequest = 0;
let requestedMode: 'photo' | 'density' = 'photo';
let modePending = false;
let pendingSubject: string | null = null;
let reconstructionImageError = '';
type Overlay = Awaited<ReturnType<Viewer['loadOverlayCatalogue']>>[number];
let currentOverlays: Overlay[] = [];
let selectedOverlayId: string | null = null;
let overlayActivation = 0;
let layerActivation = 0;
let pendingLayerActivation: number | null = null;
let placementControls: ReturnType<typeof createOverlayPlacementControls> | null = null;
const restoringImages = new Map<string, AbortController>(), restorationAttempts = new Set<string>(), restorationMessages = new Map<string, string>();
const reconstruction = createReconstructionControls(element('reconstruction-processing'), {
  async onSelect(prepared, baseSubjectId, current) {
    if (!viewer || currentTab !== 1 || !current()) return false;
    const id = prepared ? registerReconstructionSubject(prepared.subject) : baseSubjectId;
    if (sourceSubject !== id) await changeSubject(id);
    return current() && sourceSubject === id;
  },
});
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
function invalidateToneContexts() { layerActivation++; pendingLayerActivation = null; densityTone.setContext(null); imageTone.setContext(null); starRemoval.setContext(null); }

const visibleObjects = labObjects;
function objectId(id: string | null) {
  const item = subjects.find(value => value.id === id);
  const source = item?.sourceSubjectId ?? id ?? '';
  return visibleObjects.find(value => value.id === source ||
    (value.id === 'lmc-clouds' && source.startsWith('lmc')) ||
    (value.id === 'smc-particles' && source.startsWith('smc')))?.id ?? visibleObjects[0]!.id;
}


function publishShell() {
  options.onShellState({ objectId: objectId(sourceSubject), view: tabNames[currentTab]!, busy,
    alignmentAvailable: Boolean(!sourceSubject || subjects.find(item => item.id === sourceSubject)?.density), pose: activePose, alignment: alignmentState,
    originalOverlay: originalOverlayState });
}
function selectTab(index: number, updateUrl = true): Promise<void> {
  currentTab = index;
  const switching = switchMode(index === 0 ? 'density' : 'photo');
  setBusy(busy);
  void refreshOverlayControls();
  if (updateUrl) {
    const url = labViewUrl(new URL(location.href), tabNames[index]!);
    if (url.href !== location.href) history.pushState(history.state, '', url);
  }
  updateCredit();
  return switching;
}

function setBusy(value: boolean) {
  busy = value; subject.disabled = value; controls.disabled = value;
  reconstruction.setBusy(value);
  tabs.forEach((tab, index) => { tab.disabled = value || (index === 0 && Boolean(sourceSubject) && !subjects.find(item => item.id === sourceSubject)?.density); });
  cloudControls.setBusy(value);
  const density = currentMode === 'density';
  const currentSubject = subjects.find(item => item.id === sourceSubject);
  const densityMissing = density && !currentSubject?.density;
  cameraPose.disabled = value || densityMissing;
  element<HTMLButtonElement>('reset').disabled = value || densityMissing;
  densityToneFieldset.disabled = value || currentTab !== 0 || !density;
  overlayControls.disabled = value || currentTab !== 0 || !density;
  element<HTMLButtonElement>('reference-view').disabled = value || (density ? densityMissing : !currentSubject?.referenceDistanceUnits);
  element<HTMLButtonElement>('fit-cloud').disabled = value || densityMissing;
  element('viewer').setAttribute('aria-busy', String(value));
  element('viewer').inert = value;
  refreshReconstructionImages();
  publishShell();
}
function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  status.hidden = false; status.textContent = message; status.dataset.error = 'true';
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
  updateCredit();
  refreshReconstructionImages();
  publishShell();
}
function refreshReconstructionImages() {
  const base = objectId(pendingSubject ?? sourceSubject);
  const visible = currentTab === 1 && base === 'lmc-clouds';
  reconstructionImages.hidden = !visible;
  if (visible) cloudPanel.hidden = false;
  reconstruction.setContext(visible && viewer ? base : null);
  reconstruction.setBusy(busy);
}
function updateCredit() {
  const item = subjects.find(value => value.id === sourceSubject);
  const density = currentMode === 'density' && currentTab === 0 ? item?.density : null;
  sourceLink.hidden = !(density?.sourcePageUrl ?? item?.sourcePageUrl);
  if (density?.sourcePageUrl ?? item?.sourcePageUrl) sourceLink.href = density?.sourcePageUrl ?? item!.sourcePageUrl!;
  sourceLink.title = density?.credit ?? item?.credit ?? '';
}
let overlayRequest = 0;
function overlaySelectionKey(catalogue: string) {
  const stable = catalogue.replace('labs/nebula/models/lmc/', 'labs/nebula/models/lmc-').replace('labs/nebula/models/smc/', 'labs/nebula/models/smc-');
  return `cssearth-nebula-selected-overlay:${stable}`;
}
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
function refreshImageTone() {
  const overlay = currentOverlays.find(value => value.id === selectedOverlayId);
  if (overlay && restoringImages.has(overlay.id)) { imageTone.setContext(null); return; }
  imageTone.setContext(viewer && sourceSubject && overlay && toneReadyFor(sourceSubject) ? {
    subjectId: sourceSubject, imageId: overlay.id, imageLayer: viewer.getOverlayLayer(overlay.id),
    ...(overlay.removalResultId ? { removalResultId: overlay.removalResultId } : {}),
    ...(overlay.variants?.length ? { removalStrength: currentRemovalStrength(overlay) } : {}),
  } : null);
}
function currentRemovalStrength(overlay: Overlay) {
  return removalStrengths.get(overlay.id);
}
function refreshStarRemoval() {
  const overlay = currentOverlays.find(item => item.id === selectedOverlayId);
  starRemoval.setContext(currentTab === 0 && currentMode === 'density' && !busy && overlay ? {
    imageId: overlay.id, label: overlay.label,
  } : null);
}
async function restoreAppliedOverlay(overlay: Overlay) {
  if (!viewer || overlay.removalResultId || restoringImages.has(overlay.id)) return;
  const saved = readAppliedImage(overlay.id, overlay.sha256); if (!saved) return;
  const attempt = `${overlay.id}:${saved.resultId}`, expectedViewer = viewer, expectedOverlay = overlay;
  if (restorationAttempts.has(attempt)) return;
  restorationAttempts.add(attempt);
  const controller = new AbortController(); restoringImages.set(overlay.id, controller); imageTone.setContext(null);
  restorationMessages.set(overlay.id, 'Restoring prepared removal…');
  const current = () => restoringImages.get(overlay.id) === controller && !controller.signal.aborted && viewer === expectedViewer && selectedOverlayId === overlay.id &&
    currentOverlays.includes(expectedOverlay) && currentTab === 0 && currentMode === 'density';
  try {
    const response = await fetch('/__nebula/star-removal/restore', { method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageId: saved.imageId, resultId: saved.resultId, sourcePreviewSha256: saved.sourcePreviewSha256 }) });
    const result = await response.json() as RestoredAppliedImage & { error?: string };
    if (!response.ok) throw new Error(result.error ?? `Saved removal unavailable (HTTP ${response.status}).`);
    verifyRestoredImage(saved, result); if (!current()) return;
    await viewer!.installRemovalLayers(overlay.id, result.sourcePreviewSha256, result.applied, current); if (!current()) return;
    await activateOverlay(overlay.id, false); if (!current()) return;
    await viewer!.setOverlayLayer(overlay.id, saved.layer, current); if (!current()) return;
    element('viewer').dataset.removalResultId = result.applied.resultId; restorationMessages.delete(overlay.id);
  } catch (error) {
    if (current()) { restorationMessages.set(overlay.id, 'Saved removal unavailable · run Remove stars again.'); overlayStatus.title = error instanceof Error ? error.message : String(error); }
  } finally {
    const active = current();
    if (restoringImages.get(overlay.id) === controller) restoringImages.delete(overlay.id);
    if (!active) restorationAttempts.delete(attempt);
    else renderSelectedOverlay();
  }
}
function renderSelectedOverlay() {
  if (!viewer || !selectedOverlayId) return;
  const item = subjects.find(value => value.id === sourceSubject), overlay = currentOverlays.find(value => value.id === selectedOverlayId);
  if (!item?.density?.overlays || !overlay) return;
  void restoreAppliedOverlay(overlay);
  const prior = viewer.getOverlayState().find(value => value.id === overlay.id);

  overlayLayerControl.hidden = !overlay.variants?.length;

  removalControls.hidden = !overlay.variants?.some(layer => layer.id === 'diffuse');
  removalRange.max = removalNumber.max = '100';
  removalRange.value = removalNumber.value = String(currentRemovalStrength(overlay));
  removalNote.textContent = '0% Original · 100% Prepared removal';
  overlayLayerNote.textContent = '';
  overlayLayer.title = 'NOX estimates the background from the image. The residual is predicted compact light, not a measured star catalogue.';

  const identity = defaultOverlayPlacement(), fitted = overlay.initialPlacement ?? identity;
  const placementSpec = { id: overlay.id, label: overlay.label,
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
        ...(overlay.variants?.length ? { imageLayer: viewer!.getOverlayLayer(overlay.id), removalStrength: currentRemovalStrength(overlay) } : {}),
      }, null, 2));
    },
    onChange: (partial: Parameters<Viewer['setOverlayPlacement']>[1]) => { try { viewer!.setOverlayPlacement(overlay.id, partial); } catch (error) { fail(error); } } };
  if (placementControls) placementControls.update(placementSpec);
  else { placementControls = createOverlayPlacementControls(placementSpec); overlayOptions.replaceChildren(placementControls); }
  alignmentState = { images: currentOverlays.map(value => ({ id: value.id, label: value.label })), imageId: overlay.id,
    layer: viewer.getOverlayLayer(overlay.id), layers: ['original', ...(overlay.variants?.map(value => value.id) ?? [])],
    enabled: prior?.enabled ?? false, opacity: Math.round((prior?.opacity ?? overlay.initialOpacity ?? .55) * 100),
    removalStrength: currentRemovalStrength(overlay), registrationNote: overlay.registrationNote, credit: overlay.credit,
    sourcePageUrl: overlay.sourcePageUrl, status: restorationMessages.get(overlay.id) ?? `${currentOverlays.indexOf(overlay) + 1} of ${currentOverlays.length} images` };
  publishShell();
  overlayPanel.dataset.selectedOverlay = overlay.id;
  refreshImageTone();
  refreshStarRemoval();
}
async function activateOverlay(id: string, refresh = true) {
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
  if (refresh && activation === overlayActivation && selectedOverlayId === id) renderSelectedOverlay();
}
async function refreshOverlayControls() {
  const item = subjects.find(value => value.id === sourceSubject), catalogue = item?.density?.overlays;
  const densityVisible = currentTab === 0 && currentMode === 'density' && Boolean(item?.density);
  const visible = densityVisible && Boolean(catalogue);
  const cloud = currentTab === 1 && currentMode === 'photo' && !busy && !modePending ? viewer?.getCloudParts() : null;
  cloudPanel.hidden = !(currentTab === 1 && objectId(sourceSubject) === 'lmc-clouds') && !cloud;
  cloudDensityPanel.hidden = !cloud;
  cloudControls.setContext(cloud ? { id: cloud.id, parts: cloud.parts } : null);
  cloudDensityControls.setContext(cloud ? { subjectId: cloud.id } : null);
  cloudStarControls.setContext(cloud ? viewer?.getStars() ?? null : null);
  refreshReconstructionImages();
  densityViewControls.hidden = !(densityVisible || currentTab === 1 && Boolean(item?.referenceDistanceUnits));
  densityAdjustmentPanel.hidden = !densityVisible; overlayPanel.hidden = !visible;
  densityTone.setContext(densityVisible && item && toneReadyFor(item.id) ? { subjectId: item.id } : null);
  if (!visible) imageTone.setContext(null);
  starRemoval.setContext(null);
  currentOverlays = []; selectedOverlayId = null; placementControls?.destroy(); placementControls = null; overlayOptions.replaceChildren();
  if (!visible || !viewer || !catalogue) return;
  const request = ++overlayRequest;
  try {
    const overlays = await viewer.loadOverlayCatalogue();
    if (request !== overlayRequest || currentTab !== 0 || currentMode !== 'density') return;
    currentOverlays = overlays;
    const stored = storedOverlayId(catalogue), enabled = viewer.getOverlayState().find(value => value.enabled)?.id;
    selectedOverlayId = overlays.some(overlay => overlay.id === stored) ? stored :
      overlays.some(overlay => overlay.id === enabled) ? enabled! : overlays[0]?.id ?? null;
    if (selectedOverlayId) renderSelectedOverlay();
  } catch (error) { if (request === overlayRequest) { if (alignmentState) { alignmentState = { ...alignmentState, status: error instanceof Error ? error.message : String(error) }; publishShell(); } else fail(error); } }
  setBusy(busy);
}
function changeOverlayChoice(id: string) {
  layerActivation++; pendingLayerActivation = null;
  for (const controller of restoringImages.values()) controller.abort();
  const item = subjects.find(value => value.id === sourceSubject);
  if (!item?.density?.overlays) return;
  selectedOverlayId = id; rememberOverlayId(item.density.overlays, selectedOverlayId);
  renderSelectedOverlay(); void run(() => activateOverlay(selectedOverlayId!));
}
function changeOverlayLayer(layer: ImageLayer) {
  if (!viewer || !selectedOverlayId || busy) return;
  const id = selectedOverlayId, request = ++layerActivation;
  pendingLayerActivation = request;
  const current = () => request === layerActivation && selectedOverlayId === id && currentTab === 0 && currentMode === 'density';
  imageTone.setContext(null); overlayLayerNote.textContent = 'Loading prepared image layer…';
  void run(async () => {
    try {
      await activateOverlay(id, false);
      if (!current()) return;
      imageTone.setContext(null);
      await viewer!.setOverlayLayer(id, layer, current);
      if (current()) { const overlay = currentOverlays.find(value => value.id === id); if (overlay?.removalResultId) rememberAppliedLayer(id, overlay.sha256, layer); }
    } finally { if (current()) { pendingLayerActivation = null; renderSelectedOverlay(); } }
  });
}
function changeRemovalStrength(value: number) {
  if (!viewer || !selectedOverlayId || busy || removalControls.hidden) return;
  try {
    const id = selectedOverlayId, strength = validateRemovalStrength(value);
    removalStrengths.set(id, strength); removalRange.value = removalNumber.value = String(strength);
    if (alignmentState) { alignmentState = { ...alignmentState, layer: 'diffuse', enabled: true, removalStrength: strength }; publishShell(); }
    const active = viewer.getOverlayState().find(overlay => overlay.id === id)?.enabled;
    if (active && viewer.getOverlayLayer(id) === 'diffuse' && pendingLayerActivation === null) refreshImageTone();
    else changeOverlayLayer('diffuse');
  } catch (error) {
    removalRange.value = removalNumber.value = String(currentRemovalStrength(currentOverlays.find(item => item.id === selectedOverlayId)!));
    overlayLayerNote.textContent = error instanceof Error ? error.message : String(error);
  }
}
function changeOverlayVisibility(enabled: boolean) {
  if (!selectedOverlayId) return;
  void run(async () => {
    if (enabled) await activateOverlay(selectedOverlayId!);
    else { await viewer!.setOverlay(selectedOverlayId!, false, (alignmentState?.opacity ?? 55) / 100); renderSelectedOverlay(); }
  });
}
function changeOverlayOpacity(percent: number) {
  if (!selectedOverlayId) return;
  void run(async () => { await viewer!.setOverlay(selectedOverlayId!, alignmentState?.enabled ?? false, percent / 100); renderSelectedOverlay(); });
}
async function changeSubject(id: string, updateUrl = true) {
  if (!viewer || busy) return;
  pendingSubject = id; reconstructionImageError = '';
  invalidateToneContexts();
  cloudControls.setContext(null);
  cloudDensityControls.setContext(null);
  cloudStarControls.setContext(null);
  setBusy(true); status.hidden = false; status.textContent = 'Loading…'; delete status.dataset.error;
  void refreshOverlayControls();
  try {
    await viewer.setSubject(id);
    if (currentTab === 0 && !subjects.find(item => item.id === id)?.density) {
      await viewer.setMode('photo'); selectTab(1);
    }
    if (updateUrl) { const url = new URL(location.href); url.searchParams.set('subject', id);
      history.replaceState(history.state, '', url); }
  }
  catch (error) { reconstructionImageError = error instanceof Error ? error.message : String(error); fail(error); }
  finally { pendingSubject = null; if (!disposed) { subject.value = objectId(sourceSubject); setBusy(false); void refreshOverlayControls(); } }
}
async function switchMode(next: 'photo' | 'density'): Promise<void> {
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
    updateSubject(element('viewer').dataset.subject ?? subject.value); updateCredit(); setBusy(false);
    if (failed) selectTab(currentMode === 'density' ? 0 : 1);
    else void refreshOverlayControls();
  }
}

setBusy(true);
const initialUrl = new URL(location.href);
const initialTab = labView(initialUrl) === 'reconstruction' ? 1 : 0;
history.replaceState(history.state, '', labViewUrl(initialUrl, tabNames[initialTab]));
void selectTab(initialTab, false);
try {
  if (!subjects.length) throw new Error('No prepared subjects are available.');
  const requestedSubject = new URL(location.href).searchParams.get('subject');
  if (initialTab === 1 && requestedSubject && /^reconstruction-[a-f0-9]{64}$/.test(requestedSubject)) {
    try {
      const response = await fetch(`/__nebula/reconstruction/result/${requestedSubject.slice('reconstruction-'.length)}`);
      const prepared = await response.json() as PreparedReconstruction;
      if (!response.ok || prepared.subject?.id !== requestedSubject) throw new Error('Saved reconstruction is unavailable.');
      registerReconstructionSubject(prepared.subject);
    } catch (error) { reconstructionImageError = error instanceof Error ? error.message : String(error); }
  }
  const initialSubject = subjects.find(item => item.id === requestedSubject && (item.id.startsWith('lmc') || item.id.startsWith('smc') || item.sourceSubjectId === 'lmc-clouds')) ?? subjects.find(item => item.id === objectId(requestedSubject))!;
  const mountTab = initialSubject.density ? initialTab : 1;
  selectTab(mountTab);
  viewer = await createNebulaLabViewer({ host: element('viewer'), subjectId: initialSubject.id,
    mode: mountTab === 0 ? 'density' : 'photo', onState(state) {
    if (disposed) return;
    currentMode = state.mode;
    originalOverlayState = state.originalOverlay;
    subject.value = objectId(state.subjectId);
    updateSubject(state.subjectId);
    activePose = state.pose; cameraPose.value = state.pose; publishShell();
    status.textContent = state.status ?? '';
    status.hidden = element('viewer').dataset.ready === 'true' && !state.error;
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

function onHistoryChange() {
  const url = new URL(location.href), requested = url.searchParams.get('subject');
  void (async () => {
    await selectTab(labView(url) === 'reconstruction' ? 1 : 0, false);
    if (requested && subjects.some(item => item.id === requested) && requested !== sourceSubject) await changeSubject(requested, false);
  })();
}
window.addEventListener('popstate', onHistoryChange);

function destroy() { if (!disposed) { disposed = true; window.removeEventListener('popstate', onHistoryChange); for (const controller of restoringImages.values()) controller.abort(); densityTone.destroy(); imageTone.destroy(); starRemoval.destroy(); reconstruction.destroy(); placementControls?.destroy(); cloudControls.destroy(); cloudDensityControls.destroy(); cloudStarControls.destroy(); viewer?.destroy(); } }
return { destroy, selectView: (view: 'alignment' | 'reconstruction') => selectTab(view === 'alignment' ? 0 : 1), changeObject: changeSubject,
  chooseImage: changeOverlayChoice, chooseLayer: changeOverlayLayer, setRemovalStrength: changeRemovalStrength,
  showImage: changeOverlayVisibility, setImageOpacity: changeOverlayOpacity,
  showOriginal: (enabled: boolean) => run(() => viewer!.setOriginalOverlay(enabled)),
  setOriginalOpacity: (opacity: number) => run(() => viewer!.setOriginalOverlay(originalOverlayState?.enabled ?? false, opacity)),
  setPose: (pose: Parameters<Viewer['setPose']>[0]) => run(() => viewer!.setPose(pose)),
  resetCamera: () => run(() => viewer!.reset()), referenceView: () => run(() => viewer!.referenceView()), fitCloud: () => run(() => viewer!.fitCloud()) };
}
