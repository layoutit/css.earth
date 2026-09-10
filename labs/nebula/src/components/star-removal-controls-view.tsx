import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createStarRemovalJobs, removalJobActive, type RemovalJob } from '../star-removal/star-removal-jobs';
import type { RemovalProgress, StarRemovalResult } from '../star-removal/star-removal-types';

interface Context { imageId: string; label: string; }
interface Options { onApply(result: StarRemovalResult, isCurrent: () => boolean): Promise<void | boolean>; }
interface Controls { setContext(context: Context | null): void; }
interface State {
  context: Context | null; result: StarRemovalResult | null; job: RemovalJob | null;
  pending: boolean; installing: boolean; index: number; showMask: boolean;
  message: string; error: boolean; progress?: Partial<RemovalProgress>; operation?: string;
}
const initial = (): State => ({ context: null, result: null, job: null, pending: false, installing: false,
  index: 0, showMask: false, message: '', error: false });

async function readResponse(response: Response, current: () => boolean, progress: (p: Partial<RemovalProgress>) => void): Promise<StarRemovalResult> {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? `NOX request failed (HTTP ${response.status}).`);
    return value;
  }
  if (!response.body) throw new Error('Removal progress is unavailable.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', completed: StarRemovalResult | null = null;
  const consume = (line: string) => {
    if (!line.trim() || !current()) return;
    const event = JSON.parse(line);
    if (event.type === 'progress') progress(event);
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

/** React owns markup/state; unmounting only detaches the observer from durable full-image work. */
export const StarRemovalControls = forwardRef<Controls, Options & { host: HTMLElement }>(function StarRemovalControls({ host, onApply }, ref) {
  const [state, setState] = useState(initial);
  const latest = useRef(state), version = useRef(0), pending = useRef<AbortController | null>(null);
  const apply = useRef(onApply); apply.current = onApply;
  const jobsRef = useRef<ReturnType<typeof createStarRemovalJobs> | null>(null);
  // Mirror committed intent for asynchronous handlers; rendered output always comes from React state.
  const patch = (value: Partial<State>) => { latest.current = { ...latest.current, ...value }; setState(latest.current); };
  const message = (text: string, error = false) => patch({ message: text, error });
  const updateProgress = (progress?: Partial<RemovalProgress>) => {
    patch({ progress });
    if (progress?.message) message(`${progress.message}${progress.total ? ` (${progress.current ?? 0}/${progress.total})` : ''}`);
  };
  if (!jobsRef.current) jobsRef.current = createStarRemovalJobs({
    onState(job) {
      if (latest.current.context?.imageId !== job.imageId) return;
      patch({ job }); updateProgress(job.progress);
      message(job.error ?? (removalJobActive(job) ? job.progress?.message ??
        (job.status === 'queued' ? 'Removal queued…' : job.status === 'cancelling' ? 'Cancelling…' : 'Removing stars…') :
        job.status === 'completed' ? 'Removal complete.' : `Removal ${job.status}.`), Boolean(job.error));
    },
    async onComplete(completed, isCurrent) {
      patch({ installing: true });
      try {
        const installed = await apply.current(completed, isCurrent);
        if (isCurrent() && installed !== false) patch({ message: 'Image updated.', error: false, operation: 'apply' });
        return installed;
      } finally { if (isCurrent()) patch({ installing: false }); }
    },
  });
  const jobs = jobsRef.current;
  useEffect(() => () => { version.current++; pending.current?.abort(); jobs.stop(); }, [jobs]);
  const crops = state.result?.previews ?? [], crop = crops[state.index];
  useLayoutEffect(() => {
    host.hidden = !state.context;
    for (const [key, value] of Object.entries({ removalJob: state.job?.id, removalJobStatus: state.job?.status,
      removalOperation: state.operation, previewId: crop?.id })) {
      if (value === undefined) delete host.dataset[key]; else host.dataset[key] = value;
    }
  }, [host, state.context, state.job, state.operation, crop]);

  async function request(action: 'overview' | 'preview') {
    if (!latest.current.context) return false;
    pending.current?.abort(); const owner = ++version.current, imageId = latest.current.context.imageId;
    const controller = new AbortController(); pending.current = controller;
    const current = () => owner === version.current && latest.current.context?.imageId === imageId && !controller.signal.aborted;
    patch({ pending: true, progress: undefined }); message(action === 'overview' ? 'Loading source…' : 'Preparing quick preview…');
    try {
      const response = await fetch('/__nebula/star-removal', { method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' }, body: JSON.stringify({ imageId, action }) });
      const value = await readResponse(response, current, updateProgress); if (!current()) return false;
      if (value.schema !== 'cssearth-star-removal-result@1' || value.method !== 'nox' || value.imageId !== imageId || value.operation !== action ||
        !/^[a-f0-9]{64}$/.test(value.sourceSha256) || !/^[a-f0-9]{64}$/.test(value.sourcePreviewSha256) ||
        !Array.isArray(value.nativeDimensions) || value.nativeDimensions.length !== 2 || value.nativeDimensions.some(n => !Number.isInteger(n) || n < 1))
        throw new TypeError('NOX returned an invalid source identity.');
      const previous = latest.current.result;
      if (previous && (previous.sourceSha256 !== value.sourceSha256 || previous.sourcePreviewSha256 !== value.sourcePreviewSha256 || previous.nativeDimensions.join() !== value.nativeDimensions.join()))
        throw new TypeError('The source changed. Reselect the image before processing.');
      if (action === 'preview' && (!value.previews?.length || value.previews.some(crop => !crop.source || !crop.removed || !crop.mask || !Number.isInteger(crop.width) || !Number.isInteger(crop.height))))
        throw new TypeError('NOX returned no valid crop previews.');
      patch({ result: value, index: 0, operation: action }); message(action === 'preview' ? 'Preview ready.' : '');
      if (action === 'overview') jobs.resume(value);
      return true;
    } catch (error) {
      if (current()) message(error instanceof Error ? error.message : String(error), true);
      return false;
    } finally { if (owner === version.current) { pending.current = null; patch({ pending: false }); } }
  }
  useImperativeHandle(ref, () => ({ setContext(context) {
    if (latest.current.context?.imageId === context?.imageId) return;
    version.current++; pending.current?.abort(); pending.current = null; jobs.stop();
    latest.current = { ...initial(), context }; setState(latest.current);
    if (context) void request('overview');
  } }));
  async function remove() {
    const current = latest.current;
    if (!current.context || pending.current || current.installing || removalJobActive(current.job)) return;
    if (!current.result && !await request('overview')) return;
    const { result, context, job } = latest.current;
    if (!result || !context || result.imageId !== context.imageId || removalJobActive(job)) return;
    try { await jobs.start(result, { imageId: context.imageId, action: 'apply' }); }
    catch (error) { message(error instanceof Error ? error.message : String(error), true); }
  }
  function cancel() {
    if (removalJobActive(latest.current.job)) { void jobs.cancel(); return; }
    version.current++; pending.current?.abort(); pending.current = null; patch({ pending: false }); message('Preview cancelled.');
  }
  const running = removalJobActive(state.job), blocked = state.pending || state.installing || running;
  const imageError = () => message('Crop unavailable · run Quick preview again.', true);
  return <section className="automatic-star-removal">
    <div className="removal-actions">
      <button id="star-quick-preview" type="button" disabled={!state.context || blocked} title="Inspect native crops without processing the whole image."
        onClick={() => { if (!removalJobActive(latest.current.job)) void request('preview'); }}>Quick preview</button>
      <button id="star-remove" type="button" disabled={!state.context || blocked} onClick={() => void remove()}
        title="Run NOX on the full image. Processing survives refresh; the 3D reconstruction stays unchanged.">Remove stars</button>
      <button id="star-removal-cancel" type="button" hidden={!state.pending && !running} disabled={state.installing} onClick={cancel}>Cancel</button>
    </div>
    <p id="star-removal-status" className="removal-status" role="status" aria-live="polite" data-error={String(state.error)}>{state.message}</p>
    <progress id="star-removal-progress" aria-label="Star removal progress" hidden={!state.pending && !running && !state.installing}
      max={state.progress?.total || 1} value={state.progress?.total && Number.isFinite(state.progress.current) ? state.progress.current : undefined} />
    <section id="star-removal-preview" aria-label="NOX crop comparison" hidden={!crop}>
      <div className="removal-preview-navigation">
        <button id="star-preview-previous" type="button" aria-label="Previous crop" disabled={crops.length < 2}
          onClick={() => patch({ index: (state.index + crops.length - 1) % crops.length })}>←</button>
        <output id="star-preview-position" aria-live="polite">{crop ? `${state.index + 1} / ${crops.length}` : ''}</output>
        <button id="star-preview-next" type="button" aria-label="Next crop" disabled={crops.length < 2}
          onClick={() => patch({ index: (state.index + 1) % crops.length })}>→</button>
        <button id="star-preview-mask" type="button" aria-pressed={state.showMask} onClick={() => patch({ showMask: !state.showMask })}
          title="Show the image-based removal mask. This is not a physical stellar catalogue.">Mask</button>
      </div>
      <div className="removal-preview-images" title="NOX predicts the background from the image; compact nebula detail may also change.">
        <figure><img id="star-preview-original" src={crop?.source} width={crop?.width} height={crop?.height} alt="Original native image crop" onError={imageError} /><figcaption>Original</figcaption></figure>
        <figure><img id="star-preview-result" src={crop ? state.showMask ? crop.mask : crop.removed : undefined} width={crop?.width} height={crop?.height}
          alt={state.showMask ? 'NOX removal mask' : 'NOX crop result'} onError={imageError} /><figcaption id="star-preview-caption">{state.showMask ? 'Mask' : 'Without stars'}</figcaption></figure>
      </div>
    </section>
  </section>;
});

/** Stable adapter for the plain TypeScript renderer/application integration. */
export function createStarRemovalControls(host: HTMLElement, options: Options) {
  const root = createRoot(host);
  let controls: Controls | null = null, queued: Context | null = null, hasQueued = false, destroyed = false;
  const attach = (value: Controls | null) => {
    controls = value;
    if (value && hasQueued && !destroyed) { hasQueued = false; value.setContext(queued); }
  };
  root.render(<StarRemovalControls host={host} ref={attach} {...options} />);
  return { setContext(context: Context | null) {
    if (destroyed) return;
    if (controls) controls.setContext(context); else { queued = context; hasQueued = true; }
  }, destroy() {
    if (destroyed) return;
    destroyed = true; controls?.setContext(null); queueMicrotask(() => root.unmount());
  } };
}
