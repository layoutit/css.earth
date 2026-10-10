/** One image-layer object as the lab works on it: its recipe (edits write a working copy in the object's ignored
 * `.local/lab/`; Save writes its changes into the tracked recipe; Discard drops it), its jobs (a draft previews the
 * working copy, a full bake runs the site's preparation in place, a publish uploads), and
 * whether it is ready to ship. Jobs are server-owned and survive refresh. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isRecord } from '@cssearth/core';
import { activeCloudJob, readCloudJob, type CloudJob } from '../shape-cloud/shape-cloud-client';
import { localFile } from '../legacy-viewer/controller';
import { platesDirectory, type PlateQuality } from './plates-paths.ts';
import { readPlateBakeReceipt, type PlateBakeReceipt } from './plates-receipt.ts';
import { geometryRestore, geometryValues, type GeometryValues } from './plates-model.ts';

const DRAFT_DELAY_MS = 450, QUALITIES = ['draft', 'full', 'publish'] as const;
export interface RecipeChange { path: string; from: number; to: number }
interface RecipeState { recipe: unknown; working: boolean; changes: RecipeChange[] }
const readRecipeState = (value: unknown): RecipeState => {
  if (!isRecord(value) || !('recipe' in value) || !Array.isArray(value.changes)) throw new TypeError('Invalid recipe state.');
  return { recipe: value.recipe, working: value.working === true, changes: value.changes as RecipeChange[] };
};
export interface PlateStatus { recipeChanged: boolean; changed: string[]; host: string; inventory: { ok: boolean; message: string } }
type PerQuality<T> = Record<PlateQuality, T>;
const none = <T,>(value: T): PerQuality<T> => ({ draft: value, full: value, publish: value });

async function call(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  const response = await fetch(path, { cache: 'no-store', signal,
    ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(isRecord(value) && typeof value.error === 'string' ? value.error : `${path} failed (${response.status}).`);
  return value;
}
/** The dev server answers a missing file with its HTML shell, so only a JSON answer is a file. */
async function localJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(localFile(path), { cache: 'no-store', signal });
  return response.ok && response.headers.get('content-type')?.includes('json') ? response.json() : null;
}
const message = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
/** Each object's geometry numbers as the lab first loaded its recipe in this browser session (Reset geometry). */
const snapshots = new Map<string, GeometryValues>();
function snapshotOf(object: string, recipe: unknown): GeometryValues {
  const key = `nebula:plates:geometry-snapshot:${object}`;
  let saved = snapshots.get(object);
  if (!saved) try { const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null'); if (isRecord(stored)) saved = stored as GeometryValues; } catch { /* Memory only. */ }
  if (!saved) { saved = geometryValues(recipe); try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch { /* Memory only. */ } }
  snapshots.set(object, saved);
  return saved;
}
/** Slider drags write many numbers; edits to one field within this long count as one change to undo. */
const UNDO_MERGE_MS = 1500;

export function usePlates(object: string, onBaked: (receipt: PlateBakeReceipt) => void) {
  const storage = `nebula:plates:3:${object}`;
  const [recipe, setRecipe] = useState<unknown>(null), [status, setStatus] = useState<PlateStatus | null>(null);
  const [published, setPublished] = useState<{ ok: boolean; message: string } | 'checking' | null>(null);
  const [receipts, setReceipts] = useState<PerQuality<PlateBakeReceipt | null>>(none(null)), [jobs, setJobs] = useState<PerQuality<CloudJob | null>>(none(null));
  const [error, setError] = useState(''), [edits, setEdits] = useState(0), [changes, setChanges] = useState<RecipeChange[]>([]);
  const baked = useRef(onBaked); baked.current = onBaked;
  const live = useRef<{ signal: AbortSignal; start(quality: PlateQuality): void; cancel(quality: PlateQuality): void; refresh(): void } | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<unknown>(null); latest.current = recipe;
  const [snapshot, setSnapshot] = useState<GeometryValues>({});
  const history = useRef<{ path: string; previous: number; at: number }[]>([]), [undoable, setUndoable] = useState(0);
  useEffect(() => {
    const controller = new AbortController(), signal = controller.signal; let stopped = false;
    const active = none<string | null>(null), wanted = none(false);
    setRecipe(null); setChanges([]); setStatus(null); setPublished(null); setReceipts(none(null)); setJobs(none(null)); setError('');
    const remember = (quality: PlateQuality, id: string | null) => {
      active[quality] = id;
      try { if (id) localStorage.setItem(`${storage}:${quality}`, id); else localStorage.removeItem(`${storage}:${quality}`); } catch { /* Refresh will not reconnect. */ }
    };
    const refresh = () => { void call(`/__nebula/plate-status?object=${encodeURIComponent(object)}`, signal).then(value => { if (!stopped) setStatus(value as PlateStatus); }).catch(reason => { if (!stopped) setError(message(reason)); }); };
    const wait = () => new Promise<void>(accept => { const timer = setTimeout(accept, 300); signal.addEventListener('abort', () => { clearTimeout(timer); accept(); }, { once: true }); });
    async function follow(quality: PlateQuality, id: string) {
      try {
        let current = readCloudJob(await call(`/__nebula/plate-jobs/${id}`, signal), object);
        while (!stopped && active[quality] === id) {
          setJobs(previous => ({ ...previous, [quality]: current }));
          if (current.status === 'completed') {
            const receipt = readPlateBakeReceipt(current.result); remember(quality, null);
            setReceipts(previous => ({ ...previous, [quality]: receipt })); refresh(); baked.current(receipt); break;
          }
          if (!activeCloudJob(current)) { remember(quality, null); if (current.status !== 'cancelled') setError(current.error || `Plate ${quality} ${current.status}.`); break; }
          await wait(); if (stopped) return;
          current = readCloudJob(await call(`/__nebula/plate-jobs/${id}`, signal), object);
        }
      } catch (reason) { if (!stopped && active[quality] === id) { remember(quality, null); setError(message(reason)); } }
      // An edit made while a draft baked is baked next: only the latest waits.
      if (!stopped && !active[quality] && wanted[quality]) { wanted[quality] = false; start(quality); }
    }
    function start(quality: PlateQuality) {
      if (active[quality]) {
        wanted[quality] = true;
        if (quality === 'draft') void call(`/__nebula/plate-jobs/${active[quality]}/cancel`, signal, {}).catch(() => {});
        return;
      }
      const id = crypto.randomUUID(); remember(quality, id); setError('');
      void call('/__nebula/plate-jobs', signal, { requestId: id, request: { action: 'apply', imageId: object, object, quality } })
        .then(() => follow(quality, id)).catch(reason => { if (!stopped) { remember(quality, null); setError(message(reason)); } });
    }
    live.current = { signal, start, refresh, cancel(quality) { wanted[quality] = false; const id = active[quality]; if (id) void call(`/__nebula/plate-jobs/${id}/cancel`, signal, {}).catch(() => {}); } };
    void (async () => {
      try {
        const [state, draft] = await Promise.all([call('/__nebula/plate-recipe', signal, { object, read: true }).then(readRecipeState), localJson(`${platesDirectory(object)}/receipt.json`, signal)]);
        if (stopped) return;
        const value = state.recipe;
        setRecipe(value); setChanges(state.changes); setSnapshot(snapshotOf(object, value)); history.current = []; setUndoable(0);
        let receipt: PlateBakeReceipt | null = null;
        try { receipt = draft ? readPlateBakeReceipt(draft) : null; } catch { /* An older draft's receipt is not shown. */ }
        if (receipt) setReceipts(previous => ({ ...previous, draft: receipt }));
      } catch (reason) { if (!stopped) setError(message(reason)); }
      refresh();
      for (const quality of QUALITIES) {
        let id: string | null = null;
        try { id = localStorage.getItem(`${storage}:${quality}`); } catch { /* No saved job. */ }
        if (id && /^[a-f0-9-]{36}$/.test(id)) { active[quality] = id; void follow(quality, id); }
      }
    })();
    return () => { stopped = true; clearTimeout(draftTimer.current); controller.abort(); live.current = null; };
  }, [object, storage]);
  /** Writes geometry numbers into the working copy, then bakes a draft once the pointer settles. */
  const write = useCallback((body: { path: string; value: number } | { edits: { path: string; value: number }[] }) => {
    const current = live.current; if (!current) return Promise.resolve();
    return call('/__nebula/plate-recipe', current.signal, { object, ...body }).then(value => {
      const next = readRecipeState(value);
      setRecipe(next.recipe); setChanges(next.changes); setEdits(count => count + 1); current.refresh();
      clearTimeout(draftTimer.current); draftTimer.current = setTimeout(() => live.current?.start('draft'), DRAFT_DELAY_MS);
    }).catch(reason => setError(message(reason)));
  }, [object]);
  const edit = useCallback((path: string, value: number) => {
    const previous = geometryValues(latest.current)[path], last = history.current.at(-1), now = Date.now();
    if (previous !== undefined && previous !== value && !(last && last.path === path && now - last.at < UNDO_MERGE_MS)) history.current.push({ path, previous, at: now });
    else if (last && last.path === path) last.at = now;
    setUndoable(history.current.length);
    void write({ path, value });
  }, [write]);
  /** Puts back the last slider change. */
  const undo = useCallback(() => {
    const last = history.current.pop(); setUndoable(history.current.length);
    if (last) void write({ path: last.path, value: last.previous });
  }, [write]);
  /** Puts back only the geometry numbers the sliders edit: as first loaded this session, or as committed. Every other
   * key of the recipe stays as it is. */
  const resetGeometry = useCallback(async (to: 'session' | 'committed') => {
    const current = live.current; if (!current) return;
    try {
      const target = to === 'session' ? snapshot : geometryValues(await call('/__nebula/plate-recipe', current.signal, { object, committed: true }));
      const edits = geometryRestore(geometryValues(latest.current), target);
      history.current = []; setUndoable(0);
      if (edits.length) await write({ edits });
    } catch (reason) { setError(message(reason)); }
  }, [object, snapshot, write]);
  /** Drops the working copy: the recipe is the tracked one again. */
  const discard = useCallback(() => {
    const current = live.current; if (!current) return Promise.resolve();
    clearTimeout(draftTimer.current); current.cancel('draft'); history.current = []; setUndoable(0);
    return call('/__nebula/plate-recipe', current.signal, { object, discard: true }).then(value => { const next = readRecipeState(value); setRecipe(next.recipe); setChanges(next.changes); setEdits(0); current.refresh(); })
      .catch(reason => setError(message(reason)));
  }, [object]);
  /** Writes the working copy's changes into the tracked recipe. */
  const save = useCallback(() => {
    const current = live.current; if (!current) return Promise.resolve();
    return call('/__nebula/plate-recipe', current.signal, { object, save: true }).then(value => { const next = readRecipeState(value); setRecipe(next.recipe); setChanges(next.changes); history.current = []; setUndoable(0); current.refresh(); })
      .catch(reason => setError(message(reason)));
  }, [object]);
  const checkPublished = useCallback(() => {
    const current = live.current; if (!current) return;
    setPublished('checking');
    void call(`/__nebula/plate-published?object=${encodeURIComponent(object)}`, current.signal).then(value => setPublished(value as { ok: boolean; message: string }))
      .catch(reason => setPublished({ ok: false, message: message(reason) }));
  }, [object]);
  return { recipe, changes, status, published, receipts, jobs, error, edits, edit, discard, save, checkPublished, snapshot, undo, undoable, resetGeometry,
    busy: { draft: activeCloudJob(jobs.draft), full: activeCloudJob(jobs.full), publish: activeCloudJob(jobs.publish) },
    start: (quality: PlateQuality) => live.current?.start(quality), cancel: (quality: PlateQuality) => live.current?.cancel(quality) };
}
