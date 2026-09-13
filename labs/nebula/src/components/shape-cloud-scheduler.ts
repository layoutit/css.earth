/** One active preparation plus one replaceable latest request. Drafts are throttled, not trailing-only debounced. */
export type PreviewQuality = 'draft' | 'detailed';
export interface PreviewTicket<T> { value: T; key: string; quality: PreviewQuality; revision: number }
export interface PreviewClock { now(): number; set(callback: () => void, delay: number): unknown; clear(handle: unknown): void }
const clock: PreviewClock = { now: Date.now, set: (callback, delay) => setTimeout(callback, delay), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };
export function createShapeCloudScheduler<T, Result>(options: {
  value: T; key(value: T): string;
  run(ticket: PreviewTicket<T>): Promise<Result>;
  cancel(ticket: PreviewTicket<T>): void;
  accept(result: Result, ticket: PreviewTicket<T>): void | boolean;
  error(reason: unknown): void;
  clock?: PreviewClock; throttleMs?: number; settleMs?: number; initiallyDragging?: boolean;
}) {
  const time = options.clock ?? clock, throttle = options.throttleMs ?? 250, settleDelay = options.settleMs ?? 650;
  let latest = options.value, revision = 0, settled = !options.initiallyDragging, dragging = Boolean(options.initiallyDragging), disposed = false, failed = false;
  let active: PreviewTicket<T> | null = null, cancelled = false, lastDraft = -Infinity;
  let acceptedKey = '', acceptedQuality: PreviewQuality | '' = '', acceptedRevision = -1;
  let throttleTimer: unknown, idleTimer: unknown;
  function clearTimers() { if (throttleTimer !== undefined) time.clear(throttleTimer); if (idleTimer !== undefined) time.clear(idleTimer); throttleTimer = idleTimer = undefined; }
  function launch(ticket: PreviewTicket<T>, task: () => Promise<Result>) {
    active = ticket; cancelled = false; if (ticket.quality === 'draft') lastDraft = time.now();
    void task().then(result => {
      if (disposed || cancelled) return;
      // Drafts may trail the drag. A final for an obsolete edit must never replace newer intent.
      if (ticket.revision >= acceptedRevision && (ticket.quality === 'draft' || ticket.key === options.key(latest))) {
        if (options.accept(result, ticket) !== false) { acceptedKey = ticket.key; acceptedQuality = ticket.quality; acceptedRevision = ticket.revision; }
      }
    }).catch(reason => { if (!disposed && !cancelled) { failed = true; options.error(reason); } })
      .finally(() => { active = null; cancelled = false; pump(); });
  }
  function pump() {
    if (disposed || failed || active) return;
    const key = options.key(latest), quality = settled ? 'detailed' : 'draft';
    if (acceptedKey === key && (acceptedQuality === 'detailed' || quality === 'draft')) return;
    const wait = quality === 'draft' ? throttle - (time.now() - lastDraft) : 0;
    if (wait > 0) {
      if (throttleTimer === undefined) throttleTimer = time.set(() => { throttleTimer = undefined; pump(); }, wait);
      return;
    }
    const ticket: PreviewTicket<T> = { value: latest, key, quality, revision };
    launch(ticket, () => options.run(ticket));
  }
  function settle() {
    if (disposed) return;
    dragging = false; settled = true;
    if (idleTimer !== undefined) time.clear(idleTimer); idleTimer = undefined;
    if (throttleTimer !== undefined) time.clear(throttleTimer); throttleTimer = undefined;
    pump();
  }
  function edit(value: T, immediate = false) {
    if (disposed) return;
    if (options.key(value) === options.key(latest)) { if (immediate) settle(); return; }
    latest = value; revision++; settled = immediate; failed = false;
    if (active?.quality === 'detailed' && !cancelled) { cancelled = true; options.cancel(active); }
    if (idleTimer !== undefined) time.clear(idleTimer);
    idleTimer = !immediate && !dragging ? time.set(settle, settleDelay) : undefined;
    pump();
  }
  return {
    start: pump, edit, settle,
    begin() { dragging = true; if (idleTimer !== undefined) time.clear(idleTimer); idleTimer = undefined; },
    seed(value: T, quality: PreviewQuality) { acceptedKey = options.key(value); acceptedQuality = quality; acceptedRevision = revision; },
    resume(value: T, quality: PreviewQuality, task: () => Promise<Result>) {
      if (active || disposed) throw new Error('Only one cloud preview job may be observed at a time.');
      launch({ value, key: options.key(value), quality, revision: -1 }, task);
    },
    retry() { failed = false; settled = true; pump(); },
    dispose() { disposed = true; clearTimers(); },
  };
}
