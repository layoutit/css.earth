import { workspaceObjects } from '../state/workspace-objects';
import { readAppliedImage, writeAppliedImage, rememberAppliedLayer, verifyRestoredImage, type RestoredAppliedImage } from '../features/star-removal/applied-image-state.ts';
import { createNebulaLabViewer, subjects, registerReconstructionSubject } from '../features/legacy-viewer/controller';
import { createReconstructionControls } from '../features/reconstruction/reconstruction-controls';
import { labView, labViewUrl } from '../features/legacy-viewer/lab-routing';
import type { PreparedReconstruction } from '../features/reconstruction/reconstruction-types.ts';
import { defaultOverlayPlacement } from '@cssearth/bake/volume';
import { createOverlayPlacementControls } from '../features/alignment/overlay-placement-controls';
import { createToneControls } from '../features/tone/tone-controls';
import { createCloudControls } from '../features/cloud-controls/cloud-controls';
import { createCloudDensityControls } from '../features/cloud-controls/cloud-density-controls';
import { createCloudStarControls } from '../features/cloud-controls/cloud-star-controls';
import type { ImageLayer } from '../features/legacy-viewer/overlay-variants';
import { createRemovalStrengthStore, validateRemovalStrength } from '../features/star-removal/removal-strength.ts';
import { createStarRemovalControls } from '../features/star-removal/star-removal-controls';
import { supportsLabAlignment, densityReconstructionOwner } from '../state/lab-workflows.ts';
import type { ControlPortals } from '../ui/control-portals';
import { labPresentation, type AlignmentState, type LabPresentation, type LabShellState } from '../state/lab-shell';

export const labObjects = workspaceObjects(subjects).map(item => ({ id: item.id, name: item.menuLabel ?? item.name }));
export type { AlignmentState, LabShellState } from '../state/lab-shell';

