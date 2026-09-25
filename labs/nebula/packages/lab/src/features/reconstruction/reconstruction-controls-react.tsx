import type { ReconstructionProcessingCapability } from './reconstruction-capabilities.ts';
import { acceptsSavedResult, selectedPreviewAllowed, selectedProcessing } from './reconstruction-selection.ts';
import { useEffect, useRef, useState } from 'react';
import type { ControlPortals } from '../../ui/control-portals';
import { readOverlaySessions, resolveSavedPlacement } from '../alignment/overlay-store';
import { defaultOverlayPlacement, parseCloudAppearance, sameCloudAppearance, type CloudAppearance } from '@cssearth/bake/volume';
import type { PreparedReconstruction, ReconstructionCandidate, ReconstructionCatalogue, ReconstructionRequest } from './reconstruction-types.ts';
import { readCloudAppearance, saveCloudAppearance } from './cloud-appearance-store.ts';
import { CloudAppearanceControls } from './cloud-appearance-controls';
import { LensLevelsPanel, LevelsIcon, LEVELS_TOOLTIP } from './lens-levels-panel';
import { differenceTool } from './difference-map';
import { LensRadialPanel, RadialIcon, RADIAL_TOOLTIP } from './lens-radial-panel';
import type { DifferenceOverlayState } from '../legacy-viewer/difference-plane';
import { saveLensSettings } from './lens-settings-export.ts';
import { ImageCredit } from '../workspace/image-credit';
import { WorkspaceImagePicker } from '../workspace/workspace-image-picker';
import { WorkspaceTools } from '../workspace/workspace-tools';

interface Job {
  id: string; status: 'queued' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  progress?: { current?: number; total?: number; message: string }; result?: PreparedReconstruction; error?: string;
}
interface SavedJob { id: string; request: ReconstructionRequest; status: Job['status']; }
interface Selection { imageId: string; displayedResultId?: string; }
const active = (job: Job | SavedJob | null) => Boolean(job && ['queued', 'running', 'cancelling'].includes(job.status));
const selectionKey = (subjectId: string) => `cssearth-nebula-reconstruction-v1:${subjectId}`;
const jobKey = (subjectId: string, imageId: string) => `cssearth-nebula-reconstruction-job-v1:${subjectId}:${imageId}`;
const resultId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function readSelection(subjectId: string): Selection {
  try {
    const saved = JSON.parse(localStorage.getItem(selectionKey(subjectId)) ?? 'null');
    if (saved && typeof saved.imageId === 'string') return { imageId: saved.imageId,
      ...(resultId(saved.displayedResultId) ? { displayedResultId: saved.displayedResultId } : {}) };
  } catch { /* The benchmark remains available without storage. */ }
  return { imageId: '' };
}

interface Props { context: string | null; viewerBusy: boolean;
  captureSettings?(): unknown;
  /** The viewer's difference-map plane, and the switch for it; the map needs the Earth-facing camera. */
  difference?: DifferenceOverlayState; onDifference?(enabled: boolean, opacity: number): void;
  onSelect(prepared: PreparedReconstruction | null, subjectId: string, isCurrent: () => boolean): Promise<boolean>;
}
interface View { imageId: string; candidates: ReconstructionCandidate[]; selectDisabled: boolean; processDisabled: boolean;
  appearance: CloudAppearance; appearanceDirty: boolean; processing?: ReconstructionProcessingCapability;
  running: boolean; cancelling: boolean; job: Job | null; text: string; error: boolean; credit: string; sourcePageUrl?: string; displayedResultId?: string;
  /** The displayed result when it is a baked image lens, which is what the levels measurement compares. */
  lensResultId?: string; }
const initialView: View = { imageId: 'benchmark', candidates: [], selectDisabled: true, processDisabled: true,
  appearance: parseCloudAppearance(), appearanceDirty: false,
  running: false, cancelling: false, job: null, text: '', error: false, credit: 'Historical photo-based LMC experiment.' };
