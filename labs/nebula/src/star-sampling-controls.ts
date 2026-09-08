import { createStarRemovalJobs, removalJobActive, type RemovalJob } from './star-removal-jobs';
import { createStarPositionPicker } from './star-position-picker';
import type { SamplePoint, SamplingControls, SamplingResult, StarSample, ValidationSample } from './star-sampling-types';

interface Context { imageId: string; label: string; supported: boolean; }
import { defaultSamplingControls as defaults, pointKey as key, validSamplePoint as validPoint, readReferenceState,
  referenceStorageKey, mergeReferenceSamples, type StarReference } from './star-sampling-state';
export function overviewPoint(x: number, y: number, width: number, height: number, dimensions: [number, number]): SamplePoint {
  if (![x, y, width, height, ...dimensions].every(Number.isFinite) || width <= 0 || height <= 0 || dimensions.some(value => value < 1))
    throw new TypeError('Invalid overview extent.');
  return { x: Math.max(0, Math.min(dimensions[0] - 1, x / width * dimensions[0] - .5)),
    y: Math.max(0, Math.min(dimensions[1] - 1, y / height * dimensions[1] - .5)) };
}
export function createStarSamplingControls(host: HTMLElement, options: { onApply?(result: SamplingResult, isCurrent: () => boolean): Promise<void | boolean> } = {}) {
  host.innerHTML = `<section class="star-sampling">
    <div class="sampling-actions" title="Find or add reference stars, then Remove stars from image. Preview samples is optional. The 3D reconstruction stays unchanged."><button id="star-survey" type="button">Find samples</button><button id="star-preview" type="button" disabled>Preview samples</button><button id="star-cancel" type="button" disabled hidden>Cancel</button></div>
    <p id="star-sampling-status" class="sampling-status" role="status" aria-live="polite"></p>
    <progress id="star-sampling-progress" aria-label="Star sampling progress" hidden></progress>
    <div id="star-sampling-workspace" hidden>
      <div class="sampling-coverage"><button id="star-show-references" type="button" aria-pressed="false" aria-controls="star-overview-references" title="Circle every reference on the galaxy. Solid rings are selected for calibration; dashed rings are excluded. The current reference is white.">All references</button></div>
      <div class="star-overview"><img id="star-overview" alt="Full galaxy image. Pick a star, then choose Add sample." /><div id="star-overview-references" aria-hidden="true" hidden></div><span id="star-overview-marker" hidden></span><div id="star-loupe" class="star-loupe" hidden></div></div>
      <div class="sampling-navigation"><button id="star-previous" type="button" aria-label="Previous star">←</button><output id="star-position" aria-live="polite">0 / 0</output><button id="star-next" type="button" aria-label="Next star">→</button><button id="star-inspect" type="button" disabled>Add sample</button></div>
      <section id="star-selected" hidden>
        <div id="star-view" class="sampling-view" role="group" aria-label="Star sample view"><button id="star-reference-view" type="button" aria-pressed="true">References</button><button id="star-check-view" type="button" aria-pressed="false" disabled>Calibration checks</button></div>
        <label class="sampling-checkbox"><input id="star-include" type="checkbox" /> Use for calibration</label>
        <p id="star-sample-flags" class="sampling-note"></p>
        <div id="star-crops" class="star-crop-grid"><figure><img id="star-crop-source" alt="Original native star crop" /><figcaption>Original</figcaption></figure><figure><img id="star-crop-model" alt="Isolated star model" /><figcaption>Isolated star</figcaption></figure><figure><img id="star-crop-residual" alt="Star crop after model subtraction" /><figcaption class="star-result-buttons"><button id="star-show-result" type="button" aria-pressed="true">Result</button><button id="star-show-mask" type="button" aria-pressed="false" disabled>Mask</button></figcaption></figure></div>
      </section>
      <button id="star-apply" class="star-apply" type="button" disabled title="Learn from the selected reference stars, then remove matching stars from the image. This creates inspection images only, never a 3D bake.">Remove stars from image</button>
      <div class="sampling-footer"><span id="star-selection-count" class="sampling-note"></span><button id="copy-star-recipe" class="text-button" type="button" disabled>Copy calibration</button></div>
    </div></section>`;
  const element = <T extends HTMLElement>(id: string) => host.querySelector<T>(`#${id}`)!;
  const status = element('star-sampling-status'), workspace = element('star-sampling-workspace');
  const overview = element<HTMLImageElement>('star-overview'), marker = element('star-overview-marker');
  const referenceOverlay = element('star-overview-references'), referenceToggle = element<HTMLButtonElement>('star-show-references');
  const referenceMarkers = new Map<string, HTMLSpanElement>();
  const copy = element<HTMLButtonElement>('copy-star-recipe'), apply = element<HTMLButtonElement>('star-apply');
  const picker = createStarPositionPicker(element('star-loupe'), point => { pendingPoint = point; renderSelected(); status.textContent = 'Centre selected · Add sample to confirm.'; });
  let context: Context | null = null, result: SamplingResult | null = null, controls = defaults();
  let references: StarReference[] = [], selected: SamplePoint | null = null, pendingPoint: SamplePoint | null = null, calibrationCurrent = false;
  let checks: ValidationSample[] = [], checkIndex = 0, showChecks = false, showMask = false, showReferences = false;
  let removalJob: RemovalJob | null = null;
  const missingPreviews = new Set<string>();
  let version = 0, requestVersion = 0, removalSequence = 0, pending: AbortController | null = null;
  const progress = element<HTMLProgressElement>('star-sampling-progress'), cancel = element<HTMLButtonElement>('star-cancel');
  const jobs = createStarRemovalJobs({
    onState(job) {
      if (context?.imageId !== job.imageId) return; removalJob = job;
      host.dataset.removalJob = job.id; host.dataset.removalJobStatus = job.status;
      const active = removalJobActive(job), update = job.progress;
      cancel.hidden = cancel.disabled = !active; progress.hidden = !active;
      if (active && update?.total && Number.isFinite(update.current)) { progress.max = update.total; progress.value = update.current!; }
      else progress.removeAttribute('value');
      status.textContent = job.error ?? (active ? `${update?.message ?? (job.status === 'queued' ? 'Removal queued…' : job.status === 'cancelling' ? 'Cancelling removal…' : 'Removing stars…')}${update?.total ? ` (${update.current ?? 0}/${update.total})` : ''}` : job.status === 'completed' ? 'Removal complete.' : `Removal ${job.status}.`);
      status.dataset.error = String(Boolean(job.error)); render();
    },
    async onComplete(completed, isCurrent) {
      const installed = await options.onApply?.(completed, isCurrent);
      if (isCurrent() && installed !== false) { status.textContent = 'Image updated.'; host.dataset.samplingOperation = 'apply'; }
      return installed;
    },
  });
  const included = () => references.filter(row => row.included).map(row => row.point);
  function save() {
    if (!result) return;
    try { localStorage.setItem(referenceStorageKey(result), JSON.stringify({ controls, references, selected })); }
    catch { /* Sampling still works without local storage. */ }
  }
  const selectedReference = () => references.find(row => selected && key(row.point) === key(selected));
  function visibleSample() { return showChecks ? checks[checkIndex] : selectedReference()?.sample; }
  function renderReferenceMarkers() {
    referenceOverlay.hidden = !showReferences;
    referenceToggle.setAttribute('aria-pressed', String(showReferences));
    if (!result) return;
    const live = new Set(references.map(row => key(row.point)));
    for (const [id, ring] of referenceMarkers) if (!live.has(id)) { ring.remove(); referenceMarkers.delete(id); }
    for (const reference of references) {
      const id = key(reference.point), position = reference.sample?.point ?? reference.point;
      let ring = referenceMarkers.get(id);
      if (!ring) {
        ring = document.createElement('span'); ring.className = 'star-reference-marker'; ring.dataset.reference = id;
        referenceMarkers.set(id, ring); referenceOverlay.append(ring);
      }
      ring.style.left = `${(position.x + .5) / result.nativeDimensions[0] * 100}%`;
      ring.style.top = `${(position.y + .5) / result.nativeDimensions[1] * 100}%`;
      ring.dataset.included = String(reference.included);
      ring.dataset.current = String(!pendingPoint && !showChecks && selected !== null && key(selected) === id);
    }
  }
  function renderSelected() {
    const index = showChecks ? checkIndex : references.findIndex(value => selected && key(value.point) === key(selected));
    const sample = visibleSample(), reference = selectedReference(), count = showChecks ? checks.length : references.length;
    apply.disabled = !references.length || !options.onApply || Boolean(pending) || Boolean(pendingPoint) || removalJobActive(removalJob);
    element('star-selected').hidden = showChecks ? !sample : !reference; marker.hidden = !pendingPoint && !sample && !reference;
    renderReferenceMarkers();
    if (showReferences && !pendingPoint && !showChecks) marker.hidden = true;
    element('star-position').textContent = `${index >= 0 ? index + 1 : 0} / ${count}`;
    element<HTMLButtonElement>('star-previous').disabled = count < 2;
    element<HTMLButtonElement>('star-next').disabled = count < 2;
    element<HTMLButtonElement>('star-inspect').disabled = !pendingPoint || removalJobActive(removalJob);
    if ((pendingPoint || sample || reference) && result) {
      const position = pendingPoint ?? sample?.point ?? reference!.point;
      marker.style.left = `${(position.x + .5) / result.nativeDimensions[0] * 100}%`;
      marker.style.top = `${(position.y + .5) / result.nativeDimensions[1] * 100}%`;
    }
    if (result) picker.show(pendingPoint, { url: result.overview.url, nativeDimensions: result.nativeDimensions }, sample);
    element<HTMLButtonElement>('star-check-view').disabled = !checks.length;
    element('star-check-view').setAttribute('aria-pressed', String(showChecks));
    element('star-reference-view').setAttribute('aria-pressed', String(!showChecks));
    element<HTMLInputElement>('star-include').closest('label')!.hidden = showChecks;
    element<HTMLInputElement>('star-include').checked = reference?.included ?? false;
    host.dataset.selectedReference = selected ? key(selected) : '';
    const missing = !sample || missingPreviews.has(key(sample.requestedPoint));
    element('star-crops').hidden = missing;
    if (missing) { element('star-sample-flags').textContent = 'Preview unavailable · Preview samples to refresh'; return; }
    const validation = showChecks ? sample as ValidationSample : null;
    const bankResult = validation ?? (sample.modelKind === 'shared-profile-bank' ? sample : null);
    const flags = (bankResult?.reasons ?? sample.metrics.flags).join(', ').replaceAll('-', ' ');
    const label = bankResult ? `${!calibrationCurrent ? 'Previously ' : ''}${bankResult.accepted ? 'matched' : 'rejected'}` : 'Not learned yet';
    element('star-sample-flags').textContent = label.charAt(0).toUpperCase() + label.slice(1);
    element('star-sample-flags').title = `${flags}${sample.contributesProfile === undefined ? '' : sample.contributesProfile ? ' · Used to learn a profile.' : ' · Not used to learn a profile.'}\n${JSON.stringify({ point: sample.point, metrics: sample.metrics }, null, 2)}`;
    element<HTMLButtonElement>('star-show-mask').disabled = !sample.images.mask;
    element('star-show-mask').setAttribute('aria-pressed', String(showMask && Boolean(sample.images.mask)));
    element('star-show-result').setAttribute('aria-pressed', String(!showMask || !sample.images.mask));
    for (const kind of ['source', 'model', 'residual'] as const) element<HTMLImageElement>(`star-crop-${kind}`).src = kind === 'residual' && showMask && sample.images.mask ? sample.images.mask : sample.images[kind];
  }
  function render() {
    if (!result) return;
    element('star-view').title = result.limitations.join(' ');
    workspace.hidden = false; overview.src = result.overview.url;
    element('star-selection-count').textContent = `${included().length} selected`;
    element<HTMLButtonElement>('star-preview').disabled = !included().length || removalJobActive(removalJob);
    element<HTMLButtonElement>('star-survey').disabled = !context?.supported || removalJobActive(removalJob);
    copy.disabled = !included().length || !calibrationCurrent;
    apply.disabled = !references.length || !options.onApply || Boolean(pending) || Boolean(pendingPoint) || removalJobActive(removalJob);
    host.dataset.sampleCount = String(references.length);
    renderSelected();
  }
  async function readResponse(response: Response, current: () => boolean): Promise<SamplingResult> {
    if (!response.headers.get('content-type')?.includes('application/x-ndjson')) return await response.json() as SamplingResult;
    if (!response.body) throw new Error('The sample progress stream is unavailable.');
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', final: SamplingResult | null = null;
    const consume = (line: string) => {
      if (!line.trim()) return; const event = JSON.parse(line);
      if (!current()) return false;
      if (event.type === 'progress') {
        status.textContent = `${event.message ?? event.stage}${Number.isFinite(event.current) && Number.isFinite(event.total) && event.total > 0 ? ` (${event.current}/${event.total})` : ''}`;
        if (Number.isFinite(event.current) && Number.isFinite(event.total) && event.total > 0) { progress.max = event.total; progress.value = event.current; }
        else progress.removeAttribute('value');
      } else if (event.type === 'result') final = event.result;
      else if (event.type === 'error') throw new Error(event.message ?? 'Sample preparation failed.');
    };
    while (true) {
      const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let end = buffer.indexOf('\n'); while (end >= 0) { consume(buffer.slice(0, end)); buffer = buffer.slice(end + 1); end = buffer.indexOf('\n'); }
      if (chunk.done) break;
    }
    consume(buffer); if (!final) throw new Error('Sample preparation ended without a completed result.'); return final;
  }
  async function request(action: 'overview' | 'survey' | 'inspect' | 'preview', points?: SamplePoint[], point?: SamplePoint): Promise<boolean> {
    if (!context?.supported) return false;
    const owner = version, revision = ++requestVersion, imageId = context.imageId;
    const expectedControls = { ...controls };
    copy.disabled = true; apply.disabled = true;
    pending?.abort(); pending = new AbortController();
    cancel.disabled = false; cancel.hidden = false; progress.hidden = false; progress.removeAttribute('value');
    status.dataset.error = 'false'; status.textContent = action === 'overview' ? 'Loading the source overview…' : action === 'survey' ? 'Finding native star samples…' : 'Fitting sample crops…';
    const belongs = () => owner === version && revision === requestVersion && context?.imageId === imageId;
    const current = belongs;
    try {
      const response = await fetch('/__nebula/star-samples', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' }, signal: pending.signal,
        body: JSON.stringify({ imageId, action, ...(point ? { point } : {}), ...(points ? { points } : {}), controls: expectedControls,
          options: { sampleCount: 30, maximumRadius: 128 } }) });
      const body = await readResponse(response, current);
      if (!response.ok) throw new Error((body as unknown as { error?: string }).error ?? `Sample preparation failed (HTTP ${response.status}).`);
      if (!current()) return false;
      const next = body as SamplingResult;
      if (next.schema !== 'cssearth-star-sampling-result@1' || next.imageId !== imageId || !/^[a-f0-9]{64}$/.test(next.sourceSha256) ||
        !Array.isArray(next.samples) || !Array.isArray(next.nativeDimensions) || next.samples.some(sample => !validPoint(sample.point, next.nativeDimensions) || !validPoint(sample.requestedPoint, next.nativeDimensions)))
        throw new TypeError('Invalid prepared star sample response.');
      const reset = !result || result.sourceSha256 !== next.sourceSha256 || result.nativeDimensions.join() !== next.nativeDimensions.join();
      if (reset) { references = []; selected = null; pendingPoint = null; checks = []; showChecks = false; controls = defaults(); missingPreviews.clear(); }
      result = next;
      const stored = reset ? readReferenceState(next) : null;
      if (stored) { controls = stored.controls; references = stored.references; selected = stored.selected; }
      references = mergeReferenceSamples(references, next.samples, action === 'inspect');
      for (const sample of next.samples) missingPreviews.delete(key(sample.requestedPoint));
      if (action === 'inspect') { selected = next.samples[0]?.requestedPoint ?? selected; pendingPoint = null; showChecks = false; checks = []; }
      if (action === 'survey') { checks = []; showChecks = false; }
      if (action === 'preview') { checks = next.validationSamples ?? []; checkIndex = 0; }
      if (!selected || references.length && !references.some(row => key(row.point) === key(selected!))) selected = references[0]?.point ?? null;
      const calibratedPoints = action === 'survey' ? next.samples.filter(sample => sample.qualified).map(sample => sample.requestedPoint) : points ?? [];
      const expectedKeys = calibratedPoints.map(key).sort().join('|'), selectedKeys = included().map(key).sort().join('|');
      calibrationCurrent = Boolean(next.calibration?.qualifiedCount) && action === 'preview' && expectedKeys === selectedKeys && JSON.stringify(expectedControls) === JSON.stringify(controls);
      host.dataset.samplingOperation = action;
      save(); render(); status.textContent = action === 'overview' ? references.length ? 'Saved previews · removal will refresh the model.' : 'Find samples or pick a star to add.' : action === 'inspect' && !next.samples.length ? 'No suitable star found here.' : calibrationCurrent ? next.calibration?.qualifiedCount ? 'Samples previewed · ready for removal.' : 'No usable fits in this selection.' : 'References ready · choose Remove stars.';
      return true;
    } catch (error) {
      if (current() && (error as { name?: string }).name !== 'AbortError') { status.dataset.error = 'true'; status.textContent = error instanceof Error ? error.message : String(error); }
      return false;
    } finally { if (belongs()) { pending = null; cancel.disabled = true; cancel.hidden = true; progress.hidden = true; render(); } }
  }
  function markDirty() {
    calibrationCurrent = false; copy.disabled = true; checks = []; showChecks = false;
    status.textContent = 'References changed · image unchanged.';
  }
  function moveSample(direction: number) {
    pendingPoint = null;
    if (showChecks) checkIndex = (checkIndex + direction + checks.length) % checks.length;
    else {
      if (!references.length) return;
      const index = references.findIndex(row => selected && key(row.point) === key(selected));
      selected = references[(Math.max(index, 0) + direction + references.length) % references.length]!.point;
    }
    save(); renderSelected();
  }
  referenceToggle.addEventListener('click', () => { showReferences = !showReferences; renderSelected(); });
  element('star-show-result').addEventListener('click', () => { showMask = false; renderSelected(); });
  element('star-show-mask').addEventListener('click', () => { showMask = true; renderSelected(); });
  element('star-reference-view').addEventListener('click', () => { showChecks = false; pendingPoint = null; renderSelected(); });
  element('star-check-view').addEventListener('click', () => { if (checks.length) { showChecks = true; pendingPoint = null; renderSelected(); } });
  element('star-previous').addEventListener('click', () => moveSample(-1));
  element('star-next').addEventListener('click', () => moveSample(1));
  element<HTMLInputElement>('star-include').addEventListener('change', event => {
    const reference = selectedReference(); if (!reference) return;
    reference.included = (event.target as HTMLInputElement).checked;
    markDirty(); save(); render();
  });
  overview.addEventListener('click', event => {
    if (!result) return; const bounds = overview.getBoundingClientRect();
    const point = overviewPoint(event.clientX - bounds.left, event.clientY - bounds.top, bounds.width, bounds.height, result.nativeDimensions);
    pendingPoint = point; renderSelected();
    status.textContent = 'Position selected · Add sample to inspect.';
  });
  for (const kind of ['source', 'model', 'residual']) element<HTMLImageElement>(`star-crop-${kind}`).addEventListener('error', () => {
    const sample = visibleSample(); if (sample) { missingPreviews.add(key(sample.requestedPoint)); renderSelected(); }
  });
  element<HTMLImageElement>('star-crop-source').addEventListener('click', event => {
    const sample = visibleSample();
    if (!sample) return;
    const bounds = element<HTMLImageElement>('star-crop-source').getBoundingClientRect();
    const local = overviewPoint(event.clientX - bounds.left, event.clientY - bounds.top, bounds.width, bounds.height, [sample.cutout.width, sample.cutout.height]);
    pendingPoint = { x: sample.cutout.x + local.x, y: sample.cutout.y + local.y }; renderSelected();
    status.textContent = 'Position selected · Add sample to inspect.';
  });
  element('star-inspect').addEventListener('click', () => {
    if (result && pendingPoint && validPoint(pendingPoint, result.nativeDimensions)) void request('inspect', undefined, pendingPoint);
  });
  cancel.addEventListener('click', () => {
    if (removalJobActive(removalJob)) { void jobs.cancel(); return; }
    removalSequence++; requestVersion++; pending?.abort(); pending = null; cancel.disabled = true; cancel.hidden = true; progress.hidden = true;
    render(); status.textContent = 'Cancelled · samples retained.';
  });
  apply.addEventListener('click', async () => {
    if (apply.disabled) return;
    const points = included(), sequence = ++removalSequence, imageId = context?.imageId;
    if (!points.length) { status.textContent = 'Select at least one reference star.'; return; }
    const current = () => sequence === removalSequence && context?.imageId === imageId && points.map(key).join('|') === included().map(key).join('|');
    if (!await request('preview', points) || !current()) return;
    if (!result?.calibrationToken || !result.calibration?.profileBank?.length || !calibrationCurrent) {
      status.textContent = 'No usable star profiles · review the rejected references.'; return;
    }
    try { await jobs.start(result, { imageId: result.imageId, action: 'apply', calibrationToken: result.calibrationToken, points, controls: { ...controls }, options: { sampleCount: 30, maximumRadius: 128 } }); }
    catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
  });
  element('star-survey').addEventListener('click', () => void request('survey'));
  element('star-preview').addEventListener('click', () => { if (included().length) void request('preview', included()); });
  copy.addEventListener('click', async () => {
    if (!result || !context || !calibrationCurrent) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify({ schema: 'cssearth-star-sampling-recipe@1', imageId: context.imageId,
        sourceSha256: result.sourceSha256, nativeDimensions: result.nativeDimensions, points: included(), controls,
        calibration: result.calibration, scope: 'Local sample fits only; does not authorize or perform full-image subtraction or a 3D bake.' }, null, 2));
      status.textContent = 'Calibration copied.';
    } catch { status.textContent = 'Copy failed. Try again.'; }
  });
  return {
    setContext(next: Context | null) {
      if (context?.imageId === next?.imageId && context?.supported === next?.supported) return;
      save(); jobs.stop(); removalJob = null; delete host.dataset.removalJob; delete host.dataset.removalJobStatus; version++; removalSequence++; requestVersion++; pending?.abort(); pending = null; cancel.disabled = true; cancel.hidden = true; progress.hidden = true;
      context = next; result = null; references = []; missingPreviews.clear(); selected = null; pendingPoint = null; checks = []; showChecks = false; calibrationCurrent = false; controls = defaults(); workspace.hidden = true;
      element<HTMLButtonElement>('star-preview').disabled = true; copy.disabled = true; apply.disabled = true;
      host.dataset.imageId = next?.imageId ?? ''; delete host.dataset.samplingOperation; delete status.dataset.error;
      element<HTMLButtonElement>('star-survey').disabled = !next?.supported;
      if (!next) { status.textContent = 'Select an image to inspect its stars.'; return; }
      if (!next.supported) { status.textContent = 'Star sampling is available for VISTA, Horálek and WISE.'; return; }
      void request('overview').then(ready => { if (ready && context?.imageId === next.imageId && result) jobs.resume(result); });
    },
    destroy() { save(); jobs.stop(); version++; removalSequence++; requestVersion++; pending?.abort(); },
  };
}