export async function mountNebulaLab(options: { controls: ControlPortals; onShellState(state: LabShellState): void }) {
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const overlayOptions = element('overlay-options');
const removalStrengths = createRemovalStrengthStore();
const starRemoval = createStarRemovalControls(element('automatic-star-removal'), { controls: options.controls,
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
const tabNames = ['alignment', 'reconstruction'] as const;
type Viewer = Awaited<ReturnType<typeof createNebulaLabViewer>>;
let viewer: Viewer | null = null;
let busy = false, disposed = false;
let sourceSubject: string | null = null;
let currentTab = 0;
let emissionInspection: 'sources' | 'structure' | 'volume' = 'structure';
let currentMode: 'photo' | 'density' = 'density';
let activePose = 'front', alignmentState: AlignmentState | undefined;
let originalOverlayState: LabShellState['originalOverlay'];
let materialState: LabShellState['material'];
let statusState: LabPresentation['status'] = { message: 'Loading…', hidden: false, error: false };
let layerNote = '', overlayStatusDetail = '';
function setStatus(message: string, hidden = false, error = false) { statusState = { message, hidden, error }; publishShell(); }
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
const reconstruction = createReconstructionControls(element('reconstruction-processing'), { controls: options.controls,
  captureSettings: () => ({
    cloudId: viewer?.getCloudParts()?.id,
    selection: cloudControls.getSelection(), brightness: cloudControls.getBrightness(),
    densityDraft: cloudDensityControls.getValue(),
    densityApplied: JSON.parse(element('viewer').dataset.cloudDensityFilter ?? 'null'),
    stars: cloudStarControls.getValue(), starContext: viewer?.getStars(),
  }),
  async onSelect(prepared, baseSubjectId, current) {
    if (!viewer || currentTab !== 1 || !current()) return false;
    const id = prepared ? registerReconstructionSubject(prepared.subject) : baseSubjectId;
    if (sourceSubject !== id) await changeSubject(id);
    return current() && sourceSubject === id;
  },
  onDifference: (enabled, opacity) => run(() => viewer!.setDifferenceOverlay(enabled, opacity)),
});
const cloudStarControls = createCloudStarControls({ controls: options.controls, host: element('cloud-star-controls'), onChange(options) { viewer?.setStars(options); } });
const cloudDensityControls = createCloudDensityControls({ controls: options.controls, host: element('cloud-density-controls'),
  async onApply(context, resources, isCurrent) {
    if (!viewer || viewer.getCloudParts()?.id !== context.subjectId) return;
    await viewer.applyCloudDensityResources(resources, context.filter, isCurrent);
    if (isCurrent()) { const host = element('viewer');
      host.dataset.cloudDensityFilter = JSON.stringify(context.filter); host.dataset.cloudDensityReady = 'true'; }
  },
});
const cloudControls = createCloudControls({ controls: options.controls, host: element('cloud-controls'),
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
const densityTone = createToneControls({ controls: options.controls, host: element('density-tone-controls'), target: 'density',
  async onApply(_context, resources, isCurrent) {
    if (!viewer) throw new Error('Viewer is unavailable.');
    await viewer.applyToneResources('density', undefined, resources, isCurrent);
  } });
const imageTone = createToneControls({ controls: options.controls, host: element('image-tone-controls'), target: 'image',
  async onApply(context, resources, isCurrent) {
    if (!viewer) throw new Error('Viewer is unavailable.');
    await viewer.applyToneResources('image', context.imageId, resources, isCurrent);
  } });
function invalidateToneContexts() { layerActivation++; pendingLayerActivation = null; densityTone.setContext(null); imageTone.setContext(null); starRemoval.setContext(null); }

const visibleObjects = labObjects;
function objectId(id: string | null) {
  const item = subjects.find(value => value.id === id);
  const source = visibleObjects.some(value => value.id === id) ? id! : item?.sourceSubjectId ?? id ?? '';
  return visibleObjects.find(value => value.id === source)?.id ?? visibleObjects.find(value =>
    (value.id === 'lmc-clouds' && source.startsWith('lmc')) ||
    (value.id === 'smc-particles' && source.startsWith('smc')))?.id ?? visibleObjects[0]!.id;
}


function publishShell() {
  const item = subjects.find(value => value.id === sourceSubject);
  const density = currentMode === 'density' && currentTab === 0 ? item?.density : null;
  const cloud = currentTab === 1 && currentMode === 'photo' && !busy && !modePending ? viewer?.getCloudParts() : null;
  options.onShellState({ objectId: objectId(sourceSubject), view: tabNames[currentTab]!, busy,
    alignmentAvailable: !sourceSubject || supportsLabAlignment(item), pose: activePose, alignment: alignmentState,
    originalOverlay: originalOverlayState, material: materialState,
    presentation: labPresentation({ busy, alignment: currentTab === 0, densityMode: currentMode === 'density',
      densityAvailable: Boolean(item?.density), overlaysAvailable: Boolean(item?.density?.overlays),
      referenceAvailable: Boolean(item?.referenceDistanceUnits), observationInspection: observationInspectionActive(),
      cloudAvailable: Boolean(cloud), reconstructionImages: currentTab === 1 && Boolean(densityReconstructionOwner(subjects, pendingSubject ?? sourceSubject)),
      sourceUrl: density?.sourcePageUrl ?? item?.sourcePageUrl, sourceCredit: density?.credit ?? item?.credit ?? '', status: statusState }) });
}
function observationInspectionActive(id = sourceSubject) {
  const item = subjects.find(value => value.id === id);
  return Boolean(item?.observationAlignment && (currentTab === 0 ||
    item.emissionExperiment?.observationStructures && emissionInspection !== 'volume'));
}
function selectTab(index: number, updateUrl = true): Promise<void> {
  if (index === 1 && subjects.find(value => value.id === sourceSubject)?.alignmentOnly) index = 0;
  if (currentTab !== index) emissionInspection = 'structure';
  currentTab = index;
  const item = subjects.find(value => value.id === sourceSubject);
  const switching = observationInspectionActive() ? Promise.resolve() :
    item?.observationAlignment && index === 1 && (!viewer || element('viewer').dataset.subject !== sourceSubject) ? changeSubject(item.id, false) :
    switchMode(index === 0 ? 'density' : 'photo');
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
  busy = value; reconstruction.setBusy(value); cloudControls.setBusy(value);
  refreshReconstructionImages(); publishShell();
}
function fail(error: unknown) {
  setStatus(error instanceof Error ? error.message : String(error), false, true);
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
  const base = densityReconstructionOwner(subjects, pendingSubject ?? sourceSubject);
  const visible = currentTab === 1 && Boolean(base);
  reconstruction.setContext(visible && viewer ? base : null);
  reconstruction.setBusy(busy);
}
function updateCredit() { publishShell(); }
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
  const saved = readAppliedImage(overlay.id, overlay.sha256);
  const attempt = `${overlay.id}:${saved?.resultId ?? overlay.sha256}`, expectedViewer = viewer, expectedOverlay = overlay;
  if (restorationAttempts.has(attempt)) return;
  restorationAttempts.add(attempt);
  const controller = new AbortController(); restoringImages.set(overlay.id, controller); imageTone.setContext(null);
  restorationMessages.set(overlay.id, 'Restoring prepared removal…');
  const current = () => restoringImages.get(overlay.id) === controller && !controller.signal.aborted && viewer === expectedViewer && selectedOverlayId === overlay.id &&
    currentOverlays.includes(expectedOverlay) && currentTab === 0 && currentMode === 'density';
  try {
    const response = await fetch('/__nebula/star-removal/restore', { method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageId: overlay.id, ...(saved ? { resultId: saved.resultId } : {}), sourcePreviewSha256: overlay.sha256 }) });
    const result = await response.json() as (RestoredAppliedImage & { error?: string }) | null;
    if (!response.ok) throw new Error(result?.error ?? `Saved removal unavailable (HTTP ${response.status}).`);
    if (!result) { restorationMessages.delete(overlay.id); return; }
    if (saved) verifyRestoredImage(saved, result); if (!current()) return;
    await viewer!.installRemovalLayers(overlay.id, result.sourcePreviewSha256, result.applied, current); if (!current()) return;
    await activateOverlay(overlay.id, false); if (!current()) return;
    await viewer!.setOverlayLayer(overlay.id, saved?.layer ?? 'original', current); if (!current()) return;
    writeAppliedImage(result, saved?.layer ?? 'original');
    element('viewer').dataset.removalResultId = result.applied.resultId; restorationMessages.delete(overlay.id);
  } catch (error) {
    if (current()) { restorationMessages.set(overlay.id, 'Saved removal unavailable · run Remove stars again.'); overlayStatusDetail = error instanceof Error ? error.message : String(error); }
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

  layerNote = '';

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
  else placementControls = createOverlayPlacementControls(placementSpec, overlayOptions, options.controls);
  alignmentState = { images: currentOverlays.map(value => ({ id: value.id, label: value.label })), imageId: overlay.id,
    layer: viewer.getOverlayLayer(overlay.id), layers: ['original', ...(overlay.variants?.map(value => value.id) ?? [])],
    densityOverlayEnabled: viewer.getDensityOverlay(), enabled: prior?.enabled ?? false, opacity: Math.round((prior?.opacity ?? overlay.initialOpacity ?? .55) * 100),
    removalStrength: currentRemovalStrength(overlay), registrationNote: overlay.registrationNote, credit: overlay.credit,
    sourcePageUrl: overlay.sourcePageUrl, layerNote, statusDetail: overlayStatusDetail, status: restorationMessages.get(overlay.id) ?? `${currentOverlays.indexOf(overlay) + 1} of ${currentOverlays.length} images` };
  publishShell();
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
  cloudControls.setContext(cloud ? { id: cloud.id, parts: cloud.parts } : null);
  cloudDensityControls.setContext(cloud ? { subjectId: cloud.id } : null);
  cloudStarControls.setContext(cloud ? viewer?.getStars() ?? null : null);
  refreshReconstructionImages();
  densityTone.setContext(densityVisible && item && toneReadyFor(item.id) ? { subjectId: item.id } : null);
  if (!visible) imageTone.setContext(null);
  starRemoval.setContext(null);
  currentOverlays = []; selectedOverlayId = null; placementControls?.destroy(); placementControls = null;
  publishShell();
  if (!visible || !viewer || !catalogue) return;
  const request = ++overlayRequest;
  try {
    const overlays = await viewer.loadOverlayCatalogue();
    if (request !== overlayRequest || currentTab !== 0 || currentMode !== 'density') return;
    currentOverlays = overlays;
    const stored = storedOverlayId(catalogue), enabled = viewer.getOverlayState().find(value => value.enabled)?.id;
    selectedOverlayId = overlays.some(overlay => overlay.id === stored) ? stored :
      overlays.some(overlay => overlay.id === enabled) ? enabled! : overlays[0]?.id ?? null;
    if (selectedOverlayId) await activateOverlay(selectedOverlayId);
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
  imageTone.setContext(null); layerNote = 'Loading prepared image layer…';
  if (alignmentState) alignmentState = { ...alignmentState, layerNote }; publishShell();
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
  if (!viewer || !selectedOverlayId || busy || !currentOverlays.find(item => item.id === selectedOverlayId)?.variants?.some(layer => layer.id === 'diffuse')) return;
  try {
    const id = selectedOverlayId, strength = validateRemovalStrength(value);
    removalStrengths.set(id, strength);
    if (alignmentState) { alignmentState = { ...alignmentState, layer: 'diffuse', enabled: true, removalStrength: strength }; publishShell(); }
    const active = viewer.getOverlayState().find(overlay => overlay.id === id)?.enabled;
    if (active && viewer.getOverlayLayer(id) === 'diffuse' && pendingLayerActivation === null) refreshImageTone();
    else changeOverlayLayer('diffuse');
  } catch (error) {
    layerNote = error instanceof Error ? error.message : String(error);
    if (alignmentState) alignmentState = { ...alignmentState, layerNote, removalStrength: currentRemovalStrength(currentOverlays.find(item => item.id === selectedOverlayId)!) };
    publishShell();
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
  if (busy) return;
  if (id !== sourceSubject) emissionInspection = 'structure';
  pendingSubject = id; reconstructionImageError = '';
  invalidateToneContexts();
  cloudControls.setContext(null);
  cloudDensityControls.setContext(null);
  cloudStarControls.setContext(null);
  setBusy(true); setStatus('Loading…');
  void refreshOverlayControls();
  try {
    const item = subjects.find(value => value.id === id);
    if (!item) throw new TypeError('Unknown lab subject.');
    if (item.alignmentOnly && currentTab !== 0) {
      currentTab = 0;
      history.replaceState(history.state, '', labViewUrl(new URL(location.href), 'alignment'));
    }
    if (observationInspectionActive(id)) {
      updateSubject(id); setStatus('', true);
    } else {
      const nextMode = currentTab === 0 && item.density ? 'density' : 'photo';
      if (!viewer) await mountViewer(id, nextMode);
      else await viewer.setSubject(id, null, nextMode);
      updateSubject(id);
    }
    if (currentTab === 0 && !supportsLabAlignment(item)) {
      await viewer?.setMode('photo'); selectTab(1);
    }
    if (updateUrl) { const url = new URL(location.href); url.searchParams.set('subject', id);
      history.replaceState(history.state, '', url); }
  }
  catch (error) { reconstructionImageError = error instanceof Error ? error.message : String(error); fail(error); }
  finally { pendingSubject = null; if (!disposed) { setBusy(false); void refreshOverlayControls(); } }
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
  setBusy(true); setStatus(statusState.message, statusState.hidden);
  let failed = false;
  try { await viewer.setMode(next); }
  catch (error) { failed = true; if (request === modeRequest) fail(error); }
  finally {
    if (request !== modeRequest || disposed) return;
    modePending = false;
    currentMode = element('viewer').dataset.mode === 'density' ? 'density' : 'photo';
    updateSubject(element('viewer').dataset.subject ?? objectId(sourceSubject)); updateCredit(); setBusy(false);
    if (failed) selectTab(currentMode === 'density' ? 0 : 1);
    else void refreshOverlayControls();
  }
}

async function mountViewer(id: string, mode: 'density' | 'photo') {
  viewer = await createNebulaLabViewer({ host: element('viewer'), subjectId: id, mode, onState(state) {
    if (disposed || (pendingSubject && state.subjectId !== pendingSubject) ||
        (!pendingSubject && observationInspectionActive() && state.subjectId !== sourceSubject)) return;
    currentMode = state.mode;
    originalOverlayState = state.originalOverlay; materialState = state.material;
    reconstruction.setDifference(state.differenceOverlay);
    updateSubject(state.subjectId);
    activePose = state.pose;
    setStatus(state.status ?? '', element('viewer').dataset.ready === 'true' && !state.error);
    if (state.error) fail(state.error);
  } });
  if (disposed) viewer.destroy();
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
  const initialSubject = subjects.find(item => item.id === requestedSubject) ?? subjects.find(item => item.id === objectId(requestedSubject))!;
  const mountTab = initialSubject.alignmentOnly ? 0 : supportsLabAlignment(initialSubject) ? initialTab : 1;
  selectTab(mountTab);
  updateSubject(initialSubject.id);
  if (observationInspectionActive()) { setStatus('', true); setBusy(false); void refreshOverlayControls(); }
  else {
    await mountViewer(initialSubject.id, mountTab === 0 ? 'density' : 'photo');
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

async function selectEmissionInspection(mode: 'sources' | 'structure' | 'volume') {
  const item = subjects.find(value => value.id === sourceSubject);
  if (!item?.emissionExperiment?.observationStructures || disposed) return;
  if (mode === 'volume' && !item.emissionExperiment.directory) return;
  emissionInspection = mode;
  setBusy(busy);
  if (mode !== 'volume' || busy) return;
  if (!viewer || element('viewer').dataset.subject !== item.id) await changeSubject(item.id, false);
  else await switchMode('photo');
}

function destroy() { if (!disposed) { disposed = true; window.removeEventListener('popstate', onHistoryChange); for (const controller of restoringImages.values()) controller.abort(); densityTone.destroy(); imageTone.destroy(); starRemoval.destroy(); reconstruction.destroy(); placementControls?.destroy(); cloudControls.destroy(); cloudDensityControls.destroy(); cloudStarControls.destroy(); viewer?.destroy(); } }
return { destroy, selectView: (view: 'alignment' | 'reconstruction') => selectTab(view === 'alignment' ? 0 : 1), changeObject: changeSubject,
  selectEmissionInspection,
  chooseImage: changeOverlayChoice, chooseLayer: changeOverlayLayer, setRemovalStrength: changeRemovalStrength,
  showDensityOverlay: (enabled: boolean) => { viewer?.setDensityOverlay(enabled); renderSelectedOverlay(); },
  showImage: changeOverlayVisibility, setImageOpacity: changeOverlayOpacity,
  setMaterial: (mode: 'neutral' | 'textured') => run(() => viewer!.setMaterial(mode)),
  showOriginal: (enabled: boolean) => run(() => viewer!.setOriginalOverlay(enabled)),
  setOriginalOpacity: (opacity: number) => run(() => viewer!.setOriginalOverlay(originalOverlayState?.enabled ?? false, opacity)),
  setPose: (pose: Parameters<Viewer['setPose']>[0]) => run(() => viewer!.setPose(pose)),
  resetCamera: () => run(() => viewer!.reset()), referenceView: () => run(() => viewer!.referenceView()), fitCloud: () => run(() => viewer!.fitCloud()) };
}