export function ReconstructionControls({ context, viewerBusy: busy, onSelect, captureSettings, difference, onDifference }: Props) {
  const [view, setView] = useState<View>(initialView);
  const [exportLabel, setExportLabel] = useState('Save lens settings');
  const actions = useRef<{ choose?(value: string): void; appearance?(value: CloudAppearance): void; process?(): void; cancel?(): void; export?(): void; busy?(value: boolean): void }>({});
  useEffect(() => {
  let messageText = '', messageError = false;
  let subjectId: string | null = null, catalogue: ReconstructionCatalogue | null = null, selection: Selection = { imageId: 'benchmark' };
  let version = 0, controller: AbortController | null = null, job: Job | null = null, loading = false, mounting = false, viewerBusy = false;
  let starting: Promise<void> | null = null;
  let appearance = parseCloudAppearance(), displayedAppearance = parseCloudAppearance();
  let displayedProcessing: ReconstructionProcessingCapability | undefined;
  const previewAllowed = () => selectedPreviewAllowed(catalogue, candidate());
  const candidate = () => catalogue?.candidates.find(item => item.imageId === selection.imageId);
  function message(value: string, error = false) { messageText = value; messageError = error; render(); }
  function saveSelection() {
    if (subjectId) try { localStorage.setItem(selectionKey(subjectId), JSON.stringify(selection)); } catch { /* Current selection still works. */ }
  }
  function render() {
    const row = candidate(), running = active(job);
    setView({ imageId: selection.imageId, candidates: catalogue?.candidates ?? [],
      selectDisabled: loading || mounting || viewerBusy || !subjectId,
      processing: selectedProcessing(catalogue, row), processDisabled: !previewAllowed() || !row?.ready || loading || mounting || viewerBusy || running,
      appearance: { ...appearance }, appearanceDirty: Boolean(row) && !sameCloudAppearance(appearance, displayedAppearance),
      running, cancelling: job?.status === 'cancelling', job, text: messageText, error: messageError,
      credit: row?.credit ?? 'Historical photo-based LMC experiment.', sourcePageUrl: row?.sourcePageUrl,
      displayedResultId: selection.displayedResultId,
      lensResultId: row?.prepared?.finiteMaterial && row.prepared.resultId === selection.displayedResultId ? row.prepared.resultId : undefined });
  }
  function stopObserver() { version++; controller?.abort(); controller = null; job = null; }
  async function json(path: string, init: RequestInit = {}, signal = controller?.signal) {
    const response = await fetch(path, { ...init, signal }), value = await response.json();
    if (!response.ok) throw Object.assign(new Error(value.error ?? `Reconstruction unavailable (HTTP ${response.status}).`), { status: response.status });
    return value;
  }
  function readJob(): SavedJob | null {
    if (!subjectId || !candidate()) return null;
    try {
      const saved = JSON.parse(localStorage.getItem(jobKey(subjectId, selection.imageId)) ?? 'null') as SavedJob | null;
      return saved && /^[a-f0-9-]{36}$/.test(saved.id) && saved.request?.subjectId === subjectId &&
        saved.request.imageId === selection.imageId && saved.request.action === 'apply' ? saved : null;
    } catch { return null; }
  }
  function saveJob(saved: SavedJob) { localStorage.setItem(jobKey(saved.request.subjectId, saved.request.imageId), JSON.stringify(saved)); }
  async function install(prepared: PreparedReconstruction | null, current: () => boolean) {
    if (!current() || !subjectId) return;
    if (prepared && (prepared.schema !== 'cssearth-nebula-reconstruction@1' || !resultId(prepared.resultId) || prepared.subject.id !== `reconstruction-${prepared.resultId}`))
      throw new TypeError('Invalid saved reconstruction identity.');
    mounting = true; render();
    try {
      if (await onSelect(prepared, subjectId, current) && current()) {
        displayedProcessing = prepared?.processing;
        displayedAppearance = parseCloudAppearance(prepared?.appearance);
        appearance = readCloudAppearance(subjectId, selection.imageId, displayedAppearance);
        selection.displayedResultId = prepared?.resultId; saveSelection();
        const skipped = catalogue?.finiteModel?.skipped?.length; // Never present an older fit as the newest one silently.
        message(`${skipped ? `Older finite model shown · ${skipped} newer lens index rejected. ` : ''}${prepared ? displayedProcessing?.densityPreview === false ? `${displayedProcessing.modelLabel} · offline refit only.` : 'Reconstruction loaded.' : 'Unpainted density reference.'}`, Boolean(skipped));
      }
    } finally { if (current()) { mounting = false; render(); } }
  }
  function wait(signal: AbortSignal) {
    return new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
      const timer = window.setTimeout(done, 1000); signal.addEventListener('abort', done, { once: true });
      if (signal.aborted) done();
    });
  }
  function accept(value: Job, saved: SavedJob) {
    if (!value || value.id !== saved.id || !['queued', 'running', 'cancelling', 'completed', 'failed', 'cancelled', 'interrupted'].includes(value.status))
      throw new TypeError('Invalid reconstruction job identity.');
    if (value.result && (value.result.imageId !== saved.request.imageId || value.result.removalResultId !== saved.request.removalResultId ||
        !sameCloudAppearance(value.result.appearance, saved.request.appearance)))
      throw new TypeError('Reconstruction result differs from the requested source.');
    job = value; saved.status = value.status; saveJob(saved);
    message(value.error ?? (active(value) ? value.progress?.message ?? `Reconstruction ${value.status}…` : value.status === 'completed' ? 'Reconstruction ready.' : `Reconstruction ${value.status}.`), Boolean(value.error));
    render();
  }
  async function watch(saved: SavedJob, initial?: Job) {
    const owner = version, signal = controller!.signal, current = () => owner === version && !signal.aborted;
    let value = initial;
    while (current()) {
      try {
        if (!value) {
          try { value = (await json(`/__nebula/reconstruction-jobs/${saved.id}`, {}, signal)).job; }
          catch (error) {
            if ((error as { status?: number }).status !== 404) throw error;
            value = (await json('/__nebula/reconstruction-jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId: saved.id, request: saved.request }) }, signal)).job;
          }
        }
        if (!current()) return;
        accept(value!, saved);
        if (value!.status === 'completed' && value!.result) {
          const row = candidate(); if (row) row.prepared = value!.result;
          await install(value!.result, current); return;
        }
        if (!active(value!)) return;
      } catch (error) {
        if (!current()) return;
        message(active(saved) ? 'Connection lost · reconnecting to the same job…' : error instanceof Error ? error.message : String(error), true);
        if (!active(saved)) return;
      }
      await wait(signal); value = undefined;
    }
  }
  async function activateSelection(restoreDisplay = false) {
    stopObserver(); controller = new AbortController(); const owner = version, current = () => owner === version && !controller?.signal.aborted;
    render();
    try {
      const row = candidate(), saved = readJob();
      appearance = readCloudAppearance(subjectId!, selection.imageId, row?.prepared?.appearance); render();
      if (saved && active(saved) && selectedPreviewAllowed(catalogue, row)) {
        job = { id: saved.id, status: saved.status }; message('Reattaching to reconstruction…'); render(); void watch(saved);
      }
      if (!row) { await install(null, current); return; }
      if (row.prepared) await install(row.prepared, current);
      else if (restoreDisplay && selection.displayedResultId && catalogue && acceptsSavedResult(catalogue, selection.displayedResultId)) {
        const prepared = await json(`/__nebula/reconstruction/result/${selection.displayedResultId}`) as PreparedReconstruction;
        if (prepared.imageId === row.imageId) row.prepared = prepared; // Preview capability follows the selected row.
        if (current()) await install(prepared, current);
      }
      if (current() && !active(job) && !row.prepared) message(row.ready ? 'Ready to process.' : row.reason ?? 'Remove stars in Alignment first.');
    } catch (error) { if (current()) { mounting = false; message(error instanceof Error ? error.message : String(error), true); render(); } }
  }
  actions.current.choose = value => {
    if (catalogue?.candidates.find(row => row.imageId === value)?.unavailable) return;
    selection.imageId = value; saveSelection(); void activateSelection();
  };
  actions.current.appearance = value => {
    if (!previewAllowed() || !subjectId || !candidate() || loading || mounting || viewerBusy || active(job)) return;
    appearance = parseCloudAppearance(value); saveCloudAppearance(subjectId, selection.imageId, appearance); render();
  };
  actions.current.export = () => {
    if (!subjectId || loading || mounting || viewerBusy || active(job)) return;
    setExportLabel('Saving…');
    void saveLensSettings(subjectId, { ...selection }, captureSettings?.()).then(() => setExportLabel('✓ Lens settings saved'), error => { setExportLabel('Save lens settings'); message(error.message, true); });
  };
  actions.current.process = () => {
    if (!previewAllowed()) { message(selectedProcessing(catalogue, candidate())?.reason ?? 'This saved method does not support density Preview.'); return; }
    const row = candidate(); if (!row?.ready || !row.removalResultId || !catalogue || !subjectId || loading || mounting || active(job)) return;
    const previous = readJob(); if (previous && active(previous)) { void activateSelection(); return; }
    const savedPlacement = readOverlaySessions().get(catalogue.overlayCatalogue)?.find(item => item.id === row.imageId);
    const placement = savedPlacement?.basis === row.placementBasis ?
      resolveSavedPlacement(savedPlacement.placement, savedPlacement.defaultPlacement ?? defaultOverlayPlacement(), row.placement) : row.placement;
    const request: ReconstructionRequest = { action: 'apply', subjectId, imageId: row.imageId, removalResultId: row.removalResultId, placement,
      appearance: { ...appearance } };
    const saved: SavedJob = { id: crypto.randomUUID(), request, status: 'queued' };
    try { saveJob(saved); } catch { message('Enable local storage before processing.', true); return; }
    stopObserver(); controller = new AbortController(); const owner = version;
    job = { id: saved.id, status: 'queued' }; message('Reconstruction queued…'); render();
    starting = (async () => {
      try {
        const value = await json('/__nebula/reconstruction-jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId: saved.id, request }) });
        if (owner === version) void watch(saved, value.job);
      } catch { if (owner === version) { message('Connection lost · reconnecting to the same job…'); void watch(saved); } }
      finally { starting = null; }
    })();
  };
  actions.current.cancel = () => {
    const saved = readJob(), owner = version; if (!saved || !active(job)) return;
    void (async () => {
      if (starting) await starting;
      if (owner !== version) return;
      try {
        const value = await json(`/__nebula/reconstruction-jobs/${saved.id}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        if (owner === version) accept(value.job, saved);
      } catch { if (owner === version) message('Cancel was not confirmed · retry Cancel.', true); }
    })();
  };
  const api = {
    setContext(next: string | null) {
      if (next === subjectId) return;
      stopObserver(); subjectId = next; catalogue = null; loading = false; mounting = false;
      if (!next) { render(); return; }
      selection = readSelection(next); controller = new AbortController(); const owner = version;
      loading = true; message('Loading saved sources…'); render();
      void (async () => {
        try {
          const value = await json(`/__nebula/reconstruction?subjectId=${encodeURIComponent(next)}`) as ReconstructionCatalogue;
          if (owner !== version) return;
          if (value.subjectId !== next || !Array.isArray(value.candidates)) throw new TypeError('Invalid reconstruction source catalogue.');
          catalogue = value;
          if (!selection.imageId || candidate()?.unavailable) selection.imageId = value.candidates.find(row => row.prepared)?.imageId ?? 'benchmark';
          if (selection.imageId !== 'benchmark' && !candidate()) selection.imageId = 'benchmark';
          const requested = /^reconstruction-([a-f0-9]{64})$/.exec(new URL(location.href).searchParams.get('subject') ?? '')?.[1];
          if (requested && acceptsSavedResult(value, requested)) {
            const prepared = value.candidates.find(row => row.prepared?.resultId === requested)?.prepared ??
              await json(`/__nebula/reconstruction/result/${requested}`) as PreparedReconstruction;
            if (owner !== version) return;
            const row = value.candidates.find(item => item.imageId === prepared.imageId);
            if (row) { row.prepared = prepared; selection.imageId = row.imageId; selection.displayedResultId = requested; }
          }
          loading = false; render(); await activateSelection(true);
        } catch (error) { if (owner === version) { loading = false; message(error instanceof Error ? error.message : String(error), true); render(); } }
      })();
    },
    setBusy(value: boolean) { viewerBusy = value; render(); },
    destroy() { stopObserver(); },
  };
  actions.current.busy = api.setBusy;
  api.setBusy(busy); api.setContext(context);
  return () => { api.destroy(); actions.current = {}; };
  }, [context, onSelect]);
  useEffect(() => { actions.current.busy?.(busy); }, [busy]);
  const total = view.job?.progress?.total, current = view.job?.progress?.current;
  return <section className="reconstruction-controls" data-selected-image={view.imageId}
    data-reconstruction-job={view.job?.id} data-reconstruction-job-status={view.job?.status}
    data-reconstruction-result={view.displayedResultId}>
    <WorkspaceImagePicker target="reconstruction-image-picker">
    <label className="visually-hidden" htmlFor="reconstruction-image">Image</label>
    <select id="reconstruction-image" aria-describedby="reconstruction-image-status" value={view.imageId}
      disabled={view.selectDisabled} onChange={event => actions.current.choose?.(event.target.value)}>
      <option value="benchmark">Unpainted density</option>
      {view.candidates.map(row => <option key={row.imageId} value={row.imageId} disabled={Boolean(row.unavailable)} title={row.unavailable}>
        {row.label}{row.unavailable ? ' · no lens' : row.prepared ? ' · saved' : ''}</option>)}
    </select>
    </WorkspaceImagePicker>
    <ImageCredit credit={view.credit} active={context !== null && view.imageId !== 'benchmark' && view.candidates.some(row => row.imageId === view.imageId)} />
    {view.imageId !== 'benchmark' && <CloudAppearanceControls value={view.appearance} disabled={view.processDisabled} reason={view.processing?.reason}
      onChange={value => actions.current.appearance?.(value)} />}
    <div className="reconstruction-actions">
      <button id="reconstruction-process" type="button" disabled={view.processDisabled} onClick={() => actions.current.process?.()}
        title={view.processing?.reason ?? "Save a material preview on the fixed density source using the current Alignment placement."}>Preview</button>
      <button id="reconstruction-cancel" type="button" hidden={!view.running} disabled={view.cancelling} onClick={() => actions.current.cancel?.()}>Cancel</button>
    </div>
    <p id="reconstruction-image-status" className="reconstruction-image-detail" role="status" aria-live="polite" data-error={view.error}>
      {view.appearanceDirty && !view.running && !view.error && !view.processDisabled ? 'Changes ready · Preview to apply.' : view.text}</p>
    <progress id="reconstruction-progress" aria-label="Reconstruction progress" hidden={!view.running}
      max={total && Number.isFinite(current) ? total : undefined} value={total && Number.isFinite(current) ? current : undefined} />
    {/* Levels, the difference map and the radial profile need a source image: no tools for the unpainted density or an unbaked lens. */}
    <WorkspaceTools tools={view.lensResultId ? [{ id: 'levels', label: 'Levels', tooltip: LEVELS_TOOLTIP, icon: <LevelsIcon />,
      panel: <LensLevelsPanel key={view.lensResultId} resultId={view.lensResultId} /> },
      ...differenceTool(view.lensResultId, difference, onDifference),
      { id: 'radial', label: 'Radial profile', tooltip: RADIAL_TOOLTIP, icon: <RadialIcon />,
        panel: <LensRadialPanel key={view.lensResultId} resultId={view.lensResultId} /> }] : []} />
    <button id="save-lens-settings" type="button" className="text-button" disabled={view.selectDisabled || view.running}
      title="Save this browser’s lens, filter, brightness and star settings locally for the app handoff. Includes stored settings for all images; does not bake."
      onClick={() => actions.current.export?.()}>{exportLabel}</button>
  </section>;
}

export function createReconstructionControls(host: HTMLElement, options: Pick<Props, 'onSelect' | 'captureSettings' | 'onDifference'> & { controls: ControlPortals }) {
  const root = options.controls.mount(host); let context: string | null = null, viewerBusy = false, disposed = false;
  let difference: DifferenceOverlayState | undefined;
  const render = () => { if (!disposed) root.render(<ReconstructionControls context={context} viewerBusy={viewerBusy} onSelect={options.onSelect}
    captureSettings={options.captureSettings} difference={difference} onDifference={options.onDifference} />); };
  render();
  return { setContext(next: string | null) { if (next !== context) { context = next; render(); } },
    setDifference(next: DifferenceOverlayState | undefined) {
      if (JSON.stringify(next) !== JSON.stringify(difference)) { difference = next && { ...next }; render(); }
    },
    setBusy(next: boolean) { if (next !== viewerBusy) { viewerBusy = next; render(); } },
    destroy() { if (!disposed) { disposed = true; root.unmount(); } } };
}
