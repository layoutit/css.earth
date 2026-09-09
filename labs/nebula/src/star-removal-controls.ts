import { createStarRemovalJobs, removalJobActive, type RemovalJob } from './star-removal-jobs';
import type { RemovalProgress, StarRemovalResult } from './star-removal-types';

interface Context { imageId: string; label: string; }

/** Small crop previews are optional; full removal belongs to the durable server job. */
export function createStarRemovalControls(host: HTMLElement, options: {
  onApply(result: StarRemovalResult, isCurrent: () => boolean): Promise<void | boolean>;
}) {
  host.innerHTML = `<section class="automatic-star-removal">
    <div class="removal-actions">
      <button id="star-quick-preview" type="button" title="Inspect native crops without processing the whole image.">Quick preview</button>
      <button id="star-remove" type="button" title="Run NOX on the full image. Processing survives refresh; the 3D reconstruction stays unchanged.">Remove stars</button>
      <button id="star-removal-cancel" type="button" hidden>Cancel</button>
    </div>
    <p id="star-removal-status" class="removal-status" role="status" aria-live="polite"></p>
    <progress id="star-removal-progress" aria-label="Star removal progress" hidden></progress>
    <section id="star-removal-preview" aria-label="NOX crop comparison" hidden>
      <div class="removal-preview-navigation">
        <button id="star-preview-previous" type="button" aria-label="Previous crop">←</button>
        <output id="star-preview-position" aria-live="polite"></output>
        <button id="star-preview-next" type="button" aria-label="Next crop">→</button>
        <button id="star-preview-mask" type="button" aria-pressed="false" title="Show the image-based removal mask. This is not a physical stellar catalogue.">Mask</button>
      </div>
      <div class="removal-preview-images" title="NOX predicts the background from the image; compact nebula detail may also change.">
        <figure><img id="star-preview-original" alt="Original native image crop" /><figcaption>Original</figcaption></figure>
        <figure><img id="star-preview-result" alt="NOX crop result" /><figcaption id="star-preview-caption">Without stars</figcaption></figure>
      </div>
    </section>
  </section>`;
  const element = <T extends HTMLElement>(id: string) => host.querySelector<T>(`#${id}`)!;
  const preview = element<HTMLButtonElement>('star-quick-preview'), remove = element<HTMLButtonElement>('star-remove');
  const cancel = element<HTMLButtonElement>('star-removal-cancel'), progress = element<HTMLProgressElement>('star-removal-progress');
  const status = element('star-removal-status'), comparison = element('star-removal-preview');
  const previous = element<HTMLButtonElement>('star-preview-previous'), next = element<HTMLButtonElement>('star-preview-next');
  const mask = element<HTMLButtonElement>('star-preview-mask');
  let context: Context | null = null, result: StarRemovalResult | null = null, job: RemovalJob | null = null;
  let version = 0, pending: AbortController | null = null, installing = false, index = 0, showMask = false;

  function message(text: string, error = false) { status.textContent = text; status.dataset.error = String(error); }
  function updateProgress(value?: Partial<RemovalProgress>) {
    if (value?.total && Number.isFinite(value.current)) { progress.max = value.total; progress.value = value.current!; }
    else progress.removeAttribute('value');
    if (value?.message) message(`${value.message}${value.total ? ` (${value.current ?? 0}/${value.total})` : ''}`);
  }
  function render() {
    const running = removalJobActive(job), blocked = Boolean(pending) || installing || running;
    preview.disabled = remove.disabled = !context || blocked;
    cancel.hidden = !pending && !running; cancel.disabled = installing;
    progress.hidden = !pending && !running && !installing;
    const crops = result?.previews ?? [], crop = crops[index];
    comparison.hidden = !crop; previous.disabled = next.disabled = crops.length < 2;
    if (!crop) return;
    element('star-preview-position').textContent = `${index + 1} / ${crops.length}`;
    mask.setAttribute('aria-pressed', String(showMask));
    const original = element<HTMLImageElement>('star-preview-original'), output = element<HTMLImageElement>('star-preview-result');
    const outputUrl = showMask ? crop.mask : crop.removed;
    if (original.getAttribute('src') !== crop.source) original.src = crop.source;
    if (output.getAttribute('src') !== outputUrl) output.src = outputUrl;
    original.width = output.width = crop.width; original.height = output.height = crop.height;
    output.alt = showMask ? 'NOX removal mask' : 'NOX crop result';
    element('star-preview-caption').textContent = showMask ? 'Mask' : 'Without stars';
    host.dataset.previewId = crop.id;
  }
  const jobs = createStarRemovalJobs({
    onState(value) {
      if (context?.imageId !== value.imageId) return;
      job = value; host.dataset.removalJob = value.id; host.dataset.removalJobStatus = value.status;
      updateProgress(value.progress);
      message(value.error ?? (removalJobActive(value) ? value.progress?.message ??
        (value.status === 'queued' ? 'Removal queued…' : value.status === 'cancelling' ? 'Cancelling…' : 'Removing stars…') :
        value.status === 'completed' ? 'Removal complete.' : `Removal ${value.status}.`), Boolean(value.error));
      render();
    },
    async onComplete(completed, isCurrent) {
      installing = true; render();
      try {
        const installed = await options.onApply(completed, isCurrent);
        if (isCurrent() && installed !== false) { message('Image updated.'); host.dataset.removalOperation = 'apply'; }
        return installed;
      } finally { if (isCurrent()) { installing = false; render(); } }
    },
  });
  async function readResponse(response: Response, current: () => boolean): Promise<StarRemovalResult> {
    if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? `NOX request failed (HTTP ${response.status}).`);
      return value;
    }
    if (!response.body) throw new Error('Removal progress is unavailable.');
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', completed: StarRemovalResult | null = null;
    const consume = (line: string) => {
      if (!line.trim() || !current()) return;
      const event = JSON.parse(line);
      if (event.type === 'progress') updateProgress(event);
      else if (event.type === 'result') completed = event.result;
      else if (event.type === 'error') throw new Error(event.message ?? 'NOX preparation failed.');
    };
    try {
      while (true) {
        const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        let end = buffer.indexOf('\n');
        while (end >= 0) { consume(buffer.slice(0, end)); buffer = buffer.slice(end + 1); end = buffer.indexOf('\n'); }
        if (chunk.done) break;
      }
      consume(buffer);
    } finally { reader.releaseLock(); }
    if (!completed) throw new Error('NOX preparation ended without a result.');
    return completed;
  }
  async function request(action: 'overview' | 'preview') {
    if (!context) return false;
    pending?.abort(); const owner = ++version, imageId = context.imageId;
    const controller = new AbortController(); pending = controller;
    const current = () => owner === version && context?.imageId === imageId && !controller.signal.aborted;
    message(action === 'overview' ? 'Loading source…' : 'Preparing quick preview…'); updateProgress(); render();
    try {
      const response = await fetch('/__nebula/star-removal', { method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' }, body: JSON.stringify({ imageId, action }) });
      const value = await readResponse(response, current); if (!current()) return false;
      if (value.schema !== 'cssearth-star-removal-result@1' || value.method !== 'nox' || value.imageId !== imageId || value.operation !== action ||
        !/^[a-f0-9]{64}$/.test(value.sourceSha256) || !/^[a-f0-9]{64}$/.test(value.sourcePreviewSha256) ||
        !Array.isArray(value.nativeDimensions) || value.nativeDimensions.length !== 2 || value.nativeDimensions.some(n => !Number.isInteger(n) || n < 1))
        throw new TypeError('NOX returned an invalid source identity.');
      if (result && (result.sourceSha256 !== value.sourceSha256 || result.sourcePreviewSha256 !== value.sourcePreviewSha256 || result.nativeDimensions.join() !== value.nativeDimensions.join()))
        throw new TypeError('The source changed. Reselect the image before processing.');
      if (action === 'preview' && (!value.previews?.length || value.previews.some(crop => !crop.source || !crop.removed || !crop.mask || !Number.isInteger(crop.width) || !Number.isInteger(crop.height))))
        throw new TypeError('NOX returned no valid crop previews.');
      result = value; index = 0; host.dataset.removalOperation = action;
      message(action === 'preview' ? 'Preview ready.' : '');
      if (action === 'overview') jobs.resume(value);
      return true;
    } catch (error) {
      if (current()) message(error instanceof Error ? error.message : String(error), true);
      return false;
    } finally { if (owner === version) { pending = null; render(); } }
  }
  preview.addEventListener('click', () => { if (!removalJobActive(job)) void request('preview'); });
  remove.addEventListener('click', () => {
    if (!context || pending || installing || removalJobActive(job)) return;
    void (async () => {
      if (!result && !await request('overview')) return;
      if (!result || !context || result.imageId !== context.imageId || removalJobActive(job)) return;
      try { await jobs.start(result, { imageId: context.imageId, action: 'apply' }); }
      catch (error) { message(error instanceof Error ? error.message : String(error), true); render(); }
    })();
  });
  cancel.addEventListener('click', () => {
    if (removalJobActive(job)) { void jobs.cancel(); return; }
    version++; pending?.abort(); pending = null; message('Preview cancelled.'); render();
  });
  previous.addEventListener('click', () => { const count = result?.previews?.length ?? 0; if (count) { index = (index + count - 1) % count; render(); } });
  next.addEventListener('click', () => { const count = result?.previews?.length ?? 0; if (count) { index = (index + 1) % count; render(); } });
  mask.addEventListener('click', () => { showMask = !showMask; render(); });
  for (const id of ['star-preview-original', 'star-preview-result']) element(id).addEventListener('error', () => message('Crop unavailable · run Quick preview again.', true));
  render();
  return {
    setContext(value: Context | null) {
      if (context?.imageId === value?.imageId) return;
      version++; pending?.abort(); pending = null; jobs.stop(); context = value; result = null; job = null; installing = false; index = 0; showMask = false;
      delete host.dataset.removalJob; delete host.dataset.removalJobStatus; delete host.dataset.removalOperation; delete host.dataset.previewId;
      host.hidden = !value; render();
      if (value) void request('overview');
      else message('');
    },
    destroy() { version++; pending?.abort(); jobs.stop(); },
  };
}
